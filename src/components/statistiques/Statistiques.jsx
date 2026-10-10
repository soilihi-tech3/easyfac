import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, CheckCircle, TrendingDown, Activity, Truck, User, Weight, FileText, ShoppingBag } from 'lucide-react';
import { getFactures, getDepenses, getClients, getVoyages, formatCurrency, formatDate, API_URL } from '../../data/store';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export default function Statistiques() {
  const [allFactures, setAllFactures] = useState([]);
  const [allDepenses, setAllDepenses] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [allVoyages, setAllVoyages] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  const [filterMois, setFilterMois] = useState('');
  const [filterAnnee, setFilterAnnee] = useState(String(new Date().getFullYear()));
  const [filterVoyage, setFilterVoyage] = useState('');
  const [filterEmploye, setFilterEmploye] = useState('');

  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const { devise, refresh } = useApp();
  const { token, user } = useAuth();

  const formatVoyageLabel = (v) => {
    if (!v) return '';
    const dateStr = v.dateDepart ? formatDate(v.dateDepart) : '';
    return dateStr ? `${v.nom} (${dateStr})` : v.nom;
  };

  useEffect(() => {
    const load = async () => {
      if (isFirstLoad) setLoading(true);
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

        if (token) {
          try {
            const res = await fetch(`${API_URL}/api/users`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
              const usersData = await res.json();
              setAllUsers(usersData);
            }
          } catch (e) {
            console.error(e);
          }
        }
        setIsFirstLoad(false);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, [refresh, isFirstLoad, token]);

  if (loading) return <div className="page-enter" style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>;

  // Filter lists dynamically by month, year, voyage, and employee
  const activeEmployeFilter = user?.role === 'employee' ? user.id : filterEmploye;

  const filteredFactures = allFactures.filter(f => {
    if (filterVoyage && f.voyageId !== filterVoyage) return false;
    if (activeEmployeFilter) {
      const matchId = f.creeParId === activeEmployeFilter || f.creePar?.id === activeEmployeFilter || f.userId === activeEmployeFilter;
      const selectedUserObj = allUsers.find(u => u.id === activeEmployeFilter);
      let matchName = false;
      if (selectedUserObj && f.creePar) {
        const creatorName = `${f.creePar.prenom || ''} ${f.creePar.nom || ''}`.trim().toLowerCase();
        const empName = `${selectedUserObj.prenom || ''} ${selectedUserObj.nom || ''}`.trim().toLowerCase();
        if (creatorName && empName && creatorName === empName) matchName = true;
      }
      
      const hasCollectedPayment = f.paiements && f.paiements.some(p => p.userId === activeEmployeFilter);
      if (!matchId && !matchName && !hasCollectedPayment) return false;
    }
    if (f.createdAt) {
      const d = new Date(f.createdAt);
      if (filterMois !== '' && d.getMonth() !== parseInt(filterMois)) return false;
      if (filterAnnee !== '' && d.getFullYear() !== parseInt(filterAnnee)) return false;
    }
    return true;
  });

  const filteredDepenses = allDepenses.filter(dep => {
    if (filterVoyage && dep.voyageId !== filterVoyage) return false;
    if (activeEmployeFilter) {
      const matchId = dep.creeParId === activeEmployeFilter || dep.creePar?.id === activeEmployeFilter || dep.userId === activeEmployeFilter;
      const selectedUserObj = allUsers.find(u => u.id === activeEmployeFilter);
      let matchName = false;
      if (selectedUserObj && dep.creePar) {
        const creatorName = `${dep.creePar.prenom || ''} ${dep.creePar.nom || ''}`.trim().toLowerCase();
        const empName = `${selectedUserObj.prenom || ''} ${selectedUserObj.nom || ''}`.trim().toLowerCase();
        if (creatorName && empName && creatorName === empName) matchName = true;
      }
      if (!matchId && !matchName) return false;
    }
    if (dep.createdAt) {
      const d = new Date(dep.createdAt);
      if (filterMois !== '' && d.getMonth() !== parseInt(filterMois)) return false;
      if (filterAnnee !== '' && d.getFullYear() !== parseInt(filterAnnee)) return false;
    }
    return true;
  });

  // Calculate dynamic stats from filtered data
  const totalCA = filteredFactures.reduce((s, f) => {
    if (activeEmployeFilter) {
      const isCreator = f.userId === activeEmployeFilter || f.creeParId === activeEmployeFilter || f.creePar?.id === activeEmployeFilter;
      const selectedUserObj = allUsers.find(u => u.id === activeEmployeFilter);
      let matchName = false;
      if (selectedUserObj && f.creePar) {
        const creatorName = `${f.creePar.prenom || ''} ${f.creePar.nom || ''}`.trim().toLowerCase();
        const empName = `${selectedUserObj.prenom || ''} ${selectedUserObj.nom || ''}`.trim().toLowerCase();
        if (creatorName && empName && creatorName === empName) matchName = true;
      }
      const isRealCreator = isCreator || matchName;
      const empCollected = (f.paiements || []).filter(p => p.userId === activeEmployeFilter).reduce((sum, p) => sum + Number(p.montant || 0), 0);
      
      if (isRealCreator) {
        return s + Number(f.montantTotal || 0);
      } else {
        return s + empCollected; // Employee only processed the payment on this invoice
      }
    }
    return s + Number(f.montantTotal || 0);
  }, 0);
  
  const totalPaye = filteredFactures.reduce((s, f) => {
    if (activeEmployeFilter) {
      if (f.paiements && f.paiements.length > 0) {
        const empPay = f.paiements.filter(p => p.userId === activeEmployeFilter).reduce((sum, p) => sum + Number(p.montant || 0), 0);
        return s + empPay;
      }
      const isCreator = f.userId === activeEmployeFilter || f.creeParId === activeEmployeFilter || f.creePar?.id === activeEmployeFilter;
      const selectedUserObj = allUsers.find(u => u.id === activeEmployeFilter);
      let matchName = false;
      if (selectedUserObj && f.creePar) {
        const creatorName = `${f.creePar.prenom || ''} ${f.creePar.nom || ''}`.trim().toLowerCase();
        const empName = `${selectedUserObj.prenom || ''} ${selectedUserObj.nom || ''}`.trim().toLowerCase();
        if (creatorName && empName && creatorName === empName) matchName = true;
      }
      const isRealCreator = isCreator || matchName;
      return s + (isRealCreator ? Number(f.montantPaye || 0) : 0);
    }
    return s + Number(f.montantPaye || 0);
  }, 0);

  const totalDepenses = filteredDepenses.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
  const nbDepenses = filteredDepenses.length;
  const beneficeNet = totalPaye - totalDepenses;
  const totalKilos = filteredFactures.reduce((s, f) => s + Number(f.poidsTotal || 0), 0);
  const nbFactures = filteredFactures.length;

  const facturesPaye = filteredFactures.filter(f => f.statut === 'paye').length;
  const facturesPartiel = filteredFactures.filter(f => f.statut === 'partiel').length;
  const facturesImpaye = filteredFactures.filter(f => f.statut === 'non_paye').length;

  const pieData = [
    { name: 'Payées',     value: facturesPaye,    color: '#22c55e' },
    { name: 'Partielles', value: facturesPartiel, color: '#f59e0b' },
    { name: 'Impayées',   value: facturesImpaye,  color: '#ef4444' },
  ].filter(d => d.value > 0);

  const selectedEmployeObj = filterEmploye ? allUsers.find(u => u.id === filterEmploye) : null;
  const selectedVoyageObj = filterVoyage ? allVoyages.find(v => v.id === filterVoyage) : null;

  const kpis = [
    { label: "Chiffre d'affaires",  val: formatCurrency(totalCA,        devise), Icon: TrendingUp,   color: 'var(--brand)',   bg: 'var(--brand-muted)'   },
    { label: 'Encaissé',            val: formatCurrency(totalPaye,       devise), Icon: CheckCircle,  color: 'var(--success)', bg: 'var(--success-muted)' },
    { label: 'Dépenses totales',    val: formatCurrency(totalDepenses,   devise), Icon: TrendingDown, color: 'var(--danger)',  bg: 'var(--danger-muted)'  },
    { label: 'Nombre de Dépenses',  val: `${nbDepenses} dépense(s)`,            Icon: ShoppingBag,   color: '#e11d48',        bg: 'rgba(225,29,72,0.12)' },
    { label: 'Bénéfice net',        val: formatCurrency(beneficeNet,     devise), Icon: Activity,     color: 'var(--purple)',  bg: 'var(--purple-muted)'  },
    { label: 'Total Poids (Kilos)', val: `${totalKilos.toLocaleString('fr-FR')} kg`, Icon: Weight,    color: 'var(--info)',    bg: 'var(--info-muted)'    },
    { label: 'Nombre de Factures',  val: `${nbFactures} facture(s)`,            Icon: FileText,  color: 'var(--warning)', bg: 'var(--warning-muted)' },
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
    monthly[key] = { mois: d.toLocaleDateString('fr-FR', { month: 'short' }), ca: 0, paye: 0, kilos: 0 };
  }
  filteredFactures.forEach(f => {
    if (!f.createdAt) return;
    const d = new Date(f.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthly[key]) {
      if (activeEmployeFilter) {
        const matchId = f.creeParId === activeEmployeFilter || f.creePar?.id === activeEmployeFilter || f.userId === activeEmployeFilter;
        let matchName = false;
        if (f.creePar) {
          const selectedUserObj = allUsers.find(u => u.id === activeEmployeFilter);
          const creatorName = `${f.creePar.prenom || ''} ${f.creePar.nom || ''}`.trim().toLowerCase();
          const empName = selectedUserObj ? `${selectedUserObj.prenom || ''} ${selectedUserObj.nom || ''}`.trim().toLowerCase() : '';
          matchName = (creatorName && empName && creatorName === empName);
        }
        const isRealCreator = matchId || matchName;
        const empCollected = (f.paiements || []).filter(p => p.userId === activeEmployeFilter).reduce((sum, p) => sum + Number(p.montant || 0), 0);
        
        monthly[key].ca += isRealCreator ? Number(f.montantTotal || 0) : empCollected;
        
        if (f.paiements && f.paiements.length > 0) {
          monthly[key].paye += empCollected;
        } else {
          monthly[key].paye += isRealCreator ? Number(f.montantPaye || 0) : 0;
        }
      } else {
        monthly[key].ca += Number(f.montantTotal || 0);
        monthly[key].paye += Number(f.montantPaye || 0);
      }
      monthly[key].kilos += Number(f.poidsTotal || 0);
    }
  });

  const chartMonthlyData = Object.values(monthly);

  // Compile dynamic voyage profitability stats
  const computedVoyageStats = allVoyages.map(v => {
    const facs = filteredFactures.filter(f => f.voyageId === v.id);
    const deps = filteredDepenses.filter(d => d.voyageId === v.id);
    
    const totalEncaisse = facs.reduce((s, f) => {
      if (activeEmployeFilter) {
        if (f.paiements && f.paiements.length > 0) {
          return s + f.paiements.filter(p => p.userId === activeEmployeFilter).reduce((sum, p) => sum + Number(p.montant || 0), 0);
        }
        const matchId = f.creeParId === activeEmployeFilter || f.creePar?.id === activeEmployeFilter || f.userId === activeEmployeFilter;
        let matchName = false;
        if (f.creePar) {
          const selectedUserObj = allUsers.find(u => u.id === activeEmployeFilter);
          const creatorName = `${f.creePar.prenom || ''} ${f.creePar.nom || ''}`.trim().toLowerCase();
          const empName = selectedUserObj ? `${selectedUserObj.prenom || ''} ${selectedUserObj.nom || ''}`.trim().toLowerCase() : '';
          matchName = (creatorName && empName && creatorName === empName);
        }
        return s + ((matchId || matchName) ? Number(f.montantPaye || 0) : 0);
      }
      return s + Number(f.montantPaye || 0);
    }, 0);
    
    const totalDepenses = deps.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
    const totalKilosVoyage = facs.reduce((s, f) => s + Number(f.poidsTotal || 0), 0);
    return {
      ...v,
      labelName: formatVoyageLabel(v),
      totalEncaisse,
      totalDepenses,
      totalKilosVoyage,
      benefice: totalEncaisse - totalDepenses,
      nbFactures: facs.length
    };
  }).filter(v => v.nbFactures > 0 || v.totalDepenses > 0);

  // Compile Employee performance statistics dynamically
  const employeeStats = allUsers.map(u => {
    const facs = filteredFactures.filter(f => {
      const matchId = f.creeParId === u.id || f.creePar?.id === u.id || f.userId === u.id;
      if (matchId) return true;
      
      const hasCollectedPayment = f.paiements && f.paiements.some(p => p.userId === u.id);
      if (hasCollectedPayment) return true;

      if (f.creePar) {
        const creatorName = `${f.creePar.prenom || ''} ${f.creePar.nom || ''}`.trim().toLowerCase();
        const empName = `${u.prenom || ''} ${u.nom || ''}`.trim().toLowerCase();
        return creatorName && empName && creatorName === empName;
      }
      return false;
    });
    
    const totalCAEmp = facs.reduce((s, f) => {
      const matchId = f.creeParId === u.id || f.creePar?.id === u.id || f.userId === u.id;
      let matchName = false;
      if (f.creePar) {
        const creatorName = `${f.creePar.prenom || ''} ${f.creePar.nom || ''}`.trim().toLowerCase();
        const empName = `${u.prenom || ''} ${u.nom || ''}`.trim().toLowerCase();
        matchName = (creatorName && empName && creatorName === empName);
      }
      const isRealCreator = matchId || matchName;
      const empCollected = (f.paiements || []).filter(p => p.userId === u.id).reduce((sum, p) => sum + Number(p.montant || 0), 0);
      
      if (isRealCreator) return s + Number(f.montantTotal || 0);
      return s + empCollected;
    }, 0);
    
    const totalPayeEmp = facs.reduce((s, f) => {
      if (f.paiements && f.paiements.length > 0) {
        const empPay = f.paiements.filter(p => p.userId === u.id).reduce((sum, p) => sum + Number(p.montant || 0), 0);
        return s + empPay;
      }
      const matchId = f.creeParId === u.id || f.creePar?.id === u.id || f.userId === u.id;
      let matchName = false;
      if (f.creePar) {
        const creatorName = `${f.creePar.prenom || ''} ${f.creePar.nom || ''}`.trim().toLowerCase();
        const empName = `${u.prenom || ''} ${u.nom || ''}`.trim().toLowerCase();
        matchName = (creatorName && empName && creatorName === empName);
      }
      const isRealCreator = matchId || matchName;
      return s + (isRealCreator ? Number(f.montantPaye || 0) : 0);
    }, 0);
    
    const totalKilosEmp = facs.reduce((s, f) => s + Number(f.poidsTotal || 0), 0);
    return {
      id: u.id,
      name: `${u.prenom || ''} ${u.nom || ''}`.trim() || u.email || 'Employé',
      role: u.role,
      nbFactures: facs.length,
      totalCA: totalCAEmp,
      totalPaye: totalPayeEmp,
      totalKilos: totalKilosEmp
    };
  }).filter(e => e.nbFactures > 0 || !filterEmploye);

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Statistiques</h1>
          <p className="page-subtitle">Analyse détaillée et filtrage dynamique de votre activité</p>
        </div>
        
        {/* Dynamic Filters: Mois, Année, Voyage, Employé */}
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

          <select className="form-input form-select" style={{ flex: '1 1 200px' }} value={filterVoyage} onChange={e => setFilterVoyage(e.target.value)}>
            <option value="">Tous les voyages</option>
            {allVoyages.map(v => (
              <option key={v.id} value={v.id}>{formatVoyageLabel(v)}</option>
            ))}
          </select>

          <select className="form-input form-select" style={{ flex: '1 1 180px' }} value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}>
            <option value="">Tous les employés</option>
            {allUsers.map(u => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role === 'admin' ? 'Admin' : 'Employé'})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filter Indicators */}
      {(filterMois !== '' || filterAnnee !== '' || filterVoyage !== '' || filterEmploye !== '') && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Filtres actifs :</span>
          {filterMois !== '' && (
            <span className="badge badge-brand">
              Mois : {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][parseInt(filterMois)]}
            </span>
          )}
          {filterAnnee !== '' && <span className="badge badge-brand">Année : {filterAnnee}</span>}
          {selectedVoyageObj && <span className="badge badge-info"><Truck size={10} style={{ marginRight: 4 }} /> Voyage : {formatVoyageLabel(selectedVoyageObj)}</span>}
          {selectedEmployeObj && <span className="badge badge-purple"><User size={10} style={{ marginRight: 4 }} /> Employé : {selectedEmployeObj.prenom} {selectedEmployeObj.nom}</span>}
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={() => { setFilterMois(''); setFilterAnnee(String(new Date().getFullYear())); setFilterVoyage(''); setFilterEmploye(''); }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <div
            key={i}
            className="kpi-card"
            style={{ '--kpi-color': k.color, '--kpi-bg': k.bg, animationDelay: `${i * 0.07}s`, padding: '16px 14px' }}
            title={`${k.label} : ${k.val}`}
          >
            <div className="kpi-icon-wrap" style={{ width: 40, height: 40 }}>
              <k.Icon size={18} strokeWidth={1.8} />
            </div>
            <div className="kpi-info">
              <div className="kpi-value">{k.val}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Specific Employee Highlight Widget if employee filter selected */}
      {selectedEmployeObj && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--bg-elevated)', borderLeft: '4px solid var(--purple)' }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: 'var(--purple-muted)', color: 'var(--purple)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16
            }}>
              {selectedEmployeObj.prenom?.[0]}{selectedEmployeObj.nom?.[0]}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Activité détaillée de {selectedEmployeObj.prenom} {selectedEmployeObj.nom}</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Rôle : {selectedEmployeObj.role === 'admin' ? 'Administrateur' : 'Employé'} | Email : {selectedEmployeObj.email}
              </p>
            </div>
          </div>
          <div className="grid-4" style={{ marginTop: 16, gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Factures Créées</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)' }}>{nbFactures}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Kilos Traités</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--info)' }}>{totalKilos.toLocaleString('fr-FR')} kg</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chiffre d'affaires généré</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(totalCA, devise)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Montant Encaissé</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--purple)' }}>{formatCurrency(totalPaye, devise)}</div>
            </div>
          </div>
        </div>
      )}

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

      {/* Employee Performance Chart */}
      {employeeStats.length > 0 && !filterEmploye && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3>Performance par employé (Kilos & Chiffre d'Affaires)</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={employeeStats.map(e => ({ name: e.name, Factures: e.nbFactures, Kilos: e.totalKilos, CA: e.totalCA }))}
              margin={{ top: 5, right: 5, left: -10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => `${v}kg`} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v, name) => [name === 'CA' ? formatCurrency(v, devise) : (name === 'Kilos' ? `${v} kg` : `${v} fac.`), name]} />
              <Bar yAxisId="left" dataKey="Kilos" fill="#3b82f6" radius={[4,4,0,0]} name="Kilos traités" />
              <Bar yAxisId="right" dataKey="CA" fill="#8b5cf6" radius={[4,4,0,0]} name="Chiffre d'Affaires" />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} iconType="circle" iconSize={7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Voyage Performance */}
      {computedVoyageStats.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h3>Rentabilité & Volume par voyage</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={computedVoyageStats.map(v => ({ name: v.labelName, Encaissé: v.totalEncaisse, Dépenses: v.totalDepenses, Bénéfice: v.benefice, Kilos: v.totalKilosVoyage }))}
                margin={{ top: 5, right: 5, left: -10, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} angle={-15} textAnchor="end" axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v, n) => [n === 'Kilos' ? `${v} kg` : formatCurrency(v, devise), n]} />
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
                    <th>Date de départ</th>
                    <th>Factures</th>
                    <th>Total Kilos</th>
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
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.dateDepart ? formatDate(v.dateDepart) : '-'}</td>
                        <td><span className="badge badge-info">{v.nbFactures}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--brand)' }}>{v.totalKilosVoyage.toLocaleString('fr-FR')} kg</td>
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


