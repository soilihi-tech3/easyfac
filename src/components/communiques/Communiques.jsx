import React, { useState, useEffect } from 'react';
import {
  Megaphone, Send, Users, Truck, MessageCircle, Copy, Check,
  Sparkles, Filter, CheckSquare, Square, RefreshCw, AlertCircle, Phone
} from 'lucide-react';
import { getVoyages, getFactures, getClients, getParametres, API_URL } from '../../data/store';
import { useAuth } from '../../context/AuthContext';
import './Communiques.css';

const MESSAGE_TEMPLATES = [
  {
    id: 'vol_arrive',
    title: '📢 Vol Arrivé & Dépotage',
    text: "Bonjour {prenom} {nom},\n\nNous vous informons que le vol pour le voyage *{voyage}* est bien arrivé ! 🛬\nLe dépotage des colis est actuellement en cours. Nous vous informerons dès que les colis seront prêts à être récupérés.\n\nMerci de votre confiance,\n*{entreprise}*"
  },
  {
    id: 'colis_dispo',
    title: '📦 Colis Prêts pour Retrait',
    text: "Bonjour {prenom} {nom},\n\nExcellente nouvelle ! Votre colis du voyage *{voyage}* est disponible au magasin pour retrait. 📦✨\n\nVeuillez vous munir de votre reçu ou de votre pièce d'identité.\n\nCordialement,\n*{entreprise}*"
  },
  {
    id: 'prochain_vol',
    title: '✈️ Prochain Vol & Dernier Dépôt',
    text: "📢 *COMMUNIQUÉ IMPORTANT — PROCHAIN DEPART FRET*\n\nChers clients,\nNotre prochain départ pour *{voyage}* aura lieu très prochainement ! ✈️\n\n🗓️ *Dernier dépôt des colis :* [Indiquer la date]\n📍 *Lieu de dépôt :* [Indiquer l'adresse]\n\nReservez vos kilos dès maintenant en nous contactant !\n\n*{entreprise}*"
  },
  {
    id: 'retard_info',
    title: '⚠️ Info & Mise à jour Voyage',
    text: "⚠️ *COMMUNIQUÉ — INFORMATION SUR LE VOYAGE {voyage}*\n\nBonjour {prenom} {nom},\n\nNous tenons à vous informer d'un léger ajustement sur l'horaire de livraison de vos colis. Notre équipe fait le maximum pour vous livrer dans les plus brefs délais.\n\nNous restons à votre disposition pour toute question.\n\n*{entreprise}*"
  }
];

export default function Communiques() {
  const { user } = useAuth();
  let permissions = {};
  if (user?.permissions) {
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {}
  }

  if (user?.role === 'employee' && !permissions.voirCommuniques) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertCircle size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Accès non autorisé</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Vous ne disposez pas des droits d'accès requis pour consulter ou envoyer des communiqués.</p>
      </div>
    );
  }
  const [voyages, setVoyages] = useState([]);
  const [factures, setFactures] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [entrepriseName, setEntrepriseName] = useState('EASYFAC');
  const [loading, setLoading] = useState(true);

  // Target Selection Mode
  const [targetType, setTargetType] = useState('voyage'); // 'voyage' | 'all' | 'custom'
  const [selectedVoyageId, setSelectedVoyageId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  // Message Composition
  const [messageText, setMessageText] = useState(MESSAGE_TEMPLATES[0].text);
  const [selectedTemplate, setSelectedTemplate] = useState('vol_arrive');

  // Execution state
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // WhatsApp Web API connection status
  const [waStatus, setWaStatus] = useState('CHECKING');

  useEffect(() => {
    loadData();
    checkWhatsAppStatus();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vList, fList, cList, params] = await Promise.all([
        getVoyages(),
        getFactures(),
        getClients(),
        getParametres()
      ]);

      setVoyages(vList || []);
      setFactures(fList || []);
      setAllClients(cList || []);

      if (params?.entreprise?.nom) {
        setEntrepriseName(params.entreprise.nom);
      }

      if (vList && vList.length > 0) {
        setSelectedVoyageId(vList[0].id);
      }
    } catch (e) {
      console.error("Error loading data for Communiques:", e);
    } finally {
      setLoading(false);
    }
  };

  const checkWhatsAppStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/whatsapp/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status || 'DISCONNECTED');
      } else {
        setWaStatus('DISCONNECTED');
      }
    } catch {
      setWaStatus('DISCONNECTED');
    }
  };

  // Get targeted clients based on selection mode
  const getTargetedClients = () => {
    if (targetType === 'voyage') {
      if (!selectedVoyageId) return [];
      // Find all invoices linked to this voyageId
      const voyageFactures = factures.filter(f => f.voyageId === selectedVoyageId);
      const clientMap = new Map();

      voyageFactures.forEach(f => {
        // Seul l'expéditeur (le client qui a déposé et payé le colis) doit recevoir le message
        if (f.expediteur && f.expediteur.telephone) {
          clientMap.set(f.expediteur.id || f.expediteur.telephone, f.expediteur);
        } else if (f.clientId) {
          const clientExp = allClients.find(c => c.id === f.clientId);
          if (clientExp && clientExp.telephone) {
            clientMap.set(clientExp.id, clientExp);
          }
        }
      });
      return Array.from(clientMap.values());
    } else if (targetType === 'all') {
      return allClients.filter(c => c.telephone);
    } else if (targetType === 'custom') {
      return allClients.filter(c => selectedClientIds.includes(c.id) && c.telephone);
    }
    return [];
  };

  const targetedClients = getTargetedClients();

  // Selected Voyage Name
  const selectedVoyageObj = voyages.find(v => v.id === selectedVoyageId);
  const currentVoyageName = selectedVoyageObj ? selectedVoyageObj.nom : 'Voyage';

  // Toggle selection for single client
  const toggleClientSelection = (id) => {
    if (selectedClientIds.includes(id)) {
      setSelectedClientIds(selectedClientIds.filter(i => i !== id));
    } else {
      setSelectedClientIds([...selectedClientIds, id]);
    }
  };

  // Select / Deselect All
  const toggleSelectAllCustom = () => {
    if (selectedClientIds.length === allClients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(allClients.map(c => c.id));
    }
  };

  // Select Template
  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl.id);
    setMessageText(tpl.text);
  };

  // Format message for a specific client
  const formatMessageForClient = (client) => {
    return messageText
      .replace(/{prenom}/g, client.prenom || '')
      .replace(/{nom}/g, client.nom || '')
      .replace(/{voyage}/g, currentVoyageName)
      .replace(/{entreprise}/g, entrepriseName);
  };

  // Open direct WhatsApp chat link for single client
  const handleOpenSingleWhatsApp = (client) => {
    const text = formatMessageForClient(client);
    const cleanPhone = (client.telephone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Copy Status Message to Clipboard
  const handleCopyForStatus = () => {
    const textForStatus = messageText
      .replace(/{prenom}/g, '')
      .replace(/{nom}/g, '')
      .replace(/{voyage}/g, currentVoyageName)
      .replace(/{entreprise}/g, entrepriseName);

    navigator.clipboard.writeText(textForStatus);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2500);
  };

  // Send Direct Automatic Broadcast via Backend WhatsApp Web Client
  const handleSendAutomaticBroadcast = async () => {
    if (targetedClients.length === 0) {
      alert("Aucun client sélectionné pour l'envoi.");
      return;
    }

    if (!window.confirm(`Voulez-vous vraiment envoyer ce communiqué WhatsApp à ${targetedClients.length} client(s) ?`)) {
      return;
    }

    setSendingBroadcast(true);
    setBroadcastResult(null);

    try {
      const token = localStorage.getItem('token');
      const recipients = targetedClients.map(c => ({
        phone: c.telephone,
        prenom: c.prenom,
        nom: c.nom
      }));

      const res = await fetch(`${API_URL}/api/whatsapp/send-broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipients,
          message: messageText
            .replace(/{voyage}/g, currentVoyageName)
            .replace(/{entreprise}/g, entrepriseName)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");

      setBroadcastResult({
        success: true,
        message: `Communiqué envoyé avec succès à ${data.sent} client(s) ! (${data.failed} échec)`
      });
    } catch (err) {
      console.error(err);
      setBroadcastResult({
        success: false,
        message: `Échec de l'envoi automatique: ${err.message}`
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="communiques-container">
      {/* Header Bar */}
      <div className="communiques-page-header">
        <div className="header-title-box">
          <div className="header-icon-circle">
            <Megaphone size={22} />
          </div>
          <div>
            <h2>Communiqués & Diffusion WhatsApp</h2>
            <p>Envoyez des annonces groupées par Voyage ou publiez directement sur votre Statut WhatsApp.</p>
          </div>
        </div>

        {/* WhatsApp Status Pill */}
        <div className={`wa-connection-pill ${waStatus === 'CONNECTED' ? 'connected' : 'disconnected'}`}>
          <span className="dot" />
          <span>{waStatus === 'CONNECTED' ? 'WhatsApp Connecté' : 'WhatsApp Non Connecté'}</span>
        </div>
      </div>

      {/* Main Grid: Selection + Composer + Preview */}
      <div className="communiques-workspace">
        {/* Left Column: Target Selection & Message Editor */}
        <div className="communiques-editor-column">

          {/* Step 1: Target Audience Selection */}
          <div className="card-box">
            <div className="card-box-header">
              <span className="step-number">1</span>
              <h3>Sélectionnez les Destinataires</h3>
            </div>

            <div className="target-options-grid">
              <button
                type="button"
                className={`target-tab-btn ${targetType === 'voyage' ? 'active' : ''}`}
                onClick={() => setTargetType('voyage')}
              >
                <Truck size={16} /> Par Voyage Spécifique
              </button>

              <button
                type="button"
                className={`target-tab-btn ${targetType === 'all' ? 'active' : ''}`}
                onClick={() => setTargetType('all')}
              >
                <Users size={16} /> Tous les Clients ({allClients.length})
              </button>

              <button
                type="button"
                className={`target-tab-btn ${targetType === 'custom' ? 'active' : ''}`}
                onClick={() => setTargetType('custom')}
              >
                <Filter size={16} /> Choix Manuel sur Liste
              </button>
            </div>

            {/* Sub-selector for Voyage Mode */}
            {targetType === 'voyage' && (
              <div className="sub-select-wrapper">
                <label className="input-label">Sélectionner le Voyage :</label>
                <select
                  className="comm-select-input"
                  value={selectedVoyageId}
                  onChange={e => setSelectedVoyageId(e.target.value)}
                >
                  {voyages.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nom} (Départ : {new Date(v.dateDepart).toLocaleDateString('fr-FR')})
                    </option>
                  ))}
                </select>
                <div className="target-summary-info">
                  🎯 <b>{targetedClients.length} expéditeur(s)</b> ayant envoyé un colis sur ce voyage.
                </div>
              </div>
            )}

            {/* Sub-selector for Custom Checkbox List Mode */}
            {targetType === 'custom' && (
              <div className="sub-select-wrapper">
                <div className="custom-list-header">
                  <span>Cochez les clients à contacter :</span>
                  <button type="button" className="btn-link" onClick={toggleSelectAllCustom}>
                    {selectedClientIds.length === allClients.length ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                </div>

                <div className="custom-clients-scroll-box">
                  {allClients.map(c => (
                    <label key={c.id} className="client-check-item">
                      <input
                        type="checkbox"
                        checked={selectedClientIds.includes(c.id)}
                        onChange={() => toggleClientSelection(c.id)}
                      />
                      <span className="client-name">{c.prenom} {c.nom}</span>
                      <span className="client-phone">{c.telephone || 'Sans tél'}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Message Composition & Templates */}
          <div className="card-box">
            <div className="card-box-header">
              <span className="step-number">2</span>
              <h3>Rédigez le Message / Modèles Prédéfinis</h3>
            </div>

            {/* Preset Template Chips */}
            <div className="template-chips-row">
              {MESSAGE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`template-chip ${selectedTemplate === tpl.id ? 'active' : ''}`}
                  onClick={() => handleSelectTemplate(tpl)}
                >
                  {tpl.title}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div className="textarea-wrapper">
              <textarea
                className="comm-textarea"
                rows={7}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Rédigez votre communiqué ici..."
              />
              <div className="tags-help-bar">
                <span>Balises dynamiques :</span>
                <span className="tag-pill" onClick={() => setMessageText(m => m + ' {prenom}')}>{'{prenom}'}</span>
                <span className="tag-pill" onClick={() => setMessageText(m => m + ' {nom}')}>{'{nom}'}</span>
                <span className="tag-pill" onClick={() => setMessageText(m => m + ' {voyage}')}>{'{voyage}'}</span>
                <span className="tag-pill" onClick={() => setMessageText(m => m + ' {entreprise}')}>{'{entreprise}'}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="comm-actions-bar">
              {/* Copy for WhatsApp Status */}
              <button
                type="button"
                className="btn-status-copy"
                onClick={handleCopyForStatus}
              >
                {copiedStatus ? <Check size={16} /> : <Copy size={16} />}
                {copiedStatus ? 'Copié ! À coller dans votre Statut' : 'Copier pour votre Statut WhatsApp'}
              </button>

              {/* Automatic Mass WhatsApp Send */}
              <button
                type="button"
                className="btn-send-auto"
                onClick={handleSendAutomaticBroadcast}
                disabled={sendingBroadcast || targetedClients.length === 0}
              >
                {sendingBroadcast ? (
                  <>
                    <RefreshCw size={16} className="spin-icon" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Envoyer à tous ({targetedClients.length})
                  </>
                )}
              </button>
            </div>

            {broadcastResult && (
              <div className={`broadcast-alert ${broadcastResult.success ? 'success' : 'error'}`}>
                {broadcastResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                <span>{broadcastResult.message}</span>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Live Preview & Individual Client List */}
        <div className="communiques-preview-column">
          {/* Live Preview Box */}
          <div className="card-box preview-box-card">
            <div className="preview-card-header">
              <MessageCircle size={18} className="wa-icon" />
              <span>Aperçu du Message (WhatsApp)</span>
            </div>

            <div className="wa-chat-bubble">
              <p style={{ whiteSpace: 'pre-wrap' }}>
                {targetedClients.length > 0
                  ? formatMessageForClient(targetedClients[0])
                  : messageText.replace(/{prenom}/g, 'Amine').replace(/{nom}/g, 'Soilihi').replace(/{voyage}/g, currentVoyageName).replace(/{entreprise}/g, entrepriseName)
                }
              </p>
              <div className="wa-bubble-time">
                {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ✓✓
              </div>
            </div>
          </div>

          {/* List of Targeted Clients with Direct 1-Click WhatsApp Button */}
          <div className="card-box client-list-card">
            <div className="client-list-header">
              <h3>Destinataires ({targetedClients.length})</h3>
              <span className="sub-tag">1-Click WhatsApp</span>
            </div>

            <div className="targeted-clients-scroll">
              {targetedClients.length > 0 ? (
                targetedClients.map((client, idx) => (
                  <div key={client.id || idx} className="client-target-row">
                    <div className="client-info">
                      <span className="c-name">{client.prenom} {client.nom}</span>
                      <span className="c-phone">{client.telephone}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-wa-single"
                      onClick={() => handleOpenSingleWhatsApp(client)}
                      title="Envoyer individuellement via WhatsApp"
                    >
                      <Phone size={13} /> Envoyer
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-clients-notice">
                  <span>Aucun client ne correspond à cette sélection.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
