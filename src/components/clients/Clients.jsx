import React, { useState, useEffect } from 'react';
import { getClients, addClient, updateClient, deleteClient, getFactures, formatCurrency } from '../../data/store';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Users, Search, Plus, Edit2, Trash2, Phone, MapPin, X, Check } from 'lucide-react';

const emptyForm = { nom: '', prenom: '', telephone: '', adresse: '' };

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [factures, setFactures] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const { toast, devise, refresh } = useApp();

  const isAdmin = user?.role === 'admin';
  let permissions = {};
  if (user?.permissions) {
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {
      console.error(e);
    }
  }

  const load = async () => {
    if (isFirstLoad) setLoading(true);
    try {
      const [allClients, allFactures] = await Promise.all([getClients(), getFactures()]);
      setClients(allClients);
      setFactures(allFactures);
      setIsFirstLoad(false);
    } catch (err) {
      toast('Erreur de chargement des clients', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [refresh, isFirstLoad]);

  const openAdd  = () => { setForm(emptyForm); setEditClient(null); setShowModal(true); };
  const openEdit = (c) => { setForm({ nom: c.nom, prenom: c.prenom, telephone: c.telephone, adresse: c.adresse }); setEditClient(c); setShowModal(true); };

  const handleSubmit = async () => {
    if (!form.nom || !form.prenom || !form.telephone) {
      toast('Veuillez remplir les champs obligatoires', 'error');
      return;
    }
    try {
      if (editClient) {
        await updateClient(editClient.id, form);
        toast('Client modifié avec succès');
      } else {
        await addClient(form);
        toast('Client ajouté avec succès');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteClient(id);
      setConfirmDelete(null);
      toast('Client supprimé');
      load();
    } catch (err) {
      toast('Erreur lors de la suppression', 'error');
    }
  };

  const getClientStats = (id) => {
    const facs = factures.filter(f => f.expediteurId === id || f.destinataireId === id);
    return { nb: facs.length, ca: facs.reduce((s, f) => s + Number(f.montantTotal || 0), 0) };
  };

  const filteredClients = clients.filter(c => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return (c.nom?.toLowerCase().includes(lower) || c.prenom?.toLowerCase().includes(lower) || c.telephone?.includes(search));
  });

  if (user?.role === 'employee' && !permissions.voirClients) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Accès non autorisé</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Vous ne disposez pas des droits d'accès requis pour consulter le fichier client.</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            {clients.length} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="search-bar">
            <span className="search-icon-wrap"><Search size={15} /></span>
            <input
              className="form-input"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {(isAdmin || permissions.creerClient) && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Nouveau client
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Téléphone</th>
                <th>Adresse</th>
                <th>Factures</th>
                <th>CA Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>Chargement...</td></tr>
              ) : filteredClients.map(c => {
                const cs = getClientStats(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: 'var(--brand-muted)', color: 'var(--brand)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-display)',
                          flexShrink: 0,
                        }}>
                          {c.prenom?.[0]}{c.nom?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.prenom} {c.nom}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <Phone size={13} />
                        {c.telephone}
                      </div>
                    </td>
                    <td>
                      {c.adresse ? (
                        <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                          <MapPin size={13} />
                          {c.adresse}
                        </div>
                      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                    </td>
                    <td><span className="badge badge-info">{cs.nb}</span></td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(cs.ca, devise)}</td>
                    <td>
                      <div className="flex gap-2">
                        {(isAdmin || permissions.modifierClient) && (
                          <button className="btn-icon" onClick={() => openEdit(c)} title="Modifier">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {(isAdmin || permissions.supprimerClient) && (
                          <button className="btn-icon danger" onClick={() => setConfirmDelete(c)} title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredClients.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon"><Users size={26} /></div>
                    <div className="empty-title">Aucun client trouvé</div>
                    <div className="empty-desc">
                      {search ? 'Aucun résultat pour cette recherche.' : 'Commencez par ajouter votre premier client.'}
                    </div>
                    {!search && (isAdmin || permissions.creerClient) && (
                      <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Ajouter un client</button>
                    )}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editClient ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={15} /></button>
            </div>
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Prénom *</label>
                <input className="form-input" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Ex: Moussa" />
              </div>
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Diallo" />
              </div>
              <div className="form-group">
                <label className="form-label">Téléphone *</label>
                <input className="form-input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="77 123 45 67" />
              </div>
              <div className="form-group">
                <label className="form-label">Adresse</label>
                <input className="form-input" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} placeholder="Dakar, Médina" />
              </div>
            </div>
            <div className="flex justify-end gap-3" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                <Check size={15} /> {editClient ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Supprimer le client ?</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><X size={15} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              Voulez-vous vraiment supprimer <strong>{confirmDelete.prenom} {confirmDelete.nom}</strong> ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete.id)}>
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
