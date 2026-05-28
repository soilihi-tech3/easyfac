const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

// Use multer to handle memory storage for the uploaded PDF
const upload = multer({ storage: multer.memoryStorage() });

router.post('/send-invoice', upload.single('pdf'), async (req, res) => {
  try {
    const { phone } = req.body;
    const file = req.file;

    if (!phone || !file) {
      return res.status(400).json({ error: "Numéro de téléphone ou fichier PDF manquant." });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
      return res.status(500).json({ 
        error: "Configuration WhatsApp manquante sur le serveur (WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID)." 
      });
    }

    // 1. Upload the media to WhatsApp API
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: 'facture.pdf',
      contentType: 'application/pdf',
    });
    formData.append('type', 'document');
    formData.append('messaging_product', 'whatsapp');

    const uploadRes = await axios.post(`https://graph.facebook.com/v20.0/${phoneId}/media`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
    });

    const mediaId = uploadRes.data.id;

    if (!mediaId) {
      throw new Error("Erreur lors de l'upload du document sur Meta.");
    }

    // Clean phone number (remove +, spaces, dashes, parentheses)
    const cleanPhone = phone.replace(/\D/g, '');

    // 2. Send the message with the media ID
    const messageRes = await axios.post(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "document",
      document: {
        id: mediaId,
        caption: "Bonjour, voici votre facture."
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
    });

    res.json({ success: true, messageId: messageRes.data.messages[0].id });

  } catch (error) {
    console.error("WhatsApp Error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: "Erreur lors de l'envoi via WhatsApp.", 
      details: error.response?.data || error.message 
    });
  }
});

module.exports = router;
