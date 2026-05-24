import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, FileText, Users, Truck, TrendingDown, BarChart2,
  Settings, Sun, Moon, Menu, X, ChevronLeft, ChevronRight, Zap, LogOut, Shield
} from 'lucide-react';
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
  const { nomEntreprise, toggleTheme, isDark } = useApp();
  const { user, logout } = useAuth();
  const location = useLocation();

  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

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

          <div className="topbar-right">
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
    </div>
  );
}
