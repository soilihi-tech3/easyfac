import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { getClients, getVoyages, getNextNumero, formatCurrency, formatDate, getVoyagesCache, getClientsCache, getParametresCache, convertCurrency } from '../../data/store';
import { X, Search, Package, Send, Truck, CreditCard, Plus, Trash2, Scale, Banknote, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createPortal } from 'react-dom';

const MODES_PAIEMENT = [
  { value: 'cash', label: 'Cash' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'wave', label: 'Wave' },
  { value: 'mixte', label: 'Mixte' },
];

/**
 * Produit vide d'une section.
 * Pour une section poids : quantite + prixUnitaire sont informatifs (affichés sur le reçu).
 * Le poids total de facturation est stocké AU NIVEAU de la section (s.poids).
 */
const emptyProduit = () => ({ id: uuid(), nom: '', quantite: 1, prixUnitaire: '' });

/**
 * Section vide.
 * type 'poids' : poids (kg) de tout le lot + prix/kg → total = poids × prixKg
 * type 'direct' : total = Σ(qté × PU)
 */
const emptySection = (type, prixKg = '') => ({
  id: uuid(), type,
  prixKg: type === 'poids' ? prixKg : '',
  poids: '',        // poids total de toute la section (mode poids seulement)
  prixDirect: '',   // prix total facturé de toute la section (mode direct seulement)
  produits: [emptyProduit()],
});

/** Total affiché d'un produit individuel (coût informatif = qté × PU) */
const calcProduitAffiche = (p) =>
  (parseFloat(p.quantite) || 0) * (parseFloat(p.prixUnitaire) || 0);

/** Total de facturation d'une section */
const calcSectionTotal = (s) => {
  if (s.type === 'poids') {
    return (parseFloat(s.poids) || 0) * (parseFloat(s.prixKg) || 0);
  }
  // Prix direct : prix taxé saisi si renseigné, sinon somme des (qté × PU)
  const taxe = parseFloat(s.prixDirect) || 0;
  if (taxe > 0) return taxe;
  return calcSectionArticles(s);
};
/** Valeur des articles d'une section = Σ(qté × PU) */
const calcSectionArticles = (s) => s.produits.reduce((t, p) =>
  t + (parseFloat(p.quantite) || 0) * (parseFloat(p.prixUnitaire) || 0), 0);
const calcSectionsTotal = (sections) => sections.reduce((t, s) => t + calcSectionTotal(s), 0);

/** Aplatit les sections en articles (format sauvegardé + lu par le reçu) */
const flattenSections = (sections) => sections.flatMap(s => {
  const sTotal = calcSectionTotal(s);
  // Pour poids : on répartit le total de la section proportionnellement au PU × qté de chaque produit
  const articlesQtePU = s.produits
    .filter(p => p.nom || p.prixUnitaire)
    .map(p => ({ ...p, affiche: calcProduitAffiche(p) }));
  const totalAffiche = articlesQtePU.reduce((t, p) => t + p.affiche, 0);
  return articlesQtePU.map(p => ({
    id: p.id, nom: p.nom, sectionId: s.id,
    typeCalcul: s.type,
    quantite: parseFloat(p.quantite) || 1,
    prixUnitaire: parseFloat(p.prixUnitaire) || 0,
    poidsSectionKg: s.type === 'poids' ? (parseFloat(s.poids) || 0) : '',
    prixKgArticle: s.type === 'poids' ? (parseFloat(s.prixKg) || 0) : '',
    total: calcProduitAffiche(p),
    totalFacture: totalAffiche > 0 ? (p.affiche / totalAffiche) * sTotal : sTotal / Math.max(articlesQtePU.length, 1),
  }));
});

/**
 * (legacy) Crée un article vide avec le mode par défaut "poids".
 * @param {number} defaultPrixKg - Prix/kg par défaut hérité du paramètre global
 */
const emptyArticle = (defaultPrixKg = 6000) => ({
  id: uuid(),
  nom: '',
  typeCalcul: 'poids',   // 'poids' | 'direct'
  poids: '',
  prixKgArticle: defaultPrixKg,
  prixDirect: '',
  total: 0,
});

const extractPhoneParts = (phone) => {
  if (!phone) return { prefix: '+221', number: '' };
  if (phone.startsWith('+221')) return { prefix: '+221', number: phone.substring(4) };
  if (phone.startsWith('+269')) return { prefix: '+269', number: phone.substring(4) };
  if (phone.startsWith('+33')) return { prefix: '+33', number: phone.substring(3) };
  return { prefix: '+221', number: phone };
};

/** Calcule le total d'un article selon son mode */
const calcArticleTotal = (a) => {
  if (a.typeCalcul === 'direct') {
    return parseFloat(a.prixDirect) || 0;
  }
  return (parseFloat(a.poids) || 0) * (parseFloat(a.prixKgArticle) || 0);
};

export default function FactureModal({ facture, onClose, onSave, prixKg, devise }) {
  const { user } = useAuth();
  const [defaultVoyageId, setDefaultVoyageId] = useState('');
  const globalPrixKg = prixKg || 6000;

  // ─── Normalisation des articles à l'édition ────────────────────────────────
  const normalizeArticles = (rawArticles) => {
    if (!rawArticles || rawArticles.length === 0) return [emptyArticle(globalPrixKg)];
    return rawArticles.map(a => {
      // Compatibilité avec l'ancien format (quantite / prixUnitaire)
      if (a.typeCalcul === 'direct') {
        return { ...emptyArticle(globalPrixKg), ...a, typeCalcul: 'direct' };
      }
      if (a.typeCalcul === 'poids') {
        return { ...emptyArticle(globalPrixKg), ...a, typeCalcul: 'poids' };
      }
      // Ancien format : on tente de deviner
      if (a.poids && parseFloat(a.poids) > 0) {
        return {
          id: a.id || uuid(),
          nom: a.nom || '',
          typeCalcul: 'poids',
          poids: a.poids,
          prixKgArticle: a.prixKgArticle || a.prixUnitaire || globalPrixKg,
          prixDirect: '',
          total: parseFloat(a.total) || 0,
        };
      }
      return {
        id: a.id || uuid(),
        nom: a.nom || '',
        typeCalcul: 'direct',
        poids: '',
        prixKgArticle: globalPrixKg,
        prixDirect: a.prixDirect || a.total || a.prixUnitaire || '',
        total: parseFloat(a.total) || 0,
      };
    });
  };

  /** Construit les sections depuis une facture existante (nouveau ou ancien format) */
  const buildSections = (f) => {
    if (f?.sections?.length) return f.sections;
    const arts = normalizeArticles(f?.articles).filter(a => a.nom || calcArticleTotal(a) > 0);
    if (!arts.length) return [emptySection('poids', globalPrixKg)];
    const map = new Map();
    arts.forEach(a => {
      const key = a.typeCalcul === 'poids' ? `poids-${a.prixKgArticle}` : 'direct';
      if (!map.has(key)) map.set(key, {
        id: uuid(), type: a.typeCalcul,
        prixKg: a.typeCalcul === 'poids' ? (a.prixKgArticle || '') : '',
        poids: '', // sera recalculé depuis poidsTotal si dispo
        produits: [],
      });
      const sec = map.get(key);
      sec.produits.push({
        id: a.id || uuid(), nom: a.nom,
        quantite: a.quantite || 1,
        prixUnitaire: a.prixUnitaire || (a.typeCalcul === 'direct' ? (a.prixDirect || '') : ''),
      });
      // Accumule le poids legacy dans la section
      if (a.typeCalcul === 'poids' && parseFloat(a.poids) > 0) {
        sec.poids = String((parseFloat(sec.poids) || 0) + (parseFloat(a.poids) || 0));
      }
    });
    return [...map.values()];
  };
  const [sections, setSections] = useState(() => buildSections(facture));

  // Nouvelle facture : 1re section poids = prix/kg des paramètres (modifiable ensuite)
  useEffect(() => {
    if (facture || !prixKg) return;
    setSections(ss => {
      const i = ss.findIndex(s => s.type === 'poids');
      if (i === -1) return ss;
      return ss.map((s, j) => j === i ? { ...s, prixKg } : s);
    });
  }, [prixKg, facture]);

  const [form, setForm] = useState(facture ? {
    ...facture,
    articles: normalizeArticles(facture.articles),
    payerComores: facture.payerComores || 0,
    montantComores: String(facture.montantComores || 0),
  } : {
    numero: '',
    expediteur: { nom: '', prenom: '', telephone: '' },
    destinataire: { nom: '', prenom: '', telephone: '', telephone2: '' },
    articles: [emptyArticle(globalPrixKg)],
    montantTotal: 0,
    montantPaye: 0,
    statut: 'non_paye',
    modePaiement: 'cash',
    voyageId: '',
    note: '',
    dateLimite: new Date().toISOString().split('T')[0],
    payerComores: 0,
    montantComores: '0',
  });

  // Recalcule montantTotal à chaque changement d'articles
  const recalcTotal = (articles) =>
    articles.reduce((sum, a) => sum + calcArticleTotal(a), 0);

  // ─── Init : numéro, voyage, date ───────────────────────────────────────────
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (facture) {
      const dLimite = facture.dateLimite
        ? new Date(facture.dateLimite).toISOString().split('T')[0]
        : todayStr;
      setForm(f => ({ ...f, dateLimite: dLimite }));
    } else {
      setForm(f => ({ ...f, dateLimite: todayStr }));
    }
  }, [facture]);

  const [voyages, setVoyages] = useState(() => getVoyagesCache() || []);
  const [clients, setClients] = useState(() => getClientsCache() || []);
  const [loading, setLoading] = useState(() => {
    if (facture) return false;
    return !getParametresCache();
  });
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
            voyageId: defId || (allVoyages.length > 0 ? allVoyages[0].id : '')
          }));
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, [facture, prixKg]);

  // ─── Recherche client ──────────────────────────────────────────────────────
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

  const updateExp = (field, value) => setForm(f => ({ ...f, expediteur: { ...f.expediteur, [field]: value, id: undefined } }));
  const updateDest = (field, value) => setForm(f => ({ ...f, destinataire: { ...f.destinataire, [field]: value, id: undefined } }));

  // ─── Gestion des articles ──────────────────────────────────────────────────

  const updateSection = (sid, field, value) =>
    setSections(ss => ss.map(s => s.id === sid ? { ...s, [field]: value } : s));
  const addSection = (type) =>
    setSections(ss => [...ss, emptySection(type, type === 'poids' && !ss.some(x => x.type === 'poids') ? globalPrixKg : '')]);
  const removeSection = (sid) => setSections(ss => ss.filter(s => s.id !== sid));
  const addProduit = (sid) =>
    setSections(ss => ss.map(s => s.id === sid ? { ...s, produits: [...s.produits, emptyProduit()] } : s));
  const removeProduit = (sid, pid) =>
    setSections(ss => ss.map(s => s.id === sid ? { ...s, produits: s.produits.filter(p => p.id !== pid) } : s));
  const updateProduit = (sid, pid, field, value) =>
    setSections(ss => ss.map(s => s.id !== sid ? s : {
      ...s, produits: s.produits.map(p => p.id === pid ? { ...p, [field]: value } : p),
    }));

  /** Change un champ d'un article et recalcule son total et le total facture */
  const updateArticle = (id, field, value) => {
    setForm(f => {
      const articles = f.articles.map(a => {
        if (a.id !== id) return a;
        const updated = { ...a, [field]: value };
        updated.total = calcArticleTotal(updated);
        return updated;
      });
      return { ...f, articles, montantTotal: recalcTotal(articles) };
    });
  };

  /** Bascule le mode de calcul d'un article */
  const toggleArticleMode = (id, mode) => {
    setForm(f => {
      const articles = f.articles.map(a => {
        if (a.id !== id) return a;
        const updated = { ...a, typeCalcul: mode };
        updated.total = calcArticleTotal(updated);
        return updated;
      });
      return { ...f, articles, montantTotal: recalcTotal(articles) };
    });
  };

  const addArticle = () => {
    setForm(f => {
      const a = emptyArticle(globalPrixKg);
      const articles = [...f.articles, a];
      return { ...f, articles };
    });
  };

  const removeArticle = (id) => {
    setForm(f => {
      const articles = f.articles.filter(a => a.id !== id);
      return { ...f, articles, montantTotal: recalcTotal(articles) };
    });
  };

  // ─── Paiement ──────────────────────────────────────────────────────────────
  const handlePaye = (value) => {
    const numPaye = parseFloat(value) || 0;
    let statut = 'non_paye';
    const tot = calcSectionsTotal(sections);
    if (numPaye >= tot && tot > 0) statut = 'paye';
    else if (numPaye > 0) statut = 'partiel';
    setForm(f => ({ ...f, montantPaye: value, statut }));
  };

  // ─── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.expediteur?.nom || !form.expediteur?.prenom) e.exp = 'Informations expéditeur requises';
    if (!form.destinataire?.nom || !form.destinataire?.prenom) e.dest = 'Informations destinataire requises';
    if (flattenSections(sections).every(a => !a.nom)) e.articles = 'Ajoutez au moins un produit avec un nom';
    const missing = sections.filter(s => s.type === 'poids'
      ? !(parseFloat(s.poids) > 0) || !(parseFloat(s.prixKg) > 0)
      : !(parseFloat(s.prixDirect) > 0));
    if (missing.length) {
      e.sectionIds = missing.map(s => s.id);
      e.articles = (e.articles ? e.articles + ' — ' : '') + 'Le poids (section poids) et le prix taxé (section prix direct) sont obligatoires';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSaving(true);
    const numPaye = parseFloat(form.montantPaye) || 0;
    const cappedPaye = Math.min(numPaye, montantTotal);
    const data = {
      ...form,
      sections,
      articles: flattenSections(sections),
      montantTotal,
      montantPaye: cappedPaye,
      montantComores: parseFloat(form.montantComores) || 0,
      // Champs legacy remis à zéro (plus utilisés)
      poidsTotal: 0,
      prixKg: globalPrixKg,
      fraisFret: 0,
    };
    onSave(data).finally(() => setSaving(false));
  };

  const openClientSearch = (target) => {
    setClientTarget(target);
    setClientSearch('');
    searchRef.current?.focus();
  };

  // ─── Totaux ────────────────────────────────────────────────────────────────
  const montantTotal = calcSectionsTotal(sections);
  const totalArticles = sections.reduce((t, s) => t + calcSectionArticles(s), 0);

  // ─── Composants internes ───────────────────────────────────────────────────
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

  /** Carte d'une section tarifaire (render function, pas un composant, pour garder le focus) */
  const renderSection = (s) => {
    const isPoids = s.type === 'poids';
    const color = isPoids ? '#f59e0b' : '#22c55e';
    const tint = isPoids ? 'rgba(245,158,11,' : 'rgba(34,197,94,';
    const Icon = isPoids ? Scale : Banknote;
    // Colonnes : Article | Qté | P.U | Total | Supprimer
    const cols = '3fr 48px 72px 72px 30px';
    const lbl = { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' };
    const sTotal = calcSectionTotal(s);
    const poidsVal = parseFloat(s.poids) || 0;
    const prixKgVal = parseFloat(s.prixKg) || 0;
    return (
      <div key={s.id} style={{ border: `1px solid ${tint}0.3)`, borderRadius: 14, overflow: 'hidden', background: 'var(--bg-surface)' }}>
        {/* ── Titre + total + actions ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: `${tint}0.08)`, borderBottom: `1px solid ${tint}0.18)` }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={15} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 13.5 }}>{isPoids ? 'Tarif au poids' : 'Prix direct'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.produits.filter(p => p.nom).length} produit(s)</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontWeight: 900, color, fontFamily: 'var(--font-display)', fontSize: 15 }}>{formatCurrency(sTotal, devise)}</span>
            <button type="button" className="btn-icon" title={s.collapsed ? 'Afficher' : 'Masquer'} onClick={() => updateSection(s.id, 'collapsed', !s.collapsed)}>
              {s.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            <button type="button" className="btn-icon danger" title="Supprimer" onClick={() => removeSection(s.id)}><Trash2 size={13} /></button>
          </div>
        </div>

        {/* ── Saisie : chips alignés côte-à-côte ── */}
        <div style={{ padding: '10px 14px', background: `${tint}0.04)`, borderBottom: `1px solid ${tint}0.12)` }}>
          {isPoids ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Ligne chips */}
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Chip Prix/kg */}
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-surface)', border: `1.5px solid ${tint}0.3)`,
                  borderRadius: 10, padding: '8px 12px', minWidth: 0,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>1 kg =</span>
                  <input
                    type="number" min="0" placeholder="6000" value={s.prixKg}
                    onChange={e => updateSection(s.id, 'prixKg', e.target.value)}
                    style={{
                      flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                      fontSize: 15, fontWeight: 700, color: 'var(--text)', outline: 'none', textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{devise}</span>
                </div>
                {/* Chip Poids lot */}
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-surface)', minWidth: 0,
                  border: `1.5px solid ${errors.sectionIds?.includes(s.id) && !(parseFloat(s.poids) > 0) ? 'var(--danger)' : tint + '0.3)'}`,
                  borderRadius: 10, padding: '8px 12px',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Poids</span>
                  <input
                    type="number" min="0" step="0.1" placeholder="0" value={s.poids}
                    onChange={e => updateSection(s.id, 'poids', e.target.value)}
                    style={{
                      flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                      fontSize: 15, fontWeight: 700, color: 'var(--text)', outline: 'none', textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>kg</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 900, fontSize: 12 }}>*</span>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Prix taxé :</span>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg-surface)',
                border: `1.5px solid ${errors.sectionIds?.includes(s.id) && !(parseFloat(s.prixDirect) > 0) ? 'var(--danger)' : '#22c55e'}`,
                borderRadius: 10, padding: '8px 12px',
              }}>
                <input
                  type="number" min="0" placeholder={String(calcSectionArticles(s) || 'Montant')} value={s.prixDirect || ''}
                  onChange={e => updateSection(s.id, 'prixDirect', e.target.value)}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                    fontSize: 15, fontWeight: 700, color: 'var(--text)', outline: 'none',
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap' }}>{devise}</span>
                <span style={{ color: 'var(--danger)', fontWeight: 900, fontSize: 12 }}>*</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Lignes produits ── */}
        {!s.collapsed && (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'center', paddingBottom: 4 }}>
              <span style={lbl}>Article</span>
              <span style={{ ...lbl, textAlign: 'center' }}>Qté</span>
              <span style={{ ...lbl, textAlign: 'right' }}>P.U</span>
              <span style={{ ...lbl, textAlign: 'right' }}>Total</span>
              <span />
            </div>
            {s.produits.map(p => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'center' }}>
                <input className="form-input" placeholder="Produit" value={p.nom}
                  onChange={e => updateProduit(s.id, p.id, 'nom', e.target.value)}
                  style={{ padding: '6px 8px', fontSize: 13 }} />
                <input className="form-input" type="number" min="1" value={p.quantite}
                  onChange={e => updateProduit(s.id, p.id, 'quantite', e.target.value)}
                  style={{ padding: '6px 4px', fontSize: 13, textAlign: 'center' }} />
                <input className="form-input" type="number" min="0" placeholder="0" value={p.prixUnitaire}
                  onChange={e => updateProduit(s.id, p.id, 'prixUnitaire', e.target.value)}
                  style={{ padding: '6px 4px', fontSize: 13, textAlign: 'right' }} />
                <span style={{ textAlign: 'right', fontWeight: 700, fontSize: 12.5, color: isPoids ? 'var(--text-muted)' : 'var(--text)', lineHeight: 1.2 }}>
                  {formatCurrency(calcProduitAffiche(p), devise)}
                </span>
                <button type="button" className="btn-icon danger" onClick={() => removeProduit(s.id, p.id)} title="Supprimer"><Trash2 size={13} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => addProduit(s.id)}>
              <Plus size={13} /> Ajouter un article
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Rendu principal ───────────────────────────────────────────────────────
  return createPortal(
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 820 }}>
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
                  {voyages.map(v => {
                    const dateStr = v.dateDepart ? formatDate(v.dateDepart) : '';
                    const label = dateStr ? `${v.nom} (${dateStr})` : v.nom;
                    return <option key={v.id} value={v.id}>{label}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Recherche client */}
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
                    <div style={{ display: 'flex' }}>
                      <select
                        className="form-input"
                        style={{ width: '90px', borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, background: 'var(--bg-surface)', paddingLeft: 8 }}
                        value={extractPhoneParts(form.expediteur?.telephone).prefix}
                        onChange={e => updateExp('telephone', e.target.value + extractPhoneParts(form.expediteur?.telephone).number)}
                      >
                        <option value="+221">+221</option>
                        <option value="+269">+269</option>
                        <option value="+33">+33</option>
                      </select>
                      <input
                        className="form-input"
                        style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                        value={extractPhoneParts(form.expediteur?.telephone).number}
                        onChange={e => updateExp('telephone', extractPhoneParts(form.expediteur?.telephone).prefix + e.target.value.replace(/\D/g, ''))}
                        placeholder="Numéro sans le code"
                      />
                    </div>
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
                    <div style={{ display: 'flex' }}>
                      <select
                        className="form-input"
                        style={{ width: '90px', borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, background: 'var(--bg-surface)', paddingLeft: 8 }}
                        value={extractPhoneParts(form.destinataire?.telephone).prefix}
                        onChange={e => updateDest('telephone', e.target.value + extractPhoneParts(form.destinataire?.telephone).number)}
                      >
                        <option value="+221">+221</option>
                        <option value="+269">+269</option>
                        <option value="+33">+33</option>
                      </select>
                      <input
                        className="form-input"
                        style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                        value={extractPhoneParts(form.destinataire?.telephone).number}
                        onChange={e => updateDest('telephone', extractPhoneParts(form.destinataire?.telephone).prefix + e.target.value.replace(/\D/g, ''))}
                        placeholder="Numéro sans le code"
                      />
                    </div>
                    {/* Bouton 2e numéro */}
                    {!form.destinataire?.telephone2 ? (
                      <button
                        type="button"
                        onClick={() => updateDest('telephone2', '+221')}
                        style={{
                          marginTop: 6, background: 'none', border: 'none', padding: 0,
                          fontSize: 12, color: 'var(--info)', fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Plus size={12} /> Ajouter un 2ᵉ numéro
                      </button>
                    ) : (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>2ᵉ numéro</span>
                          <button
                            type="button"
                            onClick={() => updateDest('telephone2', '')}
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Supprimer
                          </button>
                        </div>
                        <div style={{ display: 'flex' }}>
                          <select
                            className="form-input"
                            style={{ width: '90px', borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, background: 'var(--bg-surface)', paddingLeft: 8 }}
                            value={extractPhoneParts(form.destinataire?.telephone2).prefix}
                            onChange={e => updateDest('telephone2', e.target.value + extractPhoneParts(form.destinataire?.telephone2).number)}
                          >
                            <option value="+221">+221</option>
                            <option value="+269">+269</option>
                            <option value="+33">+33</option>
                          </select>
                          <input
                            className="form-input"
                            style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                            value={extractPhoneParts(form.destinataire?.telephone2).number}
                            onChange={e => updateDest('telephone2', extractPhoneParts(form.destinataire?.telephone2).prefix + e.target.value.replace(/\D/g, ''))}
                            placeholder="2ᵉ numéro sans le code"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Articles & Tarification ═════════════════════════════════════ */}
            <div>
              <SectionHead Icon={Package} label="Articles & Tarification" color="var(--warning)" />

              {errors.articles && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errors.articles}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sections.map(renderSection)}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSection('poids')}>
                    <Scale size={13} /> Section tarif poids
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSection('direct')}>
                    <Banknote size={13} /> Section prix direct
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: 'var(--brand-muted)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.25)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Total articles : {formatCurrency(totalArticles, devise)}</span>
                  <Layers size={15} style={{ color: 'var(--brand)' }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Total facture :</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--brand)', fontFamily: 'var(--font-display)' }}>{formatCurrency(montantTotal, devise)}</span>
                </div>
              </div>

              {/* Récap par section */}
              {sections.length > 1 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {sections.map(s => {
                    const isP = s.type === 'poids';
                    const Ic = isP ? Scale : Banknote;
                    return (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: isP ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: isP ? '#f59e0b' : '#22c55e',
                        border: `1px solid ${isP ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}`
                      }}>
                        <Ic size={12} />
                        {isP ? `${formatCurrency(s.prixKg || 0, devise)}/kg` : 'Prix direct'} · {formatCurrency(calcSectionTotal(s), devise)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══ Paiement ════════════════════════════════════════════════════ */}
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
                  {formatCurrency(montantTotal, devise)}
                </span>
              </div>

              {/* Reste à payer */}
              {montantTotal - (parseFloat(form.montantPaye) || 0) > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', background: 'var(--danger-muted)', borderRadius: 10 }}>
                    <span style={{ color: 'var(--danger)', fontSize: 13 }}>Reste à payer</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>{formatCurrency(montantTotal - (parseFloat(form.montantPaye) || 0), devise)}</span>
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

              {/* Monnaie à rendre */}
              {(parseFloat(form.montantPaye) || 0) - montantTotal > 0 && (
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', background: 'var(--success-muted)', borderRadius: 10, border: '1px solid var(--success)' }}>
                  <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>À rendre (monnaie)</span>
                  <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 15 }}>{formatCurrency((parseFloat(form.montantPaye) || 0) - montantTotal, devise)}</span>
                </div>
              )}

              {/* Payer aux Comores */}
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12, padding: '14px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', fontWeight: 600, fontSize: 13.5 }}>
                  <input
                    type="checkbox"
                    checked={!!form.payerComores}
                    onChange={e => {
                      const checked = e.target.checked;
                      const remaining = Math.max(0, montantTotal - (parseFloat(form.montantPaye) || 0));
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--brand-muted)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)', gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Equivalent en Franc Comorien (KMF)</span>
                          <strong style={{ fontSize: 14, color: 'var(--brand)', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>
                            {formatCurrency(convertCurrency(parseFloat(form.montantComores) || 0, devise, 'KMF'), 'KMF')}
                          </strong>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                          Taux de conversion appliqué : 1 {devise} = {convertCurrency(1, devise, 'KMF').toFixed(2)} KMF
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
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Enregistrement en cours...' : (facture ? 'Enregistrer les modifications' : 'Créer la facture')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
