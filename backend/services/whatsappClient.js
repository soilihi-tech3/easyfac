const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

class WhatsAppService {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.qrCodeUrl = null;
    this.status = 'INITIALIZING';
    this.phoneConnected = null;

    this.initialize();
  }

  initialize() {
    this.client.on('qr', async (qr) => {
      console.log('WhatsApp QR Code generated, waiting for scan...');
      this.status = 'QR_READY';
      try {
        this.qrCodeUrl = await qrcode.toDataURL(qr);
      } catch (err) {
        console.error('Error generating QR code data URL', err);
      }
    });

    this.client.on('ready', () => {
      console.log('WhatsApp Client is ready!');
      this.status = 'CONNECTED';
      this.qrCodeUrl = null;
      if (this.client.info && this.client.info.wid) {
        this.phoneConnected = this.client.info.wid.user;
      }
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp Authenticated');
    });

    this.client.on('auth_failure', msg => {
      console.error('WhatsApp Authentication failure', msg);
      this.status = 'AUTH_FAILURE';
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp Client was disconnected', reason);
      this.status = 'DISCONNECTED';
      this.phoneConnected = null;
      // Optionnel : on peut relancer client.initialize() ici selon le besoin
      // this.client.initialize(); 
    });

    console.log('Starting WhatsApp client initialization...');
    this.client.initialize().catch(err => {
      console.error('Failed to initialize WhatsApp client:', err);
    });
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.qrCodeUrl,
      phone: this.phoneConnected
    };
  }

  async logout() {
    if (this.status === 'CONNECTED') {
      await this.client.logout();
      this.status = 'DISCONNECTED';
      this.phoneConnected = null;
      this.qrCodeUrl = null;
      this.client.initialize(); // Re-initialize to generate a new QR
    }
  }

  async sendText(phone, message) {
    if (this.status !== 'CONNECTED') {
      throw new Error("Le client WhatsApp n'est pas connecté. Veuillez scanner le QR code.");
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;
    await this.client.sendMessage(chatId, message);
  }

  async sendPdf(phone, pdfBuffer, filename, caption = '') {
    if (this.status !== 'CONNECTED') {
      throw new Error("Le client WhatsApp n'est pas connecté. Veuillez scanner le QR code.");
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;
    
    // Create MessageMedia from buffer
    const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), filename);
    await this.client.sendMessage(chatId, media, { caption });
  }
}

// Export as a singleton
const whatsappService = new WhatsAppService();
module.exports = whatsappService;
