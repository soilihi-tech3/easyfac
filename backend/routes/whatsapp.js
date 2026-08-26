const express = require('express');
const router = express.Router();
const multer = require('multer');
const whatsappManager = require('../services/whatsappClient');

// Use multer to handle memory storage for the uploaded PDF
const upload = multer({ storage: multer.memoryStorage() });

router.get('/status', async (req, res) => {
  const boutiqueId = req.user.boutique_id || (req.user.role === 'superadmin' ? req.user.id : null);
  if (!boutiqueId) return res.status(400).json({ error: "Boutique ID manquant" });
  const statusData = await whatsappManager.getStatus(boutiqueId);
  res.json(statusData);
});

router.post('/logout', async (req, res) => {
  try {
    const boutiqueId = req.user.boutique_id || (req.user.role === 'superadmin' ? req.user.id : null);
    if (!boutiqueId) return res.status(400).json({ error: "Boutique ID manquant" });
    await whatsappManager.logout(boutiqueId);
    res.json({ success: true, message: 'Déconnecté avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la déconnexion', details: err.message });
  }
});

router.post('/reconnect', async (req, res) => {
  try {
    const boutiqueId = req.user.boutique_id || (req.user.role === 'superadmin' ? req.user.id : null);
    if (!boutiqueId) return res.status(400).json({ error: "Boutique ID manquant" });
    const clientData = await whatsappManager.reconnect(boutiqueId);
    res.json({ success: true, status: clientData.status, qr: clientData.qrCodeUrl });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la réinitialisation WhatsApp', details: err.message });
  }
});

router.post('/pairing-code', async (req, res) => {
  try {
    const boutiqueId = req.user.boutique_id || (req.user.role === 'superadmin' ? req.user.id : null);
    if (!boutiqueId) return res.status(400).json({ error: "Boutique ID manquant" });

    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "Numéro de téléphone requis" });

    const code = await whatsappManager.requestPairingCode(boutiqueId, phoneNumber);
    res.json({ success: true, pairingCode: code });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur lors de la génération du code d'association" });
  }
});

router.post('/send-invoice', upload.single('pdf'), async (req, res) => {
  try {
    const boutiqueId = req.user.boutique_id || (req.user.role === 'superadmin' ? req.user.id : null);
    if (!boutiqueId) return res.status(400).json({ error: "Boutique ID manquant" });

    const { phone } = req.body;
    const file = req.file;

    if (!phone || !file) {
      return res.status(400).json({ error: "Numéro de téléphone ou fichier PDF manquant." });
    }

    await whatsappManager.sendPdf(
      boutiqueId,
      phone, 
      file.buffer, 
      'facture.pdf', 
      'Bonjour, voici votre facture.'
    );

    res.json({ success: true, message: "Facture envoyée avec succès !" });

  } catch (error) {
    console.error("WhatsApp Error:", error.message);
    res.status(500).json({ 
      error: `Erreur d'envoi: ${error.message}`, 
      details: error.message 
    });
  }
});

router.post('/send-message', async (req, res) => {
  try {
    const boutiqueId = req.user.boutique_id || (req.user.role === 'superadmin' ? req.user.id : null);
    if (!boutiqueId) return res.status(400).json({ error: "Boutique ID manquant" });

    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "Numéro de téléphone ou message manquant." });
    }
    
    await whatsappManager.sendText(boutiqueId, phone, message);
    res.json({ success: true, message: "Message envoyé avec succès !" });
  } catch (error) {
    console.error("WhatsApp Error:", error.message);
    res.status(500).json({ 
      error: `Erreur d'envoi: ${error.message}`, 
      details: error.message 
    });
  }
});

router.post('/send-broadcast', async (req, res) => {
  try {
    const boutiqueId = req.user.boutique_id || (req.user.role === 'superadmin' ? req.user.id : null);
    if (!boutiqueId) return res.status(400).json({ error: "Boutique ID manquant" });

    const { recipients, message } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
      return res.status(400).json({ error: "Récipiendaires ou message manquant." });
    }

    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      if (!r.phone) continue;
      try {
        const text = message
          .replace(/{prenom}/g, r.prenom || '')
          .replace(/{nom}/g, r.nom || '');
        await whatsappManager.sendText(boutiqueId, r.phone, text);
        sent++;
        // Small delay to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (e) {
        console.error(`Failed broadcast to ${r.phone}:`, e.message);
        failed++;
      }
    }

    res.json({ success: true, total: recipients.length, sent, failed });
  } catch (error) {
    console.error("Broadcast Error:", error.message);
    res.status(500).json({ error: `Erreur de diffusion: ${error.message}` });
  }
});

module.exports = router;
