import React, { useState, useEffect } from 'react';
import { getDepenses, addDepense, updateDepense, deleteDepense, getVoyages, getParametres, formatCurrency, formatDate } from '../../data/store';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { TrendingDown, Plus, Edit2, Trash2, X, Check, AlertCircle, Search } from 'lucide-react';

const emptyForm = { nom: '', quantite: 1, montant: '', voyageId: '' };

export default function Depenses() {
  const [depenses, setDepenses] = useState([]);
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterVoyage, setFilterVoyage] = useState('');
  const [search, setSearch] = useState('');
  const [filterMois, setFilterMois] = useState('');
  const [filterAnnee, setFilterAnnee] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editDep, setEditDep] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { toast, devise, refresh } = useApp();
  const { user } = useAuth();

  const [defaultVoyageId, setDefaultVoyageId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [allDepenses, allVoyages, params] = await Promise.all([
        getDepenses(), 
        getVoyages(),
        getParametres()
      ]);
      let d = allDepenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (search) {
        const s = search.toLowerCase();
        d = d.filter(x => x.nom?.toLowerCase().includes(s));
      }
      if (filterVoyage) d = d.filter(x => x.voyageId === filterVoyage);
      if (filterMois) {
        d = d.filter(x => new Date(x.createdAt).getMonth() === parseInt(filterMois));
      }
      if (filterAnnee) {
        d = d.filter(x => new Date(x.createdAt).getFullYear() === parseInt(filterAnnee));
      }
      setDepenses(d);
      setVoyages(allVoyages);
      setDefaultVoyageId(params.config?.voyageDefautId || '');
    } catch (err) {
      toast('Erreur de chargement', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterVoyage, search, filterMois, filterAnnee, refresh]);

  const openAdd  = () => { 
    setForm({ 
      ...emptyForm, 
      voyageId: defaultVoyageId || filterVoyage || (user?.role === 'employee' && voyages.length > 0 ? voyages[0].id : '') 
    }); 
    setEditDep(null); 
    setShowModal(true); 
  };
  const openEdit = (d) => { setForm({ nom: d.nom, quantite: d.quantite, montant: d.montant, voyageId: d.voyageId || '' }); setEditDep(d); setShowModal(true); };

  const handleSubmit = async () => {
    if (!form.nom || !form.montant) { toast('Veuillez remplir les champs obligatoires', 'error'); return; }
    const data = { ...form, montant: parseFloat(form.montant), quantite: parseInt(form.quantite) || 1 };
    try {
      if (editDep) { await updateDepense(editDep.id, data); toast('Dépense modifiée'); }
      else { await addDepense(data); toast('Dépense ajoutée'); }
      setShowModal(false);
      load();
    } catch (err) {
      toast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDepense(id);
      setConfirmDelete(null);
      toast('Dépense supprimée');
      load();
    } catch (err) {
      toast('Erreur de suppression', 'error');
    }
  };

  const getVoyageName = (id) => voyages.find(v => v.id === id)?.nom || '—';
  const totalDepenses = depenses.reduce((s, d) => s + (d.montant * (d.quantite || 1)), 0);

  const isAdmin = user?.role === 'admin';
  let permissions = {};
  if (user?.permissions) {
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {
      console.error(e);
    }
  }

  if (user?.role === 'employee' && !permissions.voirDepenses) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Accès non autorisé</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Vous ne disposez pas des droits d'accès requis pour consulter les dépenses.</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dépenses</h1>
          <p className="page-subtitle">
            {depenses.length} dépense{depenses.length > 1 ? 's' : ''} —{' '}
            Total: <strong style={{ color: 'var(--danger)' }}>{formatCurrency(totalDepenses, devise)}</strong>
          </p>
        </div>
        {(isAdmin || permissions.creerDepense) && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Ajouter une dépense
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center justify-between" style={{ marginBottom: 20, width: '100%' }}>
        <div className="flex gap-3 flex-wrap flex-1" style={{ minWidth: 280 }}>
          <div className="search-bar" style={{ flex: '1 1 200px', width: '100%' }}>
            <span className="search-icon-wrap"><Search size={15} /></span>
            <input className="form-input" style={{ width: '100%' }} placeholder="Rechercher une dépense..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input form-select" style={{ flex: '1 1 180px' }} value={filterVoyage} onChange={e => setFilterVoyage(e.target.value)}>
            <option value="">Tous les voyages</option>
            {voyages.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
          </select>
          <select className="form-input form-select" style={{ flex: '1 1 140px' }} value={filterMois} onChange={e => setFilterMois(e.target.value)}>
            <option value="">Tous les mois</option>
            <option value="0">Janvier</option>
            <option value="1">Février</option>
            <option value="2">Mars</option>
            <option value="3">Avril</option>
            <option value="4">Mai</option>
            <option value="5">Juin</option>
            <option value="6">Juillet</option>
            <option value="7">Août</option>
            <option value="8">Septembre</option>
            <option value="9">Octobre</option>
            <option value="10">Novembre</option>
            <option value="11">Décembre</option>
          </select>
          <select className="form-input form-select" style={{ flex: '1 1 140px' }} value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}>
            <option value="">Toutes les années</option>
            {Array.from({ length: 7 }, (_, i) => {
              const y = 2024 + i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantité</th>
                <th>Montant unitaire</th>
                <th>Total</th>
                <th>Voyage</th>
                <th>Date</th>
                <th>Saisi par</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>Chargement...</td></tr>
              ) : depenses.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.nom}</td>
                  <td>{d.quantite || 1}</td>
                  <td>{formatCurrency(d.montant, devise)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--danger)' }}>
                    {formatCurrency(d.montant * (d.quantite || 1), devise)}
                  </td>
                  <td>
                    {d.voyageId
                      ? <span className="badge badge-info">{getVoyageName(d.voyageId)}</span>
                      : <span className="badge badge-muted">Sans voyage</span>
                    }
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(d.createdAt)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                    {d.creePar ? `${d.creePar.prenom} ${d.creePar.nom}` : 'Admin'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {(isAdmin || permissions.modifierDepense) && (
                        <button className="btn-icon" onClick={() => openEdit(d)} title="Modifier"><Edit2 size={14} /></button>
                      )}
                      {(isAdmin || permissions.supprimerDepense) && (
                        <button className="btn-icon danger" onClick={() => setConfirmDelete(d)} title="Supprimer"><Trash2 size={14} /></button>
                      )}
                      {!isAdmin && !permissions.modifierDepense && !permissions.supprimerDepense && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && depenses.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-icon"><TrendingDown size={26} /></div>
                    <div className="empty-title">Aucune dépense</div>
                    <div className="empty-desc">
                      {search || filterVoyage || filterMois || filterAnnee
                        ? 'Aucune dépense ne correspond aux critères de recherche.'
                        : 'Enregistrez vos dépenses pour calculer vos bénéfices réels.'}
                    </div>
                    {(isAdmin || permissions.creerDepense) && !search && !filterVoyage && !filterMois && !filterAnnee && (
                      <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Ajouter une dépense</button>
                    )}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editDep ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <input className="form-input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Carburant, Péage..." />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Quantité</label>
                  <input className="form-input" type="number" min="1" value={form.quantite} onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Montant unitaire ({devise}) *</label>
                  <input className="form-input" type="number" min="0" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="Ex: 45 000" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Voyage associé</label>
                <select className="form-input form-select" value={form.voyageId} onChange={e => setForm(f => ({ ...f, voyageId: e.target.value }))} disabled={user?.role === 'employee' || !!defaultVoyageId}>
                  <option value="">Aucun voyage</option>
                  {voyages.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
                </select>
              </div>
              {form.montant && form.quantite && (
                <div className="alert alert-warning">
                  <AlertCircle size={16} />
                  Total: <strong>{formatCurrency(parseFloat(form.montant) * parseInt(form.quantite || 1), devise)}</strong>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                <Check size={15} /> {editDep ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Supprimer la dépense ?</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><X size={15} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              La dépense <strong>{confirmDelete.nom}</strong> ({formatCurrency(confirmDelete.montant, devise)}) sera définitivement supprimée.
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
