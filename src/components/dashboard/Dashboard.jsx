import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import {
  TrendingUp, TrendingDown, CheckCircle, Clock, Activity,
  Users, FileText, ArrowRight, Truck
} from 'lucide-react';
import { getStats, getFactures, getClients, getVoyages, formatCurrency, formatDate, getFacturesCache, getClientsCache, getVoyagesCache, getDepensesCache } from '../../data/store';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

const STATUT_CONFIG = {
  paye:     { label: 'Payé',     cls: 'badge-green' },
  partiel:  { label: 'Partiel',  cls: 'badge-warning' },
  non_paye: { label: 'Non payé', cls: 'badge-danger' },
};

export default function Dashboard() {
  const [stats, setStats] = useState(() => {
    const cachedFac = getFacturesCache();
    const cachedDeps = getDepensesCache();
    const cachedClients = getClientsCache();
    const cachedVoyages = getVoyagesCache();
    
    if (cachedFac.length > 0) {
      const totalCA = cachedFac.reduce((s, f) => s + Number(f.montantTotal || 0), 0);
      const totalPaye = cachedFac.reduce((s, f) => s + Number(f.montantPaye || 0), 0);
      const totalResteAPayer = totalCA - totalPaye;
      const totalDepenses = cachedDeps.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
      const beneficeNet = totalPaye - totalDepenses;

      const facturesPaye = cachedFac.filter(f => f.statut === 'paye').length;
      const facturesPartiel = cachedFac.filter(f => f.statut === 'partiel').length;
      const facturesImpaye = cachedFac.filter(f => f.statut === 'non_paye').length;

      const monthly = {};
      const now = new Date();
      for (let i = 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthly[key] = { mois: d.toLocaleDateString('fr-FR', { month: 'short' }), ca: 0, paye: 0 };
      }
      cachedFac.forEach(f => {
        if (!f.createdAt) return;
        const d = new Date(f.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthly[key]) {
          monthly[key].ca += Number(f.montantTotal || 0);
          monthly[key].paye += Number(f.montantPaye || 0);
        }
      });

      return {
        totalCA, totalPaye, totalResteAPayer, totalDepenses, beneficeNet,
        facturesPaye, facturesPartiel, facturesImpaye,
        totalClients: cachedClients.length,
        totalFactures: cachedFac.length,
        totalVoyages: cachedVoyages.length,
        monthly: Object.values(monthly),
      };
    }
    return {
      totalCA: 0, totalPaye: 0, totalResteAPayer: 0, totalDepenses: 0, beneficeNet: 0,
      facturesPaye: 0, facturesPartiel: 0, facturesImpaye: 0,
      totalClients: cachedClients.length,
      totalFactures: cachedFac.length,
      totalVoyages: cachedVoyages.length,
      monthly: [],
    };
  });

  const [recentFactures, setRecentFactures] = useState(() => {
    const cachedFac = getFacturesCache();
    return [...cachedFac]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);
  });

  const [topClients, setTopClients] = useState(() => {
    const cachedFac = getFacturesCache();
    const cachedClients = getClientsCache();
    return cachedClients.map(c => ({
      ...c,
      nbFactures: cachedFac.filter(f => f.clientId === c.id || f.expediteurId === c.id).length,
      totalCA: cachedFac.filter(f => f.clientId === c.id || f.expediteurId === c.id).reduce((sum, f) => sum + Number(f.montantTotal || 0), 0),
    })).sort((a, b) => b.nbFactures - a.nbFactures).slice(0, 5);
  });

  const [top3Best, setTop3Best] = useState([]);
  const [top3Worst, setTop3Worst] = useState([]);
  const [loading, setLoading] = useState(() => {
    const cachedFac = getFacturesCache();
    return cachedFac.length === 0;
  });
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const { devise, refresh } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  const computeLocalStats = (factures, depenses, clients, employeeId = null) => {
    const totalCA = factures.reduce((s, f) => {
      if (employeeId) {
        const isCreator = f.userId === employeeId || f.creeParId === employeeId || f.creePar?.id === employeeId;
        const empCollected = (f.paiements || []).filter(p => p.userId === employeeId).reduce((sum, p) => sum + Number(p.montant || 0), 0);
        if (isCreator) {
          return s + Number(f.montantTotal || 0);
        } else {
          return s + empCollected;
        }
      }
      return s + Number(f.montantTotal || 0);
    }, 0);
    
    // Compute cash collected by employee or total paid
    const totalPaye = factures.reduce((s, f) => {
      if (employeeId) {
        if (f.paiements && f.paiements.length > 0) {
          const empPay = f.paiements.filter(p => p.userId === employeeId).reduce((sum, p) => sum + Number(p.montant || 0), 0);
          return s + empPay;
        }
        const isCreator = f.userId === employeeId || f.creeParId === employeeId || f.creePar?.id === employeeId;
        return s + (isCreator ? Number(f.montantPaye || 0) : 0);
      }
      return s + Number(f.montantPaye || 0);
    }, 0);

    const totalResteAPayer = totalCA - totalPaye;
    const totalDepenses = depenses.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
    const beneficeNet = totalPaye - totalDepenses;

    const facturesPaye = factures.filter(f => f.statut === 'paye').length;
    const facturesPartiel = factures.filter(f => f.statut === 'partiel').length;
    const facturesImpaye = factures.filter(f => f.statut === 'non_paye').length;

    const monthly = {};
    const now = new Date();
    for (let i = 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = { mois: d.toLocaleDateString('fr-FR', { month: 'short' }), ca: 0, paye: 0 };
    }
    factures.forEach(f => {
      if (!f.createdAt) return;
      const d = new Date(f.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthly[key]) {
        if (employeeId) {
          const isCreator = f.userId === employeeId || f.creeParId === employeeId || f.creePar?.id === employeeId;
          const empPay = (f.paiements || []).filter(p => p.userId === employeeId).reduce((sum, p) => sum + Number(p.montant || 0), 0);
          monthly[key].ca += isCreator ? Number(f.montantTotal || 0) : empPay;
          if (f.paiements && f.paiements.length > 0) {
            monthly[key].paye += empPay;
          } else {
            monthly[key].paye += isCreator ? Number(f.montantPaye || 0) : 0;
          }
        } else {
          monthly[key].ca += Number(f.montantTotal || 0);
          monthly[key].paye += Number(f.montantPaye || 0);
        }
      }
    });

    return {
      totalCA, totalPaye, totalResteAPayer, totalDepenses, beneficeNet,
      facturesPaye, facturesPartiel, facturesImpaye,
      totalClients: clients.length,
      totalFactures: factures.length,
      monthly: Object.values(monthly),
    };
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isFirstLoad && getFacturesCache().length === 0) setLoading(true);
      const timer = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 3500);

      try {
        const [facRes, depsRes, clientsRes, voyagesRes] = await Promise.allSettled([
          getFactures(),
          import('../../data/store').then(m => m.getDepenses()),
          getClients(),
          getVoyages()
        ]);
        clearTimeout(timer);

        const allFac = facRes.status === 'fulfilled' ? (facRes.value || []) : getFacturesCache();
        const allDeps = depsRes.status === 'fulfilled' ? (depsRes.value || []) : getDepensesCache();
        const clients = clientsRes.status === 'fulfilled' ? (clientsRes.value || []) : getClientsCache();
        const voyages = voyagesRes.status === 'fulfilled' ? (voyagesRes.value || []) : getVoyagesCache();

        const employeeVoyages = user?.role === 'employee'
          ? (user.voyageId && user.voyageId !== 'all' ? voyages.filter(v => v.id === user.voyageId) : voyages)
          : voyages;

        const voyageStats = employeeVoyages.map(v => {
          const facs = user?.role === 'employee' 
            ? allFac.filter(f => f.voyageId === v.id && (f.userId === user.id || f.creeParId === user.id || f.creePar?.id === user.id))
            : allFac.filter(f => f.voyageId === v.id);
          const ca = facs.reduce((sum, f) => sum + Number(f.montantTotal || 0), 0);
          const paye = facs.reduce((sum, f) => sum + Number(f.montantPaye || 0), 0);
          
          const deps = user?.role === 'employee'
            ? allDeps.filter(d => d.voyageId === v.id && (d.userId === user.id || d.creeParId === user.id || d.creePar?.id === user.id))
            : allDeps.filter(d => d.voyageId === v.id);
          const expenses = deps.reduce((sum, d) => sum + (Number(d.montant) * Number(d.quantite || 1)), 0);
          const profit = paye - expenses;
          
          return {
            name: v.nom,
            ca,
            paye,
            expenses,
            profit
          };
        });

        const best = [...voyageStats]
          .sort((a, b) => b.profit - a.profit)
          .slice(0, 3);
          
        const worst = [...voyageStats]
          .sort((a, b) => a.profit - b.profit)
          .slice(0, 3);

        setTop3Best(best);
        setTop3Worst(worst);

        if (user?.role === 'employee') {
          // Employee dashboard includes invoices created by the employee AND invoices where the employee collected payment
          const employeeFac = allFac.filter(f => {
            const isCreator = f.userId === user.id || f.creeParId === user.id || f.creePar?.id === user.id;
            const hasCollectedPayment = f.paiements && f.paiements.some(p => p.userId === user.id);
            return isCreator || hasCollectedPayment;
          });
          const employeeDeps = allDeps.filter(d => d.userId === user.id || d.creeParId === user.id || d.creePar?.id === user.id);
          
          // Get unique clients from their own invoices
          const clientIds = new Set();
          employeeFac.forEach(f => {
            if (f.expediteurId) clientIds.add(f.expediteurId);
            if (f.destinataireId) clientIds.add(f.destinataireId);
          });
          const employeeClients = clients.filter(c => clientIds.has(c.id));

          // Get employee voyages count
          const assignedVoyageIds = new Set(employeeFac.map(f => f.voyageId).filter(Boolean));
          if (user.voyageId && user.voyageId !== 'all') {
            assignedVoyageIds.add(user.voyageId);
          }
          const employeeVoyageList = (user.voyageId === 'all' || !user.voyageId)
            ? voyages.filter(v => assignedVoyageIds.has(v.id))
            : voyages.filter(v => v.id === user.voyageId);

          const localStats = computeLocalStats(employeeFac, employeeDeps, employeeClients, user.id);
          localStats.totalVoyages = employeeVoyageList.length;
          setStats(localStats);

          const factures = [...allFac]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 6);
          setRecentFactures(factures);

          const clientCounts = employeeClients.map(c => ({
            ...c,
            nbFactures: employeeFac.filter(f => f.clientId === c.id || f.expediteurId === c.id).length,
            totalCA: employeeFac.filter(f => f.clientId === c.id || f.expediteurId === c.id).reduce((sum, f) => sum + Number(f.montantTotal || 0), 0),
          })).sort((a, b) => b.nbFactures - a.nbFactures).slice(0, 5);
          setTopClients(clientCounts);

        } else {
          // Admin dashboard: full site stats (real-time client calculation)
          const localStats = computeLocalStats(allFac, allDeps, clients);
          localStats.totalVoyages = voyages.length;
          setStats(localStats);

          const factures = [...allFac]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 6);
          setRecentFactures(factures);

          const clientCounts = clients.map(c => ({
            ...c,
            nbFactures: allFac.filter(f => f.clientId === c.id || f.expediteurId === c.id).length,
            totalCA: allFac.filter(f => f.clientId === c.id || f.expediteurId === c.id).reduce((sum, f) => sum + Number(f.montantTotal || 0), 0),
          })).sort((a, b) => b.nbFactures - a.nbFactures).slice(0, 5);
          setTopClients(clientCounts);
        }
        setIsFirstLoad(false);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [refresh, isFirstLoad]);

  const currentStats = stats || {
    totalCA: 0, totalPaye: 0, totalResteAPayer: 0, totalDepenses: 0, beneficeNet: 0,
    facturesPaye: 0, facturesPartiel: 0, facturesImpaye: 0,
    totalClients: 0, totalFactures: 0, totalVoyages: 0, monthly: []
  };

  const kpis = [
    {
      label: "Chiffre d'affaires",
      value: formatCurrency(currentStats.totalCA, devise),
      Icon: TrendingUp,
      trend: '+12%', trendDir: 'up',
      kpiColor: 'var(--brand)',
      kpiBg:    'var(--brand-muted)',
    },
    {
      label: 'Montant encaissé',
      value: formatCurrency(currentStats.totalPaye, devise),
      Icon: CheckCircle,
      trend: '+8%', trendDir: 'up',
      kpiColor: 'var(--success)',
      kpiBg:    'var(--success-muted)',
    },
    {
      label: 'Reste à percevoir',
      value: formatCurrency(currentStats.totalResteAPayer, devise),
      Icon: Clock,
      trend: '-3%', trendDir: 'down',
      kpiColor: 'var(--warning)',
      kpiBg:    'var(--warning-muted)',
    },
    {
      label: 'Bénéfice net',
      value: formatCurrency(currentStats.beneficeNet, devise),
      Icon: Activity,
      trend: '+15%', trendDir: 'up',
      kpiColor: 'var(--purple)',
      kpiBg:    'var(--purple-muted)',
    },
  ];

  const miniStats = [
    { Icon: Users,       label: 'Clients',    val: currentStats.totalClients,    color: 'var(--info)', path: '/clients' },
    { Icon: FileText,    label: 'Factures',   val: currentStats.totalFactures,   color: 'var(--brand)', path: '/factures' },
    { Icon: Truck,       label: 'Voyages',    val: currentStats.totalVoyages || 0, color: 'var(--purple)', iconBg: 'var(--purple-muted)', path: '/voyages' },
    {
      Icon: CheckCircle, label: 'Payées',     val: currentStats.facturesPaye,    color: 'var(--success)',
      iconBg: 'var(--success-muted)', path: '/factures', state: { filterStatut: 'paye' }
    },
    {
      Icon: Clock,       label: 'Partielles', val: currentStats.facturesPartiel, color: 'var(--warning)',
      iconBg: 'var(--warning-muted)', path: '/factures', state: { filterStatut: 'partiel' }
    },
    {
      Icon: Activity,    label: 'Impayées',   val: currentStats.facturesImpaye,  color: 'var(--danger)',
      iconBg: 'var(--danger-muted)', path: '/factures', state: { filterStatut: 'non_paye' }
    },
  ];

  return (
    <div className="dashboard page-enter">
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '8px 12px',
          margin: '0 auto 16px',
          borderRadius: 8,
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          fontSize: '0.85rem',
          color: 'var(--brand, #2563eb)'
        }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
          <span>Actualisation des données en direct...</span>
        </div>
      )}
      {/* ─── KPI Cards ─── */}
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div
            key={i}
            className="kpi-card"
            style={{
              '--kpi-color': k.kpiColor,
              '--kpi-bg': k.kpiBg,
              animationDelay: `${i * 0.07}s`,
            }}
          >
            <div className="kpi-icon-wrap">
              <k.Icon size={20} strokeWidth={1.8} />
            </div>
            <div className="kpi-info">
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
              <span className={`kpi-trend ${k.trendDir}`}>
                {k.trend} ce mois
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Mini Stats ─── */}
      <div className="mini-stats">
        {miniStats.map((m, i) => (
          <div
            key={i}
            className="mini-stat"
            onClick={() => {
              if (m.path) {
                navigate(m.path, { state: m.state });
              }
            }}
          >
            <div className="mini-icon" style={{ background: m.iconBg || 'var(--bg-elevated)', color: m.color }}>
              <m.Icon size={16} strokeWidth={1.8} />
            </div>
            <div>
              <div className="mini-val" style={{ color: m.color }}>{m.val}</div>
              <div className="mini-lbl">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Dashboard Grid ─── */}
      <div className="dashboard-grid">
        {/* Revenue Chart */}
        <div className="card chart-card">
          <div className="card-header">
            <h3>Évolution du chiffre d'affaires</h3>
            <span className="badge badge-success">2 derniers mois</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.monthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPaye" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="mois"
                tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-sans)' }}
                tickFormatter={v => v >= 1000 ? `${v/1000}k` : v}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: 'var(--shadow-md)',
                }}
                labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12 }}
                formatter={(v) => [formatCurrency(v, devise), '']}
              />
              <Area type="monotone" dataKey="ca"   name="CA total" stroke="#6366f1" fill="url(#gradCA)"   strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="paye" name="Encaissé" stroke="#22c55e" fill="url(#gradPaye)" strokeWidth={2} dot={false} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)', paddingTop: 8 }}
                iconType="circle"
                iconSize={7}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Summary */}
        <div className="card payment-summary">
          <div className="card-header">
            <h3>Répartition paiements</h3>
          </div>
          <div className="payment-bars">
            {[
              { label: 'Payées',     count: stats.facturesPaye,    color: 'var(--success)', pct: stats.totalFactures ? Math.round(stats.facturesPaye / stats.totalFactures * 100) : 0 },
              { label: 'Partielles', count: stats.facturesPartiel, color: 'var(--warning)', pct: stats.totalFactures ? Math.round(stats.facturesPartiel / stats.totalFactures * 100) : 0 },
              { label: 'Impayées',   count: stats.facturesImpaye,  color: 'var(--danger)',  pct: stats.totalFactures ? Math.round(stats.facturesImpaye / stats.totalFactures * 100) : 0 },
            ].map((item, i) => (
              <div key={i} className="payment-bar-item">
                <div className="payment-bar-header">
                  <span style={{ color: item.color, fontWeight: 600 }}>{item.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.count} · {item.pct}%</span>
                </div>
                <div className="payment-bar-track">
                  <div
                    className="payment-bar-fill"
                    style={{ width: `${item.pct}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="payment-totals">
            {[
              { label: 'Encaissé',   val: stats.totalPaye,        color: 'var(--success)' },
              { label: 'En attente', val: stats.totalResteAPayer,  color: 'var(--warning)' },
              { label: 'Dépenses',   val: stats.totalDepenses,     color: 'var(--danger)'  },
            ].map((row, i) => (
              <div key={i} className="payment-total-row">
                <span>{row.label}</span>
                <strong style={{ color: row.color }}>{formatCurrency(row.val, devise)}</strong>
              </div>
            ))}
            <div className="payment-total-row" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Bénéfice net</span>
              <strong style={{ color: 'var(--brand)', fontSize: 15 }}>{formatCurrency(stats.beneficeNet, devise)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Voyages Rentabilité Grid ─── */}
      <div className="voyages-profit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginTop: 24 }}>
        {/* Top 3 Plus de Bénéfice */}
        <div className="card">
          <div className="card-header">
            <h3>Top 3 Voyages — Plus de bénéfice</h3>
            <span className="badge badge-success" style={{ gap: 4 }}>
              <TrendingUp size={12} /> Plus rentables
            </span>
          </div>
          <div style={{ padding: '10px 0' }}>
            {top3Best.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={top3Best} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                      borderRadius: 10, color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-md)',
                    }}
                    labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12 }}
                    formatter={(v) => [formatCurrency(v, devise), 'Bénéfice Net']}
                  />
                  <Bar dataKey="profit" name="Bénéfice net" fill="var(--success)" radius={[4,4,0,0]}>
                    {top3Best.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? 'var(--success)' : 'var(--danger)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-icon"><Truck size={24} /></div>
                <div className="empty-title">Aucune donnée disponible</div>
              </div>
            )}
          </div>
        </div>

        {/* Top 3 Moins de Bénéfice */}
        <div className="card">
          <div className="card-header">
            <h3>Top 3 Voyages — Moins de bénéfice</h3>
            <span className="badge badge-danger" style={{ gap: 4 }}>
              <TrendingDown size={12} /> Moins rentables
            </span>
          </div>
          <div style={{ padding: '10px 0' }}>
            {top3Worst.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={top3Worst} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                      borderRadius: 10, color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-md)',
                    }}
                    labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12 }}
                    formatter={(v) => [formatCurrency(v, devise), 'Bénéfice Net']}
                  />
                  <Bar dataKey="profit" name="Bénéfice net" fill="var(--danger)" radius={[4,4,0,0]}>
                    {top3Worst.map((entry, index) => (
                      <Cell key={`cell-worst-${index}`} fill={entry.profit >= 0 ? 'var(--success)' : 'var(--danger)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-icon"><Truck size={24} /></div>
                <div className="empty-title">Aucune donnée disponible</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
