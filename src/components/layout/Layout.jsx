import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, FileText, Users, Truck, TrendingDown, BarChart2,
  Settings, Sun, Moon, Menu, X, ChevronLeft, ChevronRight, Zap, LogOut, Shield,
  Bell, MessageCircle, PiggyBank, FileImage, Megaphone, ChevronDown, RotateCcw,
  Smartphone
} from 'lucide-react';
import { getFactures, getDepenses, formatCurrency, formatDate, getParametres } from '../../data/store';
import ReceiptModal from '../factures/ReceiptModal';
import PwaInstallPrompt from '../pwa/PwaInstallPrompt';
import './Layout.css';

const ALL_NAV_ITEMS = [
  { path: '/',             label: 'Tableau de bord', Icon: LayoutDashboard, exact: true },
  { path: '/factures',     label: 'Factures',         Icon: FileText, key: 'factures' },
  { path: '/clients',      label: 'Clients',           Icon: Users, key: 'clients' },
  { path: '/voyages',      label: 'Voyages',           Icon: Truck, key: 'voyages' },
  { path: '/depenses',     label: 'Dépenses',          Icon: TrendingDown, key: 'depenses' },
  { path: '/remboursements', label: 'Remboursements', Icon: RotateCcw, key: 'remboursements' },
  { path: '/communiques',  label: 'Communiqués',       Icon: Megaphone, key: 'communiques' },
  { path: '/flyer',        label: 'Flyer',             Icon: FileImage, key: 'flyer' },
  { path: '/epargnes',     label: 'Épargne',           Icon: PiggyBank, adminOnly: true, key: 'epargne' },
  { path: '/statistiques', label: 'Statistiques',      Icon: BarChart2, adminOnly: true, key: 'statistiques' },
];

const SETTINGS_ITEMS = [
  { path: '/users',        label: 'Employés',         Icon: Shield, adminOnly: true, key: 'employes' },
  { path: '/parametres',   label: 'Paramètres',       Icon: Settings, adminOnly: true, key: 'parametres' },
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { nomEntreprise, toggleTheme, isDark, refresh, devise, viewDevise, changeViewDevise, rates, isModuleActive } = useApp();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [online, setOnline] = useState(window.navigator.onLine);
  const [isAppStandalone, setIsAppStandalone] = useState(() => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  const [showPwaModal, setShowPwaModal] = useState(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');
    if (standalone) return false;
    return !sessionStorage.getItem('ef_pwa_dismissed');
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e) => {
      setIsAppStandalone(e.matches);
      if (e.matches) setShowPwaModal(false);
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // 💱 CURRENCY SWITCHER DROPDOWN STATE & LOGIC
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const currencyDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const CURRENCIES = [
    { value: 'FCFA', label: 'FCFA', symbol: 'FCFA', flag: '🇸🇳', desc: 'Franc CFA (Sénégal)' },
    { value: 'EUR', label: 'EUR', symbol: '€', flag: '🇪🇺', desc: 'Euro' },
    { value: 'USD', label: 'USD', symbol: '$', flag: '🇺🇸', desc: 'Dollar US' },
    { value: 'KMF', label: 'KMF', symbol: 'CF', flag: '🇰🇲', desc: 'Franc Comorien' },
  ];

  const currentCurrency = CURRENCIES.find(c => c.value === viewDevise) || CURRENCIES[0];

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
      const config = params?.config || {};
      const total = facture.montantTotal;
      const paye = facture.montantPaye;
      const reste = total - paye;
      const dateStr = facture.dateLimite ? formatDate(facture.dateLimite) : "immédiatement";
      
      const customCordial = config.rappelCordial !== undefined && config.rappelCordial !== ''
        ? config.rappelCordial
        : "Merci de bien vouloir régulariser ce solde restant au plus tard à cette date.\nNous restons à votre entière disposition.\n\nCordialement,";

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
        customCordial,
        ``,
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
    if (n.path === '/remboursements' && isEmployee && !permissions.voirRemboursements) return false;
    if (n.path === '/communiques' && isEmployee && !permissions.voirCommuniques) return false;
    if (n.path === '/flyer' && isEmployee && !permissions.voirFlyer) return false;
    return true;
  });
  const SETTINGS = SETTINGS_ITEMS.filter(n => !n.adminOnly || isAdmin);

  const currentLabel = [...NAV_ITEMS, ...SETTINGS].find(n =>
    n.exact ? location.pathname === n.path : location.pathname.startsWith(n.path)
  )?.label || 'EasyFac';

  const renderNavItem = (item) => {
    const { path, label, Icon, exact, key } = item;
    const isDisabled = key && !isModuleActive(key);

    return (
      <NavLink
        key={path}
        to={path}
        end={exact}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled-module' : ''}`}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? (isDisabled ? `${label} (Bientôt disponible)` : label) : undefined}
      >
        <span className="nav-icon" style={{ opacity: isDisabled ? 0.6 : 1 }}>
          <Icon size={17} strokeWidth={1.8} />
        </span>
        {!collapsed && (
          <span className="nav-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ opacity: isDisabled ? 0.75 : 1 }}>{label}</span>
            {isDisabled && (
              <span style={{
                fontSize: '9.5px',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--warning)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                whiteSpace: 'nowrap'
              }}>
                Bientôt dispo
              </span>
            )}
          </span>
        )}
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
              ? <ChevronRight size={16} strokeWidth={2.5} />
              : <ChevronLeft  size={16} strokeWidth={2.5} />
            }
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            {!collapsed && <span className="nav-section-label">Principal</span>}
            {NAV_ITEMS.map(renderNavItem)}
          </div>

          {SETTINGS.length > 0 && (
            <div className="nav-section" style={{ marginTop: 8 }}>
              {!collapsed && <span className="nav-section-label">Système</span>}
              {SETTINGS.map(renderNavItem)}
            </div>
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
            {/* 📱 PWA INSTALL BUTTON (WEB MODE ONLY) */}
            {!isAppStandalone && (
              <button
                onClick={() => setShowPwaModal(true)}
                style={{
                  background: 'linear-gradient(135deg, var(--brand) 0%, #a855f7 100%)',
                  color: '#ffffff',
                  border: 'none',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '12.5px',
                  boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                title="Installer EasyFac sur votre écran d'accueil"
              >
                <Smartphone size={15} />
                <span className="hide-mobile-sm">Installer l'app</span>
              </button>
            )}

            {/* 💱 PREMIUM CURRENCY SWITCHER DROPDOWN */}
            {isModuleActive('devise') ? (
              <div style={{ position: 'relative' }} ref={currencyDropdownRef}>
                <button
                  onClick={() => setShowCurrencyDropdown(o => !o)}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13px',
                    transition: 'all 0.2s',
                    userSelect: 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                  title="Changer la devise d'affichage"
                >
                  <span style={{ fontSize: '15px' }}>{currentCurrency.flag}</span>
                  <span>{currentCurrency.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '500' }}>({currentCurrency.symbol})</span>
                  <ChevronDown size={12} style={{ color: 'var(--text-secondary)', transition: 'transform 0.2s', transform: showCurrencyDropdown ? 'rotate(180deg)' : 'none' }} />
                </button>

                {showCurrencyDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '220px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 500,
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    {CURRENCIES.map(c => {
                      const active = c.value === viewDevise;
                      return (
                        <button
                          key={c.value}
                          onClick={() => {
                            changeViewDevise(c.value);
                            setShowCurrencyDropdown(false);
                          }}
                          style={{
                            background: active ? 'var(--brand-muted)' : 'transparent',
                            border: 'none',
                            color: active ? 'var(--brand)' : 'var(--text-primary)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.15s',
                            fontWeight: active ? '700' : '500',
                            fontSize: '13px'
                          }}
                        >
                          <span style={{ fontSize: '16px' }}>{c.flag}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <span style={{ fontWeight: 700 }}>{c.label} ({c.symbol})</span>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '400' }}>{c.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div
                title="Sélecteur de devise désactivé par le Super Admin"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-muted)',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  opacity: 0.6,
                  cursor: 'not-allowed'
                }}
              >
                <span>{currentCurrency.flag} {currentCurrency.label}</span>
                <span style={{ fontSize: '9.5px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', padding: '2px 6px', borderRadius: '6px', fontWeight: 800 }}>🔒 Verrouillé</span>
              </div>
            )}

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

            {online ? (
              <div className="status-pill">
                <span className="status-dot" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                En ligne
              </div>
            ) : (
              <div className="status-pill warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
                <span className="status-dot" style={{ background: '#f59e0b', boxShadow: '0 0 8px #f59e0b', animation: 'pulse 1.5s infinite' }} />
                Hors ligne (Local)
              </div>
            )}
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

      {/* ─── PWA Installation Prompt Modal ─── */}
      <PwaInstallPrompt
        isOpen={showPwaModal}
        onClose={() => {
          setShowPwaModal(false);
          sessionStorage.setItem('ef_pwa_dismissed', 'true');
        }}
      />
    </div>
  );
}
