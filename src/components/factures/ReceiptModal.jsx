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
      `*${entreprise.nom || 'EASYFAC'}*`
    ].join('\n');
    
    let phone = facture.expediteur?.telephone || facture.destinataire?.telephone || '';
    phone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank');
  };

  const handleExportPDF = () => {
    handlePrint();
  };

  const activeModele = config.modeleFacture || 'moderne'; // simple, moderne, professionnel

  const renderSimpleTemplate = () => (
    <div style={{ padding: '30px 40px' }}>
      {/* Top Header */}
      <div className="receipt-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {entreprise.logo && (
              <img src={entreprise.logo} alt="Logo" style={{ maxHeight: 50, maxWidth: 120, objectFit: 'contain' }} />
            )}
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: entreprise.logo ? 22 : 28, fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase', lineHeight: 1.1 }}>
              {entreprise.nom || 'EASYFAC'}
            </h1>
          </div>
        </div>
        <div className="agencies-wrap" style={{ flex: 2, fontSize: 11, lineHeight: 1.5 }}>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'flex-end', flexWrap: 'wrap' }} className="agencies-inner-flex">
            {/* 1. SÉNÉGAL */}
            <div style={{ textAlign: 'left', minWidth: '130px' }} className="agency-block">
              <strong style={{ color: accentColor, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>
                AGENCE SÉNÉGAL
              </strong>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 11, lineHeight: 1.4 }}>
                {entreprise.adresse || '—'}
                {entreprise.rueSenegal && <><br />{entreprise.rueSenegal}</>}
              </div>
              <div style={{ fontWeight: 700, color: '#475569', fontSize: 10.5, marginTop: 4 }}>
                📞 {entreprise.telephone1 || '—'}
                {entreprise.telephone2 ? ` / ${entreprise.telephone2}` : ''}
              </div>
            </div>
            
            {/* 2. COMORES */}
            {(entreprise.lieuComores || entreprise.telComores1) && (
              <div style={{ textAlign: 'left', minWidth: '130px' }} className="agency-block">
                <strong style={{ color: accentColor, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>
                  AGENCE COMORES
                </strong>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 11, lineHeight: 1.4 }}>
                  {entreprise.lieuComores || '—'}
                  {entreprise.rueComores && <><br />{entreprise.rueComores}</>}
                </div>
                <div style={{ fontWeight: 700, color: '#475569', fontSize: 10.5, marginTop: 4 }}>
                  📞 {entreprise.telComores1 || '—'}
                  {entreprise.telComores2 ? ` / ${entreprise.telComores2}` : ''}
                </div>
              </div>
            )}

            {/* 3. AUTRE */}
            {(entreprise.lieuAutre || entreprise.telAutre1) && (
              <div style={{ textAlign: 'left', minWidth: '130px' }} className="agency-block">
                <strong style={{ color: accentColor, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>
                  {entreprise.nomAutre || 'AUTRE ADRESSE'}
                </strong>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 11, lineHeight: 1.4 }}>
                  {entreprise.lieuAutre || '—'}
                  {entreprise.rueAutre && <><br />{entreprise.rueAutre}</>}
                </div>
                <div style={{ fontWeight: 700, color: '#475569', fontSize: 10.5, marginTop: 4 }}>
                  📞 {entreprise.telAutre1 || '—'}
                  {entreprise.telAutre2 ? ` / ${entreprise.telAutre2}` : ''}
                </div>
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
        <div className="receipt-info-row-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '2px solid #000' }}>
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
        <div className="receipt-info-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #000' }}>
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
            <tr style={{ background: accentColor, color: '#ffffff', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 12px', borderRight: '2px solid #000', width: '60px', textAlign: 'center', color: '#ffffff' }}>QTÉ.</th>
              <th style={{ padding: '10px 12px', borderRight: '2px solid #000', color: '#ffffff' }}>ARTICLE (DESCRIPTION)</th>
              <th style={{ padding: '10px 12px', borderRight: '2px solid #000', width: '120px', textAlign: 'right', color: '#ffffff' }}>PRIX UNITAIRE</th>
              <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right', color: '#ffffff' }}>TOTAL</th>
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

      {/* Signature & Cachet Section */}
      {(entreprise.cachet || entreprise.signature) && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'flex-end', 
          gap: 30, 
          marginTop: 20,
          pageBreakInside: 'avoid'
        }}>
          {entreprise.signature && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signature</span>
              <img src={entreprise.signature} alt="Signature" style={{ maxWidth: 110, maxHeight: 70, objectFit: 'contain' }} />
            </div>
          )}
          {entreprise.cachet && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cachet Officiel</span>
              <img src={entreprise.cachet} alt="Cachet" style={{ maxWidth: 110, maxHeight: 75, objectFit: 'contain' }} />
            </div>
          )}
        </div>
      )}
      
      {/* Footer Shapes */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, display: 'flex' }}>
        <div style={{ width: '40%', background: '#0f172a', clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)' }}></div>
        <div style={{ width: '60%', background: accentColor, marginLeft: -20, zIndex: -1 }}></div>
      </div>
    </div>
  );

  const renderModerneTemplate = () => (
    <div style={{ padding: 0 }}>
      {/* Top Header curved wave */}
      <div style={{ background: '#1e1e1e', color: '#fff', padding: '25px 30px 45px 30px', position: 'relative', overflow: 'hidden', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
          {/* Left: Logo & Company Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {entreprise.logo && (
              <img src={entreprise.logo} alt="Logo" style={{ maxHeight: 45, maxWidth: 100, objectFit: 'contain' }} />
            )}
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 900, color: '#eab308', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {entreprise.nom || 'EASYFAC'}
            </h2>
          </div>
          {/* Right: Company details */}
          <div style={{ display: 'flex', gap: 20, fontSize: 10, color: '#e2e8f0', textAlign: 'left', lineHeight: 1.4, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 2 }} className="agencies-inner-flex">
            {/* 1. SÉNÉGAL */}
            <div style={{ minWidth: '130px' }} className="agency-block">
              <span style={{ color: '#eab308', fontWeight: 800, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: '0.03em', display: 'block', marginBottom: 3 }}>
                AGENCE SÉNÉGAL
              </span>
              <div style={{ fontWeight: 800, color: '#ffffff', fontSize: 10.5, lineHeight: 1.4 }}>
                {entreprise.adresse || '—'}
                {entreprise.rueSenegal && <><br />{entreprise.rueSenegal}</>}
              </div>
              <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 10, marginTop: 4 }}>
                📞 {entreprise.telephone1 || '—'}
                {entreprise.telephone2 ? ` / ${entreprise.telephone2}` : ''}
              </div>
            </div>
            
            {/* 2. COMORES */}
            {(entreprise.lieuComores || entreprise.telComores1) && (
              <div style={{ minWidth: '130px' }} className="agency-block">
                <span style={{ color: '#eab308', fontWeight: 800, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: '0.03em', display: 'block', marginBottom: 3 }}>
                  AGENCE COMORES
                </span>
                <div style={{ fontWeight: 800, color: '#ffffff', fontSize: 10.5, lineHeight: 1.4 }}>
                  {entreprise.lieuComores || '—'}
                  {entreprise.rueComores && <><br />{entreprise.rueComores}</>}
                </div>
                <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 10, marginTop: 4 }}>
                  📞 {entreprise.telComores1 || '—'}
                  {entreprise.telComores2 ? ` / ${entreprise.telComores2}` : ''}
                </div>
              </div>
            )}

            {/* 3. AUTRE */}
            {(entreprise.lieuAutre || entreprise.telAutre1) && (
              <div style={{ minWidth: '130px' }} className="agency-block">
                <span style={{ color: '#eab308', fontWeight: 800, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: '0.03em', display: 'block', marginBottom: 3 }}>
                  {entreprise.nomAutre || 'AUTRE ADRESSE'}
                </span>
                <div style={{ fontWeight: 800, color: '#ffffff', fontSize: 10.5, lineHeight: 1.4 }}>
                  {entreprise.lieuAutre || '—'}
                  {entreprise.rueAutre && <><br />{entreprise.rueAutre}</>}
                </div>
                <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 10, marginTop: 4 }}>
                  📞 {entreprise.telAutre1 || '—'}
                  {entreprise.telAutre2 ? ` / ${entreprise.telAutre2}` : ''}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* SVG Wave Divider */}
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 40, zIndex: 1 }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
            <path fill="#ffffff" d="M0,32L80,37.3C160,43,320,53,480,58.7C640,64,800,64,960,58.7C1120,53,1280,43,1360,37.3L1440,32L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"></path>
          </svg>
        </div>
      </div>

      {/* Details Box */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 30px 10px 30px', alignItems: 'flex-start' }}>
        {/* Customer Info */}
        <div style={{ display: 'flex', gap: 30, fontSize: 12, lineHeight: 1.4 }}>
          <div>
            <span style={{ color: '#64748b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Expéditeur :</span>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
              {facture.expediteur?.prenom} {facture.expediteur?.nom}
            </div>
            {facture.expediteur?.telephone && <div style={{ color: '#475569', fontSize: 11.5 }}>Tél: {facture.expediteur.telephone}</div>}
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Destinataire :</span>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
              {facture.destinataire?.prenom} {facture.destinataire?.nom}
            </div>
            {facture.destinataire?.telephone && <div style={{ color: '#475569', fontSize: 11.5 }}>Tél: {facture.destinataire.telephone}</div>}
          </div>
        </div>
        
        {/* Invoice Info */}
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '0.05em' }}>
            FACTURE
          </h1>
          <table style={{ borderCollapse: 'collapse', fontSize: 11.5, marginLeft: 'auto' }}>
            <tbody>
              <tr>
                <td style={{ padding: '2px 8px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>N° FACTURE :</td>
                <td style={{ padding: '2px 8px', fontWeight: 800, color: '#ef4444' }}>{facture.numero}</td>
              </tr>
              {voyage && (
                <tr>
                  <td style={{ padding: '2px 8px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>VOYAGE :</td>
                  <td style={{ padding: '2px 8px', fontWeight: 700 }}>{voyage.nom}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: '2px 8px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>DATE :</td>
                <td style={{ padding: '2px 8px', fontWeight: 700 }}>{formatDate(facture.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: '0 30px', marginBottom: 15 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>
              <th style={{ background: '#eab308', color: '#000', padding: '8px 12px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' }}>
                Description de l'article / Voyage
              </th>
              <th style={{ background: '#1e1e1e', color: '#fff', padding: '8px 12px', textAlign: 'center', width: '50px' }}>
                Qté
              </th>
              <th style={{ background: '#1e1e1e', color: '#fff', padding: '8px 12px', textAlign: 'right', width: '110px' }}>
                Prix Unit.
              </th>
              <th style={{ background: '#1e1e1e', color: '#fff', padding: '8px 12px', textAlign: 'right', width: '110px', borderTopRightRadius: '4px', borderBottomRightRadius: '4px' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  {a.nom}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center', color: '#475569' }}>
                  {a.quantite || 1}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right', color: '#475569' }}>
                  {formatCurrency(a.prixUnitaire, devise)}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 800, textAlign: 'right', color: '#0f172a' }}>
                  {formatCurrency(a.total, devise)}
                </td>
              </tr>
            ))}
            
            {/* Freight Row */}
            {facture.poidsTotal > 0 && (
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: articles.length % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  Fret: {facture.poidsTotal} KG
                </td>
                <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center', color: '#475569' }}>
                  1
                </td>
                <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right', color: '#475569' }}>
                  {formatCurrency(facture.prixKg, devise)}/kg
                </td>
                <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 800, textAlign: 'right', color: '#0f172a' }}>
                  {formatCurrency(facture.fraisFret, devise)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom info & Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 30px', alignItems: 'flex-start', marginBottom: 15 }}>
        {/* Payment info */}
        <div style={{ width: '50%', fontSize: 11.5 }}>
          <span style={{ color: '#64748b', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase' }}>Infos Paiement :</span>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><strong style={{ color: '#475569' }}>Statut :</strong> <span style={{ fontWeight: 800, color: statColor }}>{STATUT_MAP[facture.statut]}</span></div>
            <div><strong style={{ color: '#475569' }}>Mode :</strong> <span style={{ fontWeight: 600 }}>{MODE_MAP[facture.modePaiement] || 'Cash'}</span></div>
            {facture.dateLimite && (facture.montantTotal - facture.montantPaye > 0) && (
              <div style={{ color: '#ef4444' }}><strong style={{ color: '#ef4444' }}>Échéance :</strong> {formatDate(facture.dateLimite)}</div>
            )}
            {facture.payerComores === 1 && (
              <div style={{ marginTop: 6, padding: 8, border: '1px solid #eab308', borderRadius: 4, background: '#fefbeb', maxWidth: '85%' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#d97706', display: 'block', marginBottom: 2 }}>RÈGLEMENT AUX COMORES :</span>
                <div style={{ fontSize: 11, fontWeight: 700 }}>Solde Comores : {formatCurrency(facture.montantComores, devise)}</div>
                {devise !== 'KMF' && (
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#d97706', marginTop: 2 }}>
                    Soit : {formatCurrency(facture.montantComores * (devise === 'EUR' ? 491.96775 : 0.75), 'KMF')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Totals table */}
        <div style={{ width: '45%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 700 }}>Sous-total :</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(facture.montantTotal, devise)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 700 }}>Montant Payé :</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(facture.montantPaye, devise)}</td>
              </tr>
              {facture.montantTotal - facture.montantPaye > 0 && (
                <tr>
                  <td style={{ padding: '4px 8px', color: '#ef4444', fontWeight: 700 }}>Reste à payer :</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(facture.montantTotal - facture.montantPaye, devise)}</td>
                </tr>
              )}
              
              {/* Gold grand total banner */}
              <tr style={{ background: '#eab308', color: '#000', fontSize: 14 }}>
                <td style={{ padding: '8px 12px', fontWeight: 800, borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px', textTransform: 'uppercase' }}>
                  Total :
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, borderTopRightRadius: '4px', borderBottomRightRadius: '4px' }}>
                  {formatCurrency(facture.montantTotal, devise)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature & Cachet Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 30px 25px 30px' }}>
        <div style={{ fontStyle: 'italic', fontSize: 11, color: '#64748b' }}>
          Merci de votre confiance !
        </div>
        
        {(entreprise.cachet || entreprise.signature) && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
            {entreprise.signature && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signature</span>
                <img src={entreprise.signature} alt="Signature" style={{ maxWidth: 100, maxHeight: 60, objectFit: 'contain' }} />
              </div>
            )}
            {entreprise.cachet && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cachet Officiel</span>
                <img src={entreprise.cachet} alt="Cachet" style={{ maxWidth: 100, maxHeight: 65, objectFit: 'contain' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderProfessionnelTemplate = () => (
    <div style={{ padding: 0 }}>
      {/* Decorative corner triangles */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: '#0b57d0', clipPath: 'polygon(100% 0, 100% 100%, 0 0)', zIndex: 1 }}></div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 120, height: 120, background: '#0b57d0', clipPath: 'polygon(0 0, 0 100%, 100% 100%)', zIndex: 1 }}></div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '30px 40px 10px 40px', position: 'relative', zIndex: 2 }}>
        {/* Left Logo & Company Name / Agencies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {entreprise.logo && (
              <img src={entreprise.logo} alt="Logo" style={{ maxHeight: 40, maxWidth: 100, objectFit: 'contain' }} />
            )}
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 900, color: '#0b57d0', margin: 0, textTransform: 'uppercase' }}>
              {entreprise.nom || 'EASYFAC'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 11, color: '#475569', lineHeight: 1.4, marginTop: 8, flexWrap: 'wrap' }} className="agencies-inner-flex">
            {/* 1. SÉNÉGAL */}
            <div style={{ minWidth: '130px' }} className="agency-block">
              <strong style={{ color: '#0b57d0', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 3 }}>
                AGENCE SÉNÉGAL
              </strong>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 11, lineHeight: 1.4 }}>
                {entreprise.adresse || '—'}
                {entreprise.rueSenegal && <><br />{entreprise.rueSenegal}</>}
              </div>
              <div style={{ fontWeight: 700, color: '#475569', fontSize: 10.5, marginTop: 4 }}>
                📞 {entreprise.telephone1 || '—'}
                {entreprise.telephone2 ? ` / ${entreprise.telephone2}` : ''}
              </div>
            </div>
            
            {/* 2. COMORES */}
            {(entreprise.lieuComores || entreprise.telComores1) && (
              <div style={{ minWidth: '130px' }} className="agency-block">
                <strong style={{ color: '#0b57d0', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 3 }}>
                  AGENCE COMORES
                </strong>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 11, lineHeight: 1.4 }}>
                  {entreprise.lieuComores || '—'}
                  {entreprise.rueComores && <><br />{entreprise.rueComores}</>}
                </div>
                <div style={{ fontWeight: 700, color: '#475569', fontSize: 10.5, marginTop: 4 }}>
                  📞 {entreprise.telComores1 || '—'}
                  {entreprise.telComores2 ? ` / ${entreprise.telComores2}` : ''}
                </div>
              </div>
            )}

            {/* 3. AUTRE */}
            {(entreprise.lieuAutre || entreprise.telAutre1) && (
              <div style={{ minWidth: '130px' }} className="agency-block">
                <strong style={{ color: '#0b57d0', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 3 }}>
                  {entreprise.nomAutre || 'AUTRE ADRESSE'}
                </strong>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 11, lineHeight: 1.4 }}>
                  {entreprise.lieuAutre || '—'}
                  {entreprise.rueAutre && <><br />{entreprise.rueAutre}</>}
                </div>
                <div style={{ fontWeight: 700, color: '#475569', fontSize: 10.5, marginTop: 4 }}>
                  📞 {entreprise.telAutre1 || '—'}
                  {entreprise.telAutre2 ? ` / ${entreprise.telAutre2}` : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Title & Customer section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 40px', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
        {/* Left: Blue Invoice block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            background: '#0b57d0',
            color: '#ffffff',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: '0.1em',
            padding: '8px 24px',
            borderRadius: '4px',
            boxShadow: '0 4px 6px -1px rgba(11,87,208,0.2)',
            alignSelf: 'flex-start'
          }}>
            FACTURE
          </div>
          {/* Metadata */}
          <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.4, marginTop: 4 }}>
            <strong>N° FACTURE :</strong> <span style={{ color: '#ef4444', fontWeight: 800 }}>{facture.numero}</span><br />
            <strong>DATE :</strong> {formatDate(facture.createdAt)}<br />
            {voyage && <><strong>VOYAGE :</strong> {voyage.nom}</>}
          </div>
        </div>
        
        {/* Right Client Info */}
        <div style={{ display: 'flex', gap: 30, textAlign: 'left', fontSize: 11.5, lineHeight: 1.4 }}>
          <div>
            <span style={{ color: '#0b57d0', fontWeight: 800, textTransform: 'uppercase', fontSize: 9.5 }}>Expéditeur :</span>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
              {facture.expediteur?.prenom} {facture.expediteur?.nom}
            </div>
            {facture.expediteur?.telephone && <div style={{ color: '#475569', fontSize: 11.5 }}>Tél: {facture.expediteur.telephone}</div>}
          </div>
          <div>
            <span style={{ color: '#0b57d0', fontWeight: 800, textTransform: 'uppercase', fontSize: 9.5 }}>Destinataire :</span>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
              {facture.destinataire?.prenom} {facture.destinataire?.nom}
            </div>
            {facture.destinataire?.telephone && <div style={{ color: '#475569', fontSize: 11.5 }}>Tél: {facture.destinataire.telephone}</div>}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: '0 40px', marginBottom: 15, position: 'relative', zIndex: 2 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0b57d0', color: '#ffffff', fontSize: 11.5, textTransform: 'uppercase', fontWeight: 800 }}>
              <th style={{ padding: '10px 12px', color: '#ffffff', borderTopLeftRadius: '4px' }}>Description de l'article</th>
              <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'center', width: '50px' }}>Qté</th>
              <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'right', width: '120px' }}>Prix</th>
              <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'right', width: '120px', borderTopRightRadius: '4px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>{a.nom}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'center', color: '#475569' }}>{a.quantite || 1}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: '#475569' }}>{formatCurrency(a.prixUnitaire, devise)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 800, textAlign: 'right', color: '#0b57d0' }}>{formatCurrency(a.total, devise)}</td>
              </tr>
            ))}
            
            {/* Freight Row */}
            {facture.poidsTotal > 0 && (
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: articles.length % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  Fret: {facture.poidsTotal} KG
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'center', color: '#475569' }}>1</td>
                <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: '#475569' }}>{formatCurrency(facture.prixKg, devise)}/kg</td>
                <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 800, textAlign: 'right', color: '#0b57d0' }}>{formatCurrency(facture.fraisFret, devise)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', alignItems: 'flex-start', marginBottom: 20, position: 'relative', zIndex: 2 }}>
        {/* Left: Payment Method */}
        <div style={{ width: '50%', fontSize: 11.5 }}>
          <span style={{ color: '#0b57d0', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Mode de règlement :</span>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><strong style={{ color: '#475569' }}>Statut :</strong> <span style={{ fontWeight: 800, color: statColor }}>{STATUT_MAP[facture.statut]}</span></div>
            <div><strong style={{ color: '#475569' }}>Mode de paiement :</strong> <span style={{ fontWeight: 600 }}>{MODE_MAP[facture.modePaiement] || 'Cash'}</span></div>
            {facture.dateLimite && (facture.montantTotal - facture.montantPaye > 0) && (
              <div style={{ color: '#ef4444' }}><strong style={{ color: '#ef4444' }}>Date d'échéance :</strong> {formatDate(facture.dateLimite)}</div>
            )}
            {facture.payerComores === 1 && (
              <div style={{ marginTop: 6, padding: 8, border: '1px solid #0b57d0', borderRadius: 4, background: '#f0f6ff', maxWidth: '85%' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#0b57d0', display: 'block', marginBottom: 2 }}>RÈGLEMENT AUX COMORES :</span>
                <div style={{ fontSize: 11, fontWeight: 700 }}>Solde Comores : {formatCurrency(facture.montantComores, devise)}</div>
                {devise !== 'KMF' && (
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0b57d0', marginTop: 2 }}>
                    Soit : {formatCurrency(facture.montantComores * (devise === 'EUR' ? 491.96775 : 0.75), 'KMF')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Totals with Blue Grand Total block */}
        <div style={{ width: '40%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 700 }}>Sous-total :</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(facture.montantTotal, devise)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 700 }}>Montant Payé :</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(facture.montantPaye, devise)}</td>
              </tr>
              {facture.montantTotal - facture.montantPaye > 0 && (
                <tr>
                  <td style={{ padding: '4px 8px', color: '#ef4444', fontWeight: 700 }}>Reste à payer :</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(facture.montantTotal - facture.montantPaye, devise)}</td>
                </tr>
              )}
              
              <tr style={{ background: '#0b57d0', color: '#ffffff', fontSize: 13.5 }}>
                <td style={{ padding: '8px 12px', fontWeight: 800, borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' }}>
                  TOTAL FACTURÉ :
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, borderTopRightRadius: '4px', borderBottomRightRadius: '4px' }}>
                  {formatCurrency(facture.montantTotal, devise)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature & Cachet Horizontal Area */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 40px 30px 40px', position: 'relative', zIndex: 2 }}>
        {(entreprise.cachet || entreprise.signature) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', marginBottom: 4 }}>
              {entreprise.signature && (
                <img src={entreprise.signature} alt="Signature" style={{ maxWidth: 100, maxHeight: 60, objectFit: 'contain' }} />
              )}
              {entreprise.cachet && (
                <img src={entreprise.cachet} alt="Cachet" style={{ maxWidth: 100, maxHeight: 65, objectFit: 'contain' }} />
              )}
            </div>
            <div style={{ width: 180, height: 1.5, background: '#000' }}></div>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signature & Cachet</span>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(12px)',
      zIndex: 1000,
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      padding: '20px 10px',
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

        #receipt-print-area table th {
          color: #ffffff !important;
        }

        #receipt-print-area * {
          color-scheme: light !important;
        }

        /* Normal view header styles */
        .receipt-top-bar {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          width: 100% !important;
          max-width: 720px !important;
          background: var(--bg-elevated) !important;
          border: 1px solid var(--border-strong) !important;
          border-radius: 16px !important;
          padding: 12px 16px !important;
          margin-bottom: 12px !important;
          gap: 12px !important;
          flex-shrink: 0 !important;
          box-shadow: var(--shadow-lg) !important;
          box-sizing: border-box !important;
        }
        .receipt-top-bar-title {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
        }
        .receipt-actions-row {
          display: flex !important;
          gap: 8px !important;
          align-items: center !important;
          flex-shrink: 0 !important;
        }

        @media print {
          /* Enforce single physical page, no margins/headers/footers */
          @page {
            size: portrait;
            margin: 0 !important;
          }

          /* Force page background to white and prevent overflow scroll */
          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color-scheme: light !important;
            height: 100% !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Hide all sibling elements of the modal overlay */
          body > :not(.modal-overlay) {
            display: none !important;
          }
          #root {
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
            height: 100% !important;
            overflow: hidden !important;
          }

          /* Ensure wrapper does not flex or center, keeping normal flow */
          .modal-overlay > div {
            display: block !important;
            min-height: auto !important;
            width: 100% !important;
            background: transparent !important;
            background-color: transparent !important;
            height: 100% !important;
            overflow: hidden !important;
          }

          /* Hide sticky action bar */
          .modal-overlay > div > div:first-child {
            display: none !important;
          }

          #receipt-print-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            height: 296mm !important;
            max-height: 296mm !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            box-shadow: none !important;
            margin: 0 !important;
            color-scheme: light !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            
            /* Strict single page limits */
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            
            /* Apply general scaling zoom for standard layouts to comfortably fit more articles */
            zoom: 0.85 !important; 
          }

          #receipt-print-area > div {
            padding: 20px 30px !important; /* reduce excessive padding */
            box-sizing: border-box !important;
          }

          /* Tighter spacings to shrink height dynamically for printing */
          #receipt-print-area h1 {
            font-size: 20px !important;
          }
          #receipt-print-area .receipt-header-row {
            margin-bottom: 8px !important;
          }
          #receipt-print-area .receipt-info-row-3,
          #receipt-print-area .receipt-info-row-2 {
            margin-bottom: 8px !important;
          }
          #receipt-print-area table {
            margin-bottom: 8px !important;
          }
          #receipt-print-area th, 
          #receipt-print-area td {
            padding: 4px 6px !important;
            font-size: 10.5px !important;
          }
          #receipt-print-area .info-box {
            margin-bottom: 8px !important;
          }
          #receipt-print-area table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          /* Let all inner elements print exactly as designed in the app */
          #receipt-print-area * {
            color-scheme: light !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
          }
        }

        @media screen and (max-width: 600px) {
          .receipt-top-bar {
            flex-wrap: wrap !important;
            padding: 10px !important;
            border-radius: 12px !important;
            gap: 8px !important;
          }
          .receipt-top-bar-title {
            flex: 1 1 auto !important;
          }
          .receipt-actions-row {
            flex: 1 1 auto !important;
            width: 100% !important;
            justify-content: flex-end !important;
            gap: 6px !important;
          }
          .receipt-actions-row button {
            padding: 8px 10px !important;
            font-size: 11px !important;
          }
          #receipt-print-area {
            font-size: 11px !important;
          }
          #receipt-print-area > div {
            padding: 16px 12px !important;
          }
          .receipt-header-row {
            flex-direction: column !important;
            gap: 16px !important;
            margin-bottom: 16px !important;
          }
          .agencies-wrap {
            text-align: left !important;
            width: 100% !important;
          }
          .agencies-inner-flex {
            flex-direction: column !important;
            gap: 12px !important;
            justify-content: flex-start !important;
          }
          .agency-block {
            text-align: left !important;
          }
          .receipt-info-row-3 {
            grid-template-columns: 1fr !important;
          }
          .receipt-info-row-3 > div {
            border-right: none !important;
            border-bottom: 2px solid #000 !important;
          }
          .receipt-info-row-3 > div:last-child {
            border-bottom: none !important;
          }
          .receipt-info-row-2 {
            grid-template-columns: 1fr !important;
          }
          .receipt-info-row-2 > div {
            border-right: none !important;
            border-bottom: 2px solid #000 !important;
          }
          .receipt-info-row-2 > div:last-child {
            border-bottom: none !important;
          }
          #receipt-print-area table th,
          #receipt-print-area table td {
            padding: 6px 8px !important;
            font-size: 11px !important;
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
        className="receipt-top-bar"
      >
        {/* Title */}
        <div className="receipt-top-bar-title">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--brand-muted)', color: 'var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
            flexShrink: 0
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
        <div className="receipt-actions-row">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportPDF}
            style={{ gap: 6, background: 'var(--purple-muted)', color: 'var(--purple)', borderColor: 'rgba(168,85,247,0.2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--purple)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--purple-muted)'; e.currentTarget.style.color = 'var(--purple)'; }}
          >
            <FileText size={14} /> Exporter PDF
          </button>
          {facture.montantTotal - facture.montantPaye > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReminderWhatsApp}
              style={{
                gap: 6,
                background: 'var(--danger-muted)',
                color: 'var(--danger)',
                borderColor: 'rgba(239,68,68,0.2)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--danger-muted)'; e.currentTarget.style.color = 'var(--danger)'; }}
            >
              <MessageCircle size={14} /> Rappel WhatsApp
            </button>
          )}
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
        {activeModele === 'simple' && renderSimpleTemplate()}
        {activeModele === 'moderne' && renderModerneTemplate()}
        {activeModele === 'professionnel' && renderProfessionnelTemplate()}
      </div>
    </div>
    </div>,
    document.body
  );
}
