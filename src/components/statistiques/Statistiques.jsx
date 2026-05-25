import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, CheckCircle, TrendingDown, Activity, Truck } from 'lucide-react';
import { getFactures, getDepenses, getClients, getVoyages, formatCurrency, formatDate } from '../../data/store';
import { useApp } from '../../context/AppContext';

export default function Statistiques() {
  const [allFactures, setAllFactures] = useState([]);
  const [allDepenses, setAllDepenses] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [allVoyages, setAllVoyages] = useState([]);
  const [filterMois, setFilterMois] = useState('');
  const [filterAnnee, setFilterAnnee] = useState('');
  const [loading, setLoading] = useState(true);
  const { devise, refresh } = useApp();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [facs, deps, clis, voys] = await Promise.all([
          getFactures(),
          getDepenses(),
          getClients(),
          getVoyages()
        ]);
        setAllFactures(facs);
        setAllDepenses(deps);
        setAllClients(clis);
        setAllVoyages(voys);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, [refresh]);

  if (loading) return <div className="page-enter" style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>;

  // Filter lists by month and year dynamically
  const filteredFactures = allFactures.filter(f => {
    if (!f.createdAt) return true;
    const d = new Date(f.createdAt);
    if (filterMois && d.getMonth() !== parseInt(filterMois)) return false;
    if (filterAnnee && d.getFullYear() !== parseInt(filterAnnee)) return false;
    return true;
  });

  const filteredDepenses = allDepenses.filter(dep => {
    if (!dep.createdAt) return true;
    const d = new Date(dep.createdAt);
    if (filterMois && d.getMonth() !== parseInt(filterMois)) return false;
    if (filterAnnee && d.getFullYear() !== parseInt(filterAnnee)) return false;
    return true;
  });

  // Calculate dynamic stats
  const totalCA = filteredFactures.reduce((s, f) => s + Number(f.montantTotal || 0), 0);
  const totalPaye = filteredFactures.reduce((s, f) => s + Number(f.montantPaye || 0), 0);
  const totalDepenses = filteredDepenses.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
  const beneficeNet = totalPaye - totalDepenses;

  const facturesPaye = filteredFactures.filter(f => f.statut === 'paye').length;
  const facturesPartiel = filteredFactures.filter(f => f.statut === 'partiel').length;
  const facturesImpaye = filteredFactures.filter(f => f.statut === 'non_paye').length;

  const pieData = [
    { name: 'Payées',     value: facturesPaye,    color: '#22c55e' },
    { name: 'Partielles', value: facturesPartiel, color: '#f59e0b' },
    { name: 'Impayées',   value: facturesImpaye,  color: '#ef4444' },
  ].filter(d => d.value > 0);

  const kpis = [
    { label: "Chiffre d'affaires",  val: formatCurrency(totalCA,        devise), Icon: TrendingUp,   color: 'var(--brand)',   bg: 'var(--brand-muted)'   },
    { label: 'Encaissé',            val: formatCurrency(totalPaye,       devise), Icon: CheckCircle,  color: 'var(--success)', bg: 'var(--success-muted)' },
    { label: 'Dépenses totales',    val: formatCurrency(totalDepenses,   devise), Icon: TrendingDown, color: 'var(--danger)',  bg: 'var(--danger-muted)'  },
    { label: 'Bénéfice net',        val: formatCurrency(beneficeNet,     devise), Icon: Activity,     color: 'var(--purple)',  bg: 'var(--purple-muted)'  },
  ];

  const tooltipStyle = {
    contentStyle: {
      background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
      borderRadius: 10, color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-md)',
    },
    labelStyle: { color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12 },
  };

  // Compile monthly chart data
  const monthly = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly[key] = { mois: d.toLocaleDateString('fr-FR', { month: 'short' }), ca: 0, paye: 0 };
  }
  filteredFactures.forEach(f => {
    if (!f.createdAt) return;
    const d = new Date(f.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthly[key]) {
      monthly[key].ca += Number(f.montantTotal || 0);
      monthly[key].paye += Number(f.montantPaye || 0);
    }
  });

  const chartMonthlyData = Object.values(monthly);

  // Compile dynamic voyage profitability stats
  const computedVoyageStats = allVoyages.map(v => {
    const facs = filteredFactures.filter(f => f.voyageId === v.id);
    const deps = filteredDepenses.filter(d => d.voyageId === v.id);
    const totalEncaisse = facs.reduce((s, f) => s + Number(f.montantPaye || 0), 0);
    const totalDepenses = deps.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
    return {
      ...v,
      totalEncaisse,
      totalDepenses,
      benefice: totalEncaisse - totalDepenses,
      nbFactures: facs.length
    };
  }).filter(v => v.nbFactures > 0 || v.totalDepenses > 0);

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Statistiques</h1>
          <p className="page-subtitle">Analyse détaillée de votre activité</p>
        </div>
        
        {/* Dynamic Month/Year Filters */}
        <div className="flex gap-3 flex-wrap">
          <select className="form-input form-select" style={{ flex: '1 1 140px' }} value={filterMois} onChange={e => setFilterMois(e.target.value)}>
            <option value="">Tous les mois</option>
            {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select className="form-input form-select" style={{ flex: '1 1 120px' }} value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}>
            <option value="">Toutes les années</option>
            {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <div
            key={i}
            className="kpi-card"
            style={{ '--kpi-color': k.color, '--kpi-bg': k.bg, animationDelay: `${i * 0.07}s` }}
          >
            <div className="kpi-icon-wrap">
              <k.Icon size={20} strokeWidth={1.8} />
            </div>
            <div className="kpi-info">
              <div className="kpi-value">{k.val}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ gap: 20 }}>
        {/* Bar Chart */}
        <div className="card">
          <div className="card-header">
            <h3>Évolution mensuelle</h3>
            <span className="badge badge-brand">6 mois</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartMonthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="mois" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={v => [formatCurrency(v, devise), '']} />
              <Bar dataKey="ca"   name="CA total" fill="#6366f1" radius={[4,4,0,0]} opacity={0.85} />
              <Bar dataKey="paye" name="Encaissé" fill="#22c55e" radius={[4,4,0,0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} iconType="circle" iconSize={7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="card">
          <div className="card-header">
            <h3>Répartition des factures</h3>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ ...tooltipStyle.contentStyle }}
                  formatter={(v, n) => [v + ' facture(s)', n]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-title">Aucune donnée</div>
            </div>
          )}
        </div>
      </div>

      {/* Voyage Performance */}
      {computedVoyageStats.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h3>Rentabilité par voyage</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={computedVoyageStats.map(v => ({ name: v.nom, Encaissé: v.totalEncaisse, Dépenses: v.totalDepenses, Bénéfice: v.benefice }))}
                margin={{ top: 5, right: 5, left: -10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} angle={-15} textAnchor="end" axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={v => [formatCurrency(v, devise), '']} />
                <Bar dataKey="Encaissé" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="Dépenses" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="Bénéfice" fill="#6366f1" radius={[4,4,0,0]} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} iconType="circle" iconSize={7} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Voyage Table */}
          <div className="card" style={{ marginTop: 20, padding: 0 }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Détail par voyage</h3>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Voyage</th>
                    <th>Date</th>
                    <th>Factures</th>
                    <th>Encaissé</th>
                    <th>Dépenses</th>
                    <th>Bénéfice</th>
                    <th>Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {computedVoyageStats.map(v => {
                    const marge = v.totalEncaisse > 0 ? Math.round(v.benefice / v.totalEncaisse * 100) : 0;
                    return (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>
                          <div className="flex items-center gap-2">
                            <Truck size={14} style={{ color: 'var(--info)' }} />
                            {v.nom}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.dateDepart}</td>
                        <td><span className="badge badge-info">{v.nbFactures}</span></td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(v.totalEncaisse, devise)}</td>
                        <td style={{ color: 'var(--danger)',  fontWeight: 600 }}>{formatCurrency(v.totalDepenses, devise)}</td>
                        <td style={{ color: v.benefice >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{formatCurrency(v.benefice, devise)}</td>
                        <td>
                          <span className={`badge ${marge >= 0 ? 'badge-success' : 'badge-danger'}`}>{marge}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
