import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { getParametres, getVoyages, formatCurrency, formatDate } from '../../data/store';
import { Printer, MessageCircle, X, Bell, FileText } from 'lucide-react';

const STATUT_MAP   = { paye: 'PAYÉ', partiel: 'PARTIEL', non_paye: 'NON PAYÉ' };
const STATUT_COLOR = { paye: '#22c55e', partiel: '#f59e0b', non_paye: '#ef4444' };
const MODE_MAP     = { cash: 'Cash', orange_money: 'Orange Money', wave: 'Wave', mixte: 'Paiement mixte' };

export default function ReceiptModal({ facture, onClose, devise }) {
  const [params, setParams] = React.useState(null);
  const [voyages, setVoyages] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showExportGuide, setShowExportGuide] = React.useState(false);
  const printRef = useRef();

  React.useEffect(() => {
    const load = async () => {
      try {
        const [p, v] = await Promise.all([getParametres(), getVoyages()]);
        setParams(p);
        setVoyages(v);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Chargement du reçu...
      </div>
    );
  }

  const voyage     = voyages.find(v => v.id === facture.voyageId);
  const entreprise = params?.entreprise || {};
  const config     = params?.config     || {};

  const accentColor = config.couleurPrimaire || '#6366f1';
  const statColor   = STATUT_COLOR[facture.statut] || '#94a3b8';
  const articles    = (facture.articles || []).filter(a => a.nom || a.poids);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const lines = [
      `*Facture ${facture.numero}*`,
      `Expéditeur: ${facture.expediteur?.prenom} ${facture.expediteur?.nom}`,
      `Destinataire: ${facture.destinataire?.prenom} ${facture.destinataire?.nom}`,
      articles.map(a => `  • ${a.nom} — ${a.poids}kg × ${formatCurrency(a.prixKg, devise)} = ${formatCurrency(a.total, devise)}`).join('\n'),
      `Montant total: ${formatCurrency(facture.montantTotal, devise)}`,
      `Payé: ${formatCurrency(facture.montantPaye, devise)}`,
      facture.montantTotal - facture.montantPaye > 0
        ? `Reste: ${formatCurrency(facture.montantTotal - facture.montantPaye, devise)}`
        : '',
      `Statut: ${STATUT_MAP[facture.statut]}`,
      `Date: ${formatDate(facture.createdAt)}`,
    ].filter(Boolean).join('\n');
    
    // Nettoyer le numéro de téléphone (expéditeur en priorité, sinon destinataire)
    let phone = facture.expediteur?.telephone || facture.destinataire?.telephone || '';
    phone = phone.replace(/\D/g, ''); // Ne garder que les chiffres pour WhatsApp
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank');
  };

  const handleReminderWhatsApp = () => {
    const total = facture.montantTotal;
    const paye = facture.montantPaye;
    const reste = total - paye;
    const dateStr = facture.dateLimite ? formatDate(facture.dateLimite) : "immédiatement";
    
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
      `Merci de bien vouloir régulariser ce solde restant au plus tard à cette date.`,
      `Nous restons à votre entière disposition.`,
      ``,
      `Cordialement,`,
      `*${entreprise.nom || 'EASYFAC'}*`
    ].join('\n');
    
    let phone = facture.expediteur?.telephone || facture.destinataire?.telephone || '';
    phone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank');
  };

  const handleExportPDF = () => {
    setShowExportGuide(true);
  };

  const startExportProcess = () => {
    setShowExportGuide(false);
    
    // 1. Open client WhatsApp conversation synchronously first (bypasses browser popup blocker)
    let phone = facture.expediteur?.telephone || facture.destinataire?.telephone || '';
    phone = phone.replace(/\D/g, '');
    const text = `Bonjour, voici le reçu au format PDF pour votre facture ${facture.numero}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    
    // 2. Open print dialog right after synchronously
    handlePrint();
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(12px)',
      zIndex: 1000,
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      padding: '40px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Local style overrides to prevent dark mode table styles from leaking into the print card, and handle native printing cleanly */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Ensure normal view renders correctly in dark/light mode */
        #receipt-print-area {
          color-scheme: light !important;
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #0f172a !important;

          /* Redefine CSS variables to light mode values so that inherited colors render perfectly */
          --text-primary: #0f172a !important;
          --text-secondary: #475569 !important;
          --text-muted: #64748b !important;
          --text-disabled: #94a3b8 !important;
          --bg-base: #f1f5f9 !important;
          --bg-surface: #e8edf5 !important;
          --bg-card: #ffffff !important;
          --bg-card-hover: #f8fafc !important;
          --bg-elevated: #f0f4ff !important;
          --border-subtle: rgba(15,23,42,0.05) !important;
          --border-default: rgba(15,23,42,0.10) !important;
          --border-strong: rgba(15,23,42,0.18) !important;
        }

        #receipt-print-area * {
          color-scheme: light !important;
        }

        @media print {
          /* Force page background to white */
          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color-scheme: light !important;
          }

          /* Hide everything under body except our modal */
          body > * {
            display: none !important;
          }

          /* Show the modal container and force it to be transparent/white with NO dark overlay */
          .modal-overlay {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            color-scheme: light !important;
          }

          /* Ensure wrapper does not flex or center, keeping normal flow */
          .modal-overlay > div {
            display: block !important;
            min-height: auto !important;
            width: 100% !important;
            background: transparent !important;
            background-color: transparent !important;
          }

          /* Hide sticky action bar */
          .modal-overlay > div > div:first-child {
            display: none !important;
          }

          /* Print area specific styles with color forcing */
          #receipt-print-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            color-scheme: light !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Let all inner elements print exactly as designed in the app */
          #receipt-print-area * {
            color-scheme: light !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Clean up page margins */
          @page {
            margin: 1.5cm;
          }
        }
      `}} />
      {/* Inner centering wrapper */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100%',
        width: '100%',
      }}>
      {/* ── Sticky action bar OUTSIDE the scrollable modal ── */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: 16,
          padding: '12px 16px',
          marginBottom: 12,
          gap: 12,
          flexShrink: 0,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--brand-muted)', color: 'var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
          }}>
            N°
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
              Reçu — {facture.numero}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {formatDate(facture.createdAt)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {(facture.montantTotal - facture.montantPaye > 0) && (
            <button
              className="btn btn-sm"
              onClick={handleReminderWhatsApp}
              style={{ gap: 6, background: 'var(--danger)', color: '#fff', border: 'none' }}
            >
              <Bell size={14} /> Rappel
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleWhatsApp}
            style={{ gap: 6 }}
          >
            <MessageCircle size={14} /> WhatsApp
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportPDF}
            style={{ gap: 6, background: 'var(--purple-muted)', color: 'var(--purple)', borderColor: 'rgba(168,85,247,0.2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--purple)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--purple-muted)'; e.currentTarget.style.color = 'var(--purple)'; }}
          >
            <FileText size={14} /> Exporter PDF
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handlePrint}
            style={{ gap: 6 }}
          >
            <Printer size={14} /> Imprimer
          </button>
          {/* ── CLOSE BUTTON — always visible ── */}
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36,
              borderRadius: 10,
              background: 'var(--danger-muted)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--danger)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--danger-muted)'; e.currentTarget.style.color = 'var(--danger)'; }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Printable Receipt ── */}
      <div
        ref={printRef}
        id="receipt-print-area"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          background: '#ffffff',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: '#000',
          position: 'relative',
        }}
      >
        <div style={{ padding: '30px 40px' }}>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                {entreprise.nom || 'EASYFAC'}
              </h1>
            </div>
            <div style={{ flex: 1, fontSize: 11, lineHeight: 1.5, textAlign: 'right' }}>
              <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ color: accentColor }}>AGENCE SÉNÉGAL</strong><br />
                  {entreprise.adresse && <>{entreprise.adresse}<br /></>}
                  {entreprise.telephone1 && <>📞 {entreprise.telephone1}{entreprise.telephone2 ? ` / ${entreprise.telephone2}` : ''}</>}
                </div>
                {(entreprise.lieuComores || entreprise.telComores1) && (
                  <div style={{ textAlign: 'left' }}>
                    <strong style={{ color: accentColor }}>AGENCE COMORES</strong><br />
                    {entreprise.lieuComores && <>{entreprise.lieuComores}<br /></>}
                    {entreprise.telComores1 && <>📞 {entreprise.telComores1}{entreprise.telComores2 ? ` / ${entreprise.telComores2}` : ''}</>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Title Bar */}
          <div style={{
            background: '#0f172a',
            color: '#fff',
            textAlign: 'center',
            padding: '8px 0',
            fontSize: 20,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800,
            letterSpacing: '0.1em',
            marginBottom: 20
          }}>
            FACTURE
          </div>

          {/* Info Box */}
          <div style={{
            border: '2px solid #000',
            borderRadius: '8px',
            marginBottom: 20,
            overflow: 'hidden'
          }}>
            {/* Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '2px solid #000' }}>
              <div style={{ padding: '8px 12px', borderRight: '2px solid #000' }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>N° FACTURE:</span>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{facture.numero}</div>
              </div>
              <div style={{ padding: '8px 12px', borderRight: '2px solid #000' }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>VOYAGE:</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{voyage ? voyage.nom : '—'}</div>
              </div>
              <div style={{ padding: '8px 12px' }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>DATE:</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(facture.createdAt)}</div>
              </div>
            </div>
            {/* Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #000' }}>
              <div style={{ padding: '8px 12px', borderRight: '2px solid #000' }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>EXPÉDITEUR:</span>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{facture.expediteur?.prenom} {facture.expediteur?.nom}</div>
                {facture.expediteur?.telephone && <div style={{ fontSize: 12 }}>Tél: {facture.expediteur.telephone}</div>}
              </div>
              <div style={{ padding: '8px 12px' }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>DESTINATAIRE:</span>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{facture.destinataire?.prenom} {facture.destinataire?.nom}</div>
                {facture.destinataire?.telephone && <div style={{ fontSize: 12 }}>Tél: {facture.destinataire.telephone}</div>}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{
            border: '2px solid #000',
            borderRadius: '8px',
            marginBottom: 20,
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: accentColor, color: '#fff', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px', borderRight: '2px solid #000', width: '60px', textAlign: 'center' }}>QTÉ.</th>
                  <th style={{ padding: '10px 12px', borderRight: '2px solid #000' }}>ARTICLE (DESCRIPTION)</th>
                  <th style={{ padding: '10px 12px', borderRight: '2px solid #000', width: '120px', textAlign: 'right' }}>PRIX UNITAIRE</th>
                  <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {articles.length > 0 ? articles.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '10px 12px', borderRight: '2px solid #000', textAlign: 'center', fontSize: 13 }}>{a.quantite || 1}</td>
                    <td style={{ padding: '10px 12px', borderRight: '2px solid #000', fontSize: 13, fontWeight: 600 }}>{a.nom}</td>
                    <td style={{ padding: '10px 12px', borderRight: '2px solid #000', textAlign: 'right', fontSize: 13 }}>{formatCurrency(a.prixUnitaire, devise)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{formatCurrency(a.total, devise)}</td>
                  </tr>
                )) : (
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, color: '#666' }}>Aucun article</td>
                  </tr>
                )}

                {/* Freight row */}
                {facture.poidsTotal > 0 && (
                  <tr style={{ borderBottom: '2px solid #000', background: '#f8fafc' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', borderRight: '2px solid #000', textAlign: 'right', fontSize: 12, fontWeight: 700 }}>
                      {facture.poidsTotal} KG
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '2px solid #000', textAlign: 'right', fontSize: 13 }}>
                      {formatCurrency(facture.prixKg, devise)}/kg
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                      {formatCurrency(facture.fraisFret, devise)}
                    </td>
                  </tr>
                )}

                {/* Totals Section */}
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td colSpan={2} rowSpan={facture.montantTotal - facture.montantPaye > 0 ? 3 : 2} style={{ padding: '10px 12px', borderRight: '2px solid #000', verticalAlign: 'top' }}>
                    {/* Statut & Mode */}
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>STATUT: </span>
                      <span style={{ fontWeight: 800, color: statColor }}>{STATUT_MAP[facture.statut]}</span>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>MODE PAIEMENT: </span>
                      <span style={{ fontWeight: 600 }}>{MODE_MAP[facture.modePaiement] || 'Cash'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>NOMBRE D'ARTICLES: </span>
                      <span style={{ fontWeight: 600 }}>{articles.length}</span>
                    </div>
                    {facture.dateLimite && (facture.montantTotal - facture.montantPaye > 0) && (
                      <div style={{ marginTop: 10, color: '#ef4444' }}>
                        <span style={{ fontSize: 10, fontWeight: 700 }}>DATE D'ÉCHÉANCE: </span>
                        <span style={{ fontWeight: 800 }}>{formatDate(facture.dateLimite)}</span>
                      </div>
                    )}
                    {facture.payerComores === 1 && (
                      <div style={{ marginTop: 10, padding: '8px', border: '1px solid #000', borderRadius: '4px', background: '#f8fafc' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#a855f7', display: 'block', marginBottom: 2 }}>
                          {Number(facture.montantPaye || 0) > 0 ? 'RÈGLEMENT MIXTE (SEN-COM) :' : 'RÈGLEMENT AUX COMORES :'}
                        </span>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>
                          Solde aux Comores : {formatCurrency(facture.montantComores, devise)}
                        </div>
                        {devise !== 'KMF' && (
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#a855f7', marginTop: 2 }}>
                            Soit : {formatCurrency(facture.montantComores * (devise === 'EUR' ? 491.96775 : 0.75), 'KMF')}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', borderRight: '2px solid #000', textAlign: 'right', fontSize: 11, fontWeight: 700 }}>
                    MONTANT TOTAL
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14, fontWeight: 800 }}>
                    {formatCurrency(facture.montantTotal, devise)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td style={{ padding: '8px 12px', borderRight: '2px solid #000', textAlign: 'right', fontSize: 11, fontWeight: 700 }}>
                    MONTANT PAYÉ
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                    {formatCurrency(facture.montantPaye, devise)}
                  </td>
                </tr>
                {facture.montantTotal - facture.montantPaye > 0 && (
                  <tr>
                    <td style={{ padding: '8px 12px', borderRight: '2px solid #000', textAlign: 'right', fontSize: 11, fontWeight: 700 }}>
                      RESTE À PAYER
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                      {formatCurrency(facture.montantTotal - facture.montantPaye, devise)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cachet (sans signature textuelle) */}
          {entreprise.cachet && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 30 }}>
              <img src={entreprise.cachet} alt="Cachet" style={{ maxWidth: 120, maxHeight: 120, objectFit: 'contain' }} />
            </div>
          )}
        </div>

        {/* Footer Shapes */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, display: 'flex' }}>
          <div style={{ width: '40%', background: '#0f172a', clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)' }}></div>
          <div style={{ width: '60%', background: accentColor, marginLeft: -20, zIndex: -1 }}></div>
        </div>
      </div>
          </div>

      {showExportGuide && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(16px)',
          zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20
        }} onClick={() => setShowExportGuide(false)}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 24,
            padding: '32px 24px',
            maxWidth: 480,
            width: '100%',
            boxShadow: 'var(--shadow-2xl)',
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', gap: 20
          }} onClick={e => e.stopPropagation()}>
            {/* Header Icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(168,85,247,0.15)', color: 'var(--purple)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto', fontSize: 24
            }}>
              <FileText size={28} />
            </div>

            {/* Title */}
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, margin: '0 0 8px 0', color: 'var(--text-strong)' }}>
                Exportation PDF & WhatsApp
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Pour des raisons de sécurité, les navigateurs n'autorisent pas le transfert automatique de fichiers locaux vers WhatsApp.
              </p>
            </div>

            {/* Steps */}
            <div style={{
              textAlign: 'left',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex', flexDirection: 'column', gap: 14,
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0
                }}>1</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-strong)' }}>Enregistrez le PDF</strong>
                  <div style={{ marginTop: 2 }}>
                    La boîte de dialogue d'impression va s'ouvrir. Choisissez <span style={{color: 'var(--purple)', fontWeight: 600}}>"Enregistrer au format PDF"</span>.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0
                }}>2</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-strong)' }}>Glissez-déposez dans WhatsApp</strong>
                  <div style={{ marginTop: 2 }}>
                    La discussion WhatsApp du client va s'ouvrir automatiquement. Faites glisser le fichier PDF sauvegardé dedans.
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowExportGuide(false)}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1.5, background: 'var(--purple)', border: 'none', color: '#fff' }}
                onClick={startExportProcess}
              >
                Lancer l'exportation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
