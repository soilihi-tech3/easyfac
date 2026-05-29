const express = require('express');
const router = express.Router();
const multer = require('multer');
const whatsappClient = require('../services/whatsappClient');

// Use multer to handle memory storage for the uploaded PDF
const upload = multer({ storage: multer.memoryStorage() });

router.get('/status', (req, res) => {
  res.json(whatsappClient.getStatus());
});

router.post('/logout', async (req, res) => {
  try {
    await whatsappClient.logout();
    res.json({ success: true, message: 'Déconnecté avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la déconnexion', details: err.message });
  }
});

router.post('/send-invoice', upload.single('pdf'), async (req, res) => {
  try {
    const { phone } = req.body;
    const file = req.file;

    if (!phone || !file) {
      return res.status(400).json({ error: "Numéro de téléphone ou fichier PDF manquant." });
    }

    // Use the local WhatsApp client
    await whatsappClient.sendPdf(
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

module.exports = router;
