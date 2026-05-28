import React, { useState, useEffect, useCallback } from 'react';
import { getFactures, addFacture, updateFacture, deleteFacture, getVoyages, formatCurrency, formatDate } from '../../data/store';
import { useApp } from '../../context/AppContext';
import { FileText, Search, Plus, Eye, Edit2, Trash2, Filter, X, Check, Bell, DollarSign, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import FactureModal from './FactureModal';
import ReceiptModal from './ReceiptModal';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';

const STATUTS = [
  { value: '',         label: 'Tous les statuts' },
  { value: 'paye',     label: 'Payé' },
  { value: 'partiel',  label: 'Partiel' },
  { value: 'non_paye', label: 'Non payé' },
];

const STATUT_CFG = {
  paye:     { label: 'Payé',     cls: 'badge-green' },
  partiel:  { label: 'Partiel',  cls: 'badge-warning' },
  non_paye: { label: 'Non payé', cls: 'badge-danger' },
};

export default function Factures() {
  const { user } = useAuth();
  const [factures, setFactures] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterVoyage, setFilterVoyage] = useState('');
  const [filterPays, setFilterPays] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterMois, setFilterMois] = useState('');
  const [filterAnnee, setFilterAnnee] = useState('');
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editFacture, setEditFacture] = useState(null);
  const [viewFacture, setViewFacture] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [paymentFacture, setPaymentFacture] = useState(null);
  const [newRemaining, setNewRemaining] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const { toast, devise, prixKg, refresh, entreprise, params } = useApp();
  const config = params?.config || {};

  const isAdmin = user?.role === 'admin';
  let permissions = {};
  if (user?.permissions) {
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {
      console.error(e);
    }
  }

  const load = useCallback(async () => {
    if (isFirstLoad) setLoading(true);
    try {
      const [allFactures, allVoyages] = await Promise.all([getFactures(), getVoyages()]);
      let f = allFactures.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (search) {
        const s = search.toLowerCase();
        f = f.filter(x =>
          x.numero?.toLowerCase().includes(s) ||
          x.expediteur?.nom?.toLowerCase().includes(s) ||
          x.expediteur?.prenom?.toLowerCase().includes(s) ||
          x.destinataire?.nom?.toLowerCase().includes(s) ||
          x.destinataire?.prenom?.toLowerCase().includes(s)
        );
      }
      if (filterStatut) f = f.filter(x => x.statut === filterStatut);
      if (filterVoyage) f = f.filter(x => x.voyageId === filterVoyage);
      if (filterPays === 'comores') {
        f = f.filter(x => !!x.payerComores && Number(x.montantPaye || 0) === 0);
      }
      if (filterPays === 'senegal') {
        f = f.filter(x => !x.payerComores);
      }
      if (filterPays === 'sen_com') {
        f = f.filter(x => !!x.payerComores && Number(x.montantPaye || 0) > 0);
      }
      if (filterOverdue) {
        f = f.filter(x => {
          const hasBalance = (Number(x.montantTotal || 0) - Number(x.montantPaye || 0)) > 0;
          const hasDueDate = !!x.dateLimite;
          return hasBalance && hasDueDate;
        });
      }
      if (filterMois) {
        f = f.filter(x => new Date(x.createdAt).getMonth() === parseInt(filterMois));
      }
      if (filterAnnee) {
        f = f.filter(x => new Date(x.createdAt).getFullYear() === parseInt(filterAnnee));
      }
      setFactures(f);
      setVoyages(allVoyages);
      setIsFirstLoad(false);
    } catch (err) {
      toast('Erreur de chargement des factures', 'error');
    }
    setLoading(false);
  }, [search, filterStatut, filterVoyage, filterPays, filterOverdue, filterMois, filterAnnee, isFirstLoad]);

  const startPayment = (f) => {
    setPaymentFacture(f);
    const remaining = Number(f.montantTotal || 0) - Number(f.montantPaye || 0);
    setNewRemaining('0'); // default remaining to 0 (paid off)
    setPaymentAmount(String(remaining)); // defaults payment to the full remaining amount
  };

  const handleRemainingChange = (valStr) => {
    if (!paymentFacture) return;
    const remainingLimit = Number(paymentFacture.montantTotal || 0) - Number(paymentFacture.montantPaye || 0);
    
    if (valStr === '') {
      setNewRemaining('');
      setPaymentAmount(String(remainingLimit));
      return;
    }

    const val = Number(valStr);
    const cleanVal = Math.max(0, Math.min(remainingLimit, val));
    setNewRemaining(String(cleanVal));
    setPaymentAmount(String(Math.max(0, remainingLimit - cleanVal)));
  };

  const handlePaymentChange = (valStr) => {
    if (!paymentFacture) return;
    const remainingLimit = Number(paymentFacture.montantTotal || 0) - Number(paymentFacture.montantPaye || 0);
    
    if (valStr === '') {
      setPaymentAmount('');
      setNewRemaining(String(remainingLimit));
      return;
    }

    const val = Number(valStr);
    const cleanVal = Math.max(0, Math.min(remainingLimit, val));
    setPaymentAmount(String(cleanVal));
    setNewRemaining(String(Math.max(0, remainingLimit - cleanVal)));
  };

  const submitPayment = async () => {
    if (!paymentFacture) return;
    try {
      const remainingVal = Number(newRemaining || 0);
      const newMontantPaye = Number(paymentFacture.montantTotal || 0) - remainingVal;
      let newStatut = 'partiel';
      if (remainingVal === 0) {
        newStatut = 'paye';
      } else if (remainingVal === Number(paymentFacture.montantTotal || 0)) {
        newStatut = 'non_paye';
      }

      // Format dateLimite to YYYY-MM-DD to avoid MySQL 500 error on ISO-8601 strings
      const formattedDateLimite = paymentFacture.dateLimite
        ? new Date(paymentFacture.dateLimite).toISOString().split('T')[0]
        : null;

      await updateFacture(paymentFacture.id, {
        ...paymentFacture,
        dateLimite: formattedDateLimite,
        montantPaye: newMontantPaye,
        statut: newStatut
      });

      toast('Paiement enregistré avec succès');
      setPaymentFacture(null);
      load();
    } catch (err) {
      toast("Erreur lors de l'enregistrement du paiement", 'error');
    }
  };



  useEffect(() => { load(); }, [load, refresh]);

  const openAdd  = () => { setEditFacture(null); setShowModal(true); };
  const openEdit = (f) => { setEditFacture(f); setShowModal(true); };
  const openView = (f) => setViewFacture(f);

  const handleSave = async (data) => {
    try {
      if (editFacture) {
        await updateFacture(editFacture.id, data);
        toast('Facture modifiée');
      } else {
        await addFacture(data);
        toast('Facture créée avec succès');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast('Erreur d\'enregistrement', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteFacture(id);
      toast('Facture supprimée', 'success');
      load();
      setConfirmDelete(null);
    } catch (err) {
      toast('Erreur lors de la suppression', 'error');
    }
  };

  const handleReminderWhatsApp = (facture) => {
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
      `*${entreprise?.nom || 'EASYFAC'}*`
    ].join('\n');
    
    let phone = facture.expediteur?.telephone || facture.destinataire?.telephone || '';
    phone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank');
  };

  const getVoyageName = (id) => voyages.find(v => v.id === id)?.nom || '—';
  const totalCA   = factures.reduce((s, f) => s + Number(f.montantTotal || 0), 0);
  const totalPaye = factures.reduce((s, f) => s + Number(f.montantPaye || 0), 0);

  if (user?.role === 'employee' && !permissions.voirFactures) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Accès non autorisé</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Vous ne disposez pas des droits d'accès requis pour consulter les factures.</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Factures</h1>
          <p className="page-subtitle">Pilotez la facturation, enregistrez les règlements et suivez les soldes.</p>
        </div>
        {(isAdmin || permissions.creerFacture) && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Nouvelle facture
          </button>
        )}
      </div>

      {/* Factures KPI Grid */}
      <div className="kpi-grid cols-4">
        {/* KPI 1 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--info)', '--kpi-bg': 'var(--info-muted)' }}>
          <div className="kpi-icon-wrap">
            <FileText size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{factures.length}</div>
            <div className="kpi-label">Nombre de factures</div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--brand)', '--kpi-bg': 'var(--brand-muted)' }}>
          <div className="kpi-icon-wrap">
            <TrendingUp size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{formatCurrency(totalCA, devise)}</div>
            <div className="kpi-label">Chiffre d'affaires</div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--success)', '--kpi-bg': 'var(--success-muted)' }}>
          <div className="kpi-icon-wrap">
            <CheckCircle size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{formatCurrency(totalPaye, devise)}</div>
            <div className="kpi-label">Montant encaissé</div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--danger)', '--kpi-bg': 'var(--danger-muted)' }}>
          <div className="kpi-icon-wrap">
            <Clock size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{formatCurrency(totalCA - totalPaye, devise)}</div>
            <div className="kpi-label">Reste à percevoir</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3" style={{ marginBottom: 20, width: '100%' }}>
        {/* Row 1: Search and Main categories */}
        <div className="flex gap-3 flex-wrap items-center justify-between" style={{ width: '100%' }}>
          <div className="flex gap-3 flex-wrap flex-1" style={{ minWidth: 280 }}>
            <div className="search-bar" style={{ flex: '2 1 240px' }}>
              <span className="search-icon-wrap"><Search size={15} /></span>
              <input className="form-input" style={{ width: '100%' }} placeholder="Rechercher par N° facture, expéditeur, destinataire..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-input form-select" style={{ flex: '1 1 140px' }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
              {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className="form-input form-select" style={{ flex: '1 1 140px' }} value={filterPays} onChange={e => setFilterPays(e.target.value)}>
              <option value="">Tous les pays</option>
              <option value="senegal">Sénégal</option>
              <option value="comores">Comores (100%)</option>
              <option value="sen_com">Sen-Com (Mixte)</option>
            </select>
          </div>
          <button
            className={`btn ${filterOverdue ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setFilterOverdue(!filterOverdue)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 42,
              padding: '0 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              flexShrink: 0,
              ...(filterOverdue ? {
                background: 'var(--danger)',
                color: '#ffffff'
              } : {
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)'
              })
            }}
            onMouseOver={e => {
              if (!filterOverdue) {
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.color = 'var(--text-main)';
              }
            }}
            onMouseOut={e => {
              if (!filterOverdue) {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <Bell size={14} />
            {filterOverdue ? "Toutes les factures" : "Rappels d'échéances"}
          </button>
        </div>

        {/* Row 2: Voyages and Dates */}
        <div className="flex gap-3 flex-wrap items-center" style={{ width: '100%' }}>
          <select className="form-input form-select" style={{ flex: '2 1 200px' }} value={filterVoyage} onChange={e => setFilterVoyage(e.target.value)}>
            <option value="">Tous les voyages</option>
            {voyages.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
          </select>
          <select className="form-input form-select" style={{ flex: '1 1 120px' }} value={filterMois} onChange={e => setFilterMois(e.target.value)}>
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
          <select className="form-input form-select" style={{ flex: '1 1 120px' }} value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}>
            <option value="">Toutes les années</option>
            {Array.from({ length: 7 }, (_, i) => {
              const y = 2024 + i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Expéditeur</th>
                <th>Destinataire</th>
                <th>Voyage</th>
                <th>Pays</th>
                <th>Total</th>
                <th>Payé</th>
                <th>Reste</th>
                <th>Statut</th>
                <th>Date d'échéance</th>
                <th>Date</th>
                <th>Enregistré par</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} style={{ textAlign: 'center', padding: '40px' }}>Chargement...</td></tr>
              ) : factures.map(f => (
                <tr key={f.id}>
                  <td>
                    <code
                      style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em' }}
                      onClick={() => openView(f)}
                    >
                      {f.numero}
                    </code>
                  </td>
                  <td style={{ fontWeight: 500 }}>{f.expediteur?.prenom} {f.expediteur?.nom}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{f.destinataire?.prenom} {f.destinataire?.nom}</td>
                  <td><span className="badge badge-info" style={{ fontSize: 10 }}>{getVoyageName(f.voyageId)}</span></td>
                  <td>
                    {f.payerComores ? (
                      Number(f.montantPaye || 0) > 0 ? (
                        <span className="badge badge-purple" style={{ fontSize: 10, background: 'linear-gradient(135deg, var(--info-muted) 0%, var(--purple-muted) 100%)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>Sen-Com</span>
                      ) : (
                        <span className="badge badge-purple" style={{ fontSize: 10 }}>Comores</span>
                      )
                    ) : (
                      <span className="badge badge-muted" style={{ fontSize: 10 }}>Sénégal</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(f.montantTotal, devise)}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(f.montantPaye, devise)}</td>
                  <td style={{ color: f.montantTotal - f.montantPaye > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {formatCurrency(f.montantTotal - f.montantPaye, devise)}
                  </td>
                  <td><span className={`badge ${STATUT_CFG[f.statut]?.cls}`}>{STATUT_CFG[f.statut]?.label}</span></td>
                  <td style={{ color: f.dateLimite && (f.montantTotal - f.montantPaye > 0) ? 'var(--danger)' : 'var(--text-muted)', fontSize: 12, fontWeight: f.dateLimite ? 600 : 400 }}>
                    {f.dateLimite ? formatDate(f.dateLimite) : '-'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(f.createdAt)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                    {f.creePar ? `${f.creePar.prenom} ${f.creePar.nom}` : 'Admin'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {f.montantTotal - f.montantPaye > 0 && (
                        <>
                          {(isAdmin || permissions.realiserPaiement) && (
                            <button className="btn-icon danger" onClick={() => handleReminderWhatsApp(f)} title="Notifier (WhatsApp)"><Bell size={14} /></button>
                          )}
                          {(isAdmin || permissions.realiserPaiement) && (
                            <button className="btn-icon" style={{ color: 'var(--success)' }} onClick={() => startPayment(f)} title="Réaliser un paiement"><DollarSign size={14} /></button>
                          )}
                        </>
                      )}
                      <button className="btn-icon" onClick={() => openView(f)} title="Aperçu"><Eye size={14} /></button>
                      {(isAdmin || permissions.modifierFacture) && (
                        <button className="btn-icon" onClick={() => openEdit(f)} title="Modifier"><Edit2 size={14} /></button>
                      )}
                      {(isAdmin || permissions.supprimerFacture) && (
                        <button className="btn-icon danger" onClick={() => setConfirmDelete(f)} title="Supprimer"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && factures.length === 0 && (
                <tr><td colSpan={13}>
                  <div className="empty-state">
                    <div className="empty-icon"><FileText size={26} /></div>
                    <div className="empty-title">Aucune facture trouvée</div>
                    <div className="empty-desc">
                      {search || filterStatut || filterVoyage || filterPays
                        ? 'Aucun résultat pour ces filtres.'
                        : 'Créez votre première facture.'}
                    </div>
                    {(isAdmin || permissions.creerFacture) && !search && !filterStatut && !filterVoyage && !filterPays && (
                      <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Nouvelle facture</button>
                    )}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <FactureModal
          facture={editFacture}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          prixKg={prixKg}
          devise={devise}
        />
      )}

      {viewFacture && (
        <ReceiptModal
          facture={viewFacture}
          onClose={() => setViewFacture(null)}
          devise={devise}
        />
      )}

      {confirmDelete && createPortal(
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Supprimer la facture ?</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><X size={15} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              La facture <strong>{confirmDelete.numero}</strong> sera définitivement supprimée.
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

      {paymentFacture && createPortal(
        <div className="modal-overlay" onClick={() => setPaymentFacture(null)}>
          <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Réaliser un paiement</h2>
              <button className="modal-close" onClick={() => setPaymentFacture(null)}><X size={15} /></button>
            </div>
            
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Facture N°</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>{paymentFacture.numero}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, padding: '12px', background: 'var(--bg-elevated)', borderRadius: '10px' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Montant Total</span>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {formatCurrency(paymentFacture.montantTotal, devise)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reste actuel à payer</span>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginTop: 2 }}>
                  {formatCurrency(paymentFacture.montantTotal - paymentFacture.montantPaye, devise)}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13 }}>Saisir le nouveau Reste à Payer (Restant)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  className="form-input"
                  value={newRemaining}
                  onChange={e => handleRemainingChange(e.target.value)}
                  placeholder="0"
                  min="0"
                  max={paymentFacture.montantTotal - paymentFacture.montantPaye}
                  style={{ paddingRight: 60 }}
                />
                <span style={{ position: 'absolute', right: 14, color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
                  {devise}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Le versement correspondant calculé sera de : <strong style={{ color: 'var(--success)' }}>{formatCurrency(Number(paymentAmount || 0), devise)}</strong>.
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13 }}>Ou saisir directement le Versement</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  className="form-input"
                  value={paymentAmount}
                  onChange={e => handlePaymentChange(e.target.value)}
                  placeholder="0"
                  min="0"
                  max={paymentFacture.montantTotal - paymentFacture.montantPaye}
                  style={{ paddingRight: 60 }}
                />
                <span style={{ position: 'absolute', right: 14, color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
                  {devise}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button className="btn btn-secondary" onClick={() => setPaymentFacture(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={submitPayment}>
                Valider le paiement
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
