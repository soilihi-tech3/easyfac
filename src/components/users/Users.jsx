import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Shield, Plane, Mail, User, Lock, Search, FileText, Check, Truck, CreditCard, Users as UsersIcon, TrendingDown, Eye, Megaphone, FileImage, RotateCcw, LogIn, LogOut, Calendar } from 'lucide-react';
import Pagination from '../common/Pagination';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { getVoyages, API_URL } from '../../data/store';
import { createPortal } from 'react-dom';

const defaultPermissions = {
  voirClients: false,
  creerClient: false,
  modifierClient: false,
  supprimerClient: false,

  voirFactures: false,
  creerFacture: false,
  modifierFacture: false,
  supprimerFacture: false,
  realiserPaiement: false,

  voirVoyages: false,
  creerVoyage: false,
  modifierVoyage: false,
  supprimerVoyage: false,

  voirDepenses: false,
  creerDepense: false,
  modifierDepense: false,
  supprimerDepense: false,

  voirCommuniques: false,
  voirFlyer: false,

  voirRemboursements: false,
  creerRemboursement: false,
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [showModal, setShowModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedUserLogs, setSelectedUserLogs] = useState([]);
  const [activityUser, setActivityUser] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const { token, user: currentUser } = useAuth();
  const { refresh } = useApp();

  const openActivityModal = async (u) => {
    setActivityUser(u);
    setShowActivityModal(true);
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${u.id}/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedUserLogs(data);
      } else {
        setSelectedUserLogs([]);
      }
    } catch (err) {
      console.error(err);
      setSelectedUserLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };
  
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    role: 'employee',
    voyageId: '',
    telephone: '',
    active: true,
    permissions: { ...defaultPermissions }
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchUsers();
      const v = await getVoyages();
      setVoyages(v);
      setLoading(false);
    };
    init();
  }, [refresh]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingUser ? `${API_URL}/api/users/${editingUser.id}` : `${API_URL}/api/users`;
    const method = editingUser ? 'PUT' : 'POST';
    
    // Default permissions to admin if the role is admin
    const submittedForm = {
      ...form,
      permissions: form.role === 'admin' ? {
        voirClients: true,
        creerClient: true,
        modifierClient: true,
        supprimerClient: true,
        voirFactures: true,
        creerFacture: true,
        modifierFacture: true,
        supprimerFacture: true,
        realiserPaiement: true,
        voirVoyages: true,
        creerVoyage: true,
        modifierVoyage: true,
        supprimerVoyage: true,
        voirDepenses: true,
        creerDepense: true,
        modifierDepense: true,
        supprimerDepense: true,
        voirCommuniques: true,
        voirFlyer: true,
        voirRemboursements: true,
        creerRemboursement: true,
      } : form.permissions
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(submittedForm)
      });
      if (res.ok) {
        await fetchUsers();
        closeModal();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (id === currentUser.id) return alert("Vous ne pouvez pas vous supprimer vous-même.");
    if (!window.confirm("Supprimer cet employé ?")) return;
    try {
      await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleUserActive = async (u) => {
    try {
      const updatedActive = u.active !== 0 ? 0 : 1;
      const res = await fetch(`${API_URL}/api/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...u,
          active: updatedActive
        })
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      
      let parsedPerms = { ...defaultPermissions };
      if (user.permissions) {
        try {
          parsedPerms = { 
            ...parsedPerms, 
            ...(typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions) 
          };
        } catch(e) {
          console.error(e);
        }
      }
      
      setForm({ 
        nom: user.nom || '', 
        prenom: user.prenom || '', 
        email: user.email || '', 
        password: '', 
        role: user.role || 'employee', 
        voyageId: user.voyageId || '', 
        telephone: user.telephone || '',
        active: user.active !== 0,
        permissions: parsedPerms 
      });
    } else {
      setEditingUser(null);
      setForm({
        nom: '',
        prenom: '',
        email: '',
        password: '',
        role: 'employee',
        voyageId: '',
        telephone: '',
        active: true,
        permissions: { ...defaultPermissions }
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  // Helper to generate a unique, colorful premium HSL gradient avatar based on hashing user names
  const getAvatarGradient = (firstName, lastName) => {
    const fullName = `${firstName || ''}${lastName || ''}`;
    let hash = 0;
    for (let i = 0; i < fullName.length; i++) {
      hash = fullName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    // Premium vibrant HSL combination
    return `linear-gradient(135deg, hsl(${h}, 75%, 58%) 0%, hsl(${(h + 45) % 360}, 85%, 43%) 100%)`;
  };

  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase();
    return (
      u.prenom?.toLowerCase().includes(s) ||
      u.nom?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s)
    );
  });

  // Calculate high-end KPI stats
  const totalCollaborators = users.length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;
  const totalEmployees = users.filter(u => u.role === 'employee').length;

  // No blocking loading screen

  return (
    <div className="page-enter page-with-table" style={{ width: '100%' }}>
      <div className="sticky-top-section">
        {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Employés & Droits d'Accès</h1>
          <p className="page-subtitle">Pilotez les autorisations et attribuez des restrictions d'accès précises à vos collaborateurs.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()} style={{ gap: 8 }}>
          <Plus size={16} /> Nouvel Employé
        </button>
      </div>
      </div>

      {/* KPI Stats Widgets */}
      <div className="kpi-grid cols-3">
        {/* KPI 1 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--brand)', '--kpi-bg': 'var(--brand-muted)' }}>
          <div className="kpi-icon-wrap">
            <UsersIcon size={20} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{totalCollaborators}</div>
            <div className="kpi-label">Collaborateurs</div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--purple)', '--kpi-bg': 'var(--purple-muted)' }}>
          <div className="kpi-icon-wrap">
            <Shield size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{totalAdmins}</div>
            <div className="kpi-label">Administrateurs</div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--success)', '--kpi-bg': 'var(--success-muted)' }}>
          <div className="kpi-icon-wrap">
            <User size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{totalEmployees}</div>
            <div className="kpi-label">Employés Restreints</div>
          </div>
        </div>
      </div>

      {/* Main Table Box */}
      <div className="card table-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table Filter Actions Bar */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Membres de l'équipe ({filteredUsers.length})</h3>
          <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Search size={14} /></span>
            <input
              className="form-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              style={{ paddingLeft: 38, height: 38, fontSize: 13, borderRadius: 'var(--radius-md)' }}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nom & Prénom</th>
                <th>Email & Tél.</th>
                <th>Rôle</th>
                <th>Voyage Assigné</th>
                <th>Statut Compte</th>
                <th>Dernière Connexion / Déconnexion</th>
                <th>Permissions & Droits</th>
                <th style={{ width: 100, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                if (filteredUsers.length === 0) {
                  return (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        Aucun employé ne correspond à votre recherche.
                      </td>
                    </tr>
                  );
                }

                return paginatedUsers.map(u => {
                  const voyage = voyages.find(v => v.id === u.voyageId);
                  const avatarBg = getAvatarGradient(u.prenom, u.nom);

                  const formatTimestamp = (dateStr) => {
                    if (!dateStr) return 'Jamais';
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                  };

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: avatarBg,
                            color: '#ffffff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 13.5, border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: 'var(--shadow-sm)'
                          }}>
                            {u.prenom?.[0]?.toUpperCase()}{u.nom?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.prenom} {u.nom}</div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {u.id.substring(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{u.email}</div>
                        {u.telephone && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>📞 {u.telephone}</div>}
                      </td>
                      <td>
                        {u.role === 'admin' ? (
                          <span className="badge badge-brand" style={{ gap: 4, background: 'var(--purple-muted)', color: 'var(--purple)' }}>
                            <Shield size={10} /> Admin
                          </span>
                        ) : (
                          <span className="badge badge-muted" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                            Employé
                          </span>
                        )}
                      </td>
                      <td>
                        {u.role === 'admin' ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 500 }}>Tous les accès</span>
                        ) : (
                          (!u.voyageId || u.voyageId === 'all') ? (
                            <span className="badge badge-brand" style={{ gap: 4, textTransform: 'none', background: 'var(--brand-muted)', color: 'var(--brand)', fontWeight: 600 }}>
                              <Plane size={10} /> Tous les voyages
                            </span>
                          ) : (
                            voyage ? (
                              <span className="badge badge-info" style={{ gap: 4, textTransform: 'none', background: 'var(--info-muted)', color: 'var(--info)', fontWeight: 600 }}>
                                <Plane size={10} /> {voyage.nom} ({new Date(voyage.dateDepart).toLocaleDateString('fr-FR')})
                              </span>
                            ) : (
                              <span className="badge badge-danger" style={{ fontSize: 10, textTransform: 'none', background: 'var(--danger-muted)', color: 'var(--danger)' }}>
                                Voyage inexistant
                              </span>
                            )
                          )
                        )}
                      </td>
                      <td>
                        <span
                          onClick={() => u.id !== currentUser.id && toggleUserActive(u)}
                          className={`badge ${u.active !== 0 ? 'badge-success' : 'badge-danger'}`}
                          style={{
                            cursor: u.id !== currentUser.id ? 'pointer' : 'default',
                            gap: 4,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 700
                          }}
                          title={u.id !== currentUser.id ? "Cliquer pour changer le statut" : "Votre propre compte"}
                        >
                          {u.active !== 0 ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                          <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <LogIn size={11} /> Connexion : {formatTimestamp(u.lastLoginAt)}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <LogOut size={11} /> Déconnexion : {formatTimestamp(u.lastLogoutAt)}
                          </div>
                        </div>
                      </td>
                      <td>
                        {u.role === 'admin' ? (
                          <span style={{ color: 'var(--purple)', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Shield size={12} /> Accès Total Administrateur
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: 420 }}>
                            {(() => {
                              let perms = {};
                              if (u.permissions) {
                                try {
                                  perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions;
                                } catch(e){}
                              }
                              const activePerms = [
                                { key: 'voirClients', label: 'Voir Client' },
                                { key: 'creerClient', label: 'Ajout Client' },
                                { key: 'modifierClient', label: 'Mod. Client' },
                                { key: 'supprimerClient', label: 'Sup. Client' },
                                
                                { key: 'voirFactures', label: 'Voir Fac.' },
                                { key: 'creerFacture', label: 'Créer Fac.' },
                                { key: 'modifierFacture', label: 'Modif. Fac.' },
                                { key: 'supprimerFacture', label: 'Suppr. Fac.' },
                                { key: 'realiserPaiement', label: 'Paiements' },
                                
                                { key: 'voirVoyages', label: 'Voir Voy.' },
                                { key: 'creerVoyage', label: 'Créer Voy.' },
                                { key: 'modifierVoyage', label: 'Mod. Voy.' },
                                { key: 'supprimerVoyage', label: 'Sup. Voy.' },
                                
                                { key: 'voirDepenses', label: 'Voir Dép.' },
                                { key: 'creerDepense', label: 'Créer Dép.' },
                                { key: 'modifierDepense', label: 'Mod. Dép.' },
                                { key: 'supprimerDepense', label: 'Sup. Dép.' },

                                { key: 'voirCommuniques', label: 'Communiqués' },
                                { key: 'voirFlyer', label: 'Flyer' },
                              ].filter(p => !!perms[p.key]);

                              return activePerms.length > 0 ? activePerms.map(p => (
                                <span key={p.key} className="badge badge-brand" style={{ fontSize: 9.5, padding: '2px 8px', textTransform: 'none', letterSpacing: 'normal', fontWeight: 600 }}>
                                  {p.label}
                                </span>
                              )) : <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>Aucun droit configuré</span>;
                            })()}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button className="btn-icon" onClick={() => openActivityModal(u)} title="Voir Traçabilité & Activité" style={{ background: 'var(--brand-muted)', color: 'var(--brand)', borderColor: 'transparent' }}>
                            <Eye size={13} />
                          </button>
                          <button className="btn-icon" onClick={() => openModal(u)} title="Modifier"><Edit2 size={13} /></button>
                          {u.id !== currentUser.id && (
                            <button className="btn-icon danger" onClick={() => handleDelete(u.id)} title="Supprimer"><Trash2 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
        {!loading && (
          <Pagination
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 740 }}>
            <div className="modal-header" style={{ marginBottom: 24 }}>
              <h2 className="modal-title" style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
                {editingUser ? 'Modifier les accès collaborateur' : 'Enregistrer un nouveau collaborateur'}
              </h2>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Account Info Details */}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Prénom *</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }}><User size={14} /></span>
                    <input className="form-input" required value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} placeholder="Ex: Jean" style={{ paddingLeft: 38, height: 42 }} />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Nom *</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }}><User size={14} /></span>
                    <input className="form-input" required value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Ex: Dupont" style={{ paddingLeft: 38, height: 42 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Adresse Email *</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }}><Mail size={14} /></span>
                    <input type="email" className="form-input" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="collaborateur@easyfac.com" style={{ paddingLeft: 38, height: 42 }} />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Rôle Système *</label>
                  <select className="form-input form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})} style={{ height: 42, paddingLeft: 14 }}>
                    <option value="employee">Employé (Accès restreint & contrôlé)</option>
                    <option value="admin">Administrateur (Accès total inconditionnel)</option>
                  </select>
                </div>

                <div className="form-group col-span-2">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Mot de passe {editingUser && '(Laisser vide pour ne pas modifier)'}</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }}><Lock size={14} /></span>
                    <input type="password" className="form-input" required={!editingUser} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="••••••••" style={{ paddingLeft: 38, height: 42 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Numéro de Téléphone</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: 14, color: 'var(--text-muted)' }}><Search size={14} /></span>
                    <input className="form-input" value={form.telephone || ''} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="Ex: +221 77 000 00 00" style={{ paddingLeft: 38, height: 42 }} />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={!!form.active}
                      onChange={e => setForm({...form, active: e.target.checked})}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--success)' }}
                    />
                    Compte Actif (Autoriser l'accès)
                  </label>
                </div>
              </div>

              {form.role === 'employee' && (
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>Portée des Voyages Autorisés *</label>
                  <select className="form-input form-select" value={form.voyageId} onChange={e => setForm({...form, voyageId: e.target.value})} style={{ height: 42, paddingLeft: 14 }}>
                    <option value="">Tous les voyages (Accès global illimité)</option>
                    <optgroup label="Voyages spécifiques">
                      {voyages.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.nom} ({v.dateDepart ? new Date(v.dateDepart).toLocaleDateString('fr-FR') : 'Sans date'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                    Choisissez <strong>"Tous les voyages"</strong> pour que l'employé puisse voir et gérer l'ensemble des trajets, ou sélectionnez un voyage précis.
                  </p>
                </div>
              )}

              {/* PERMISSIONS GRANDULAR CHECKBOXES */}
              {form.role === 'employee' ? (
                <div style={{
                  padding: 24,
                  background: 'var(--bg-surface)',
                  borderRadius: 18,
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                    <Shield size={18} style={{ color: 'var(--brand)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Panneau d'Autorisations Granulaires de l'Employé
                    </span>
                  </div>

                  {/* 2x2 Balanced Grid */}
                  <div className="permissions-grid">
                    
                    {/* CATEGORY 1: FACTURES */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        <FileText size={15} /> Facturation
                      </div>
                      {[
                        { key: 'voirFactures', label: "Voir les Factures" },
                        { key: 'creerFacture', label: "Créer une Facture" },
                        { key: 'modifierFacture', label: "Modifier une Facture" },
                        { key: 'supprimerFacture', label: "Supprimer une Facture" },
                        { key: 'realiserPaiement', label: "Régler / Paiements" },
                      ].map(p => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={!!form.permissions?.[p.key]}
                            onChange={e => {
                              const checked = e.target.checked;
                              setForm(f => ({
                                ...f,
                                permissions: { ...f.permissions, [p.key]: checked }
                              }));
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand)' }}
                          />
                          <span style={form.permissions?.[p.key] ? { color: 'var(--text-primary)' } : {}}>{p.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* CATEGORY 2: VOYAGES */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--purple)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        <Truck size={15} /> Voyages
                      </div>
                      {[
                        { key: 'voirVoyages', label: "Voir les Voyages" },
                        { key: 'creerVoyage', label: "Créer un Voyage" },
                        { key: 'modifierVoyage', label: "Modifier un Voyage" },
                        { key: 'supprimerVoyage', label: "Supprimer un Voyage" },
                      ].map(p => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={!!form.permissions?.[p.key]}
                            onChange={e => {
                              const checked = e.target.checked;
                              setForm(f => ({
                                ...f,
                                permissions: { ...f.permissions, [p.key]: checked }
                              }));
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--purple)' }}
                          />
                          <span style={form.permissions?.[p.key] ? { color: 'var(--text-primary)' } : {}}>{p.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* CATEGORY 3: DEPENSES */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        <TrendingDown size={15} /> Dépenses
                      </div>
                      {[
                        { key: 'voirDepenses', label: "Voir les Dépenses" },
                        { key: 'creerDepense', label: "Créer une Dépense" },
                        { key: 'modifierDepense', label: "Modifier une Dépense" },
                        { key: 'supprimerDepense', label: "Supprimer une Dépense" },
                      ].map(p => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={!!form.permissions?.[p.key]}
                            onChange={e => {
                              const checked = e.target.checked;
                              setForm(f => ({
                                ...f,
                                permissions: { ...f.permissions, [p.key]: checked }
                              }));
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--danger)' }}
                          />
                          <span style={form.permissions?.[p.key] ? { color: 'var(--text-primary)' } : {}}>{p.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* CATEGORY 4: CLIENTS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--info)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        <UsersIcon size={15} /> Fichier Clients
                      </div>
                      {[
                        { key: 'voirClients', label: "Voir les Clients" },
                        { key: 'creerClient', label: "Créer un Client" },
                        { key: 'modifierClient', label: "Modifier un Client" },
                        { key: 'supprimerClient', label: "Supprimer un Client" },
                      ].map(p => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={!!form.permissions?.[p.key]}
                            onChange={e => {
                              const checked = e.target.checked;
                              setForm(f => ({
                                ...f,
                                permissions: { ...f.permissions, [p.key]: checked }
                              }));
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--info)' }}
                          />
                          <span style={form.permissions?.[p.key] ? { color: 'var(--text-primary)' } : {}}>{p.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* CATEGORY 5: COMMUNICATION & REMBOURSEMENTS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)', gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warning)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        <RotateCcw size={15} /> Communication & Remboursements
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { key: 'voirCommuniques', label: "Accès aux Communiqués WhatsApp" },
                          { key: 'voirFlyer', label: "Accès au Générateur de Flyer" },
                          { key: 'voirRemboursements', label: "Voir les Remboursements" },
                          { key: 'creerRemboursement', label: "Effectuer un Remboursement" },
                        ].map(p => (
                          <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            <input
                              type="checkbox"
                              checked={!!form.permissions?.[p.key]}
                              onChange={e => {
                                const checked = e.target.checked;
                                setForm(f => ({
                                  ...f,
                                  permissions: { ...f.permissions, [p.key]: checked }
                                }));
                              }}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--warning)' }}
                            />
                            <span style={form.permissions?.[p.key] ? { color: 'var(--text-primary)' } : {}}>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', background: 'var(--purple-muted)', color: 'var(--purple)', borderRadius: 14, border: '1px solid rgba(168, 85, 247, 0.15)', fontSize: 13, fontWeight: 600 }}>
                  <Shield size={16} /> Un administrateur dispose inconditionnellement de l'intégralité des accès de l'application.
                </div>
              )}

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 44, justifyContent: 'center', fontSize: 14 }}>
                  Enregistrer le compte & les droits
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL TRAÇABILITÉ / HISTORIQUE D'ACTIVITÉ */}
      {showActivityModal && activityUser && createPortal(
        <div className="modal-overlay" onClick={() => setShowActivityModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650, width: '90%' }}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18 }}>
                  <Eye size={20} color="var(--brand)" /> Traçabilité & Historique d'Activité
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Journal détaillé des connexions, déconnexions et réouvertures pour <strong>{activityUser.prenom} {activityUser.nom}</strong> ({activityUser.email})
                </p>
              </div>
              <button className="btn-icon" onClick={() => setShowActivityModal(false)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ padding: 24, maxHeight: '60vh', overflowY: 'auto' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Dernière Connexion</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LogIn size={14} /> {activityUser.lastLoginAt ? new Date(activityUser.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
                  </div>
                </div>
                <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Dernière Déconnexion</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LogOut size={14} /> {activityUser.lastLogoutAt ? new Date(activityUser.lastLogoutAt).toLocaleString('fr-FR') : 'Jamais'}
                  </div>
                </div>
              </div>

              <h4 style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Journal complet des événements</h4>

              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Chargement de la traçabilité...
                </div>
              ) : selectedUserLogs.length === 0 ? (
                <div style={{ textAlignment: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: 12 }}>
                  Aucun événement d'activité enregistré pour le moment. Le journal se remplira automatiquement aux prochaines connexions/déconnexions.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedUserLogs.map(log => {
                    const isLogin = log.type === 'LOGIN';
                    const isLogout = log.type === 'LOGOUT';
                    return (
                      <div key={log.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'var(--bg-surface)',
                        borderRadius: 10,
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-xs)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: isLogin ? 'var(--success)' : (isLogout ? 'var(--danger)' : 'var(--brand)')
                          }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {log.description}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              Type: {log.type}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={12} /> {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowActivityModal(false)}>Fermer</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
