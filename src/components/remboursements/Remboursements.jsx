import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RotateCcw, Search, Plus, Eye, Edit2, Trash2, Filter, Check, X,
  DollarSign, CheckCircle, Clock, FileText, CreditCard, Package, User,
  RefreshCw, Printer, Download, AlertCircle, TrendingDown, Layers
} from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  getRemboursements, addRemboursement, updateRemboursement, deleteRemboursement,
  getFactures, getVoyages, formatCurrency, formatDate, getRemboursementsCache, API_URL
} from '../../data/store';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../common/Pagination';
import './Remboursements.css';

const STATUT_CFG = {
  total:   { label: 'Totalement remboursé', cls: 'badge-green' },
  partiel: { label: 'Partiellement remboursé', cls: 'badge-warning' },
};

export default function Remboursements() {
  const { user } = useAuth();
  const { toast, devise, refresh } = useApp();

  let permissions = {};
  if (user?.permissions) {
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {}
  }
  const isAdmin = user?.role === 'admin';

  const [remboursements, setRemboursements] = useState(() => getRemboursementsCache() || []);
  const [factures, setFactures] = useState([]);
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingRemb, setEditingRemb] = useState(null);
  const [viewRemb, setViewRemb] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit' | 'pay_remainder'
  const [montantVerseAujourdhui, setMontantVerseAujourdhui] = useState(0);

  // Dynamic Search & Form State inside Modal
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);

  const [form, setForm] = useState({
    factureId: '',
    numeroFacture: '',
    clientNom: '',
    clientPrenom: '',
    clientTelephone: '',
    voyageId: '',
    voyageNom: '',
    montantTotalFacture: 0,
    montantPayeFacture: 0,
    montantDuRemboursement: 0, // Montant dû / accordé à rembourser au client
    montantRembourse: 0,       // Montant versé / payé aujourd'hui
    resteARembourser: 0,       // Calculé: max(0, montantDuRemboursement - montantRembourse)
    statut: 'partiel', // 'partiel' | 'total'
    modePaiement: 'cash',
    motif: ''
  });

  const [saving, setSaving] = useState(false);
  const isFirstLoadRef = useRef(true);

  // Load Data silently without screen flickering
  const loadData = useCallback(async (isSilent = false) => {
    const cache = getRemboursementsCache() || [];
    if (!isSilent && isFirstLoadRef.current && cache.length === 0) {
      setLoading(true);
    }
    try {
      const [rembData, facturesData, voyagesData] = await Promise.all([
        getRemboursements(),
        getFactures(),
        getVoyages()
      ]);

      setRemboursements(rembData || []);
      setFactures(facturesData || []);
      setVoyages(voyagesData || []);
    } catch (err) {
      console.error('Erreur chargement remboursements:', err);
    } finally {
      setLoading(false);
      isFirstLoadRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadData(isFirstLoadRef.current ? false : true);
  }, [loadData, refresh]);

  // Dynamic Search Invoice Logic
  useEffect(() => {
    if (invoiceSearch.trim().length >= 1) {
      const s = invoiceSearch.toLowerCase();
      const results = factures.filter(f => {
        const num = f.numero?.toLowerCase() || '';
        const expNom = f.expediteur?.nom?.toLowerCase() || '';
        const expPrenom = f.expediteur?.prenom?.toLowerCase() || '';
        const destNom = f.destinataire?.nom?.toLowerCase() || '';
        const destPrenom = f.destinataire?.prenom?.toLowerCase() || '';
        const phone = f.expediteur?.telephone || f.destinataire?.telephone || '';
        return (
          num.includes(s) ||
          expNom.includes(s) ||
          expPrenom.includes(s) ||
          destNom.includes(s) ||
          destPrenom.includes(s) ||
          phone.includes(s)
        );
      }).slice(0, 8);
      setInvoiceResults(results);
      setShowInvoiceDropdown(true);
    } else {
      setShowInvoiceDropdown(false);
      setInvoiceResults([]);
    }
  }, [invoiceSearch, factures]);

  // Select Invoice from Dropdown
  const handleSelectInvoice = (facture) => {
    setSelectedFacture(facture);
    setShowInvoiceDropdown(false);
    setInvoiceSearch(`${facture.numero} — ${facture.expediteur?.prenom || ''} ${facture.expediteur?.nom || ''}`);

    const voyageObj = voyages.find(v => v.id === facture.voyageId);
    const voyageNom = voyageObj ? voyageObj.nom : (facture.voyageId || '—');

    const clientNom = facture.expediteur?.nom || facture.destinataire?.nom || '';
    const clientPrenom = facture.expediteur?.prenom || facture.destinataire?.prenom || '';
    const clientTelephone = facture.expediteur?.telephone || facture.destinataire?.telephone || '';

    // Default base total = sum of articles + transport kg
    const articlesTotal = (facture.articles || []).reduce((sum, a) => sum + Number(a.total || 0), 0);
    const fraisFret = Number(facture.fraisFret || 0) || (Number(facture.poidsTotal || 0) * Number(facture.prixKg || 0));
    const totalArticlesAndKg = articlesTotal + fraisFret;
    const baseTotalFacture = totalArticlesAndKg > 0 ? totalArticlesAndKg : Number(facture.montantTotal || facture.montantPaye || 0);

    const payeFacture = Number(facture.montantPaye || 0);

    setForm({
      factureId: facture.id,
      numeroFacture: facture.numero,
      clientNom,
      clientPrenom,
      clientTelephone,
      voyageId: facture.voyageId || '',
      voyageNom,
      montantTotalFacture: baseTotalFacture,
      montantPayeFacture: payeFacture,
      montantDuRemboursement: baseTotalFacture,
      montantRembourse: baseTotalFacture,
      resteARembourser: 0,
      statut: 'total',
      modePaiement: 'cash',
      motif: ''
    });
  };

  // Open Modal Add / Edit / Direct Action
  const openAdd = (factureTarget = null) => {
    setEditingRemb(null);
    setSelectedFacture(null);
    setInvoiceSearch('');

    if (factureTarget) {
      handleSelectInvoice(factureTarget);
    } else {
      setForm({
        factureId: '',
        numeroFacture: '',
        clientNom: '',
        clientPrenom: '',
        clientTelephone: '',
        voyageId: '',
        voyageNom: '',
        montantTotalFacture: 0,
        montantPayeFacture: 0,
        montantDuRemboursement: 0,
        montantRembourse: 0,
        resteARembourser: 0,
        statut: 'partiel',
        modePaiement: 'cash',
        motif: ''
      });
    }
    setShowModal(true);
  };

  const openEdit = (remb) => {
    setEditingRemb(remb);
    setInvoiceSearch(`${remb.numeroFacture} — ${remb.clientPrenom || ''} ${remb.clientNom || ''}`);
    const du = Number(remb.montantDuRemboursement || remb.montantTotalFacture || 0);
    const verse = Number(remb.montantRembourse || 0);
    const reste = Math.max(0, du - verse);
    setForm({
      factureId: remb.factureId || '',
      numeroFacture: remb.numeroFacture || '',
      clientNom: remb.clientNom || '',
      clientPrenom: remb.clientPrenom || '',
      clientTelephone: remb.clientTelephone || '',
      voyageId: remb.voyageId || '',
      voyageNom: remb.voyageNom || '',
      montantTotalFacture: Number(remb.montantTotalFacture || 0),
      montantPayeFacture: Number(remb.montantPayeFacture || 0),
      montantDuRemboursement: du,
      montantRembourse: verse,
      resteARembourser: reste,
      statut: remb.statut || (reste === 0 ? 'total' : 'partiel'),
      modePaiement: remb.modePaiement || 'cash',
      motif: remb.motif || ''
    });
    setShowModal(true);
  };

  const openPayRemainder = (remb) => {
    setEditingRemb(remb);
    setModalMode('pay_remainder');
    setInvoiceSearch(`${remb.numeroFacture} — ${remb.clientPrenom || ''} ${remb.clientNom || ''}`);
    
    const duTotal = Number(remb.montantDuRemboursement || remb.montantTotalFacture || 0);
    const dejaVerse = Number(remb.montantRembourse || 0);
    const soldeRestant = Number(remb.resteARembourser) > 0 ? Number(remb.resteARembourser) : Math.max(0, duTotal - dejaVerse);

    setMontantVerseAujourdhui(soldeRestant);

    setForm({
      factureId: remb.factureId || '',
      numeroFacture: remb.numeroFacture || '',
      clientNom: remb.clientNom || '',
      clientPrenom: remb.clientPrenom || '',
      clientTelephone: remb.clientTelephone || '',
      voyageId: remb.voyageId || '',
      voyageNom: remb.voyageNom || '',
      montantTotalFacture: Number(remb.montantTotalFacture || 0),
      montantPayeFacture: Number(remb.montantPayeFacture || 0),
      montantDuRemboursement: duTotal,
      montantDejaPaye: dejaVerse,
      soldeRestant: soldeRestant,
      montantRembourse: dejaVerse + soldeRestant,
      resteARembourser: 0,
      statut: 'total',
      modePaiement: remb.modePaiement || 'cash',
      motif: remb.motif || ''
    });
    setShowModal(true);
  };

  // Handle Refund Shortcuts relative to agreed refund amount or remaining balance
  const applyRefundShortcut = (ratio) => {
    if (modalMode === 'pay_remainder') {
      const solde = form.soldeRestant || 0;
      if (solde <= 0) return;
      const newVerse = Math.round(solde * ratio);
      const reste = Math.max(0, solde - newVerse);
      const totalRemb = (form.montantDejaPaye || 0) + newVerse;
      const newStatut = reste === 0 ? 'total' : 'partiel';

      setMontantVerseAujourdhui(newVerse);
      setForm(f => ({
        ...f,
        montantRembourse: totalRemb,
        resteARembourser: reste,
        statut: newStatut
      }));
    } else {
      const du = Number(form.montantDuRemboursement || 0);
      if (du <= 0) return;

      const newVerse = Math.round(du * ratio);
      const reste = Math.max(0, du - newVerse);
      const newStatut = reste === 0 ? 'total' : 'partiel';

      setForm(f => ({
        ...f,
        montantRembourse: newVerse,
        resteARembourser: reste,
        statut: newStatut
      }));
    }
  };

  // Handler when user edits Field 1: Montant Accordé / Dû à rembourser
  const handleMontantDuChange = (valStr) => {
    const val = parseFloat(valStr);
    const numericDu = isNaN(val) ? 0 : val;
    const verse = Number(form.montantRembourse || 0);
    const reste = Math.max(0, numericDu - verse);
    const newStatut = reste === 0 && numericDu > 0 ? 'total' : 'partiel';

    setForm(f => ({
      ...f,
      montantDuRemboursement: valStr === '' ? '' : numericDu,
      resteARembourser: reste,
      statut: newStatut
    }));
  };

  // Handler when user edits Field 2 in add/edit mode: Montant Versé
  const handleMontantVerseChange = (valStr) => {
    const val = parseFloat(valStr);
    const numericVerse = isNaN(val) ? 0 : val;
    const du = Number(form.montantDuRemboursement || 0);
    const reste = Math.max(0, du - numericVerse);
    const newStatut = reste === 0 && du > 0 ? 'total' : 'partiel';

    setForm(f => ({
      ...f,
      montantRembourse: valStr === '' ? '' : numericVerse,
      resteARembourser: reste,
      statut: newStatut
    }));
  };

  // Handler when user edits Field 2 in pay_remainder mode: Montant Versé Aujourd'hui
  const handleVerseAujourdhuiChange = (valStr) => {
    const val = parseFloat(valStr);
    const numericVerse = isNaN(val) ? 0 : val;
    const solde = form.soldeRestant || 0;
    const reste = Math.max(0, solde - numericVerse);
    const totalRemb = (form.montantDejaPaye || 0) + numericVerse;
    const newStatut = reste === 0 && numericVerse > 0 ? 'total' : 'partiel';

    setMontantVerseAujourdhui(valStr === '' ? '' : numericVerse);
    setForm(f => ({
      ...f,
      montantRembourse: totalRemb,
      resteARembourser: reste,
      statut: newStatut
    }));
  };

  // Save Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.numeroFacture || !form.clientNom) {
      toast('Veuillez sélectionner une facture valide', 'error');
      return;
    }
    const rembVal = Number(form.montantRembourse || 0);
    if (rembVal <= 0) {
      toast('Le montant versé doit être supérieur à zéro', 'error');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'pay_remainder' && editingRemb) {
        const verseAujourdhui = Number(montantVerseAujourdhui || 0);
        if (verseAujourdhui <= 0) {
          toast('Veuillez saisir un montant versé valide', 'error');
          setSaving(false);
          return;
        }

        const duTotal = Number(editingRemb.montantDuRemboursement || editingRemb.montantTotalFacture || 0);
        const dejaVerse = Number(editingRemb.montantRembourse || 0);
        const nouveauTotalVerse = dejaVerse + verseAujourdhui;
        const nouveauReste = Math.max(0, duTotal - nouveauTotalVerse);
        const nouveauStatut = nouveauReste === 0 ? 'total' : 'partiel';

        const updatedData = {
          ...form,
          montantDuRemboursement: duTotal,
          montantRembourse: nouveauTotalVerse,
          resteARembourser: nouveauReste,
          statut: nouveauStatut
        };

        await updateRemboursement(editingRemb.id, updatedData);
        toast('Règlement du solde enregistré avec succès');
      } else if (editingRemb) {
        await updateRemboursement(editingRemb.id, form);
        toast('Remboursement mis à jour avec succès');
      } else {
        await addRemboursement(form);
        toast('Remboursement enregistré avec succès');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast('Erreur lors de l\'enregistrement', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id) => {
    try {
      await deleteRemboursement(id);
      toast('Remboursement supprimé');
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      toast('Erreur lors de la suppression', 'error');
    }
  };

  // KPI Computations
  const totalFacturesRemb = remboursements.length;
  const totalSommeRemboursements = remboursements.reduce((sum, r) => sum + Number(r.montantRembourse || 0), 0);
  const totalResteARembourser = remboursements.reduce((sum, r) => sum + Number(r.resteARembourser || 0), 0);
  const totalMontantInitial = remboursements.reduce((sum, r) => sum + Number(r.montantPayeFacture || r.montantTotalFacture || 0), 0);

  // Filtered List
  const filteredRemboursements = remboursements.filter(r => {
    // Employee restriction: Employees can only view their own refunds
    if (user?.role === 'employee' && r.creeParId !== user.id && r.userId !== user.id) {
      return false;
    }
    const s = search.toLowerCase();
    const matchSearch = !search || (
      r.numeroFacture?.toLowerCase().includes(s) ||
      r.clientNom?.toLowerCase().includes(s) ||
      r.clientPrenom?.toLowerCase().includes(s) ||
      r.clientTelephone?.includes(s) ||
      r.voyageNom?.toLowerCase().includes(s)
    );
    const matchStatut = !filterStatut || r.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const paginatedList = filteredRemboursements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (user?.role === 'employee' && !permissions.voirRemboursements) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Accès non autorisé</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Vous ne disposez pas des droits d'accès requis pour consulter ou effectuer des remboursements.</p>
      </div>
    );
  }

  return (
    <div className="page-enter page-with-table" style={{ width: '100%' }}>
      {/* Top Section Header */}
      <div className="sticky-top-section">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="page-title">Remboursements</h1>
            <p className="page-subtitle">Recherchez dynamiquement une facture et enregistrez un remboursement partiel ou total.</p>
          </div>
          {(isAdmin || permissions.creerRemboursement) && (
            <button className="btn btn-primary" onClick={() => openAdd()} style={{ gap: 8 }}>
              <RotateCcw size={16} /> Nouveau remboursement
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Widgets */}
      <div className="kpi-grid cols-4">
        {/* KPI 1 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--info)', '--kpi-bg': 'var(--info-muted)' }}>
          <div className="kpi-icon-wrap">
            <FileText size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{totalFacturesRemb}</div>
            <div className="kpi-label">Nombre de factures</div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--brand)', '--kpi-bg': 'var(--brand-muted)' }}>
          <div className="kpi-icon-wrap">
            <DollarSign size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{formatCurrency(totalMontantInitial, devise)}</div>
            <div className="kpi-label">Somme des factures</div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--warning)', '--kpi-bg': 'var(--warning-muted)' }}>
          <div className="kpi-icon-wrap">
            <RotateCcw size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{formatCurrency(totalSommeRemboursements, devise)}</div>
            <div className="kpi-label">Montant Remboursé</div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="kpi-card" style={{ '--kpi-color': 'var(--danger)', '--kpi-bg': 'var(--danger-muted)' }}>
          <div className="kpi-icon-wrap">
            <Clock size={18} strokeWidth={2} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{formatCurrency(totalResteARembourser, devise)}</div>
            <div className="kpi-label">Reste à rembourser</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex gap-3 flex-wrap items-center justify-between" style={{ marginBottom: 20, width: '100%' }}>
        <div className="search-bar" style={{ flex: '1 1 300px' }}>
          <span className="search-icon-wrap"><Search size={15} /></span>
          <input
            className="form-input"
            style={{ width: '100%' }}
            placeholder="Rechercher par N° facture, nom client, voyage..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <select
            className="form-input form-select"
            style={{ width: 220 }}
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="partiel">Partiellement remboursé</option>
            <option value="total">Totalement remboursé</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="card table-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Client</th>
                <th>Voyage</th>
                <th>Total Facture</th>
                <th>Montant Dû</th>
                <th>Montant Versé</th>
                <th>Reste à Rembourser</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Enregistré par</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Chargement des remboursements...
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="empty-state">
                      <div className="empty-icon"><RotateCcw size={28} /></div>
                      <div className="empty-title">Aucun remboursement trouvé</div>
                      <div className="empty-desc">Recherchez une facture pour effectuer un premier remboursement.</div>
                      {(isAdmin || permissions.creerRemboursement) && (
                        <button className="btn btn-primary" onClick={() => openAdd()} style={{ marginTop: 12 }}>
                          <Plus size={15} /> Nouveau remboursement
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map(r => (
                  <tr key={r.id}>
                    <td>
                      <code style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 700 }}>
                        {r.numeroFacture}
                      </code>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.clientPrenom} {r.clientNom}
                      {r.clientTelephone && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                          📞 {r.clientTelephone}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: 10.5 }}>
                        {r.voyageNom || '—'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {formatCurrency(r.montantTotalFacture, devise)}
                    </td>
                    <td style={{ color: 'var(--brand)', fontWeight: 700 }}>
                      {formatCurrency(r.montantDuRemboursement || r.montantTotalFacture, devise)}
                    </td>
                    <td style={{ color: 'var(--warning)', fontWeight: 700 }}>
                      {formatCurrency(r.montantRembourse, devise)}
                    </td>
                    <td style={{ color: Number(r.resteARembourser) > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {formatCurrency(r.resteARembourser, devise)}
                    </td>
                    <td>
                      <span className={`badge ${STATUT_CFG[r.statut]?.cls || 'badge-muted'}`}>
                        {STATUT_CFG[r.statut]?.label || r.statut}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {formatDate(r.createdAt)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                      {r.creePar ? `${r.creePar.prenom} ${r.creePar.nom}` : 'Admin'}
                    </td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        {r.statut === 'total' || Number(r.resteARembourser) <= 0 ? (
                          <button className="btn-icon" onClick={() => setViewRemb(r)} title="Voir le reçu / Bon de remboursement">
                            <Eye size={14} />
                          </button>
                        ) : (
                          <>
                            {(isAdmin || permissions.creerRemboursement) && (
                              <button
                                className="btn-icon"
                                onClick={() => openPayRemainder(r)}
                                title="Régler le paiement restant (Solde de tout compte)"
                                style={{ color: 'var(--success)', background: 'var(--success-muted)', border: '1px solid rgba(34, 197, 94, 0.25)' }}
                              >
                                <CreditCard size={14} />
                              </button>
                            )}
                            <button className="btn-icon" onClick={() => setViewRemb(r)} title="Voir le reçu / Bon de remboursement">
                              <Eye size={14} />
                            </button>
                            <button className="btn-icon" onClick={() => openEdit(r)} title="Modifier">
                              <Edit2 size={14} />
                            </button>
                            {isAdmin && (
                              <button className="btn-icon danger" onClick={() => setConfirmDelete(r)} title="Supprimer">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredRemboursements.length > 0 && (
          <Pagination
            totalItems={filteredRemboursements.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      {/* --- ADD / EDIT / PAY REMAINDER REMBOURSEMENT MODAL --- */}
      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: 20 }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 800 }}>
                {modalMode === 'pay_remainder' ? (
                  <>
                    <CreditCard size={20} style={{ color: 'var(--success)' }} />
                    Régler le solde restant du remboursement
                  </>
                ) : modalMode === 'edit' ? (
                  <>
                    <RotateCcw size={20} style={{ color: 'var(--warning)' }} />
                    Modifier le remboursement
                  </>
                ) : (
                  <>
                    <RotateCcw size={20} style={{ color: 'var(--warning)' }} />
                    Effectuer un remboursement
                  </>
                )}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* DYNAMIC SEARCH INVOICE INPUT BOX (Hide in pay_remainder mode for clarity) */}
              {modalMode !== 'pay_remainder' && (
                <div className="info-box" style={{ position: 'relative', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 16 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand)' }}>
                    <Search size={15} /> Recherche dynamique par Nom du Client ou N° Facture *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Tapez un nom, prénom, téléphone ou N° de facture (ex: Fac-26-01)..."
                      value={invoiceSearch}
                      onChange={e => setInvoiceSearch(e.target.value)}
                      style={{ paddingRight: 40, height: 44, fontSize: 13.5, fontWeight: 600 }}
                    />
                    <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                      <Search size={16} />
                    </span>

                    {/* Dropdown Suggestions List */}
                    {showInvoiceDropdown && invoiceResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0, right: 0,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 12,
                        zIndex: 500,
                        boxShadow: 'var(--shadow-xl)',
                        maxHeight: 280,
                        overflowY: 'auto'
                      }}>
                        {invoiceResults.map(f => (
                          <div
                            key={f.id}
                            onClick={() => handleSelectInvoice(f)}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-subtle)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--brand)', fontSize: 13.5 }}>
                                {f.numero}
                              </div>
                              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 600 }}>
                                👤 {f.expediteur?.prenom} {f.expediteur?.nom}
                                {f.expediteur?.telephone && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({f.expediteur.telephone})</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                                {formatCurrency(f.montantTotal, devise)}
                              </div>
                              <span className={`badge ${f.statut === 'paye' ? 'badge-green' : 'badge-warning'}`} style={{ fontSize: 9.5 }}>
                                {f.statut === 'paye' ? 'Payé' : 'Partiel/Non payé'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AUTO-POPULATED INVOICE & CLIENT DETAILS DISPLAY */}
              {form.numeroFacture && (
                <div style={{
                  padding: 16,
                  background: 'var(--bg-surface)',
                  borderRadius: 14,
                  border: '1px solid var(--border-default)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14
                }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Facture N°</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand)', marginTop: 2 }}>
                      {form.numeroFacture}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Client Bénéficiaire</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                      {form.clientPrenom} {form.clientNom}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Voyage Associé</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--info)', marginTop: 2 }}>
                      {form.voyageNom || '—'}
                    </div>
                  </div>

                  {modalMode === 'pay_remainder' ? (
                    <>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Déjà Versé au Client</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>
                          {formatCurrency(form.montantDejaPaye, devise)}
                        </div>
                      </div>
                      <div style={{ gridColumn: 'span 2', padding: '10px 14px', background: 'var(--warning-muted)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 700 }}>SOLDE RESTANT À RÉGLER AU CLIENT :</span>
                        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--warning)', marginTop: 2 }}>
                          {formatCurrency(form.soldeRestant, devise)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Montant Total (Articles + Fret Kg)</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', marginTop: 2 }}>
                          {formatCurrency(form.montantTotalFacture, devise)}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Montant Payé sur la Facture</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>
                          {formatCurrency(form.montantPayeFacture, devise)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* REFUND AMOUNT ACTION & SHORTCUT BUTTONS */}
              {modalMode === 'pay_remainder' ? (
                <div style={{ padding: 16, background: 'var(--success-muted)', borderRadius: 14, border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label className="form-label" style={{ fontWeight: 800, fontSize: 13, color: 'var(--success)', margin: 0 }}>
                      💳 Règlement du Solde Restant
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => applyRefundShortcut(1)}
                        style={{
                          background: form.statut === 'total' ? 'var(--success)' : 'var(--bg-card)',
                          color: form.statut === 'total' ? '#fff' : 'var(--text-primary)',
                          border: '1px solid var(--border-strong)',
                          fontWeight: 800,
                          fontSize: 11.5,
                          borderRadius: 8
                        }}
                      >
                        Tout le solde (100%)
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => applyRefundShortcut(0.5)}
                        style={{
                          background: form.statut === 'partiel' ? 'var(--success)' : 'var(--bg-card)',
                          color: form.statut === 'partiel' ? '#fff' : 'var(--text-primary)',
                          border: '1px solid var(--border-strong)',
                          fontWeight: 800,
                          fontSize: 11.5,
                          borderRadius: 8
                        }}
                      >
                        50% du solde
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 11.5 }}>
                        Solde Dû Restant ({devise})
                      </label>
                      <div style={{ height: 42, display: 'flex', alignItems: 'center', padding: '0 12px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-default)', fontSize: 13.5, fontWeight: 800, color: 'var(--brand)' }}>
                        {formatCurrency(form.soldeRestant, devise)}
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 11.5 }}>
                        Montant Versé Aujourd'hui ({devise}) *
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        required
                        min="0"
                        step="any"
                        placeholder="Saisir montant versé..."
                        value={montantVerseAujourdhui}
                        onChange={e => handleVerseAujourdhuiChange(e.target.value)}
                        style={{ height: 42, fontSize: 14, fontWeight: 800, color: 'var(--success)', border: '2px solid var(--success)' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 11.5 }}>
                        Nouveau Reste Calculé
                      </label>
                      <div style={{ height: 42, display: 'flex', alignItems: 'center', padding: '0 10px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-default)', fontSize: 13, fontWeight: 800, color: Number(form.resteARembourser) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {formatCurrency(form.resteARembourser, devise)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(34, 197, 94, 0.3)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Statut résultant du remboursement :</span>
                    <span className={`badge ${STATUT_CFG[form.statut]?.cls || 'badge-muted'}`} style={{ fontSize: 11, padding: '4px 12px' }}>
                      {STATUT_CFG[form.statut]?.label}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16, background: 'var(--warning-muted)', borderRadius: 14, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label className="form-label" style={{ fontWeight: 800, fontSize: 13, color: 'var(--warning)', margin: 0 }}>
                      ⚡ Action de Règlement du Remboursement
                    </label>
                    {/* Quick Shortcut Buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => applyRefundShortcut(1)}
                        style={{
                          background: form.statut === 'total' ? 'var(--warning)' : 'var(--bg-card)',
                          color: form.statut === 'total' ? '#fff' : 'var(--text-primary)',
                          border: '1px solid var(--border-strong)',
                          fontWeight: 800,
                          fontSize: 11.5,
                          borderRadius: 8
                        }}
                      >
                        Tout (100%)
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => applyRefundShortcut(0.5)}
                        style={{
                          background: form.statut === 'partiel' ? 'var(--warning)' : 'var(--bg-card)',
                          color: form.statut === 'partiel' ? '#fff' : 'var(--text-primary)',
                          border: '1px solid var(--border-strong)',
                          fontWeight: 800,
                          fontSize: 11.5,
                          borderRadius: 8
                        }}
                      >
                        Moitié (50%)
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 11.5 }}>
                        Montant Dû / Accordé ({devise}) *
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        required
                        min="0"
                        step="any"
                        placeholder="Montant dû..."
                        value={form.montantDuRemboursement}
                        onChange={e => handleMontantDuChange(e.target.value)}
                        style={{ height: 42, fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 11.5 }}>
                        Montant Versé ({devise}) *
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        required
                        min="0"
                        step="any"
                        placeholder="Montant versé..."
                        value={form.montantRembourse}
                        onChange={e => handleMontantVerseChange(e.target.value)}
                        style={{ height: 42, fontSize: 14, fontWeight: 800, color: 'var(--warning)' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 11.5 }}>
                        Reste à rembourser
                      </label>
                      <div style={{
                        height: 42,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 10px',
                        background: 'var(--bg-card)',
                        borderRadius: 10,
                        border: '1px solid var(--border-default)',
                        fontSize: 13,
                        fontWeight: 800,
                        color: Number(form.resteARembourser) > 0 ? 'var(--danger)' : 'var(--success)'
                      }}>
                        {formatCurrency(form.resteARembourser, devise)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(245, 158, 11, 0.3)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Statut résultant du remboursement :</span>
                    <span className={`badge ${STATUT_CFG[form.statut]?.cls || 'badge-muted'}`} style={{ fontSize: 11, padding: '4px 12px' }}>
                      {STATUT_CFG[form.statut]?.label}
                    </span>
                  </div>
                </div>
              )}

              {/* PAYMENT MODE & MOTIF */}
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12.5 }}>Mode de règlement</label>
                  <select
                    className="form-input form-select"
                    value={form.modePaiement}
                    onChange={e => setForm({ ...form, modePaiement: e.target.value })}
                    style={{ height: 42 }}
                  >
                    <option value="cash">Cash / Espèces</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="wave">Wave</option>
                    <option value="mixte">Mixte</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 12.5 }}>Motif du remboursement (Optionnel)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Colis non livré, voyage annulé, litige..."
                    value={form.motif}
                    onChange={e => setForm({ ...form, motif: e.target.value })}
                    style={{ height: 42 }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={saving}
                  style={{
                    gap: 8,
                    padding: '0 24px',
                    background: modalMode === 'pay_remainder' ? 'var(--success)' : 'var(--brand)',
                    color: '#ffffff'
                  }}
                >
                  {saving ? (
                    <RefreshCw size={15} className="spin-icon" />
                  ) : modalMode === 'pay_remainder' ? (
                    <CreditCard size={15} />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                  {modalMode === 'pay_remainder'
                    ? 'Valider le règlement du solde'
                    : modalMode === 'edit'
                    ? 'Enregistrer les modifications'
                    : 'Valider le remboursement'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- RECEIPT / BON DE REMBOURSEMENT PRINT MODAL --- */}
      {viewRemb && createPortal(
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520, background: '#ffffff', color: '#1e293b' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/logo.jpg" alt="easyfac" style={{ height: 36, borderRadius: 8 }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a' }}>BON DE REMBOURSEMENT</h3>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Reçu officiel d'annulation / versement</span>
                </div>
              </div>
              <button onClick={() => setViewRemb(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            {/* Content Receipt */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13, color: '#334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>N° Facture liée</span>
                  <div style={{ fontWeight: 800, color: '#6366f1', fontSize: 14 }}>{viewRemb.numeroFacture}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Date du remboursement</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatDate(viewRemb.createdAt)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Bénéficiaire</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{viewRemb.clientPrenom} {viewRemb.clientNom}</div>
                  {viewRemb.clientTelephone && <div style={{ fontSize: 11, color: '#64748b' }}>{viewRemb.clientTelephone}</div>}
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Voyage</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{viewRemb.voyageNom || '—'}</div>
                </div>
              </div>

              <div style={{ padding: '14px', background: '#fef3c7', borderRadius: 12, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12, color: '#78350f' }}>
                  <span>Montant Dû / Accordé :</span>
                  <strong>{formatCurrency(viewRemb.montantDuRemboursement || viewRemb.montantTotalFacture, devise)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#92400e' }}>Montant Versé :</span>
                  <strong style={{ fontSize: 17, fontWeight: 900, color: '#b45309' }}>{formatCurrency(viewRemb.montantRembourse, devise)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#78350f' }}>
                  <span>Reste à rembourser :</span>
                  <strong style={{ color: Number(viewRemb.resteARembourser) > 0 ? '#b91c1c' : '#15803d' }}>{formatCurrency(viewRemb.resteARembourser, devise)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#78350f', marginTop: 4 }}>
                  <span>Statut :</span>
                  <span style={{ fontWeight: 800, textTransform: 'uppercase' }}>{STATUT_CFG[viewRemb.statut]?.label}</span>
                </div>
              </div>

              {viewRemb.motif && (
                <div style={{ fontSize: 12, fontStyle: 'italic', color: '#64748b', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                  Motif : {viewRemb.motif}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1', fontSize: 11, color: '#94a3b8' }}>
                <span>Opérateur : {viewRemb.creePar ? `${viewRemb.creePar.prenom} ${viewRemb.creePar.nom}` : 'Admin'}</span>
                <span>Signature / Cachet</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setViewRemb(null)}
              >
                Fermer
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', gap: 6 }}
                onClick={() => window.print()}
              >
                <Printer size={15} /> Imprimer le bon
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDelete && createPortal(
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Supprimer ce remboursement ?</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}><X size={15} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Le remboursement pour la facture <strong>{confirmDelete.numeroFacture}</strong> ({formatCurrency(confirmDelete.montantRembourse, devise)}) sera définitivement supprimé.
            </p>
            <div className="modal-footer">
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
