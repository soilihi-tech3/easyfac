import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getVoyages, addVoyage, updateVoyage, deleteVoyage, getStatsVoyage, formatCurrency, formatDate } from '../../data/store';
import { useApp } from '../../context/AppContext';
import { Truck, Plus, Edit2, Trash2, Calendar, X, Check, TrendingUp, TrendingDown, DollarSign, FileText, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { nom: '', dateDepart: '', description: '' };

export default function Voyages() {
  const [voyages, setVoyages] = useState([]);
  const [factures, setFactures] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMois, setFilterMois] = useState('');
  const [filterAnnee, setFilterAnnee] = useState('');
  const [editVoyage, setEditVoyage] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { toast, devise, refresh } = useApp();
  const { user } = useAuth();

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
    setLoading(true);
    try {
      const [allVoyages, allFactures, allDepenses] = await Promise.all([
        getVoyages(),
        import('../../data/store').then(m => m.getFactures()),
        import('../../data/store').then(m => m.getDepenses())
      ]);
      setVoyages(allVoyages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setFactures(allFactures);
      setDepenses(allDepenses);
    } catch (err) {
      toast('Erreur de chargement', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [refresh]);

  const openAdd  = () => { setForm({ ...emptyForm, dateDepart: new Date().toISOString().split('T')[0] }); setEditVoyage(null); setShowModal(true); };
  const openEdit = (v) => { setForm({ nom: v.nom, dateDepart: v.dateDepart, description: v.description || '' }); setEditVoyage(v); setShowModal(true); };

  const handleSubmit = async () => {
    if (!form.nom || !form.dateDepart) { toast('Veuillez remplir les champs obligatoires', 'error'); return; }
    try {
      if (editVoyage) { await updateVoyage(editVoyage.id, form); toast('Voyage modifié'); }
      else { await addVoyage(form); toast('Voyage créé'); }
      setShowModal(false);
      load();
    } catch (err) {
      toast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteVoyage(id);
      setConfirmDelete(null);
      toast('Voyage supprimé');
      load();
    } catch (err) {
      toast('Erreur lors de la suppression', 'error');
    }
  };

  const getVoyageStats = (voyageId) => {
    const facs = factures.filter(f => f.voyageId === voyageId);
    const deps = depenses.filter(d => d.voyageId === voyageId);
    const totalEncaisse = facs.reduce((s, f) => s + Number(f.montantPaye || 0), 0);
    const totalDepenses = deps.reduce((s, d) => s + (Number(d.montant) * Number(d.quantite || 1)), 0);
    return { totalEncaisse, totalDepenses, benefice: totalEncaisse - totalDepenses, nbFactures: facs.length };
  };

  const filteredVoyages = voyages.filter(v => {
    if (search) {
      const s = search.toLowerCase();
      const matchNom = v.nom?.toLowerCase().includes(s);
      const matchDesc = v.description?.toLowerCase().includes(s);
      if (!matchNom && !matchDesc) return false;
    }
    if (filterMois) {
      const d = new Date(v.dateDepart);
      if (d.getMonth() !== parseInt(filterMois)) return false;
    }
    if (filterAnnee) {
      const d = new Date(v.dateDepart);
      if (d.getFullYear() !== parseInt(filterAnnee)) return false;
    }
    return true;
  });

  if (user?.role === 'employee' && !permissions.voirVoyages) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Accès non autorisé</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Vous ne disposez pas des droits d'accès requis pour consulter les voyages.</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Voyages</h1>
          <p className="page-subtitle">
            {filteredVoyages.length} voyage{filteredVoyages.length > 1 ? 's' : ''} affiché{filteredVoyages.length > 1 ? 's' : ''} (sur {voyages.length})
          </p>
        </div>
        {(isAdmin || permissions.creerVoyage) && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Nouveau voyage
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center justify-between" style={{ marginBottom: 20, width: '100%' }}>
        <div className="flex gap-3 flex-wrap flex-1" style={{ minWidth: 280 }}>
          <div className="search-bar" style={{ flex: '1 1 200px', width: '100%' }}>
            <span className="search-icon-wrap"><Search size={15} /></span>
            <input className="form-input" style={{ width: '100%' }} placeholder="Rechercher un voyage..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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

      {/* Cards Grid */}
      <div className="grid-3" style={{ gap: 18 }}>
        {loading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>Chargement...</div>
        ) : filteredVoyages.map(v => {
          const stats = getVoyageStats(v.id);
          const isPosifitif = stats.benefice >= 0;
          return (
            <div key={v.id} className="card card-hover" style={{ position: 'relative' }}>
              {/* Card Top */}
              <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'var(--info-muted)', color: 'var(--info)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Truck size={20} strokeWidth={1.7} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{v.nom}</div>
                    <div className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      <Calendar size={11} />
                      {formatDate(v.dateDepart)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(isAdmin || permissions.modifierVoyage) && (
                    <button className="btn-icon" onClick={() => openEdit(v)} title="Modifier"><Edit2 size={13} /></button>
                  )}
                  {(isAdmin || permissions.supprimerVoyage) && (
                    <button className="btn-icon danger" onClick={() => setConfirmDelete(v)} title="Supprimer"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>

              {v.description && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>{v.description}</p>
              )}

              <div className="divider" />

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Encaissé',  val: stats.totalEncaisse,  color: 'var(--success)', Icon: TrendingUp },
                  { label: 'Dépenses',  val: stats.totalDepenses,  color: 'var(--danger)',  Icon: TrendingDown },
                  { label: 'Bénéfice',  val: stats.benefice,       color: isPosifitif ? 'var(--success)' : 'var(--danger)', Icon: DollarSign },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-surface)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                      <s.Icon size={13} color={s.color} strokeWidth={2} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-display)', color: s.color }}>
                      {formatCurrency(s.val, devise)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <span className="badge badge-info">
                  <FileText size={10} />
                  {stats.nbFactures} facture{stats.nbFactures > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}

        {!loading && filteredVoyages.length === 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon"><Truck size={28} /></div>
                <div className="empty-title">Aucun voyage</div>
                <div className="empty-desc">
                  {search || filterMois || filterAnnee
                    ? 'Aucun voyage ne correspond aux critères de recherche.'
                    : 'Créez votre premier voyage pour commencer à gérer vos trajets.'}
                </div>
                {!search && !filterMois && !filterAnnee && (
                  <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Nouveau voyage</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editVoyage ? 'Modifier le voyage' : 'Nouveau voyage'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Nom du voyage *</label>
                <input className="form-input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Dakar - Thiès" />
              </div>
              <div className="form-group">
                <label className="form-label">Date de départ *</label>
                <input className="form-input" type="date" value={form.dateDepart} onChange={e => setForm(f => ({ ...f, dateDepart: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Notes supplémentaires..." />
              </div>
            </div>
            <div className="flex justify-end gap-3" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                <Check size={15} /> {editVoyage ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete */}
      {confirmDelete && createPortal(
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Supprimer le voyage ?</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><X size={15} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              Le voyage <strong>{confirmDelete.nom}</strong> sera supprimé définitivement.
              Les factures associées ne seront pas supprimées.
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete.id)}>
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
