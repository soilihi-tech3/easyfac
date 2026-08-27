import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, PiggyBank, BarChart3, LogOut, Plus, Trash2, 
  Edit2, Check, X, ShieldAlert, Search, RefreshCw, TrendingUp, 
  DollarSign, Activity, AlertTriangle, LayoutDashboard, Phone, 
  MapPin, Lock, MessageCircle, CreditCard, Receipt, ChevronDown,
  Wallet, ArrowUpRight, ArrowDownRight, Users, Calendar,
  Send, Eye, EyeOff, Package, Sun, Moon, ToggleRight, Sparkles, FileText, Settings, Menu
} from 'lucide-react';
import { 
  getSuperAdminBoutiques, createSuperAdminBoutique, 
  updateSuperAdminBoutique, deleteSuperAdminBoutique, 
  getSuperAdminStats, getSuperAdminEpargnes, createSuperAdminEpargne, deleteSuperAdminEpargne,
  getSuperAdminPayments, createSuperAdminPayment, deleteSuperAdminPayment,
  sendBoutiquePaymentReminder,
  getSuperAdminDepenses, createSuperAdminDepense, deleteSuperAdminDepense,
  changeBoutiquePassword, getAppModules, updateAppModules,
  formatCurrency, formatDate 
} from '../../data/store';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import './SuperAdminDashboard.css';

const MODULES_LIST_CONFIG = [
  { key: 'factures', label: 'Factures', category: 'Gestion', icon: FileText, desc: 'Gestion des factures clients, impayés, reçus & devis' },
  { key: 'clients', label: 'Clients', category: 'Gestion', icon: Users, desc: 'Répertoire des expediteurs & destinataires de fret' },
  { key: 'voyages', label: 'Voyages', category: 'Gestion', icon: Package, desc: 'Gestion des conteneurs, voyages maritime & aérien' },
  { key: 'depenses', label: 'Dépenses', category: 'Gestion', icon: Receipt, desc: 'Suivi des frais d’exploitation et charges des boutiques' },
  { key: 'remboursements', label: 'Remboursements', category: 'Gestion', icon: RefreshCw, desc: 'Gestion des avoirs, reliquats & indemnités litiges' },
  { key: 'communiques', label: 'Communiqués', category: 'Communication', icon: Send, desc: 'Diffusion d’annonces WhatsApp & alertes automatisées' },
  { key: 'flyer', label: 'Créateur de Flyer', category: 'Marketing', icon: Sparkles, desc: 'Générateur de visuels publicitaires & promotions' },
  { key: 'epargne', label: 'Épargne', category: 'Finances', icon: PiggyBank, desc: 'Gestion des fonds de réserve et trésorerie' },
  { key: 'statistiques', label: 'Statistiques & Rapport', category: 'Analyse', icon: BarChart3, desc: 'Tableaux de bord analytiques et bilans financiers' },
  { key: 'parametres', label: 'Paramètres', category: 'Système', icon: Settings, desc: 'Configuration de l’entreprise, tarifs & modèles de facture' },
  { key: 'employes', label: 'Gestion des Employés', category: 'Système', icon: Lock, desc: 'Gestion des accès employés & permissions' },
  { key: 'devise', label: 'Sélecteur de Devise', category: 'TopBar', icon: CreditCard, desc: 'Menu de conversion des monnaies (FCFA, EUR, USD, KMF)' },
];

const TABS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'boutiques', label: 'Boutiques', icon: Building2 },
  { key: 'modules', label: 'Activation des Fonctionnalités', icon: ToggleRight },
  { key: 'payments', label: 'Paiements CA', icon: CreditCard },
  { key: 'depenses', label: 'Mes Dépenses', icon: Receipt },
  { key: 'epargnes', label: 'Épargne Globale', icon: PiggyBank },
  { key: 'stats', label: 'Statistiques', icon: BarChart3 },
];

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  
  // Data States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLightMode, setIsLightMode] = useState(false);
  const [boutiques, setBoutiques] = useState([]);
  const [epargnes, setEpargnes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const savedMode = localStorage.getItem('sa-light-mode') === 'true';
    setIsLightMode(savedMode);
  }, []);

  const toggleTheme = () => {
    setIsLightMode(prev => {
      const newMode = !prev;
      localStorage.setItem('sa-light-mode', newMode);
      return newMode;
    });
  };

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAddDepenseModal, setShowAddDepenseModal] = useState(false);
  const [selectedBoutique, setSelectedBoutique] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletePaymentId, setDeletePaymentId] = useState(null);
  const [deleteDepenseId, setDeleteDepenseId] = useState(null);

  // Boutique form
  const [boutiqueNom, setBoutiqueNom] = useState('');
  const [boutiqueTelephone, setBoutiqueTelephone] = useState('');
  const [boutiqueAdresse, setBoutiqueAdresse] = useState('');
  const [boutiqueMontantMensuel, setBoutiqueMontantMensuel] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminNom, setAdminNom] = useState('');
  const [adminPrenom, setAdminPrenom] = useState('');

  // Payment form
  const [paymentBoutiqueId, setPaymentBoutiqueId] = useState('');
  const [paymentMontant, setPaymentMontant] = useState('');
  const [paymentMois, setPaymentMois] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');

  // Reminder form
  const [reminderBoutique, setReminderBoutique] = useState(null);
  const [reminderMessage, setReminderMessage] = useState('');

  // Password form
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  // Depense form
  const [depenseLibelle, setDepenseLibelle] = useState('');
  const [depenseMontant, setDepenseMontant] = useState('');
  const [depenseCategorie, setDepenseCategorie] = useState('Hébergement');

  // Epargne form
  const [showAddEpargneModal, setShowAddEpargneModal] = useState(false);
  const [epargneLibelle, setEpargneLibelle] = useState('');
  const [epargneMontant, setEpargneMontant] = useState('');
  const [epargneDate, setEpargneDate] = useState('');
  const [deleteEpargneId, setDeleteEpargneId] = useState(null);

  // Filter / Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterPaymentMois, setFilterPaymentMois] = useState('');
  const [filterPaymentAnnee, setFilterPaymentAnnee] = useState('');
  const [filterPaymentBoutique, setFilterPaymentBoutique] = useState('');
  const [filterDepenseCategorie, setFilterDepenseCategorie] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const showMsg = (msg, isError = false) => {
    if (isError) setActionError(msg);
    else setActionSuccess(msg);
    setTimeout(() => { setActionError(''); setActionSuccess(''); }, 4000);
  };

  const [appModules, setAppModules] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [boutiquesData, statsData, epargnesData, paymentsData, depensesData, modulesData] = await Promise.all([
        getSuperAdminBoutiques(),
        getSuperAdminStats(),
        getSuperAdminEpargnes(),
        getSuperAdminPayments(),
        getSuperAdminDepenses(),
        getAppModules()
      ]);
      setBoutiques(Array.isArray(boutiquesData) ? boutiquesData : []);
      setStats(statsData);
      setEpargnes(Array.isArray(epargnesData) ? epargnesData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      setDepenses(Array.isArray(depensesData) ? depensesData : []);
      setAppModules(modulesData || {});
    } catch (err) {
      console.error('Error fetching Super Admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);

  const handleRefresh = () => setRefreshTrigger(p => p + 1);

  const [targetBoutiqueId, setTargetBoutiqueId] = useState('global');

  const handleToggleModule = async (key, nextState) => {
    const currentGlobal = appModules.global || appModules;
    const currentBoutiques = appModules.boutiques || {};

    let updatedModules = {};

    if (targetBoutiqueId === 'global') {
      updatedModules = {
        ...appModules,
        global: {
          ...currentGlobal,
          [key]: nextState
        },
        boutiques: currentBoutiques
      };
    } else {
      const bConfig = currentBoutiques[targetBoutiqueId] || {};
      updatedModules = {
        ...appModules,
        global: currentGlobal,
        boutiques: {
          ...currentBoutiques,
          [targetBoutiqueId]: {
            ...bConfig,
            [key]: nextState
          }
        }
      };
    }

    setAppModules(updatedModules);
    try {
      await updateAppModules(updatedModules);
      const targetName = targetBoutiqueId === 'global'
        ? 'Toutes les boutiques (Global)'
        : (boutiques.find(b => b.id.toString() === targetBoutiqueId.toString())?.nom || targetBoutiqueId);

      showMsg(nextState 
        ? `Module "${key}" activé pour ${targetName} ✓`
        : `Module "${key}" désactivé pour ${targetName} ("Bientôt disponible" actif)`
      );
    } catch (err) {
      showMsg(err.message, true);
    }
  };

  const handleToggleStatus = async (boutique) => {
    try {
      const nextStatus = boutique.statut === 'actif' ? 'inactif' : 'actif';
      await updateSuperAdminBoutique(boutique.id, { 
        nom: boutique.nom, telephone: boutique.telephone,
        adresse: boutique.adresse, statut: nextStatus,
        montant_mensuel: boutique.montant_mensuel
      });
      showMsg(nextStatus === 'actif' ? 'Boutique activée ✓' : 'Boutique désactivée');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const resetBoutiqueForm = () => {
    setBoutiqueNom(''); setBoutiqueTelephone(''); setBoutiqueAdresse('');
    setBoutiqueMontantMensuel(''); setAdminEmail(''); setAdminPassword('');
    setAdminNom(''); setAdminPrenom('');
  };

  const handleCreateBoutique = async (e) => {
    e.preventDefault();
    try {
      await createSuperAdminBoutique({
        nom: boutiqueNom.trim(), telephone: boutiqueTelephone.trim() || null,
        adresse: boutiqueAdresse.trim() || null,
        montantMensuel: boutiqueMontantMensuel ? parseFloat(boutiqueMontantMensuel) : null,
        adminEmail: adminEmail.trim() || null, adminPassword: adminPassword || null,
        adminNom: adminNom.trim() || null, adminPrenom: adminPrenom.trim() || null
      });
      resetBoutiqueForm(); setShowAddModal(false);
      showMsg('Boutique créée avec succès ✓');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const handleEditBoutique = async (e) => {
    e.preventDefault();
    if (!selectedBoutique || !boutiqueNom) return;
    try {
      await updateSuperAdminBoutique(selectedBoutique.id, { 
        nom: boutiqueNom.trim(), telephone: boutiqueTelephone.trim() || null,
        adresse: boutiqueAdresse.trim() || null,
        montant_mensuel: boutiqueMontantMensuel ? parseFloat(boutiqueMontantMensuel) : null
      });
      setShowEditModal(false); setSelectedBoutique(null); resetBoutiqueForm();
      showMsg('Boutique modifiée ✓');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const handleDeleteBoutique = async (id) => {
    try {
      await deleteSuperAdminBoutique(id);
      setDeleteConfirmId(null);
      showMsg('Boutique supprimée');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      await createSuperAdminPayment({
        boutique_id: paymentBoutiqueId, montant: paymentMontant,
        mois: paymentMois || null, description: paymentDesc || null
      });
      setPaymentBoutiqueId(''); setPaymentMontant(''); setPaymentMois(''); setPaymentDesc('');
      setShowPaymentModal(false);
      showMsg('Paiement enregistré ✓');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const handleDeletePayment = async (id) => {
    try {
      await deleteSuperAdminPayment(id);
      setDeletePaymentId(null);
      showMsg('Paiement supprimé');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const openReminderModal = (boutique) => {
    setReminderBoutique(boutique);
    const montantRestant = boutique.montant_mensuel || 0;
    setReminderMessage(
      `*Rappel de Paiement — ${boutique.nom}*\n\n` +
      `Bonjour,\n\n` +
      `Nous vous rappelons que votre abonnement EasyFac pour le mois en cours est dû.\n` +
      `*Montant mensuel :* ${formatCurrency(montantRestant)}\n\n` +
      `Merci de bien vouloir régulariser votre situation au plus vite.\n\n` +
      `Cordialement,\n*EasyFac Admin*`
    );
    setShowReminderModal(true);
  };

  const handleSendReminder = async () => {
    if (!reminderBoutique?.telephone) {
      showMsg('Cette boutique n\'a pas de numéro de téléphone enregistré.', true);
      return;
    }
    try {
      const res = await sendBoutiquePaymentReminder({
        boutique_id: reminderBoutique.id,
        telephone: reminderBoutique.telephone,
        message: reminderMessage
      });
      if (res.whatsappUrl) window.open(res.whatsappUrl, '_blank');
      setShowReminderModal(false);
    } catch (err) { showMsg(err.message, true); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!selectedBoutique) return;
    try {
      await changeBoutiquePassword(selectedBoutique.id, newPassword);
      setShowPasswordModal(false); setNewPassword(''); setSelectedBoutique(null);
      showMsg('Mot de passe modifié avec succès ✓');
    } catch (err) { showMsg(err.message, true); }
  };

  const handleAddDepense = async (e) => {
    e.preventDefault();
    try {
      await createSuperAdminDepense({
        libelle: depenseLibelle.trim(), montant: depenseMontant, categorie: depenseCategorie
      });
      setDepenseLibelle(''); setDepenseMontant(''); setDepenseCategorie('Hébergement');
      setShowAddDepenseModal(false);
      showMsg('Dépense enregistrée ✓');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const handleDeleteDepense = async (id) => {
    try {
      await deleteSuperAdminDepense(id);
      setDeleteDepenseId(null);
      showMsg('Dépense supprimée');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const handleAddEpargne = async (e) => {
    e.preventDefault();
    try {
      await createSuperAdminEpargne({
        libelle: epargneLibelle.trim(), montant: epargneMontant, date_epargne: epargneDate || null
      });
      setEpargneLibelle(''); setEpargneMontant(''); setEpargneDate('');
      setShowAddEpargneModal(false);
      showMsg('Épargne enregistrée ✓');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const handleDeleteEpargne = async (id) => {
    try {
      await deleteSuperAdminEpargne(id);
      setDeleteEpargneId(null);
      showMsg('Épargne supprimée');
      handleRefresh();
    } catch (err) { showMsg(err.message, true); }
  };

  const filteredBoutiques = boutiques.filter(b => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = b.nom.toLowerCase().includes(search) || 
                         (b.telephone && b.telephone.includes(search)) ||
                         (b.adresse && b.adresse.toLowerCase().includes(search));
    const matchesStatus = statusFilter === 'all' ? true : b.statut === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPayments = payments.filter(p => {
    const matchesMois = filterPaymentMois ? p.mois === filterPaymentMois : true;
    const matchesAnnee = filterPaymentAnnee ? new Date(p.createdAt).getFullYear().toString() === filterPaymentAnnee : true;
    const matchesBoutique = filterPaymentBoutique 
      ? String(p.boutique_id) === String(filterPaymentBoutique) : true;
    return matchesMois && matchesAnnee && matchesBoutique;
  });

  const availableYears = [...new Set(payments.map(p => new Date(p.createdAt).getFullYear()))].sort((a,b) => b - a);
  const MONTHS_STATIC = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  const filteredDepenses = depenses.filter(d => {
    return filterDepenseCategorie ? d.categorie === filterDepenseCategorie : true;
  });

  const netProfit = stats ? (parseFloat(stats.globalRevenue) - parseFloat(stats.globalExpenses)) : 0;

  if (loading) {
    return (
      <div className={`sa-layout-wrapper ${isLightMode ? 'sa-light-mode' : ''}`}>
        <div className="sa-loading-screen">
          <div className="sa-spinner"></div>
          <p>Chargement du système...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`sa-layout-wrapper ${isLightMode ? 'sa-light-mode' : ''}`}>
      {/* Mobile Drawer Overlay */}
      {mobileNavOpen && (
        <div className="sa-mobile-overlay" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sa-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="sa-sidebar-header">
          <div className="sa-logo-ring">
            <img src="/logo.jpg" alt="EasyFac" className="sa-brand-logo-img" />
          </div>
          <div className="sa-sidebar-title-group">
            <h1 className="sa-sidebar-title">EasyFac</h1>
            <span className="sa-sidebar-subtitle">Super Admin</span>
          </div>
          <button 
            className="sa-mobile-close-btn" 
            onClick={() => setMobileNavOpen(false)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--sa-text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sa-nav-menu">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button 
                key={tab.key}
                className={`sa-nav-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.key);
                  setMobileNavOpen(false);
                }}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sa-sidebar-footer">
          <div className="sa-user-info">
            <div className="sa-avatar">SA</div>
            <div className="sa-user-meta">
              <span className="sa-username">{user?.prenom} {user?.nom}</span>
              <span className="sa-user-role">Super Administrateur</span>
            </div>
          </div>
          <button onClick={logout} className="sa-logout-btn">
            <LogOut size={18} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="sa-main-content">
        {/* Notifications */}
        {actionError && (
          <div className="sa-notification sa-notification-error">
            <X size={16} /> {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="sa-notification sa-notification-success">
            <Check size={16} /> {actionSuccess}
          </div>
        )}

        <header className="sa-main-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="sa-mobile-toggle-btn" onClick={() => setMobileNavOpen(o => !o)} title="Ouvrir le menu">
              {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="sa-header-titles">
              <h2 className="sa-page-title">
                {TABS.find(t => t.key === activeTab)?.label || ''}
              </h2>
              <p className="sa-page-subtitle">Portail d'administration globale multi-tenant</p>
            </div>
          </div>
          <div className="sa-header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={toggleTheme} className="sa-refresh-btn" title="Basculer le thème" disabled={loading}>
              {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={handleRefresh} className="sa-refresh-btn" disabled={loading}>
              <RefreshCw className={loading ? 'spin' : ''} size={18} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="sa-loading-indicator">
            <RefreshCw className="spin sa-loading-spinner" size={40} />
            <p>Chargement des données de la plateforme...</p>
          </div>
        ) : (
          <div className="sa-tab-content-panel">

            {/* ======= DASHBOARD TAB ======= */}
            {activeTab === 'dashboard' && stats && (
              <div className="sa-tab-pane fade-in sa-dashboard-tab-layout">
                {/* KPI Cards */}
                <section className="sa-kpis-grid">
                  <div className="sa-kpi-card sa-kpi-blue">
                    <div className="sa-kpi-icon-wrapper bg-blue"><Building2 size={22} /></div>
                    <div className="sa-kpi-data">
                      <span className="sa-kpi-value">{stats.totalBoutiques}</span>
                      <span className="sa-kpi-label">Total Boutiques</span>
                    </div>
                    <ArrowUpRight className="sa-kpi-arrow" size={16} />
                  </div>

                  <div className="sa-kpi-card sa-kpi-green">
                    <div className="sa-kpi-icon-wrapper bg-green"><TrendingUp size={22} /></div>
                    <div className="sa-kpi-data">
                      <span className="sa-kpi-value">{formatCurrency(stats.globalRevenue)}</span>
                      <span className="sa-kpi-label">CA (Paiements Reçus)</span>
                    </div>
                    <ArrowUpRight className="sa-kpi-arrow sa-kpi-arrow-green" size={16} />
                  </div>

                  <div className="sa-kpi-card sa-kpi-rose">
                    <div className="sa-kpi-icon-wrapper bg-rose"><DollarSign size={22} /></div>
                    <div className="sa-kpi-data">
                      <span className="sa-kpi-value">{formatCurrency(stats.globalExpenses)}</span>
                      <span className="sa-kpi-label">Mes Dépenses</span>
                    </div>
                    <ArrowDownRight className="sa-kpi-arrow sa-kpi-arrow-red" size={16} />
                  </div>

                  <div className="sa-kpi-card sa-kpi-teal">
                    <div className="sa-kpi-icon-wrapper bg-teal"><Wallet size={22} /></div>
                    <div className="sa-kpi-data">
                      <span className={`sa-kpi-value ${netProfit >= 0 ? 'text-green' : 'text-rose'}`}>
                        {formatCurrency(netProfit)}
                      </span>
                      <span className="sa-kpi-label">Bénéfice Net</span>
                    </div>
                  </div>

                  <div className="sa-kpi-card sa-kpi-purple">
                    <div className="sa-kpi-icon-wrapper bg-purple"><Activity size={22} /></div>
                    <div className="sa-kpi-data">
                      <span className="sa-kpi-value text-green">{stats.activeBoutiques}</span>
                      <span className="sa-kpi-label">Boutiques Actives</span>
                    </div>
                  </div>

                  <div className="sa-kpi-card sa-kpi-amber">
                    <div className="sa-kpi-icon-wrapper bg-amber"><AlertTriangle size={22} /></div>
                    <div className="sa-kpi-data">
                      <span className="sa-kpi-value text-amber">{stats.inactiveBoutiques}</span>
                      <span className="sa-kpi-label">Désactivées</span>
                    </div>
                  </div>
                </section>

                {/* Charts Row */}
                <div className="sa-stats-layout">
                  {/* Revenue per boutique */}
                  <div className="sa-stats-card shadow-glass">
                    <h3 className="sa-stats-card-title">Classement CA par Boutique</h3>
                    <div className="sa-boutique-share-list">
                      {stats.boutiqueRevenues?.length === 0 ? (
                        <p className="sa-muted-text text-center">Aucun paiement de boutique enregistré.</p>
                      ) : (
                        stats.boutiqueRevenues?.map((br, index) => {
                          const pct = stats.globalRevenue > 0 
                            ? Math.round((br.ca / stats.globalRevenue) * 100) : 0;
                          const colors = ['#6366f1', '#06b6d4', '#10b981', '#ec4899', '#eab308'];
                          return (
                            <div key={br.nom} className="sa-share-item">
                              <div className="sa-share-info">
                                <span className="sa-share-name">{br.nom}</span>
                                <span className="sa-share-values">{formatCurrency(br.ca)} ({pct}%)</span>
                              </div>
                              <div className="sa-progress-bar-bg">
                                <div 
                                  className="sa-progress-bar-fill" 
                                  style={{ width: `${pct}%`, backgroundColor: colors[index % colors.length] }}
                                />
                              </div>
                              {br.montant_mensuel > 0 && (
                                <span className="sa-share-monthly">
                                  Tarif mensuel: {formatCurrency(br.montant_mensuel)}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Financial breakdown */}
                  <div className="sa-stats-card shadow-glass">
                    <h3 className="sa-stats-card-title">Synthèse Financière</h3>
                    <div className="sa-stats-breakdown-details">
                      <div className="sa-breakdown-row">
                        <span className="sa-breakdown-label">CA Brut (paiements)</span>
                        <span className="sa-breakdown-val text-green">{formatCurrency(stats.globalRevenue)}</span>
                      </div>
                      <div className="sa-breakdown-row">
                        <span className="sa-breakdown-label">Mes Dépenses</span>
                        <span className="sa-breakdown-val text-rose">— {formatCurrency(stats.globalExpenses)}</span>
                      </div>
                      <div className="sa-breakdown-row border-top">
                        <span className="sa-breakdown-label bold">Bénéfice Net</span>
                        <span className={`sa-breakdown-val bold ${netProfit >= 0 ? 'text-green' : 'text-rose'}`}>
                          {formatCurrency(netProfit)}
                        </span>
                      </div>
                      <div className="sa-breakdown-row">
                        <span className="sa-breakdown-label">Épargnes (toutes boutiques)</span>
                        <span className="sa-breakdown-val text-teal">{formatCurrency(stats.globalEpargnes)}</span>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="sa-quick-actions">
                      <button className="sa-quick-btn" onClick={() => setActiveTab('payments')}>
                        <CreditCard size={14} /> Enregistrer un paiement
                      </button>
                      <button className="sa-quick-btn sa-quick-btn-rose" onClick={() => setActiveTab('depenses')}>
                        <Receipt size={14} /> Ajouter une dépense
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent boutiques */}
                <div className="sa-stats-card shadow-glass">
                  <div className="sa-card-header-bar">
                    <h3 className="sa-card-section-title">Boutiques Récentes</h3>
                    <button className="sa-see-all-link" onClick={() => setActiveTab('boutiques')}>
                      Voir tout →
                    </button>
                  </div>
                  <div className="sa-boutiques-mini-list">
                    {boutiques.slice(0, 5).map(b => (
                      <div key={b.id} className="sa-boutique-mini-row">
                        <div className="sa-boutique-mini-icon">
                          <Building2 size={14} />
                        </div>
                        <div className="sa-boutique-mini-info">
                          <span className="sa-boutique-mini-nom">{b.nom}</span>
                          {b.telephone && <span className="sa-boutique-mini-tel">{b.telephone}</span>}
                        </div>
                        <div className="sa-boutique-mini-right">
                          <span className={`sa-status-badge ${b.statut}`}>
                            {b.statut === 'actif' ? 'Active' : 'Désactivée'}
                          </span>
                          {b.montant_mensuel && (
                            <span className="sa-boutique-mini-mensuel">{formatCurrency(b.montant_mensuel)}/mois</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ======= BOUTIQUES TAB ======= */}
            {activeTab === 'boutiques' && (
              <div className="sa-tab-pane fade-in sa-dedicated-view">
                <div className="sa-actions-bar">
                  <div className="sa-search-wrapper">
                    <Search size={18} className="sa-search-icon" />
                    <input 
                      type="text" 
                      placeholder="Rechercher boutique, téléphone, adresse..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="sa-search-input"
                    />
                  </div>

                  <div className="sa-filters-group">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="sa-filter-select">
                      <option value="all">Tous les statuts</option>
                      <option value="actif">Actives</option>
                      <option value="inactif">Désactivées</option>
                    </select>
                    <button onClick={() => { resetBoutiqueForm(); setShowAddModal(true); }} className="sa-add-btn">
                      <Plus size={18} />
                      <span>Nouvelle Boutique</span>
                    </button>
                  </div>
                </div>

                <div className="sa-table-wrapper">
                  <div className="sa-table-card sa-full-width-table">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>Boutique</th>
                          <th>Contact</th>
                          <th>Tarif Mensuel</th>
                          <th className="text-center">Utilisateurs</th>
                          <th className="text-center">Statut</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBoutiques.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="sa-table-empty">Aucune boutique trouvée</td>
                          </tr>
                        ) : (
                          filteredBoutiques.map(b => (
                            <tr key={b.id} className={b.statut === 'inactif' ? 'row-inactive' : ''}>
                              <td>
                                <div className="sa-cell-boutique-name">
                                  <span className="sa-cell-primary">{b.nom}</span>
                                  <span className="sa-cell-date">{formatDate(b.createdAt)}</span>
                                </div>
                              </td>
                              <td>
                                <div className="sa-cell-contact-stack">
                                  {b.telephone ? (
                                    <span className="sa-contact-inline"><Phone size={12} /> {b.telephone}</span>
                                  ) : <span className="sa-cell-placeholder">—</span>}
                                  {b.adresse ? (
                                    <span className="sa-contact-inline sa-muted"><MapPin size={12} /> {b.adresse}</span>
                                  ) : null}
                                </div>
                              </td>
                              <td>
                                {b.montant_mensuel ? (
                                  <span className="sa-badge-mensuel">{formatCurrency(b.montant_mensuel)}/mois</span>
                                ) : <span className="sa-cell-placeholder">Non défini</span>}
                              </td>
                              <td className="text-center">
                                <span className="sa-badge-users"><Users size={12} /> {b.nb_users}</span>
                              </td>
                              <td className="text-center">
                                <span className={`sa-status-badge ${b.statut}`}>
                                  {b.statut === 'actif' ? 'Active' : 'Désactivée'}
                                </span>
                              </td>
                              <td className="text-right">
                                <div className="sa-row-actions">
                                  {/* Toggle status */}
                                  <button 
                                    onClick={() => handleToggleStatus(b)} 
                                    className={`sa-action-icon-btn toggle ${b.statut}`}
                                    title={b.statut === 'actif' ? 'Désactiver' : 'Activer'}
                                  >
                                    {b.statut === 'actif' ? <X size={15} /> : <Check size={15} />}
                                  </button>
                                  
                                  {/* Rappel paiement */}
                                  <button 
                                    onClick={() => openReminderModal(b)} 
                                    className="sa-action-icon-btn reminder"
                                    title="Envoyer rappel WhatsApp"
                                  >
                                    <MessageCircle size={15} />
                                  </button>

                                  {/* Enregistrer paiement */}
                                  <button 
                                    onClick={() => { setPaymentBoutiqueId(b.id); setPaymentMontant(b.montant_mensuel || ''); setShowPaymentModal(true); }} 
                                    className="sa-action-icon-btn payment"
                                    title="Enregistrer un paiement"
                                  >
                                    <CreditCard size={15} />
                                  </button>

                                  {/* Edit */}
                                  <button 
                                    onClick={() => {
                                      setSelectedBoutique(b);
                                      setBoutiqueNom(b.nom);
                                      setBoutiqueTelephone(b.telephone || '');
                                      setBoutiqueAdresse(b.adresse || '');
                                      setBoutiqueMontantMensuel(b.montant_mensuel || '');
                                      setShowEditModal(true);
                                    }} 
                                    className="sa-action-icon-btn edit"
                                    title="Modifier"
                                  >
                                    <Edit2 size={15} />
                                  </button>

                                  {/* Change Password */}
                                  <button 
                                    onClick={() => { setSelectedBoutique(b); setNewPassword(''); setShowPasswordModal(true); }} 
                                    className="sa-action-icon-btn password"
                                    title="Changer mot de passe admin"
                                  >
                                    <Lock size={15} />
                                  </button>

                                  {/* Delete */}
                                  {b.id !== 'fac-soil-uuid-1111' && (
                                    deleteConfirmId === b.id ? (
                                      <div className="sa-delete-confirm-group">
                                        <button onClick={() => handleDeleteBoutique(b.id)} className="sa-action-btn-confirm">Confirmer</button>
                                        <button onClick={() => setDeleteConfirmId(null)} className="sa-action-btn-cancel">Annuler</button>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => setDeleteConfirmId(b.id)} 
                                        className="sa-action-icon-btn delete"
                                        title="Supprimer"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======= MODULES FEATURE FLAGS TAB ======= */}
            {activeTab === 'modules' && (
              <div className="sa-tab-pane fade-in sa-dedicated-view">
                <div style={{ marginBottom: 20, padding: '20px', background: 'var(--sa-card-bg)', borderRadius: '18px', border: '1px solid var(--sa-border)' }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--sa-text-main)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ToggleRight size={26} style={{ color: '#6366f1' }} /> Centre de Contrôle des Fonctionnalités & Modules
                  </h3>
                  <p style={{ fontSize: 13.5, color: 'var(--sa-text-muted)', lineHeight: 1.5, margin: 0 }}>
                    Activez ou désactivez en temps réel les fonctionnalités. Vous pouvez appliquer vos modifications <strong>à l'ensemble des boutiques</strong> ou sélectionner <strong>une boutique spécifique</strong> ci-dessous.
                  </p>
                </div>

                {/* 🎯 BOUTIQUE TARGET SELECTOR BAR */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  gap: 16,
                  marginBottom: 24,
                  padding: '16px 20px',
                  background: 'var(--sa-card-bg)',
                  borderRadius: '18px',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  flexWrap: 'wrap',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Building2 size={22} style={{ color: '#6366f1', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--sa-text-main)', display: 'block' }}>
                        Cible d'activation / désactivation :
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--sa-text-muted)', fontWeight: 500 }}>
                        {targetBoutiqueId === 'global'
                          ? '🌐 Réglementation Globale (S\'applique par défaut à toutes les boutiques)'
                          : `🏢 Réglementation Personnalisée pour la boutique : ${boutiques.find(b => b.id.toString() === targetBoutiqueId.toString())?.nom || targetBoutiqueId}`}
                      </span>
                    </div>
                  </div>

                  <select
                    value={targetBoutiqueId}
                    onChange={e => setTargetBoutiqueId(e.target.value)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1.5px solid #6366f1',
                      color: '#ffffff',
                      padding: '10px 16px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      outline: 'none',
                      cursor: 'pointer',
                      minWidth: '280px',
                      boxShadow: '0 2px 10px rgba(99, 102, 241, 0.2)'
                    }}
                  >
                    <option value="global">🌐 Toutes les boutiques (Global)</option>
                    {boutiques.map(b => (
                      <option key={b.id} value={b.id}>
                        🏢 {b.nom} ({b.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 20
                }}>
                  {MODULES_LIST_CONFIG.map(mod => {
                    const globalConfig = appModules.global || appModules;
                    const boutiqueConfig = appModules.boutiques || {};

                    const isGlobalDisabled = globalConfig[mod.key] === false;
                    const isBoutiqueDisabled = targetBoutiqueId !== 'global' && boutiqueConfig[targetBoutiqueId]?.[mod.key] === false;

                    const isActive = targetBoutiqueId === 'global'
                      ? !isGlobalDisabled
                      : (!isGlobalDisabled && !isBoutiqueDisabled);

                    const toggleCurrentState = targetBoutiqueId === 'global'
                      ? !isGlobalDisabled
                      : !isBoutiqueDisabled;

                    const IconComponent = mod.icon;

                    return (
                      <div
                        key={mod.key}
                        style={{
                          padding: '22px',
                          background: 'var(--sa-card-bg)',
                          border: isGlobalDisabled
                            ? '1px solid rgba(239, 68, 68, 0.4)'
                            : (isBoutiqueDisabled ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(34, 197, 94, 0.35)'),
                          borderRadius: '20px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                          display: 'flex',
                          flexDirection: 'column',
                          justify: 'space-between',
                          gap: 16,
                          transition: 'all 0.25s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 46,
                              height: 46,
                              borderRadius: 14,
                              background: isActive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: isActive ? '#22c55e' : '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <IconComponent size={22} />
                            </div>
                            <div>
                              <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--sa-text-main)', margin: 0 }}>
                                {mod.label}
                              </h4>
                              <span style={{ fontSize: 11, color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                                Catégorie: {mod.category}
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: 20,
                            background: isGlobalDisabled
                              ? 'rgba(239, 68, 68, 0.15)'
                              : (isBoutiqueDisabled ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)'),
                            color: isGlobalDisabled
                              ? '#ef4444'
                              : (isBoutiqueDisabled ? '#f59e0b' : '#22c55e'),
                            border: isGlobalDisabled
                              ? '1px solid rgba(239, 68, 68, 0.3)'
                              : (isBoutiqueDisabled ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'),
                            whiteSpace: 'nowrap'
                          }}>
                            {isGlobalDisabled
                              ? '🔴 Désactivé Globalement'
                              : (isBoutiqueDisabled ? '🟠 Désactivé (Boutique)' : '● Activé')}
                          </span>
                        </div>

                        <p style={{ fontSize: 12.5, color: 'var(--sa-text-secondary)', margin: 0, lineHeight: 1.45 }}>
                          {mod.desc}
                        </p>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: 14,
                          borderTop: '1px dashed var(--sa-border)',
                          marginTop: 4
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#22c55e' : (isGlobalDisabled ? '#ef4444' : '#f59e0b') }}>
                              {isActive ? 'Accès autorisé' : 'Message "Bientôt disponible"'}
                            </span>
                            {targetBoutiqueId !== 'global' && isGlobalDisabled && (
                              <span style={{ fontSize: 10, color: '#ef4444', fontStyle: 'italic', fontWeight: 600 }}>
                                ⚠️ Désactivé globalement
                              </span>
                            )}
                          </div>

                          {/* iOS-Style Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleModule(mod.key, !toggleCurrentState)}
                            title={toggleCurrentState ? 'Cliquer pour désactiver' : 'Cliquer pour réactiver'}
                            style={{
                              width: 54,
                              height: 30,
                              borderRadius: 20,
                              background: toggleCurrentState ? '#22c55e' : '#374151',
                              border: 'none',
                              position: 'relative',
                              cursor: 'pointer',
                              transition: 'background 0.25s',
                              padding: 3,
                              flexShrink: 0
                            }}
                          >
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: '#ffffff',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                              transition: 'transform 0.25s',
                              transform: toggleCurrentState ? 'translateX(24px)' : 'translateX(0)'
                            }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ======= PAYMENTS TAB ======= */}
            {activeTab === 'payments' && (
              <div className="sa-tab-pane fade-in sa-dedicated-view">
                {/* Top row: stats + button */}
                <div className="sa-actions-bar">
                  <div className="sa-stat-pill">
                    <TrendingUp size={16} />
                    <span>CA Total : <strong>{formatCurrency(stats?.globalRevenue || 0)}</strong></span>
                    {filteredPayments.length < payments.length && (
                      <span className="sa-filter-count">
                        · {filteredPayments.length} affiché{filteredPayments.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <button onClick={() => { setPaymentBoutiqueId(''); setPaymentMontant(''); setPaymentMois(''); setPaymentDesc(''); setShowPaymentModal(true); }} className="sa-add-btn">
                    <Plus size={18} />
                    <span>Enregistrer Paiement</span>
                  </button>
                </div>

                {/* Filters row */}
                <div className="sa-payments-filters-bar">
                  <div className="sa-search-wrapper sa-filter-flex">
                    <Search size={15} className="sa-search-icon" />
                    <select
                      value={filterPaymentBoutique}
                      onChange={e => setFilterPaymentBoutique(e.target.value)}
                      className="sa-search-input sa-form-select"
                    >
                      <option value="">Toutes les boutiques</option>
                      {boutiques.map(b => (
                        <option key={b.id} value={b.id}>{b.nom}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sa-search-wrapper sa-filter-flex">
                    <Calendar size={15} className="sa-search-icon" />
                    <select
                      value={filterPaymentMois}
                      onChange={e => setFilterPaymentMois(e.target.value)}
                      className="sa-search-input sa-form-select"
                    >
                      <option value="">Tous les mois</option>
                      {MONTHS_STATIC.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sa-search-wrapper sa-filter-flex">
                    <Calendar size={15} className="sa-search-icon" />
                    <select
                      value={filterPaymentAnnee}
                      onChange={e => setFilterPaymentAnnee(e.target.value)}
                      className="sa-search-input sa-form-select"
                    >
                      <option value="">Toutes les années</option>
                      {availableYears.map(y => (
                        <option key={y} value={y.toString()}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {(filterPaymentMois || filterPaymentAnnee || filterPaymentBoutique) && (
                    <button
                      onClick={() => { setFilterPaymentMois(''); setFilterPaymentAnnee(''); setFilterPaymentBoutique(''); }}
                      className="sa-clear-filter-btn"
                    >
                      <X size={14} /> Effacer
                    </button>
                  )}
                </div>

                <div className="sa-table-card sa-full-width-table">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Boutique</th>
                        <th>Mois</th>
                        <th>Description</th>
                        <th className="text-right">Montant</th>
                        <th>Enregistré le</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.length === 0 ? (
                        <tr><td colSpan="6" className="sa-table-empty">
                          {payments.length === 0 ? 'Aucun paiement enregistré' : 'Aucun résultat pour ces filtres'}
                        </td></tr>
                      ) : (
                        filteredPayments.map(p => (
                          <tr key={p.id}>
                            <td className="sa-cell-primary">{p.boutique_nom}</td>
                            <td>
                              {p.mois ? (
                                <span className="sa-badge-mois" style={{ textTransform: 'capitalize' }}>
                                  {p.mois}
                                </span>
                              ) : <span className="sa-cell-muted">—</span>}
                            </td>
                            <td className="sa-cell-muted">{p.description || '—'}</td>
                            <td className="text-right sa-cell-bold text-green">{formatCurrency(p.montant)}</td>
                            <td>{formatDate(p.createdAt)}</td>
                            <td className="text-right">
                              {deletePaymentId === p.id ? (
                                <div className="sa-delete-confirm-group">
                                  <button onClick={() => handleDeletePayment(p.id)} className="sa-action-btn-confirm">Supprimer</button>
                                  <button onClick={() => setDeletePaymentId(null)} className="sa-action-btn-cancel">Annuler</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeletePaymentId(p.id)} className="sa-action-icon-btn delete" title="Supprimer">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredPayments.length > 0 && (
                      <tfoot>
                        <tr className="sa-table-total-row">
                          <td colSpan="3" className="sa-total-label">
                            Total — {filteredPayments.length} paiement{filteredPayments.length > 1 ? 's' : ''}
                          </td>
                          <td className="text-right sa-total-value text-green">
                            {formatCurrency(filteredPayments.reduce((s, p) => s + parseFloat(p.montant || 0), 0))}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ======= DEPENSES TAB ======= */}
            {activeTab === 'depenses' && (
              <div className="sa-tab-pane fade-in sa-dedicated-view">
                <div className="sa-actions-bar">
                  <div className="sa-stat-pill sa-stat-pill-rose">
                    <Receipt size={16} />
                    <span>Total Dépenses : <strong>{formatCurrency(stats?.globalExpenses || 0)}</strong></span>
                  </div>
                  <div className="sa-filters-group">
                    <select value={filterDepenseCategorie} onChange={e => setFilterDepenseCategorie(e.target.value)} className="sa-filter-select">
                      <option value="">Toutes catégories</option>
                      {['Hébergement','Domaine','Base de données','Marketing','Logiciel','Autre'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button onClick={() => setShowAddDepenseModal(true)} className="sa-add-btn sa-add-btn-rose">
                      <Plus size={18} />
                      <span>Ajouter Dépense</span>
                    </button>
                  </div>
                </div>

                <div className="sa-table-card sa-full-width-table">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Libellé</th>
                        <th>Catégorie</th>
                        <th className="text-right">Montant</th>
                        <th>Date</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDepenses.length === 0 ? (
                        <tr><td colSpan="5" className="sa-table-empty">Aucune dépense enregistrée</td></tr>
                      ) : (
                        filteredDepenses.map(d => (
                          <tr key={d.id}>
                            <td className="sa-cell-primary">{d.libelle}</td>
                            <td><span className="sa-badge-categorie">{d.categorie}</span></td>
                            <td className="text-right sa-cell-bold text-rose">{formatCurrency(d.montant)}</td>
                            <td>{formatDate(d.createdAt)}</td>
                            <td className="text-right">
                              {deleteDepenseId === d.id ? (
                                <div className="sa-delete-confirm-group">
                                  <button onClick={() => handleDeleteDepense(d.id)} className="sa-action-btn-confirm">Supprimer</button>
                                  <button onClick={() => setDeleteDepenseId(null)} className="sa-action-btn-cancel">Annuler</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteDepenseId(d.id)} className="sa-action-icon-btn delete" title="Supprimer">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredDepenses.length > 0 && (
                      <tfoot>
                        <tr className="sa-table-total-row">
                          <td colSpan="2" className="sa-total-label">Total</td>
                          <td className="text-right sa-total-value text-rose">
                            {formatCurrency(filteredDepenses.reduce((s, d) => s + parseFloat(d.montant || 0), 0))}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}


            {/* ======= EPARGNES TAB ======= */}
            {activeTab === 'epargnes' && (
              <div className="sa-tab-pane fade-in sa-dedicated-view">
                <div className="sa-action-bar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                  <button onClick={() => setShowAddEpargneModal(true)} className="sa-btn-primary">
                    <PiggyBank size={18} style={{ marginRight: '8px' }} /> Ajouter Épargne
                  </button>
                </div>
                <div className="sa-table-card sa-full-width-table">
                  <div className="sa-card-header-bar">
                    <h3 className="sa-card-section-title">Relevé de mes Épargnes</h3>
                    <span className="sa-section-total">Total : {formatCurrency(epargnes.reduce((acc, curr) => acc + parseFloat(curr.montant), 0))}</span>
                  </div>
                  <div className="sa-table-responsive-wrapper">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Libellé</th>
                          <th className="text-right">Montant</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {epargnes.length === 0 ? (
                          <tr><td colSpan="4" className="sa-table-empty">Aucune épargne enregistrée</td></tr>
                        ) : (
                          epargnes.map(e => (
                            <tr key={e.id}>
                              <td>{formatDate(e.date_epargne)}</td>
                              <td className="sa-cell-primary">{e.libelle}</td>
                              <td className="text-right sa-cell-bold text-teal">{formatCurrency(e.montant)}</td>
                              <td className="text-right sa-actions-cell">
                                <button onClick={() => setDeleteEpargneId(e.id)} className="sa-btn-icon text-rose" title="Supprimer">
                                  <X size={18} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======= STATS TAB ======= */}
            {activeTab === 'stats' && stats && (
              <div className="sa-tab-pane fade-in sa-dedicated-view">
                <div className="sa-stats-layout full-width">
                  <div className="sa-stats-card shadow-glass">
                    <h3 className="sa-stats-card-title">Synthèse Financière Plateforme</h3>
                    <div className="sa-stats-breakdown-details">
                      <div className="sa-breakdown-row">
                        <span className="sa-breakdown-label">CA (Paiements Boutiques)</span>
                        <span className="sa-breakdown-val text-green">{formatCurrency(stats.globalRevenue)}</span>
                      </div>
                      <div className="sa-breakdown-row">
                        <span className="sa-breakdown-label">Mes Dépenses Personnelles</span>
                        <span className="sa-breakdown-val text-rose">— {formatCurrency(stats.globalExpenses)}</span>
                      </div>
                      <div className="sa-breakdown-row border-top">
                        <span className="sa-breakdown-label bold">Bénéfice Net</span>
                        <span className={`sa-breakdown-val bold ${netProfit >= 0 ? 'text-green' : 'text-rose'}`}>
                          {formatCurrency(netProfit)}
                        </span>
                      </div>
                      <div className="sa-breakdown-row">
                        <span className="sa-breakdown-label">Mes Épargnes Globales</span>
                        <span className="sa-breakdown-val text-teal">{formatCurrency(stats.globalEpargnes)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="sa-stats-card shadow-glass" style={{ gridColumn: '1 / -1' }}>
                    <h3 className="sa-stats-card-title">Comparaison des Boutiques (Chiffre d'Affaire)</h3>
                    <div style={{ width: '100%', height: 300, marginTop: '20px' }}>
                      <ResponsiveContainer>
                        <BarChart data={stats.boutiqueRevenues || []} margin={{ top: 10, right: 10, left: 20, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sa-border-light)" />
                          <XAxis dataKey="nom" stroke="var(--sa-text-muted)" tick={{ fill: 'var(--sa-text-muted)' }} />
                          <YAxis stroke="var(--sa-text-muted)" tick={{ fill: 'var(--sa-text-muted)' }} tickFormatter={(val) => `${val/1000}k`} />
                          <RechartsTooltip cursor={{ fill: 'var(--sa-hover-bg)' }} contentStyle={{ backgroundColor: 'var(--sa-card-bg)', borderColor: 'var(--sa-border-light)', color: 'var(--sa-text-main)' }} />
                          <Bar dataKey="ca" name="CA (Paiements)" radius={[4, 4, 0, 0]}>
                            {(stats.boutiqueRevenues || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#6366f1', '#06b6d4', '#10b981', '#ec4899', '#eab308'][index % 5]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="sa-stats-card shadow-glass">
                    <h3 className="sa-stats-card-title"><TrendingUp className="text-green inline-icon" size={18} /> Top 3 Boutiques</h3>
                    <div className="sa-boutique-share-list">
                      {stats.boutiqueRevenues && [...stats.boutiqueRevenues].sort((a,b)=>b.ca-a.ca).slice(0, 3).map((br, index) => (
                        <div key={br.nom} className="sa-share-item">
                          <div className="sa-share-info">
                            <span className="sa-share-name">{index + 1}. {br.nom}</span>
                            <span className="sa-share-values text-green">{formatCurrency(br.ca)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="sa-stats-card shadow-glass">
                    <h3 className="sa-stats-card-title"><ArrowDownRight className="text-rose inline-icon" size={18} /> Flop 3 Boutiques</h3>
                    <div className="sa-boutique-share-list">
                      {stats.boutiqueRevenues && [...stats.boutiqueRevenues].sort((a,b)=>a.ca-b.ca).slice(0, 3).map((br, index) => (
                        <div key={br.nom} className="sa-share-item">
                          <div className="sa-share-info">
                            <span className="sa-share-name">{br.nom}</span>
                            <span className="sa-share-values text-rose">{formatCurrency(br.ca)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========== MODALS ========== */}

      {/* ADD BOUTIQUE MODAL */}
      {showAddModal && (
        <div className="sa-modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="sa-modal-card animate-slide-up">
            <div className="sa-modal-header">
              <div className="sa-modal-title-group">
                <Building2 className="text-blue" size={22} />
                <h3 className="sa-modal-title">Nouvelle Boutique</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="sa-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateBoutique} className="sa-modal-form">
              <div className="sa-form-section">
                <h4 className="sa-section-legend">Informations Boutique</h4>
                <div className="sa-input-group">
                  <label className="sa-input-label">Nom de la Boutique *</label>
                  <input type="text" value={boutiqueNom} onChange={e => setBoutiqueNom(e.target.value)} required placeholder="Ex: Transport Dakar" className="sa-form-input" />
                </div>
                <div className="sa-inputs-row">
                  <div className="sa-input-group">
                    <label className="sa-input-label">Numéro Téléphone</label>
                    <input type="text" value={boutiqueTelephone} onChange={e => setBoutiqueTelephone(e.target.value)} placeholder="+221 77 000 00 00" className="sa-form-input" />
                  </div>
                  <div className="sa-input-group">
                    <label className="sa-input-label">Adresse</label>
                    <input type="text" value={boutiqueAdresse} onChange={e => setBoutiqueAdresse(e.target.value)} placeholder="Dakar, Sénégal" className="sa-form-input" />
                  </div>
                </div>
                <div className="sa-input-group">
                  <label className="sa-input-label">Montant Mensuel (abonnement)</label>
                  <input type="number" value={boutiqueMontantMensuel} onChange={e => setBoutiqueMontantMensuel(e.target.value)} placeholder="Ex: 15000" className="sa-form-input" min="0" />
                </div>
              </div>
              <div className="sa-form-section">
                <h4 className="sa-section-legend">Administrateur par Défaut (Optionnel)</h4>
                <div className="sa-inputs-row">
                  <div className="sa-input-group">
                    <label className="sa-input-label">Prénom</label>
                    <input type="text" value={adminPrenom} onChange={e => setAdminPrenom(e.target.value)} placeholder="Faruck" className="sa-form-input" />
                  </div>
                  <div className="sa-input-group">
                    <label className="sa-input-label">Nom</label>
                    <input type="text" value={adminNom} onChange={e => setAdminNom(e.target.value)} placeholder="Admin" className="sa-form-input" />
                  </div>
                </div>
                <div className="sa-input-group">
                  <label className="sa-input-label">Email</label>
                  <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@boutique.com" className="sa-form-input" />
                </div>
                <div className="sa-input-group">
                  <label className="sa-input-label">Mot de Passe</label>
                  <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Min 6 caractères" className="sa-form-input" />
                </div>
              </div>
              <div className="sa-modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="sa-btn-secondary">Annuler</button>
                <button type="submit" className="sa-btn-primary">Créer la Boutique</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BOUTIQUE MODAL */}
      {showEditModal && (
        <div className="sa-modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="sa-modal-card animate-slide-up">
            <div className="sa-modal-header">
              <div className="sa-modal-title-group">
                <Edit2 className="text-teal" size={20} />
                <h3 className="sa-modal-title">Modifier — {selectedBoutique?.nom}</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="sa-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleEditBoutique} className="sa-modal-form">
              <div className="sa-form-section">
                <div className="sa-input-group">
                  <label className="sa-input-label">Nom *</label>
                  <input type="text" value={boutiqueNom} onChange={e => setBoutiqueNom(e.target.value)} required className="sa-form-input" />
                </div>
                <div className="sa-inputs-row">
                  <div className="sa-input-group">
                    <label className="sa-input-label">Téléphone</label>
                    <input type="text" value={boutiqueTelephone} onChange={e => setBoutiqueTelephone(e.target.value)} placeholder="+221 77 000 00 00" className="sa-form-input" />
                  </div>
                  <div className="sa-input-group">
                    <label className="sa-input-label">Adresse</label>
                    <input type="text" value={boutiqueAdresse} onChange={e => setBoutiqueAdresse(e.target.value)} placeholder="Dakar, Sénégal" className="sa-form-input" />
                  </div>
                </div>
                <div className="sa-input-group">
                  <label className="sa-input-label">Montant Mensuel</label>
                  <input type="number" value={boutiqueMontantMensuel} onChange={e => setBoutiqueMontantMensuel(e.target.value)} placeholder="Ex: 15000" className="sa-form-input" min="0" />
                </div>
              </div>
              <div className="sa-modal-footer">
                <button type="button" onClick={() => setShowEditModal(false)} className="sa-btn-secondary">Annuler</button>
                <button type="submit" className="sa-btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="sa-modal-backdrop" onClick={e => e.target === e.currentTarget && setShowPaymentModal(false)}>
          <div className="sa-modal-card sa-modal-card-sm animate-slide-up">
            <div className="sa-modal-header">
              <div className="sa-modal-title-group">
                <CreditCard className="text-green" size={20} />
                <h3 className="sa-modal-title">Enregistrer un Paiement</h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="sa-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddPayment} className="sa-modal-form">
              <div className="sa-form-section">
                <div className="sa-input-group">
                  <label className="sa-input-label">Boutique *</label>
                  <select 
                    value={paymentBoutiqueId} 
                    onChange={e => {
                      const val = e.target.value;
                      setPaymentBoutiqueId(val);
                      const b = boutiques.find(bx => bx.id === val);
                      if (b && b.montant_mensuel) {
                        setPaymentMontant(b.montant_mensuel);
                      } else {
                        setPaymentMontant('');
                      }
                    }} 
                    required 
                    className="sa-form-input sa-form-select"
                  >
                    <option value="">Sélectionner une boutique...</option>
                    {boutiques.map(b => (
                      <option key={b.id} value={b.id}>{b.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="sa-inputs-row">
                  <div className="sa-input-group">
                    <label className="sa-input-label">Montant (FCFA) *</label>
                    <input type="number" value={paymentMontant} onChange={e => setPaymentMontant(e.target.value)} required placeholder="Sera rempli auto" className="sa-form-input" disabled />
                  </div>
                  <div className="sa-input-group">
                    <label className="sa-input-label">Mois *</label>
                    <select value={paymentMois} onChange={e => setPaymentMois(e.target.value)} required className="sa-form-input sa-form-select">
                      <option value="">Choisir un mois...</option>
                      {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sa-input-group">
                  <label className="sa-input-label">Description (optionnel)</label>
                  <input type="text" value={paymentDesc} onChange={e => setPaymentDesc(e.target.value)} placeholder="Ex: Paiement partiel, solde..." className="sa-form-input" />
                </div>
              </div>
              <div className="sa-modal-footer">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="sa-btn-secondary">Annuler</button>
                <button type="submit" className="sa-btn-primary sa-btn-green">Enregistrer Paiement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMINDER MODAL */}
      {showReminderModal && reminderBoutique && (
        <div className="sa-modal-backdrop" onClick={e => e.target === e.currentTarget && setShowReminderModal(false)}>
          <div className="sa-modal-card animate-slide-up">
            <div className="sa-modal-header">
              <div className="sa-modal-title-group">
                <MessageCircle className="text-teal" size={20} />
                <h3 className="sa-modal-title">Rappel WhatsApp — {reminderBoutique.nom}</h3>
              </div>
              <button onClick={() => setShowReminderModal(false)} className="sa-modal-close"><X size={20} /></button>
            </div>
            <div className="sa-modal-form">
              <div className="sa-form-section">
                {reminderBoutique.telephone ? (
                  <div className="sa-reminder-phone-badge">
                    <Phone size={14} />
                    <span>{reminderBoutique.telephone}</span>
                  </div>
                ) : (
                  <div className="sa-reminder-warning">
                    <AlertTriangle size={14} />
                    <span>Aucun numéro de téléphone pour cette boutique. Ajoutez-en un d'abord.</span>
                  </div>
                )}
                <div className="sa-input-group" style={{marginTop: '1rem'}}>
                  <label className="sa-input-label">Message WhatsApp</label>
                  <textarea 
                    value={reminderMessage} 
                    onChange={e => setReminderMessage(e.target.value)}
                    rows={8}
                    className="sa-form-input sa-form-textarea"
                    placeholder="Votre message..."
                  />
                </div>
              </div>
              <div className="sa-modal-footer">
                <button type="button" onClick={() => setShowReminderModal(false)} className="sa-btn-secondary">Annuler</button>
                <button 
                  type="button" 
                  onClick={handleSendReminder} 
                  className="sa-btn-primary sa-btn-whatsapp"
                  disabled={!reminderBoutique.telephone}
                >
                  <Send size={16} /> Ouvrir WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showPasswordModal && selectedBoutique && (
        <div className="sa-modal-backdrop" onClick={e => e.target === e.currentTarget && setShowPasswordModal(false)}>
          <div className="sa-modal-card sa-modal-card-sm animate-slide-up">
            <div className="sa-modal-header">
              <div className="sa-modal-title-group">
                <Lock className="text-amber" size={20} />
                <h3 className="sa-modal-title">Changer MDP — {selectedBoutique.nom}</h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="sa-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleChangePassword} className="sa-modal-form">
              <div className="sa-form-section">
                <p className="sa-form-desc">
                  Ce mot de passe sera appliqué au compte administrateur de la boutique <strong>{selectedBoutique.nom}</strong>.
                </p>
                <div className="sa-input-group">
                  <label className="sa-input-label">Nouveau Mot de Passe *</label>
                  <div className="sa-password-wrapper">
                    <input 
                      type={showNewPass ? 'text' : 'password'} 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      required 
                      minLength={6}
                      placeholder="Min. 6 caractères"
                      className="sa-form-input" 
                    />
                    <button type="button" className="sa-password-toggle" onClick={() => setShowNewPass(p => !p)}>
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="sa-modal-footer">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="sa-btn-secondary">Annuler</button>
                <button type="submit" className="sa-btn-primary sa-btn-amber">Modifier le Mot de Passe</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DEPENSE MODAL */}
      {showAddDepenseModal && (
        <div className="sa-modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAddDepenseModal(false)}>
          <div className="sa-modal-card sa-modal-card-sm animate-slide-up">
            <div className="sa-modal-header">
              <div className="sa-modal-title-group">
                <Receipt className="text-rose" size={20} />
                <h3 className="sa-modal-title">Ajouter une Dépense</h3>
              </div>
              <button onClick={() => setShowAddDepenseModal(false)} className="sa-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddDepense} className="sa-modal-form">
              <div className="sa-form-section">
                <div className="sa-input-group">
                  <label className="sa-input-label">Libellé *</label>
                  <input type="text" value={depenseLibelle} onChange={e => setDepenseLibelle(e.target.value)} required placeholder="Ex: Nom de domaine, Hébergement cloud..." className="sa-form-input" />
                </div>
                <div className="sa-inputs-row">
                  <div className="sa-input-group">
                    <label className="sa-input-label">Montant (FCFA) *</label>
                    <input type="number" value={depenseMontant} onChange={e => setDepenseMontant(e.target.value)} required placeholder="Ex: 20000" className="sa-form-input" min="0" />
                  </div>
                  <div className="sa-input-group">
                    <label className="sa-input-label">Catégorie</label>
                    <select value={depenseCategorie} onChange={e => setDepenseCategorie(e.target.value)} className="sa-form-input sa-form-select">
                      <option>Hébergement</option>
                      <option>Domaine</option>
                      <option>Base de données</option>
                      <option>Marketing</option>
                      <option>Logiciel</option>
                      <option>Autre</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="sa-modal-footer">
                <button type="button" onClick={() => setShowAddDepenseModal(false)} className="sa-btn-secondary">Annuler</button>
                <button type="submit" className="sa-btn-primary sa-btn-rose">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ADD EPARGNE MODAL */}
      {showAddEpargneModal && (
        <div className="sa-modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAddEpargneModal(false)}>
          <div className="sa-modal-card sa-modal-card-sm animate-slide-up">
            <div className="sa-modal-header">
              <div className="sa-modal-title-group">
                <PiggyBank className="text-teal" size={20} />
                <h3 className="sa-modal-title">Ajouter une Épargne</h3>
              </div>
              <button onClick={() => setShowAddEpargneModal(false)} className="sa-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEpargne} className="sa-modal-form">
              <div className="sa-form-section">
                <div className="sa-input-group">
                  <label className="sa-input-label">Libellé *</label>
                  <input type="text" value={epargneLibelle} onChange={e => setEpargneLibelle(e.target.value)} required placeholder="Ex: Épargne mensuelle Mai" className="sa-form-input" />
                </div>
                <div className="sa-inputs-row">
                  <div className="sa-input-group">
                    <label className="sa-input-label">Montant (FCFA) *</label>
                    <input type="number" value={epargneMontant} onChange={e => setEpargneMontant(e.target.value)} required placeholder="Ex: 50000" className="sa-form-input" min="0" />
                  </div>
                  <div className="sa-input-group">
                    <label className="sa-input-label">Date</label>
                    <input type="date" value={epargneDate} onChange={e => setEpargneDate(e.target.value)} className="sa-form-input" />
                  </div>
                </div>
              </div>
              <div className="sa-modal-footer">
                <button type="button" onClick={() => setShowAddEpargneModal(false)} className="sa-btn-secondary">Annuler</button>
                <button type="submit" className="sa-btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE EPARGNE */}
      {deleteEpargneId && (
        <div className="sa-modal-backdrop">
          <div className="sa-modal-card sa-modal-card-sm animate-slide-up">
            <div className="sa-modal-header sa-modal-header-danger">
              <div className="sa-modal-title-group">
                <AlertTriangle className="text-rose" size={24} />
                <h3 className="sa-modal-title text-rose">Confirmer la suppression</h3>
              </div>
            </div>
            <div className="sa-modal-body">
              <p>Voulez-vous vraiment supprimer cette épargne ?</p>
            </div>
            <div className="sa-modal-footer">
              <button onClick={() => setDeleteEpargneId(null)} className="sa-btn-secondary">Annuler</button>
              <button onClick={() => handleDeleteEpargne(deleteEpargneId)} className="sa-btn-danger">Supprimer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
