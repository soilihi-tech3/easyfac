import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, FileText, Users, Truck, TrendingDown, BarChart2,
  Settings, Sun, Moon, Menu, X, ChevronLeft, ChevronRight, Zap, LogOut, Shield,
  Bell, MessageCircle
} from 'lucide-react';
import { getFactures, getDepenses, formatCurrency, formatDate, getParametres } from '../../data/store';
import ReceiptModal from '../factures/ReceiptModal';
import './Layout.css';

const ALL_NAV_ITEMS = [
  { path: '/',             label: 'Tableau de bord', Icon: LayoutDashboard, exact: true },
  { path: '/factures',     label: 'Factures',         Icon: FileText },
  { path: '/clients',      label: 'Clients',           Icon: Users },
  { path: '/voyages',      label: 'Voyages',           Icon: Truck },
  { path: '/depenses',     label: 'Dépenses',          Icon: TrendingDown },
  { path: '/statistiques', label: 'Statistiques',      Icon: BarChart2, adminOnly: true },
];

const SETTINGS_ITEMS = [
  { path: '/users',        label: 'Employés',         Icon: Shield, adminOnly: true },
  { path: '/parametres',   label: 'Paramètres',       Icon: Settings, adminOnly: true },
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { nomEntreprise, toggleTheme, isDark, refresh, devise } = useApp();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  // 🔔 NOTIFICATIONS SYSTEM FOR ADMIN
  const [notifications, setNotifications] = useState([]);
  const [readNotifications, setReadNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('read_notifications') || '[]');
    } catch {
      return [];
    }
  });
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [activeReceiptFacture, setActiveReceiptFacture] = useState(null);
  const dropdownRef = useRef(null);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch and compile unread notifications in real-time
  useEffect(() => {
    if (user?.role !== 'admin') return;

    const fetchNotifs = async () => {
      try {
        const [allFactures, allDepenses] = await Promise.all([
          getFactures(),
          getDepenses()
        ]);

        const list = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        // 1. Invoices exceeding payment deadline (Échéance dépassée)
        allFactures.forEach(f => {
          if (f.statut !== 'paye' && f.dateLimite) {
            const limitDate = new Date(f.dateLimite);
            limitDate.setHours(0,0,0,0);
            if (limitDate < today) {
              list.push({
                id: `late-${f.id}`,
                type: 'late_invoice',
                title: `Échéance dépassée`,
                text: `${f.expediteur?.prenom || ''} ${f.expediteur?.nom || ''} doit encore ${formatCurrency(f.montantTotal - f.montantPaye, devise)} sur la facture ${f.numero}. Échéance : ${formatDate(f.dateLimite)}`,
                item: f,
                action: 'receipt',
                createdAt: new Date(f.dateLimite)
              });
            }
          }
        });

        // 2. Invoices created by employees (Paiement employé réalisé)
        allFactures.forEach(f => {
          if (f.creePar && f.creePar.role === 'employee') {
            const createdDate = new Date(f.createdAt || Date.now());
            const diffDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) {
              list.push({
                id: `payment-${f.id}`,
                type: 'employee_payment',
                title: `Paiement enregistré`,
                text: `L'employé ${f.creePar.prenom} ${f.creePar.nom} a créé la facture ${f.numero} de ${formatCurrency(f.montantTotal, devise)} pour ${f.expediteur?.prenom} ${f.expediteur?.nom}.`,
                item: f,
                action: 'receipt',
                createdAt: createdDate
              });
            }
          }
        });

        // 3. Expenses created by employees (Dépense de l'employé)
        allDepenses.forEach(d => {
          if (d.creePar && d.creePar.role === 'employee') {
            const createdDate = new Date(d.createdAt || Date.now());
            const diffDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) {
              list.push({
                id: `expense-${d.id}`,
                type: 'employee_expense',
                title: `Dépense déclarée`,
                text: `L'employé ${d.creePar.prenom} ${d.creePar.nom} a enregistré une dépense de ${formatCurrency(d.montant * d.quantite, devise)} : ${d.nom}.`,
                item: d,
                action: 'expense_route',
                createdAt: createdDate
              });
            }
          }
        });

        // Sort notifications by date (newest first)
        list.sort((a, b) => b.createdAt - a.createdAt);

        setNotifications(list);
      } catch (err) {
        console.error("Error generating notifications:", err);
      }
    };

    fetchNotifs();
  }, [refresh, user, devise]);

  const unreadNotifications = notifications.filter(n => !readNotifications.includes(n.id));

  const handleNotificationClick = (notif) => {
    // 1. Mark as read immediately
    const updatedRead = [...readNotifications, notif.id];
    setReadNotifications(updatedRead);
    localStorage.setItem('read_notifications', JSON.stringify(updatedRead));

    // 2. Perform action
    if (notif.action === 'receipt') {
      setActiveReceiptFacture(notif.item);
    } else if (notif.action === 'expense_route') {
      navigate('/depenses');
    }
    
    setShowNotifDropdown(false);
  };

  const handleReminderWhatsApp = async (facture) => {
    try {
      const params = await getParametres();
      const entreprise = params?.entreprise || {};
      const total = facture.montantTotal;
      const paye = facture.montantPaye;
      const reste = total - paye;
      const dateStr = facture.dateLimite ? formatDate(facture.dateLimite) : "immédiatement";
      
      const lines = [
        `*Rappel de paiement — Facture ${facture.numero}*`,
        `Bonjour ${facture.expediteur?.prenom || ''} ${facture.expediteur?.nom || ''},`,
        ``,
        `Nous vous contactons pour le suivi de règlement de votre facture *${facture.numero}* :`,
        `*Montant Total :* ${formatCurrency(total, devise)}`,
        `*Déjà Payé :* ${formatCurrency(paye, devise)}`,
        `*Reste à Payer :* *${formatCurrency(reste, devise)}*`,
        `*Date d'échéance :* *${dateStr}*`,
        ``,
        `Merci de bien vouloir régulariser ce solde restant au plus tard à cette date.`,
        `Nous restons à votre entière disposition.`,
        ``,
        `Cordialement,`,
        `*${entreprise.nom || 'EASYFAC'}*`
      ].join('\n');
      
      let phone = facture.expediteur?.telephone || facture.destinataire?.telephone || '';
      phone = phone.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank');
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadNotifications(allIds);
    localStorage.setItem('read_notifications', JSON.stringify(allIds));
    setShowNotifDropdown(false);
  };

  let permissions = {};
  if (user?.permissions) {
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {
      console.error(e);
    }
  }

  const NAV_ITEMS = ALL_NAV_ITEMS.filter(n => {
    if (n.adminOnly && !isAdmin) return false;
    if (n.path === '/clients' && isEmployee && !permissions.voirClients) return false;
    if (n.path === '/voyages' && isEmployee && !permissions.voirVoyages) return false;
    if (n.path === '/factures' && isEmployee && !permissions.voirFactures) return false;
    if (n.path === '/depenses' && isEmployee && !permissions.voirDepenses) return false;
    return true;
  });
  const SETTINGS = SETTINGS_ITEMS.filter(n => !n.adminOnly || isAdmin);

  const currentLabel = [...NAV_ITEMS, ...SETTINGS].find(n =>
    n.exact ? location.pathname === n.path : location.pathname.startsWith(n.path)
  )?.label || 'EasyFac';

  const renderNavItem = (item) => {
    const { path, label, Icon, exact } = item;
    return (
      <NavLink
        key={path}
        to={path}
        end={exact}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? label : undefined}
      >
        <span className="nav-icon">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        {!collapsed && <span className="nav-label">{label}</span>}
      </NavLink>
    );
  };

  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''}`}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* ─── Sidebar ─── */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-header" style={{ padding: collapsed ? '14px 8px' : '14px 16px', justifyContent: collapsed ? 'center' : 'space-between', minHeight: '68px', gap: '8px' }}>
          {collapsed ? (
            <img src="/logo.jpg" alt="easyfac" style={{ height: '36px', width: '36px', borderRadius: '10px', objectFit: 'contain' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <img src="/logo.jpg" alt="easyfac" style={{ height: '38px', width: '38px', borderRadius: '10px', objectFit: 'contain' }} />
              <div className="logo-text-wrap">
                <span className="logo-name">easy<span>fac</span></span>
                <span className="logo-tagline" style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>Gestion de transport</span>
              </div>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Agrandir' : 'Réduire'}
            style={{ marginLeft: collapsed ? '0' : 'auto' }}
          >
            {collapsed
              ? <ChevronRight size={14} strokeWidth={2.5} />
              : <ChevronLeft  size={14} strokeWidth={2.5} />
            }
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {!collapsed && <span className="nav-section-label">Principal</span>}
          {NAV_ITEMS.map(renderNavItem)}

          {SETTINGS.length > 0 && (
            <>
              {!collapsed && <span className="nav-section-label" style={{ marginTop: 8 }}>Système</span>}
              {SETTINGS.map(renderNavItem)}
            </>
          )}
        </nav>

        {/* Footer with User Auth and Theme Toggle */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            style={{ margin: '0 16px 16px 16px' }}
          >
            <span className="theme-toggle-icon">
              {isDark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            </span>
            {!collapsed && <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>}
          </button>

          <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)' }}>
            {!collapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isAdmin ? 'var(--brand)' : 'var(--border-default)', color: isAdmin ? '#fff' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {user?.prenom} {user?.nom}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {isAdmin ? 'Administrateur' : 'Employé'}
                  </div>
                </div>
              </div>
            )}
            <button 
              onClick={logout}
              title={collapsed ? 'Déconnexion' : undefined}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8, padding: collapsed ? '10px 0' : '10px 16px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 12, color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--danger-muted)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'transparent'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            >
              <LogOut size={16} /> {!collapsed && 'Déconnexion'}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="main-wrapper">
        {/* Topbar */}
        <header className="topbar">
          <button
            className="topbar-mobile-btn"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="topbar-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.jpg" alt="easyfac" style={{ height: '32px', width: '32px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border-default)' }} />
            <span className="topbar-page" style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)' }}>{currentLabel}</span>
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
            {/* 🔔 ADMIN NOTIFICATIONS BELL BUTTON */}
            {isAdmin && (
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  onClick={() => setShowNotifDropdown(o => !o)}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    color: unreadNotifications.length > 0 ? 'var(--warning)' : 'var(--text-secondary)',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                  title="Notifications"
                >
                  <Bell size={18} strokeWidth={2} />
                  {unreadNotifications.length > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: 'var(--danger)',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: '800',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 6px var(--danger)',
                      border: '2px solid var(--bg-surface)'
                    }}>
                      {unreadNotifications.length}
                    </span>
                  )}
                </button>

                {/* Dropdown Panel */}
                {showNotifDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '320px',
                    maxHeight: '400px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 500,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }} className="notif-dropdown">
                    {/* Header */}
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-elevated)'
                    }}>
                      <span style={{ fontWeight: '700', fontSize: '13.5px' }}>Notifications ({unreadNotifications.length})</span>
                      {unreadNotifications.length > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--brand)',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Tout lire
                        </button>
                      )}
                    </div>

                    {/* List */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {unreadNotifications.length > 0 ? (
                        unreadNotifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            style={{
                              padding: '12px 16px',
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontWeight: '700',
                                fontSize: '12.5px',
                                color: n.type === 'late_invoice' ? 'var(--danger)' : 'var(--success)'
                              }}>
                                {n.title}
                              </span>
                              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                                {new Date(n.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                              {n.text}
                            </p>
                            {n.type === 'late_invoice' && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }} onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    const updatedRead = [...readNotifications, n.id];
                                    setReadNotifications(updatedRead);
                                    localStorage.setItem('read_notifications', JSON.stringify(updatedRead));
                                    handleReminderWhatsApp(n.item);
                                    setShowNotifDropdown(false);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'var(--success-muted)',
                                    color: 'var(--success)',
                                    border: '1px solid rgba(34,197,94,0.2)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--success)'; e.currentTarget.style.color = '#fff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--success-muted)'; e.currentTarget.style.color = 'var(--success)'; }}
                                >
                                  <MessageCircle size={12} /> Rappel WhatsApp
                                </button>
                                <button
                                  onClick={() => handleNotificationClick(n)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'var(--brand-muted)',
                                    color: 'var(--brand)',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.color = '#fff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-muted)'; e.currentTarget.style.color = 'var(--brand)'; }}
                                >
                                  <FileText size={12} /> Voir le reçu
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📣</div>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>Aucune notification en attente</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="status-pill">
              <span className="status-dot" />
              En ligne
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="main-content page-enter">
          {children}
        </main>
      </div>

      {/* ─── Receipt Modal overlay from Notification Click ─── */}
      {activeReceiptFacture && (
        <ReceiptModal
          facture={activeReceiptFacture}
          onClose={() => setActiveReceiptFacture(null)}
          devise={devise}
        />
      )}
    </div>
  );
}
