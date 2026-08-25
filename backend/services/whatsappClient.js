const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WhatsAppManager {
  constructor() {
    this.clients = new Map(); // boutiqueId => ClientData
  }

  // Obtenir ou initialiser un client pour une boutique
  getClientData(boutiqueId) {
    if (!boutiqueId) throw new Error("boutiqueId est requis");
    
    let clientData = this.clients.get(boutiqueId);
    if (!clientData) {
      // Nettoyer les verrous Puppeteer potentiels pour cette boutique
      const lockPath = path.join(__dirname, `../.wwebjs_auth/session-${boutiqueId}/SingletonLock`);
      if (fs.existsSync(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
          console.log(`Cleaned up lingering WhatsApp Puppeteer SingletonLock for boutique ${boutiqueId}`);
        } catch (err) {
          console.error(`Could not clean up SingletonLock for ${boutiqueId}:`, err.message);
        }
      }

      const isMac = process.platform === 'darwin';
      const puppeteerArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-component-update',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding'
      ];

      if (!isMac) {
        puppeteerArgs.push('--no-zygote');
      }

      let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      
      // 1. Check standard Linux system Chrome / Chromium binaries first
      if (!executablePath && !isMac) {
        const possibleLinuxPaths = [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/opt/google/chrome/chrome'
        ];
        for (const p of possibleLinuxPaths) {
          if (fs.existsSync(p)) {
            executablePath = p;
            console.log(`Detected Linux system Chrome at: ${p}`);
            break;
          }
        }
      }

      // 2. Try Puppeteer's resolved executablePath
      if (!executablePath) {
        try {
          const pPath = puppeteer.executablePath();
          if (pPath && fs.existsSync(pPath)) {
            executablePath = pPath;
          }
        } catch (e) {
          console.warn('Puppeteer default executablePath not available:', e.message);
        }
      }

      // 3. Strictly verify executablePath exists at RUNTIME before passing to Puppeteer
      if (executablePath && !fs.existsSync(executablePath)) {
        console.warn(`Executable path "${executablePath}" not found at runtime. Falling back to default launcher.`);
        executablePath = undefined;
      }

      if (executablePath) {
        console.log(`Using validated Chrome binary for WhatsApp Puppeteer: ${executablePath}`);
      } else {
        console.log('No explicit executablePath verified. Using Puppeteer default browser launcher.');
      }

      const client = new Client({
        authStrategy: new LocalAuth({ clientId: boutiqueId, dataPath: path.join(__dirname, '../.wwebjs_auth') }),
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
          executablePath: executablePath || undefined,
          headless: true,
          args: puppeteerArgs
        }
      });

      clientData = {
        client,
        status: 'INITIALIZING',
        qrCodeUrl: null,
        phoneConnected: null
      };

      this.clients.set(boutiqueId, clientData);

      client.on('qr', async (qr) => {
        console.log(`WhatsApp QR Code generated for boutique ${boutiqueId}`);
        clientData.status = 'QR_READY';
        try {
          clientData.qrCodeUrl = await qrcode.toDataURL(qr);
        } catch (err) {
          console.error('Error generating QR code data URL', err);
        }
      });

      client.on('ready', () => {
        console.log(`WhatsApp Client is ready for boutique ${boutiqueId}`);
        clientData.status = 'CONNECTED';
        clientData.qrCodeUrl = null;
        if (client.info && client.info.wid) {
          clientData.phoneConnected = client.info.wid.user;
        }
      });

      client.on('authenticated', () => {
        console.log(`WhatsApp Authenticated for boutique ${boutiqueId}`);
      });

      client.on('auth_failure', msg => {
        console.error(`WhatsApp Authentication failure for boutique ${boutiqueId}`, msg);
        clientData.status = 'AUTH_FAILURE';
      });

      client.on('disconnected', (reason) => {
        console.log(`WhatsApp Client was disconnected for boutique ${boutiqueId}`, reason);
        clientData.status = 'DISCONNECTED';
        clientData.phoneConnected = null;
      });

      console.log(`Starting WhatsApp client initialization for boutique ${boutiqueId}...`);
      client.initialize().catch(err => {
        console.error(`Failed to initialize WhatsApp client for ${boutiqueId}:`, err);
        clientData.status = 'ERROR';
        clientData.qrCodeUrl = null;
      });
    }

    return clientData;
  }

  getStatus(boutiqueId) {
    if (!boutiqueId) return { status: 'ERROR', message: "boutiqueId requis" };
    let clientData = this.clients.get(boutiqueId);
    if (!clientData) {
      try {
        clientData = this.getClientData(boutiqueId);
      } catch (e) {
        return { status: 'ERROR', message: e.message };
      }
    }
    return {
      status: clientData.status,
      qr: clientData.qrCodeUrl,
      phone: clientData.phoneConnected
    };
  }

  async logout(boutiqueId) {
    if (!boutiqueId) return;
    const clientData = this.clients.get(boutiqueId);
    if (clientData) {
      try {
        await clientData.client.destroy();
      } catch (e) {
        console.error('Error destroying client:', e);
      }
      this.clients.delete(boutiqueId);
      
      const authPath = path.join(__dirname, `../.wwebjs_auth/session-${boutiqueId}`);
      if (fs.existsSync(authPath)) {
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
        } catch (e) {
          console.error('Error removing auth folder:', e);
        }
      }
    }
  }

  async reconnect(boutiqueId) {
    await this.logout(boutiqueId);
    return this.getClientData(boutiqueId);
  }

  async sendText(boutiqueId, phone, message) {
    const clientData = this.getClientData(boutiqueId);
    if (clientData.status !== 'CONNECTED') {
      throw new Error("Le client WhatsApp n'est pas connecté pour votre boutique.");
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;
    await clientData.client.sendMessage(chatId, message);
  }

  async sendPdf(boutiqueId, phone, pdfBuffer, filename, caption = '') {
    const clientData = this.getClientData(boutiqueId);
    if (clientData.status !== 'CONNECTED') {
      throw new Error("Le client WhatsApp n'est pas connecté pour votre boutique.");
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;
    
    const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), filename);
    await clientData.client.sendMessage(chatId, media, { caption });
  }
}

const whatsappManager = new WhatsAppManager();
module.exports = whatsappManager;
