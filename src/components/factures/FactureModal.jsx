import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { getClients, getVoyages, searchClients, getNextNumero, formatCurrency } from '../../data/store';
import { X, Search, Package, Send, Truck, CreditCard, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
const MODES_PAIEMENT = [
  { value: 'cash',         label: 'Cash' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'wave',         label: 'Wave' },
  { value: 'mixte',        label: 'Mixte' },
];

const emptyArticle = () => ({ id: uuid(), nom: '', quantite: 1, prixUnitaire: 0, total: 0 });

import { createPortal } from 'react-dom';

export default function FactureModal({ facture, onClose, onSave, prixKg, devise }) {
  const { user } = useAuth();
  const [defaultVoyageId, setDefaultVoyageId] = useState('');
  
  const [form, setForm] = useState(facture ? {
    ...facture,
    payerComores: facture.payerComores || 0,
    montantComores: String(facture.montantComores || 0),
  } : {
    numero: '',
    expediteur: { nom: '', prenom: '', telephone: '' },
    destinataire: { nom: '', prenom: '', telephone: '' },
    articles: [emptyArticle()],
    poidsTotal: 0,
    prixKg: prixKg || 6000,
    fraisFret: 0,
    montantTotal: 0,
    montantPaye: 0,
    statut: 'non_paye',
    modePaiement: 'cash',
    voyageId: '',
    note: '',
    dateLimite: '',
    payerComores: 0,
    montantComores: '0',
  });

  // If editing, format the existing dateLimite to YYYY-MM-DD
  useEffect(() => {
    if (facture && facture.dateLimite) {
      setForm(f => ({ ...f, dateLimite: new Date(facture.dateLimite).toISOString().split('T')[0] }));
    }
  }, [facture]);

  const [voyages, setVoyages] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(!facture);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientTarget, setClientTarget] = useState('expediteur');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [allVoyages, allClients, params] = await Promise.all([
          getVoyages(), 
          getClients(),
          import('../../data/store').then(m => m.getParametres())
        ]);
        setVoyages(allVoyages);
        setClients(allClients);
        const defId = params.config?.voyageDefautId || '';
        setDefaultVoyageId(defId);
        
        if (!facture) {
          const num = await getNextNumero();
          setForm(f => ({ 
            ...f, 
            numero: num, 
            prixKg: prixKg || 6000, 
            voyageId: defId || ((user?.role === 'employee' && allVoyages.length > 0) ? allVoyages[0].id : '')
          }));
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, [facture, prixKg]);

  useEffect(() => {
    if (clientSearch.length >= 2) {
      const s = clientSearch.toLowerCase();
      const results = clients.filter(c => 
        c.nom?.toLowerCase().includes(s) || 
        c.prenom?.toLowerCase().includes(s) || 
        c.telephone?.includes(s)
      ).slice(0, 6);
      setClientResults(results);
      setShowClientDropdown(true);
    } else {
      setShowClientDropdown(false);
    }
  }, [clientSearch, clients]);

  const selectClient = (client) => {
    setForm(f => ({ ...f, [clientTarget]: { id: client.id, nom: client.nom, prenom: client.prenom, telephone: client.telephone } }));
    setShowClientDropdown(false);
    setClientSearch('');
  };

  const updateExp  = (field, value) => setForm(f => ({ ...f, expediteur:  { ...f.expediteur,  [field]: value, id: undefined } }));
  const updateDest = (field, value) => setForm(f => ({ ...f, destinataire: { ...f.destinataire, [field]: value, id: undefined } }));

  const updateArticle = (id, field, value) => {
    setForm(f => {
      const articles = f.articles.map(a => {
        if (a.id !== id) return a;
        const updated = { ...a, [field]: value };
        updated.total = (parseFloat(updated.quantite) || 0) * (parseFloat(updated.prixUnitaire) || 0);
        return updated;
      });
      return { ...f, articles };
    });
  };

  const addArticle = () => {
    setForm(f => {
      const a = emptyArticle();
      return { ...f, articles: [...f.articles, a] };
    });
  };

  const removeArticle = (id) => {
    setForm(f => {
      const articles = f.articles.filter(a => a.id !== id);
      return { ...f, articles };
    });
  };

  const updateFret = (field, value) => {
    setForm(f => {
      const nf = { ...f, [field]: value };
      const fraisFret = (parseFloat(nf.poidsTotal) || 0) * (parseFloat(nf.prixKg) || 0);
      const montantTotal = fraisFret; // Total is ONLY the transport cost
      return { ...nf, fraisFret, montantTotal };
    });
  };

  const handlePaye = (value) => {
    const montantPaye = value;
    const numPaye = parseFloat(value) || 0;
    let statut = 'non_paye';
    if (numPaye >= form.montantTotal && form.montantTotal > 0) statut = 'paye';
    else if (numPaye > 0) statut = 'partiel';
    setForm(f => ({ ...f, montantPaye, statut }));
  };

  const validate = () => {
    const e = {};
    if (!form.expediteur?.nom || !form.expediteur?.prenom) e.exp = 'Informations expéditeur requises';
    if (!form.destinataire?.nom || !form.destinataire?.prenom) e.dest = 'Informations destinataire requises';
    if (form.articles.length === 0 || form.articles.every(a => !a.nom)) e.articles = 'Ajoutez au moins un article';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSaving(true);
    // On plafonne le montant payé au total de la facture pour ne pas fausser la comptabilité
    const numPaye = parseFloat(form.montantPaye) || 0;
    const cappedPaye = Math.min(numPaye, form.montantTotal);
    const data = { 
      ...form, 
      montantPaye: cappedPaye,
      montantComores: parseFloat(form.montantComores) || 0
    };

    onSave(data).finally(() => setSaving(false));
  };

  const openClientSearch = (target) => {
    setClientTarget(target);
    setClientSearch('');
    searchRef.current?.focus();
  };

  const SectionHead = ({ Icon, label, color = 'var(--brand)' }) => (
    <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} strokeWidth={2} />
      </div>
      <span className="section-label" style={{ margin: 0 }}>{label}</span>
    </div>
  );

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{facture ? 'Modifier la facture' : 'Nouvelle facture'}</h2>
          <button className="modal-close" onClick={onClose}><X size={15} /></button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Chargement...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* N° + Voyage */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Numéro de facture</label>
              <input className="form-input" disabled value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Voyage associé</label>
              <select 
                className="form-input form-select" 
                value={form.voyageId} 
                onChange={e => setForm(f => ({ ...f, voyageId: e.target.value }))}
                disabled={user?.role === 'employee' || !!defaultVoyageId}
              >
                <option value="">Aucun voyage</option>
                {voyages.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
              </select>
            </div>
          </div>

          {/* Client Search */}
          <div className="info-box" style={{ position: 'relative' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div className="flex items-center gap-2">
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="section-label" style={{ margin: 0 }}>Recherche client existant</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${clientTarget === 'expediteur' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => openClientSearch('expediteur')}
                >
                  Pour expéditeur
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${clientTarget === 'destinataire' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => openClientSearch('destinataire')}
                >
                  Pour destinataire
                </button>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                ref={searchRef}
                className="form-input"
                placeholder="Tapez un nom ou téléphone..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
              {showClientDropdown && clientResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                  borderRadius: 10, zIndex: 100, boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
                }}>
                  {clientResults.map(c => (
                    <div
                      key={c.id}
                      onClick={() => selectClient(c)}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13.5, display: 'flex', gap: 12, alignItems: 'center', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: 'var(--brand-muted)', color: 'var(--brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                      }}>
                        {c.prenom?.[0]}{c.nom?.[0]}
                      </div>
                      <span style={{ fontWeight: 600 }}>{c.prenom} {c.nom}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{c.telephone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Expéditeur + Destinataire */}
          <div className="grid-2" style={{ gap: 20 }}>
            <div>
              <SectionHead Icon={Send} label="Expéditeur" color="var(--brand)" />
              {errors.exp && <div className="alert alert-error" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 12 }}>{errors.exp}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Prénom *</label>
                    <input className="form-input" value={form.expediteur?.prenom || ''} onChange={e => updateExp('prenom', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nom *</label>
                    <input className="form-input" value={form.expediteur?.nom || ''} onChange={e => updateExp('nom', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input className="form-input" value={form.expediteur?.telephone || ''} onChange={e => updateExp('telephone', e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <SectionHead Icon={Package} label="Destinataire" color="var(--info)" />
              {errors.dest && <div className="alert alert-error" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 12 }}>{errors.dest}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Prénom *</label>
                    <input className="form-input" value={form.destinataire?.prenom || ''} onChange={e => updateDest('prenom', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nom *</label>
                    <input className="form-input" value={form.destinataire?.nom || ''} onChange={e => updateDest('nom', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input className="form-input" value={form.destinataire?.telephone || ''} onChange={e => updateDest('telephone', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Articles */}
          <div>
            <SectionHead Icon={Package} label="Articles & Transport" color="var(--warning)" />
            {errors.articles && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errors.articles}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="article-header-grid">
                {['Article', 'Qté', 'Prix unitaire', 'Total', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                ))}
              </div>
              {form.articles.map(a => (
                <div key={a.id} className="article-grid">
                  <div className="article-col-nom">
                    <span className="mobile-only-label">Article</span>
                    <input className="form-input" placeholder="Nom de l'article" value={a.nom} onChange={e => updateArticle(a.id, 'nom', e.target.value)} />
                  </div>
                  <div className="article-col-qte">
                    <span className="mobile-only-label">Qté</span>
                    <input className="form-input" type="number" min="1" value={a.quantite} onChange={e => updateArticle(a.id, 'quantite', e.target.value)} />
                  </div>
                  <div className="article-col-pu">
                    <span className="mobile-only-label">Prix unitaire</span>
                    <input className="form-input" type="number" min="0" value={a.prixUnitaire} onChange={e => updateArticle(a.id, 'prixUnitaire', e.target.value)} />
                  </div>
                  <div className="article-col-total">
                    <span className="mobile-only-label">Total</span>
                    <div style={{
                      background: 'var(--brand-muted)', color: 'var(--brand)',
                      padding: '10px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13, textAlign: 'right',
                    }}>
                      {formatCurrency(a.total, devise)}
                    </div>
                  </div>
                  <div className="article-col-action">
                    <button className="btn-icon danger" onClick={() => removeArticle(a.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={addArticle}>
                <Plus size={13} /> Ajouter un article
              </button>
            </div>

            {/* Transport / Fret */}
            <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-default)' }}>
              <div className="transport-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Poids total du colis (kg)</label>
                  <input className="form-input" type="number" min="0" step="0.5" value={form.poidsTotal} onChange={e => updateFret('poidsTotal', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Prix au kg ({devise})</label>
                  <input className="form-input" disabled type="number" min="0" value={form.prixKg} onChange={e => updateFret('prixKg', e.target.value)} />
                </div>
                <div className="transport-total-col">
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Frais de transport</div>
                  <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand)' }}>
                    {formatCurrency(form.fraisFret, devise)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Paiement */}
          <div className="info-box">
            <SectionHead Icon={CreditCard} label="Paiement" color="var(--success)" />
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Mode de paiement</label>
                <select className="form-input form-select" value={form.modePaiement} onChange={e => setForm(f => ({ ...f, modePaiement: e.target.value }))}>
                  {MODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Montant payé ({devise})</label>
                <input className="form-input" type="number" min="0" value={form.montantPaye} onChange={e => handlePaye(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-default)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Total facture</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>
                {formatCurrency(form.montantTotal, devise)}
              </span>
            </div>
            
            {/* Affichage du Reste à payer (si le client n'a pas tout payé) */}
            {form.montantTotal - (parseFloat(form.montantPaye) || 0) > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', background: 'var(--danger-muted)', borderRadius: 10 }}>
                  <span style={{ color: 'var(--danger)', fontSize: 13 }}>Reste à payer</span>
                  <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>{formatCurrency(form.montantTotal - (parseFloat(form.montantPaye) || 0), devise)}</span>
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Date d'échéance de paiement</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={form.dateLimite || ''} 
                    onChange={e => setForm(f => ({ ...f, dateLimite: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Affichage de la monnaie À rendre (si le client donne plus) */}
            {(parseFloat(form.montantPaye) || 0) - form.montantTotal > 0 && (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', background: 'var(--success-muted)', borderRadius: 10, border: '1px solid var(--success)' }}>
                <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>À rendre (monnaie)</span>
                <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 15 }}>{formatCurrency((parseFloat(form.montantPaye) || 0) - form.montantTotal, devise)}</span>
              </div>
            )}
             {/* Options additionnelles : Payer aux Comores */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12, padding: '14px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', fontWeight: 600, fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  checked={!!form.payerComores}
                  onChange={e => {
                    const checked = e.target.checked;
                    const remaining = Math.max(0, form.montantTotal - (parseFloat(form.montantPaye) || 0));
                    setForm(f => ({
                      ...f,
                      payerComores: checked ? 1 : 0,
                      montantComores: checked ? String(remaining) : '0'
                    }));
                  }}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand)' }}
                />
                <span style={{ color: 'var(--text-primary)' }}>Payer le reste aux Comores</span>
              </label>

              {!!form.payerComores && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700 }}>Montant à payer aux Comores ({devise})</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={form.montantComores}
                        onChange={e => {
                          const val = e.target.value;
                          // Allow empty string, decimals, or numbers
                          if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                            setForm(f => ({ ...f, montantComores: val }));
                          }
                        }}
                        style={{ paddingRight: 60 }}
                      />
                      <span style={{ position: 'absolute', right: 14, color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
                        {devise}
                      </span>
                    </div>
                  </div>

                  {devise !== 'KMF' && (
                    <>
                      <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--brand-muted)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Equivalent en Franc Comorien (KMF)</span>
                        <strong style={{ fontSize: 14, color: 'var(--brand)', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>
                          {formatCurrency((parseFloat(form.montantComores) || 0) * (devise === 'EUR' ? 491.96775 : 0.75), 'KMF')}
                        </strong>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                        Taux de conversion appliqué : 1 {devise} = {devise === 'EUR' ? '491.97' : '0.75'} KMF
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {!loading && (
          <div className="flex justify-end gap-3" style={{ marginTop: 28 }}>
            <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {facture ? 'Enregistrer les modifications' : 'Créer la facture'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
