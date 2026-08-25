const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const puppeteer = require('puppeteer');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Ensure Puppeteer uses local backend/.cache/puppeteer folder
const projectCacheDir = path.join(__dirname, '../.cache/puppeteer');
if (fs.existsSync(projectCacheDir)) {
  process.env.PUPPETEER_CACHE_DIR = projectCacheDir;
}

class WhatsAppManager {
  constructor() {
    this.clients = new Map(); // boutiqueId => ClientData
    this.initPromises = new Map(); // boutiqueId => Promise<ClientData> (Concurrency Lock)
  }

  // Obtenir ou initialiser un client pour une boutique
  async getClientData(boutiqueId) {
    if (!boutiqueId) throw new Error("boutiqueId est requis");
    
    // 1. Si le client existe déjà, le retourner immédiatement
    if (this.clients.has(boutiqueId)) {
      return this.clients.get(boutiqueId);
    }

    // 2. Si une initialisation est déjà en cours pour cette boutique, attendre qu'elle termine
    if (this.initPromises.has(boutiqueId)) {
      return await this.initPromises.get(boutiqueId);
    }

    // 3. Verrou d'initialisation unique
    const initPromise = (async () => {
      try {
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
        let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        let sparticuzArgs = [];

        // 1. Try @sparticuz/chromium on Linux (Render / Docker / Vercel)
        if (!executablePath && !isMac) {
          try {
            const chromium = require('@sparticuz/chromium');
            executablePath = await chromium.executablePath();
            sparticuzArgs = chromium.args || [];
            console.log(`@sparticuz/chromium extracted runtime binary to: ${executablePath}`);
          } catch (err) {
            console.warn('@sparticuz/chromium resolution notice:', err.message);
          }
        }

        // 2. Check standard Linux system Chrome / Chromium binaries
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

        // 3. Try Puppeteer's resolved executablePath
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

        // 4. Verify executablePath exists at RUNTIME before passing to Puppeteer
        if (executablePath && !fs.existsSync(executablePath)) {
          console.warn(`Executable path "${executablePath}" not found at runtime. Falling back to default launcher.`);
          executablePath = undefined;
        }

        if (executablePath) {
          console.log(`Using validated Chrome binary for WhatsApp Puppeteer: ${executablePath}`);
        } else {
          console.log('No explicit executablePath verified. Using Puppeteer default browser launcher.');
        }

        const baseArgs = [
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
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--renderer-process-limit=1',
          '--js-flags=--max-old-space-size=128',
          '--disable-software-rasterizer',
          '--memory-pressure-off',
          '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ];
        if (!isMac) baseArgs.push('--no-zygote');

        const puppeteerArgs = Array.from(new Set([...baseArgs, ...sparticuzArgs]));

        const client = new Client({
          authStrategy: new LocalAuth({ clientId: boutiqueId, dataPath: path.join(__dirname, '../.wwebjs_auth') }),
          takeoverOnConflict: true,
          takeoverTimeoutMs: 0,
          qrMaxRetries: 10,
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          webVersionCache: {
            type: 'local'
          },
          puppeteer: {
            executablePath: executablePath || undefined,
            headless: true,
            bypassCSP: true,
            timeout: 90000,
            args: puppeteerArgs
          }
        });

        const clientData = {
          client,
          status: 'INITIALIZING',
          qrCodeUrl: null,
          phoneConnected: null
        };

        this.clients.set(boutiqueId, clientData);

        client.on('loading_screen', (percent, message) => {
          console.log(`WhatsApp Loading for boutique ${boutiqueId}: ${percent}% - ${message}`);
        });

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

        client.on('auth_failure', async msg => {
          console.error(`WhatsApp Authentication failure for boutique ${boutiqueId}`, msg);
          clientData.status = 'AUTH_FAILURE';
          clientData.qrCodeUrl = null;
          this.clients.delete(boutiqueId);
          try { await client.destroy(); } catch (e) {}
          const authPath = path.join(__dirname, `../.wwebjs_auth/session-${boutiqueId}`);
          if (fs.existsSync(authPath)) {
            try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
          }
        });

        client.on('disconnected', async (reason) => {
          console.log(`WhatsApp Client was disconnected for boutique ${boutiqueId}:`, reason);
          clientData.status = 'DISCONNECTED';
          clientData.phoneConnected = null;
          clientData.qrCodeUrl = null;
          this.clients.delete(boutiqueId);
          try { await client.destroy(); } catch (e) {}
          const authPath = path.join(__dirname, `../.wwebjs_auth/session-${boutiqueId}`);
          if (fs.existsSync(authPath)) {
            try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (e) {}
          }
        });

        console.log(`Starting WhatsApp client initialization for boutique ${boutiqueId}...`);
        client.initialize().catch(err => {
          const msg = err ? String(err.message || err) : '';
          if (
            msg.includes('Execution context was destroyed') ||
            msg.includes('Navigating frame was detached') ||
            msg.includes('LifecycleWatcher disposed') ||
            msg.includes('Target closed') ||
            msg.includes('Protocol error')
          ) {
            console.warn(`WhatsApp client background navigation/protocol reset for boutique ${boutiqueId}, continuing...`);
            return;
          }
          console.error(`Failed to initialize WhatsApp client for ${boutiqueId}:`, err);
          clientData.status = 'ERROR';
          clientData.qrCodeUrl = null;
        });

        return clientData;
      } finally {
        this.initPromises.delete(boutiqueId);
      }
    })();

    this.initPromises.set(boutiqueId, initPromise);
    return await initPromise;
  }

  async getStatus(boutiqueId) {
    if (!boutiqueId) return { status: 'ERROR', message: "boutiqueId requis" };
    let clientData = this.clients.get(boutiqueId);
    if (!clientData) {
      try {
        clientData = await this.getClientData(boutiqueId);
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
    return await this.getClientData(boutiqueId);
  }

  async sendText(boutiqueId, phone, message) {
    const clientData = await this.getClientData(boutiqueId);
    if (clientData.status !== 'CONNECTED') {
      throw new Error("Le client WhatsApp n'est pas connecté pour votre boutique.");
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;
    await clientData.client.sendMessage(chatId, message);
  }

  async sendPdf(boutiqueId, phone, pdfBuffer, filename, caption = '') {
    const clientData = await this.getClientData(boutiqueId);
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
