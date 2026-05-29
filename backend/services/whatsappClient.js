const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

class WhatsAppService {
  constructor() {
    const isMac = process.platform === 'darwin';
    
    // Clean up SingletonLock if it exists to prevent Puppeteer "browser is already running" error
    const fs = require('fs');
    const path = require('path');
    const lockPath = path.join(__dirname, '../.wwebjs_auth/session/SingletonLock');
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
        console.log('Cleaned up lingering WhatsApp Puppeteer SingletonLock');
      } catch (err) {
        console.error('Could not clean up WhatsApp Puppeteer SingletonLock:', err.message);
      }
    }

    const puppeteerArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees,site-per-process'
    ];

    if (!isMac) {
      puppeteerArgs.push('--no-zygote', '--single-process', '--js-flags=--max-old-space-size=150');
    }

    console.log(`Initializing Puppeteer with args: ${puppeteerArgs.join(' ')}`);

    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: puppeteerArgs
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
