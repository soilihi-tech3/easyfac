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

        const baseSessionPath = process.env.SESSION_PATH || path.join(__dirname, '../.wwebjs_auth');
        
        // Ensure the directory exists
        if (!fs.existsSync(baseSessionPath)) {
          try { fs.mkdirSync(baseSessionPath, { recursive: true }); } catch (e) {}
        }

        // 🧹 [Session Cleaner] Delete bloated cache folders before launching to save storage
        const sessionPath = path.join(baseSessionPath, `session-${boutiqueId}`);
        if (fs.existsSync(sessionPath)) {
          const pathsToClean = [
            path.join(sessionPath, 'Default/Cache'),
            path.join(sessionPath, 'Default/Code Cache'),
            path.join(sessionPath, 'Default/CacheStorage'),
            path.join(sessionPath, 'Default/Service Worker/CacheStorage')
          ];
          for (const cleanPath of pathsToClean) {
            if (fs.existsSync(cleanPath)) {
              try {
                fs.rmSync(cleanPath, { recursive: true, force: true });
                console.log(`🧹 [Session Cleaner] Cleared bloated folder: ${cleanPath}`);
              } catch (e) {
                console.warn(`[Session Cleaner] Failed to delete cache folder ${cleanPath}:`, e.message);
              }
            }
          }
        }

        const baseArgs = [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--disable-extensions',
          '--mute-audio',
          '--disable-remote-fonts',
          '--disable-cache',
          '--disk-cache-size=0',
          '--media-cache-size=0',
          '--disk-cache-dir=/tmp/chrome-cache-' + boutiqueId,
          '--js-flags=--no-compilation-cache',
          '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ];
        if (!isMac) {
          baseArgs.push('--no-zygote');
          baseArgs.push('--single-process'); // Crucial to prevent RAM crashes in free tiers
        }

        const puppeteerArgs = Array.from(new Set([...baseArgs, ...sparticuzArgs]));

        const client = new Client({
          authStrategy: new LocalAuth({ 
            clientId: boutiqueId, 
            dataPath: baseSessionPath 
          }),
          takeoverOnConflict: true,
          takeoverTimeoutMs: 0,
          qrMaxRetries: 10,
          webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1018949826-alpha.html',
          },
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          puppeteer: {
            executablePath: executablePath || undefined,
            headless: true,
            timeout: 90000,
            protocolTimeout: 120000,
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

        const setupRequestInterception = async () => {
          if (client.pupPage && !client.pupPage._hasInterception) {
            try {
              client.pupPage._hasInterception = true;
              await client.pupPage.setRequestInterception(true);
              client.pupPage.on('request', (req) => {
                const url = req.url();
                const type = req.resourceType();
                if (
                  (['media', 'font'].includes(type) && !url.includes('static.whatsapp.net')) ||
                  url.includes('sticker') || 
                  url.includes('/dyn/media') || 
                  url.includes('telemetry') || 
                  url.includes('logging')
                ) {
                  req.abort();
                } else {
                  req.continue();
                }
              });
              console.log(`🛡️ [RAM Saver] Activated Request Interception for boutique ${boutiqueId}`);
            } catch (err) {
              console.warn(`[RAM Saver] Failed to set request interception:`, err.message);
            }
          }
        };

        client.on('loading_screen', async (percent, message) => {
          console.log(`WhatsApp Loading for boutique ${boutiqueId}: ${percent}% - ${message}`);
          await setupRequestInterception();
        });

        client.on('qr', async (qr) => {
          console.log(`WhatsApp QR Code generated for boutique ${boutiqueId}`);
          clientData.status = 'QR_READY';
          try {
            clientData.qrCodeUrl = await qrcode.toDataURL(qr);
          } catch (err) {
            console.error('Error generating QR code data URL', err);
          }
          await setupRequestInterception();
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
          clientData.status = 'CONNECTED';
          clientData.qrCodeUrl = null;
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
      const sessionPath = path.join(__dirname, `../.wwebjs_auth/session-${boutiqueId}`);
      const hasSavedSession = fs.existsSync(sessionPath);
      return {
        status: hasSavedSession ? 'SAVED_SESSION' : 'DISCONNECTED',
        qr: null,
        phone: null
      };
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

  async requestPairingCode(boutiqueId, phoneNumber) {
    if (!boutiqueId) throw new Error("boutiqueId requis");
    const cleanPhone = String(phoneNumber).replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      throw new Error("Numéro de téléphone invalide (veuillez inclure l'indicatif du pays sans le +, ex: 221711692537)");
    }

    let clientData = this.clients.get(boutiqueId);
    if (!clientData || !clientData.client) {
      clientData = await this.getClientData(boutiqueId);
    }

    if (!clientData || !clientData.client) {
      throw new Error("Impossible d'initialiser le client WhatsApp.");
    }

    // Wait up to 20 seconds for Puppeteer page to be attached and ready for QR / Pairing
    let attempts = 0;
    while ((!clientData.client.pupPage || clientData.status === 'INITIALIZING') && attempts < 40) {
      await new Promise(r => setTimeout(r, 500));
      attempts++;
      clientData = this.clients.get(boutiqueId) || clientData;
    }

    if (!clientData.client.pupPage) {
      throw new Error("Le navigateur WhatsApp est en cours de démarrage. Veuillez ré-essayer dans 5 secondes.");
    }

    try {
      const code = await clientData.client.requestPairingCode(cleanPhone);
      clientData.pairingCode = code;
      return code;
    } catch (err) {
      console.error(`Error requesting pairing code for ${boutiqueId}:`, err);
      throw new Error("Impossible de générer le code d'association. Assurez-vous que le numéro est correct et réessayez.");
    }
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

  async destroyAll() {
    for (const [id, data] of this.clients.entries()) {
      try {
        if (data.client) await data.client.destroy();
      } catch (e) {}
    }
    this.clients.clear();
  }
}

const whatsappManager = new WhatsAppManager();

const gracefulShutdown = async () => {
  try {
    await whatsappManager.destroyAll();
  } catch (e) {}
};

process.once('SIGINT', gracefulShutdown);
process.once('SIGTERM', gracefulShutdown);
process.once('SIGUSR2', gracefulShutdown);

module.exports = whatsappManager;
