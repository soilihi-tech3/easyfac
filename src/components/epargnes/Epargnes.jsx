import { getEpargnes, addEpargne, updateEpargne, deleteEpargne, getVoyages, getParametres, formatCurrency, formatDate, getEpargnesCache, getVoyagesCache } from '../../data/store';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PiggyBank, Plus, Edit2, Trash2, X, Search } from 'lucide-react';

const emptyForm = { libelle: '', montant: '', voyageId: '' };

export default function Epargnes() {
  const [epargnes, setEpargnes] = useState(() => {
    const cached = getEpargnesCache();
    return [...cached].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  });
  const [voyages, setVoyages] = useState(() => getVoyagesCache());
  const [loading, setLoading] = useState(() => {
    return getEpargnesCache().length === 0;
  });
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [filterVoyage, setFilterVoyage] = useState('');
  const [search, setSearch] = useState('');
  const [filterMois, setFilterMois] = useState('');
  const [filterAnnee, setFilterAnnee] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEp, setEditEp] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { toast, devise, refresh } = useApp();
  const { user } = useAuth();

  const [defaultVoyageId, setDefaultVoyageId] = useState('');

  const load = async () => {
    const hasCache = getEpargnesCache().length > 0;
    if (isFirstLoad && !hasCache) setLoading(true);
    try {
      const [allEpargnes, allVoyages, params] = await Promise.all([
        getEpargnes(), 
        getVoyages(),
        getParametres()
      ]);
      let eList = allEpargnes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (search) {
        const s = search.toLowerCase();
        eList = eList.filter(x => x.libelle?.toLowerCase().includes(s));
      }
      if (filterVoyage) eList = eList.filter(x => x.voyageId === filterVoyage);
      if (filterMois) {
        eList = eList.filter(x => new Date(x.createdAt).getMonth() === parseInt(filterMois));
      }
      if (filterAnnee) {
        eList = eList.filter(x => new Date(x.createdAt).getFullYear() === parseInt(filterAnnee));
      }
      setEpargnes(eList);
      setVoyages(allVoyages);
      setDefaultVoyageId(params.config?.voyageDefautId || '');
      setIsFirstLoad(false);
    } catch (err) {
      toast('Erreur de chargement des épargnes', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterVoyage, search, filterMois, filterAnnee, refresh]);

  const openAdd  = () => { 
    setForm({ 
      ...emptyForm, 
      voyageId: defaultVoyageId || filterVoyage || (voyages.length > 0 ? voyages[0].id : '') 
    }); 
    setEditEp(null); 
    setShowModal(true); 
  };
  const openEdit = (e) => { 
    setForm({ libelle: e.libelle, montant: e.montant, voyageId: e.voyageId || '' }); 
    setEditEp(e); 
    setShowModal(true); 
  };

  const handleSubmit = async () => {
    if (!form.libelle || !form.montant) { toast('Veuillez remplir tous les champs', 'error'); return; }
    const data = { ...form, montant: parseFloat(form.montant) };
    try {
      if (editEp) { 
        await updateEpargne(editEp.id, data); 
        toast('Épargne modifiée'); 
      } else { 
        await addEpargne(data); 
        toast('Épargne enregistrée'); 
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEpargne(id);
      setConfirmDelete(null);
      toast('Épargne supprimée');
      load();
    } catch (err) {
      toast('Erreur lors de la suppression', 'error');
    }
  };

  const getVoyageName = (id) => voyages.find(v => v.id === id)?.nom || '—';
  const totalEpargnes = epargnes.reduce((s, e) => s + Number(e.montant || 0), 0);

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Accès non autorisé</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>La gestion de l'épargne est exclusivement réservée à l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Épargne</h1>
          <p className="page-subtitle">
            {epargnes.length} versement{epargnes.length > 1 ? 's' : ''} —{' '}
            Total épargné : <strong style={{ color: 'var(--success)' }}>{formatCurrency(totalEpargnes, devise)}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Épargner de l'argent
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center justify-between" style={{ marginBottom: 20, width: '100%' }}>
        <div className="flex gap-3 flex-wrap flex-1" style={{ minWidth: 280 }}>
          <div className="search-bar" style={{ flex: '1 1 200px', width: '100%' }}>
            <span className="search-icon-wrap"><Search size={15} /></span>
            <input className="form-input" style={{ width: '100%' }} placeholder="Rechercher par libellé..." value={search} onChange={e => setSearch(e.target.value)} />
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
                <th>Libellé / Objet</th>
                <th>Montant épargné</th>
                <th>Voyage concerné</th>
                <th>Date de versement</th>
                <th>Saisi par</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>Chargement...</td></tr>
              ) : epargnes.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 700 }}>{e.libelle}</td>
                  <td style={{ fontWeight: 800, color: 'var(--success)' }}>
                    {formatCurrency(e.montant, devise)}
                  </td>
                  <td>
                    {e.voyageId
                      ? <span className="badge badge-info">{getVoyageName(e.voyageId)}</span>
                      : <span className="badge badge-muted">Sans voyage</span>
                    }
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(e.createdAt)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                    {e.creePar ? `${e.creePar.prenom} ${e.creePar.nom}` : 'Admin'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-icon" onClick={() => openEdit(e)} title="Modifier"><Edit2 size={14} /></button>
                      <button className="btn-icon danger" onClick={() => setConfirmDelete(e)} title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && epargnes.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon"><PiggyBank size={28} /></div>
                    <div className="empty-title">Aucune épargne enregistrée</div>
                    <div className="empty-desc">
                      {search || filterVoyage || filterMois || filterAnnee
                        ? 'Aucune épargne ne correspond à vos filtres.'
                        : 'Épargnez vos bénéfices de voyages pour sécuriser votre trésorerie.'}
                    </div>
                    {!search && !filterVoyage && !filterMois && !filterAnnee && (
                      <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Épargner de l'argent</button>
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
              <h2 className="modal-title">{editEp ? 'Modifier l\'épargne' : 'Nouvel versement d\'épargne'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={15} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Libellé / Objet du versement *</label>
                <input className="form-input" value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} placeholder="Ex. Bénéfice Voyage dakar-comores" />
              </div>
              <div className="form-group">
                <label className="form-label">Montant à épargner ({devise}) *</label>
                <input className="form-input" type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Voyage concerné</label>
                <select className="form-input form-select" value={form.voyageId} onChange={e => setForm(f => ({ ...f, voyageId: e.target.value }))}>
                  <option value="">Aucun voyage (Trésorerie générale)</option>
                  {voyages.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmit}>Valider</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && createPortal(
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Confirmer la suppression</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><X size={15} /></button>
            </div>
            <div className="modal-body">
              Êtes-vous sûr de vouloir supprimer l'épargne <strong>{confirmDelete.libelle}</strong> de <strong>{formatCurrency(confirmDelete.montant, devise)}</strong> ?
            </div>
            <div className="flex justify-end gap-3" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Supprimer</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
