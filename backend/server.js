require('dotenv').config();

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection caught (prevented server crash):', reason ? (reason.message || reason) : reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught (prevented server crash):', err ? (err.message || err) : err);
});

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const exchangeRatesService = require('./services/exchangeRates');

const JWT_SECRET = process.env.JWT_SECRET || 'easyfac-super-secret-key-2026';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Create DB connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'easyfac_db',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper for generating UUIDs manually since some old MySQL versions don't have UUID()
const { v4: uuidv4 } = require('uuid');

// Check DB Connection & Init Admin
app.get('/api/status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS solution');
    // Safely add new columns if they do not exist
    try {
      await pool.query('ALTER TABLE users ADD COLUMN telephone VARCHAR(100) DEFAULT NULL');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE users ADD COLUMN active TINYINT DEFAULT 1');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE factures ADD COLUMN rappelAutomatiqueSent TINYINT DEFAULT 0');
    } catch (e) {}
    // Ensure default users exist
    const seedUser = async (nom, prenom, email, password, role, permissions = null) => {
      const [existing] = await pool.query('SELECT COUNT(*) as count FROM users WHERE email = ?', [email]);
      if (existing[0].count === 0) {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
          'INSERT INTO users (id, nom, prenom, email, password, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), nom, prenom, email, hash, role, permissions ? JSON.stringify(permissions) : null]
        );
        console.log(`Default user created: ${email} / ${password}`);
      }
    };

    await seedUser('Admin', 'Super', 'admin@easyfac.com', 'Passer123', 'admin');
    await seedUser('Faruck', 'Admin', 'faruck@gmail.com', 'Passer123', 'admin');
    await seedUser('Faruck', 'Admin', 'faruck@gmil.com', 'Passer123', 'admin');

    const empPermissions = {
      voirFactures: true, creerFacture: true, modifierFacture: true, supprimerFacture: true,
      voirVoyages: true, creerVoyage: true, modifierVoyage: true, supprimerVoyage: true,
      voirDepenses: true, creerDepense: true, modifierDepense: true, supprimerDepense: true,
      voirClients: true, creerClient: true, modifierClient: true, supprimerClient: true
    };
    await seedUser('Faruck', 'Employé', 'faruck-employe@gmail.com', 'Passer123', 'employee', empPermissions);
    res.json({ status: 'ok', db: 'connected', time: new Date() });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: error.message });
  }
});

// --- AUTH & USERS ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Login attempt for email: "${email}" with password length: ${password?.length}`);
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      console.log('User not found in DB.');
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    
    const user = users[0];
    if (user.active === 0 || user.active === false) {
      return res.status(401).json({ error: "Votre compte a été désactivé par l'administrateur." });
    }

    // SAAS Check: if user belongs to a boutique, ensure boutique is active
    if (user.boutique_id) {
      const [boutique] = await pool.query('SELECT * FROM boutiques WHERE id = ?', [user.boutique_id]);
      if (boutique.length > 0 && boutique[0].statut === 'inactif') {
        return res.status(403).json({ error: "Votre boutique a été désactivée par le Super Admin." });
      }
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Password mismatch.');
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    
    const token = jwt.sign({ 
      id: user.id, 
      role: user.role, 
      voyageId: user.voyageId, 
      boutique_id: user.boutique_id 
    }, JWT_SECRET, { expiresIn: '7d' });
    
    const { password: _, ...userWithoutPass } = user;
    res.json({ token, user: userWithoutPass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JWT Middleware
const authMiddleware = async (req, res, next) => {
  // Allow status, cron/reminders, and exchange-rates endpoints without JWT
  if (req.path === '/status' || req.path === '/cron/reminders' || req.path === '/exchange-rates') return next();
  
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // SaaS check: instantly block deactivated merchants
    if (decoded.boutique_id) {
      const [boutiques] = await pool.query('SELECT statut FROM boutiques WHERE id = ?', [decoded.boutique_id]);
      if (boutiques.length > 0 && boutiques[0].statut === 'inactif') {
        return res.status(403).json({ error: "Votre boutique a été désactivée par le Super Admin." });
      }
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

app.use('/api', authMiddleware);

const whatsappRoutes = require('./routes/whatsapp');
app.use('/api/whatsapp', whatsappRoutes);

app.get('/api/auth/me', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userWithoutPass } = users[0];
    res.json({ user: userWithoutPass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    const [rows] = await pool.query(
      'SELECT id, nom, prenom, email, role, voyageId, permissions, telephone, active, createdAt FROM users WHERE boutique_id = ? ORDER BY createdAt DESC',
      [req.user.boutique_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    const id = uuidv4();
    const { nom, prenom, email, password, role, voyageId, permissions, telephone, active } = req.body;
    const cleanVoyageId = (voyageId === '' || voyageId === undefined || voyageId === 'null') ? null : voyageId;
    const hash = await bcrypt.hash(password, 10);
    const permString = permissions ? JSON.stringify(permissions) : null;
    const activeVal = active === undefined ? 1 : (active ? 1 : 0);
    await pool.query(
      'INSERT INTO users (id, nom, prenom, email, password, role, voyageId, permissions, telephone, active, boutique_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, nom, prenom, email, hash, role || 'employee', cleanVoyageId, permString, telephone || null, activeVal, req.user.boutique_id]
    );
    res.json({ id, nom, prenom, email, role, voyageId: cleanVoyageId, permissions, telephone, active: activeVal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    const { nom, prenom, email, password, role, voyageId, permissions, telephone, active } = req.body;
    const cleanVoyageId = (voyageId === '' || voyageId === undefined || voyageId === 'null') ? null : voyageId;
    const permString = permissions ? JSON.stringify(permissions) : null;
    const activeVal = active === undefined ? 1 : (active ? 1 : 0);
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET nom=?, prenom=?, email=?, password=?, role=?, voyageId=?, permissions=?, telephone=?, active=? WHERE id=? AND boutique_id=?',
        [nom, prenom, email, hash, role, cleanVoyageId, permString, telephone || null, activeVal, req.params.id, req.user.boutique_id]
      );
    } else {
      await pool.query(
        'UPDATE users SET nom=?, prenom=?, email=?, role=?, voyageId=?, permissions=?, telephone=?, active=? WHERE id=? AND boutique_id=?',
        [nom, prenom, email, role, cleanVoyageId, permString, telephone || null, activeVal, req.params.id, req.user.boutique_id]
      );
    }
    res.json({ id: req.params.id, nom, prenom, email, role, voyageId: cleanVoyageId, permissions, telephone, active: activeVal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    await pool.query('DELETE FROM users WHERE id = ? AND boutique_id = ?', [req.params.id, req.user.boutique_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CLIENTS ---
app.get('/api/clients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients WHERE boutique_id = ? ORDER BY createdAt DESC', [req.user.boutique_id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const id = uuidv4();
    const { nom, prenom, telephone, email } = req.body;
    await pool.query(
      'INSERT INTO clients (id, nom, prenom, telephone, email, boutique_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, nom, prenom, telephone, email, req.user.boutique_id]
    );
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { nom, prenom, telephone, email } = req.body;
    await pool.query(
      'UPDATE clients SET nom = ?, prenom = ?, telephone = ?, email = ? WHERE id = ? AND boutique_id = ?',
      [nom, prenom, telephone, email, req.params.id, req.user.boutique_id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Unlink client from any existing invoices as sender or recipient
    await connection.query('UPDATE factures SET expediteurId = NULL WHERE expediteurId = ?', [req.params.id]);
    await connection.query('UPDATE factures SET destinataireId = NULL WHERE destinataireId = ?', [req.params.id]);

    // 2. Delete the client (supporting multi-tenant boutique_id and null boutique_id)
    if (req.user.boutique_id) {
      await connection.query('DELETE FROM clients WHERE id = ? AND (boutique_id = ? OR boutique_id IS NULL)', [req.params.id, req.user.boutique_id]);
    } else {
      await connection.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting client:", error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// --- VOYAGES ---
app.get('/api/voyages', async (req, res) => {
  try {
    let query = 'SELECT * FROM voyages WHERE boutique_id = ? ORDER BY dateDepart DESC';
    let params = [req.user.boutique_id];
    if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM voyages WHERE boutique_id = ? AND id = ? ORDER BY dateDepart DESC';
      params = [req.user.boutique_id, req.user.voyageId];
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/voyages', async (req, res) => {
  try {
    const id = uuidv4();
    const { nom, dateDepart, statut } = req.body;
    await pool.query(
      'INSERT INTO voyages (id, nom, dateDepart, statut, boutique_id) VALUES (?, ?, ?, ?, ?)',
      [id, nom, dateDepart, statut || 'en_cours', req.user.boutique_id]
    );
    const [rows] = await pool.query('SELECT * FROM voyages WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/voyages/:id', async (req, res) => {
  try {
    const { nom, dateDepart, statut } = req.body;
    await pool.query(
      'UPDATE voyages SET nom = ?, dateDepart = ?, statut = ? WHERE id = ? AND boutique_id = ?',
      [nom, dateDepart, statut, req.params.id, req.user.boutique_id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/voyages/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query('UPDATE factures SET voyageId = NULL WHERE voyageId = ?', [req.params.id]);
    await connection.query('UPDATE depenses SET voyageId = NULL WHERE voyageId = ?', [req.params.id]);
    await connection.query('UPDATE epargnes SET voyageId = NULL WHERE voyageId = ?', [req.params.id]);

    if (req.user.boutique_id) {
      await connection.query('DELETE FROM voyages WHERE id = ? AND (boutique_id = ? OR boutique_id IS NULL)', [req.params.id, req.user.boutique_id]);
    } else {
      await connection.query('DELETE FROM voyages WHERE id = ?', [req.params.id]);
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting voyage:", error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// --- DEPENSES ---
app.get('/api/depenses', async (req, res) => {
  try {
    let query = 'SELECT * FROM depenses WHERE boutique_id = ? ORDER BY createdAt DESC';
    let params = [req.user.boutique_id];
    let usersQuery = 'SELECT id, nom, prenom FROM users WHERE boutique_id = ?';
    let usersParams = [req.user.boutique_id];

    if (req.user.role === 'super_admin') {
      query = "SELECT * FROM depenses WHERE boutique_id = 'super_admin' OR boutique_id IS NULL ORDER BY createdAt DESC";
      params = [];
      usersQuery = "SELECT id, nom, prenom FROM users WHERE role = 'super_admin'";
      usersParams = [];
    } else if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM depenses WHERE boutique_id = ? AND voyageId = ? ORDER BY createdAt DESC';
      params = [req.user.boutique_id, req.user.voyageId];
    }

    const [rows] = await pool.query(query, params);
    const [users] = await pool.query(usersQuery, usersParams);
    const userMap = {};
    users.forEach(u => userMap[u.id] = u);

    const result = rows.map(d => ({
      ...d,
      creePar: userMap[d.userId] || null
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/depenses', async (req, res) => {
  try {
    const id = uuidv4();
    let { nom, montant, quantite, voyageId } = req.body;
    const boutique_id = req.user.role === 'super_admin' ? 'super_admin' : req.user.boutique_id;
    if (req.user.role === 'employee' && req.user.voyageId) voyageId = req.user.voyageId;
    await pool.query(
      'INSERT INTO depenses (id, nom, montant, quantite, voyageId, userId, boutique_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, nom, montant, quantite || 1, voyageId || null, req.user.id, boutique_id]
    );
    const [rows] = await pool.query('SELECT * FROM depenses WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/depenses/:id', async (req, res) => {
  try {
    let { nom, montant, quantite, voyageId } = req.body;
    const boutique_id = req.user.role === 'super_admin' ? 'super_admin' : req.user.boutique_id;
    if (req.user.role === 'employee' && req.user.voyageId) voyageId = req.user.voyageId;
    
    let query = 'UPDATE depenses SET nom = ?, montant = ?, quantite = ?, voyageId = ? WHERE id = ? AND boutique_id = ?';
    let params = [nom, montant, quantite || 1, voyageId || null, req.params.id, boutique_id];
    if (req.user.role === 'super_admin') {
      query = 'UPDATE depenses SET nom = ?, montant = ?, quantite = ?, voyageId = ? WHERE id = ? AND (boutique_id = ? OR boutique_id IS NULL)';
      params = [nom, montant, quantite || 1, voyageId || null, req.params.id, 'super_admin'];
    }
    await pool.query(query, params);
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/depenses/:id', async (req, res) => {
  try {
    let query = 'DELETE FROM depenses WHERE id = ? AND boutique_id = ?';
    let params = [req.params.id, req.user.boutique_id];
    if (req.user.role === 'super_admin') {
      query = 'DELETE FROM depenses WHERE id = ? AND (boutique_id = ? OR boutique_id IS NULL)';
      params = [req.params.id, 'super_admin'];
    }
    await pool.query(query, params);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- EXCHANGE RATES ---
app.get('/api/exchange-rates', async (req, res) => {
  try {
    const data = await exchangeRatesService.getRates();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PARAMETRES ---
app.get('/api/parametres', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings WHERE boutique_id = ?', [req.user.boutique_id]);
    if (rows.length > 0) {
      res.json({
        entreprise: typeof rows[0].entreprise === 'string' ? JSON.parse(rows[0].entreprise) : rows[0].entreprise,
        config: typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config
      });
    } else {
      res.json({
        entreprise: { nom: 'Ma Boutique', telephone1: '', email: '', adresse: '' },
        config: { prixKg: 6000, devise: 'FCFA', couleurPrimaire: '#6366f1', modeSombre: true, formatNumero: 'Fac-{YEAR2}-{NUM2}', modeleFacture: 'moderne', compteur: 0 }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/parametres', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    const { entreprise, config } = req.body;
    const [existing] = await pool.query('SELECT 1 FROM settings WHERE boutique_id = ?', [req.user.boutique_id]);
    if (existing.length > 0) {
      await pool.query(
        'UPDATE settings SET entreprise = ?, config = ? WHERE boutique_id = ?',
        [JSON.stringify(entreprise), JSON.stringify(config), req.user.boutique_id]
      );
    } else {
      const [maxIdRow] = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM settings');
      const nextId = maxIdRow[0].nextId;
      await pool.query(
        'INSERT INTO settings (id, boutique_id, entreprise, config) VALUES (?, ?, ?, ?)',
        [nextId, req.user.boutique_id, JSON.stringify(entreprise), JSON.stringify(config)]
      );
    }
    
    // Re-initialize dynamic cron with new settings immediately!
    await initReminderCron();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- MODULES FEATURE FLAGS ---
const DEFAULT_GLOBAL_MODULES = {
  factures: true,
  clients: true,
  voyages: true,
  depenses: true,
  remboursements: true,
  communiques: true,
  flyer: true,
  epargne: true,
  statistiques: true,
  parametres: true,
  employes: true,
  devise: true
};

app.get('/api/modules', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT config FROM settings WHERE boutique_id = 'super_admin'");
    if (rows.length > 0 && rows[0].config) {
      const cfg = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
      if (cfg.modules) {
        let globalModules = DEFAULT_GLOBAL_MODULES;
        let boutiqueModules = {};

        if (cfg.modules.global) {
          globalModules = { ...DEFAULT_GLOBAL_MODULES, ...cfg.modules.global };
          boutiqueModules = cfg.modules.boutiques || {};
        } else {
          // Legacy flat format migration
          globalModules = { ...DEFAULT_GLOBAL_MODULES, ...cfg.modules };
        }

        return res.json({
          modules: {
            global: globalModules,
            boutiques: boutiqueModules
          }
        });
      }
    }
    res.json({
      modules: {
        global: DEFAULT_GLOBAL_MODULES,
        boutiques: {}
      }
    });
  } catch (error) {
    res.json({
      modules: {
        global: DEFAULT_GLOBAL_MODULES,
        boutiques: {}
      }
    });
  }
});

app.put('/api/modules', async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Seul le Super Admin peut modifier les modules' });
  }
  try {
    const { modules } = req.body;
    const [existing] = await pool.query("SELECT id, config FROM settings WHERE boutique_id = 'super_admin'");
    
    let currentConfig = {};
    if (existing.length > 0 && existing[0].config) {
      currentConfig = typeof existing[0].config === 'string' ? JSON.parse(existing[0].config) : existing[0].config;
    }
    
    const updatedConfig = { ...currentConfig, modules };
    
    if (existing.length > 0) {
      await pool.query(
        "UPDATE settings SET config = ? WHERE boutique_id = 'super_admin'",
        [JSON.stringify(updatedConfig)]
      );
    } else {
      const [maxIdRow] = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM settings');
      const nextId = maxIdRow[0].nextId;
      await pool.query(
        "INSERT INTO settings (id, boutique_id, entreprise, config) VALUES (?, 'super_admin', ?, ?)",
        [nextId, JSON.stringify({ nom: 'Super Admin System' }), JSON.stringify(updatedConfig)]
      );
    }
    
    res.json({ success: true, modules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- FACTURES (Complex: nested articles) ---
// --- CRON JOBS ---
const cron = require('node-cron');
let globalReminderCron = null;

async function runRemindersForBoutique(boutiqueId) {
  console.log(`Running daily WhatsApp reminders for boutique ${boutiqueId}...`);
  const whatsappManager = require('./services/whatsappClient');

  // Load custom configuration from settings
  let cordialText = "Merci de bien vouloir régulariser ce solde restant au plus tard à cette date.\nNous restons à votre entière disposition.\n\nCordialement,";
  let isEnabled = false;
  let devise = "FCFA";
  let entrepriseName = "EASYFAC";
  let hasCustomCordial = false;
  try {
    const [settingsRows] = await pool.query('SELECT * FROM settings WHERE boutique_id = ?', [boutiqueId]);
    if (settingsRows.length > 0) {
      const settings = settingsRows[0];
      const config = typeof settings.config === 'string' ? JSON.parse(settings.config) : settings.config;
      const entreprise = typeof settings.entreprise === 'string' ? JSON.parse(settings.entreprise) : settings.entreprise;
      if (config) {
        isEnabled = !!config.rappelAutomatique;
        if (config.rappelCordial && config.rappelCordial !== '') {
          cordialText = config.rappelCordial;
          hasCustomCordial = true;
        }
        if (config.devise) {
          devise = config.devise;
        }
      }
      if (entreprise && entreprise.nom) {
        entrepriseName = entreprise.nom;
      }
    }
  } catch (err) {
    console.error(`Error fetching settings for reminders of boutique ${boutiqueId}:`, err.message);
  }

  if (!isEnabled) {
    console.log(`Automatic reminders are disabled for boutique ${boutiqueId}. Skipping.`);
    return { processed: 0, sent: 0, message: "Automatic reminders are disabled." };
  }

  const [factures] = await pool.query(`
    SELECT * FROM factures 
    WHERE boutique_id = ?
    AND montantPaye < montantTotal 
    AND dateLimite IS NOT NULL 
    AND dateLimite < CURRENT_DATE() 
    AND rappelAutomatiqueSent = 0
  `, [boutiqueId]);

  if (factures.length === 0) return { processed: 0, sent: 0, message: "No reminders to send" };

  const [clients] = await pool.query('SELECT * FROM clients WHERE boutique_id = ?', [boutiqueId]);
  const clientMap = {};
  clients.forEach(c => clientMap[c.id] = c);

  let sentCount = 0;

  for (const facture of factures) {
    const expediteur = clientMap[facture.expediteurId];
    const destinataire = clientMap[facture.destinataireId];
    const phone = expediteur?.telephone || destinataire?.telephone;
    const nomClient = expediteur?.nom || destinataire?.nom || '';
    const prenomClient = expediteur?.prenom || destinataire?.prenom || '';
    
    if (!phone) continue;
    
    const reste = facture.montantTotal - facture.montantPaye;
    
    let dateStr = "immédiatement";
    if (facture.dateLimite) {
      const d = new Date(facture.dateLimite);
      const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
      dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    const totalFormatted = `${Number(facture.montantTotal).toLocaleString('fr-FR')} ${devise}`;
    const payeFormatted = `${Number(facture.montantPaye).toLocaleString('fr-FR')} ${devise}`;
    const resteFormatted = `${Number(reste).toLocaleString('fr-FR')} ${devise}`;

    const messageLines = [
      `*Rappel de paiement — Facture ${facture.numero}*`,
      `Bonjour ${prenomClient} ${nomClient},`,
      ``,
      `Nous vous contactons pour le suivi de règlement de votre facture *${facture.numero}* :`,
      `*Montant Total :* ${totalFormatted}`,
      `*Déjà Payé :* ${payeFormatted}`,
      `*Reste à Payer :* *${resteFormatted}*`,
      `*Date d'échéance :* *${dateStr}*`,
      ``,
      cordialText
    ];

    if (!hasCustomCordial) {
      messageLines.push(``, `*${entrepriseName}*`);
    }

    const messageText = messageLines.join('\n');

    try {
      // Check connection status using manager
      const waStatus = whatsappManager.getStatus(boutiqueId);
      if (waStatus.status === 'CONNECTED') {
        await whatsappManager.sendText(boutiqueId, phone, messageText);
        await pool.query('UPDATE factures SET rappelAutomatiqueSent = 1 WHERE id = ?', [facture.id]);
        sentCount++;
      }
    } catch (err) {
      console.error(`Erreur d'envoi cron pour la facture ${facture.id}:`, err.message);
    }
  }
  console.log(`Daily WhatsApp reminders finished for boutique ${boutiqueId}. Processed: ${factures.length}, Sent: ${sentCount}`);
  return { processed: factures.length, sent: sentCount };
}

async function runReminders() {
  console.log('Running daily WhatsApp reminders globally for all active boutiques...');
  try {
    const [boutiques] = await pool.query("SELECT * FROM boutiques WHERE statut = 'actif'");
    let totalProcessed = 0;
    let totalSent = 0;
    for (const b of boutiques) {
      const res = await runRemindersForBoutique(b.id);
      totalProcessed += res.processed || 0;
      totalSent += res.sent || 0;
    }
    return { processed: totalProcessed, sent: totalSent };
  } catch (err) {
    console.error("Global reminders execution error:", err.message);
    return { processed: 0, sent: 0, error: err.message };
  }
}

async function initReminderCron() {
  console.log('Initializing global multi-tenant WhatsApp reminder cron job (every 5 minutes)...');
  if (globalReminderCron) {
    globalReminderCron.stop();
  }

  globalReminderCron = cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const [boutiques] = await pool.query("SELECT * FROM boutiques WHERE statut = 'actif'");
      for (const boutique of boutiques) {
        const [settingsRows] = await pool.query('SELECT * FROM settings WHERE boutique_id = ?', [boutique.id]);
        if (settingsRows.length > 0) {
          const config = typeof settingsRows[0].config === 'string' ? JSON.parse(settingsRows[0].config) : settingsRows[0].config;
          if (config && config.rappelAutomatique) {
            const timeStr = config.rappelHeure || '08:00';
            const [hourStr, minStr] = timeStr.split(':');
            const targetHour = parseInt(hourStr, 10) || 8;
            const targetMin = parseInt(minStr, 10) || 0;

            const diffMinutes = (currentHour * 60 + currentMinute) - (targetHour * 60 + targetMin);
            if (diffMinutes >= 0 && diffMinutes < 5) {
              console.log(`⏰ Time to run automatic reminders for boutique "${boutique.nom}" (${boutique.id})`);
              await runRemindersForBoutique(boutique.id);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error in global reminder cron:", err);
    }
  });
}

app.get('/api/cron/reminders', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron request' });
  }

  try {
    const result = await runReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Cron Error:", err);
    res.status(500).json({ error: 'Cron job failed', details: err.message });
  }
});

app.get('/api/factures', async (req, res) => {
  try {
    let query = 'SELECT * FROM factures WHERE boutique_id = ? ORDER BY createdAt DESC';
    let params = [req.user.boutique_id];
    if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM factures WHERE boutique_id = ? AND voyageId = ? ORDER BY createdAt DESC';
      params = [req.user.boutique_id, req.user.voyageId];
    }
    const [factures] = await pool.query(query, params);
    if (factures.length === 0) return res.json([]);
    
    // Fetch only the articles for these specific factures
    const factureIds = factures.map(f => f.id);
    const [articles] = await pool.query('SELECT * FROM facture_articles WHERE factureId IN (?)', [factureIds]);
    
    // Group articles by factureId
    const articlesMap = {};
    articles.forEach(a => {
      if (!articlesMap[a.factureId]) articlesMap[a.factureId] = [];
      articlesMap[a.factureId].push(a);
    });

    // Populate factures with clients & creators
    const [clients] = await pool.query('SELECT * FROM clients WHERE boutique_id = ?', [req.user.boutique_id]);
    const clientMap = {};
    clients.forEach(c => clientMap[c.id] = c);

    const [users] = await pool.query('SELECT id, nom, prenom FROM users WHERE boutique_id = ?', [req.user.boutique_id]);
    const userMap = {};
    users.forEach(u => userMap[u.id] = u);

    const result = factures.map(f => ({
      ...f,
      articles: articlesMap[f.id] || [],
      expediteur: clientMap[f.expediteurId] || null,
      destinataire: clientMap[f.destinataireId] || null,
      creePar: userMap[f.userId] || null
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/factures', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const id = uuidv4();
    let { numero, voyageId, expediteurId, destinataireId, poidsTotal, prixKg, fraisFret, montantTotal, montantPaye, modePaiement, statut, dateLimite, payerComores, montantComores, articles } = req.body;
    if (req.user.role === 'employee' && req.user.voyageId) voyageId = req.user.voyageId;

    if (dateLimite) {
      try {
        dateLimite = new Date(dateLimite).toISOString().split('T')[0];
      } catch (e) {
        dateLimite = null;
      }
    } else {
      dateLimite = null;
    }

    // Increment the invoice counter in settings safely inside transaction for this specific boutique
    const [settingsRows] = await connection.query('SELECT * FROM settings WHERE boutique_id = ? FOR UPDATE', [req.user.boutique_id]);
    if (settingsRows.length > 0) {
      const settings = settingsRows[0];
      const config = typeof settings.config === 'string' ? JSON.parse(settings.config) : settings.config;
      config.compteur = (config.compteur || 0) + 1;
      await connection.query(
        'UPDATE settings SET config = ? WHERE boutique_id = ?',
        [JSON.stringify(config), req.user.boutique_id]
      );
    }

    await connection.query(
      'INSERT INTO factures (id, numero, voyageId, expediteurId, destinataireId, poidsTotal, prixKg, fraisFret, montantTotal, montantPaye, modePaiement, statut, dateLimite, payerComores, montantComores, userId, boutique_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, numero, voyageId || null, expediteurId || null, destinataireId || null, poidsTotal || 0, prixKg || 0, fraisFret || 0, montantTotal || 0, montantPaye || 0, modePaiement || 'cash', statut || 'non_paye', dateLimite, payerComores ? 1 : 0, montantComores || 0, req.user.id, req.user.boutique_id]
    );

    if (articles && articles.length > 0) {
      for (let a of articles) {
        await connection.query(
          'INSERT INTO facture_articles (id, factureId, nom, quantite, prixUnitaire, total) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), id, a.nom, a.quantite || 1, a.prixUnitaire || 0, a.total || 0]
        );
      }
    }

    await connection.commit();
    res.json({ id, ...req.body, userId: req.user.id });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.put('/api/factures/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let { numero, voyageId, expediteurId, destinataireId, poidsTotal, prixKg, fraisFret, montantTotal, montantPaye, modePaiement, statut, dateLimite, payerComores, montantComores, articles } = req.body;
    if (req.user.role === 'employee' && req.user.voyageId) voyageId = req.user.voyageId;
    const factureId = req.params.id;

    // Verify if existing invoice is already paid
    const [existingFactures] = await connection.query('SELECT statut, montantTotal, montantPaye FROM factures WHERE id = ?', [factureId]);
    if (existingFactures.length > 0) {
      const ef = existingFactures[0];
      const wasPaid = ef.statut === 'paye' || ef.statut === 'Payée' || (Number(ef.montantPaye) >= Number(ef.montantTotal) && Number(ef.montantTotal) > 0);
      if (wasPaid) {
        await connection.rollback();
        return res.status(400).json({ error: "Une facture déjà payée ne peut pas être modifiée." });
      }
    }

    if (dateLimite) {
      try {
        dateLimite = new Date(dateLimite).toISOString().split('T')[0];
      } catch (e) {
        dateLimite = null;
      }
    } else {
      dateLimite = null;
    }

    await connection.query(
      'UPDATE factures SET numero = ?, voyageId = ?, expediteurId = ?, destinataireId = ?, poidsTotal = ?, prixKg = ?, fraisFret = ?, montantTotal = ?, montantPaye = ?, modePaiement = ?, statut = ?, dateLimite = ?, payerComores = ?, montantComores = ? WHERE id = ? AND boutique_id = ?',
      [numero, voyageId || null, expediteurId || null, destinataireId || null, poidsTotal || 0, prixKg || 0, fraisFret || 0, montantTotal || 0, montantPaye || 0, modePaiement || 'cash', statut || 'non_paye', dateLimite, payerComores ? 1 : 0, montantComores || 0, factureId, req.user.boutique_id]
    );

    // Replace all articles
    await connection.query('DELETE FROM facture_articles WHERE factureId = ?', [factureId]);
    if (articles && articles.length > 0) {
      for (let a of articles) {
        await connection.query(
          'INSERT INTO facture_articles (id, factureId, nom, quantite, prixUnitaire, total) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), factureId, a.nom, a.quantite || 1, a.prixUnitaire || 0, a.total || 0]
        );
      }
    }

    await connection.commit();
    res.json({ id: factureId, ...req.body });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.delete('/api/factures/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify if existing invoice is already paid
    const [existingFactures] = await connection.query('SELECT statut, montantTotal, montantPaye FROM factures WHERE id = ?', [req.params.id]);
    if (existingFactures.length > 0) {
      const ef = existingFactures[0];
      const wasPaid = ef.statut === 'paye' || ef.statut === 'Payée' || (Number(ef.montantPaye) >= Number(ef.montantTotal) && Number(ef.montantTotal) > 0);
      if (wasPaid) {
        await connection.rollback();
        return res.status(400).json({ error: "Une facture déjà payée ne peut pas être supprimée." });
      }
    }
    
    // 1. Delete associated articles first to prevent MySQL foreign key constraint failure
    await connection.query('DELETE FROM facture_articles WHERE factureId = ?', [req.params.id]);

    // 2. Delete invoice by ID (supporting both multi-tenant boutique_id and null boutique_id)
    if (req.user.boutique_id) {
      await connection.query('DELETE FROM factures WHERE id = ? AND (boutique_id = ? OR boutique_id IS NULL)', [req.params.id, req.user.boutique_id]);
    } else {
      await connection.query('DELETE FROM factures WHERE id = ?', [req.params.id]);
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// --- EPARGNES (SAVINGS) ---
app.get('/api/epargnes', async (req, res) => {
  try {
    let query = 'SELECT * FROM epargnes WHERE boutique_id = ? ORDER BY createdAt DESC';
    let params = [req.user.boutique_id];
    if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM epargnes WHERE boutique_id = ? AND voyageId = ? ORDER BY createdAt DESC';
      params = [req.user.boutique_id, req.user.voyageId];
    }
    const [rows] = await pool.query(query, params);
    
    // Conjoin the user details
    const [users] = await pool.query('SELECT id, nom, prenom, role FROM users WHERE boutique_id = ?', [req.user.boutique_id]);
    const userMap = users.reduce((m, u) => { m[u.id] = u; return m; }, {});
    const enriched = rows.map(r => ({
      ...r,
      creePar: r.userId ? userMap[r.userId] : null
    }));
    
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/epargnes', async (req, res) => {
  try {
    const { libelle, montant, voyageId } = req.body;
    const id = uuidv4();
    await pool.query(
      'INSERT INTO epargnes (id, libelle, montant, voyageId, userId, boutique_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, libelle, parseFloat(montant) || 0, voyageId || null, req.user.id, req.user.boutique_id]
    );
    const [rows] = await pool.query('SELECT * FROM epargnes WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/epargnes/:id', async (req, res) => {
  try {
    const { libelle, montant, voyageId } = req.body;
    await pool.query(
      'UPDATE epargnes SET libelle = ?, montant = ?, voyageId = ? WHERE id = ? AND boutique_id = ?',
      [libelle, parseFloat(montant) || 0, voyageId || null, req.params.id, req.user.boutique_id]
    );
    res.json({ id: req.params.id, libelle, montant, voyageId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/epargnes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM epargnes WHERE id = ? AND boutique_id = ?', [req.params.id, req.user.boutique_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- REMBOURSEMENTS ---
app.get('/api/remboursements', async (req, res) => {
  try {
    let query = 'SELECT * FROM remboursements WHERE boutique_id = ? ORDER BY createdAt DESC';
    let params = [req.user.boutique_id];
    if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM remboursements WHERE boutique_id = ? AND voyageId = ? ORDER BY createdAt DESC';
      params = [req.user.boutique_id, req.user.voyageId];
    }
    const [rows] = await pool.query(query, params);
    
    // Conjoin the user details
    const [users] = await pool.query('SELECT id, nom, prenom, role FROM users WHERE boutique_id = ?', [req.user.boutique_id]);
    const userMap = users.reduce((m, u) => { m[u.id] = u; return m; }, {});
    const enriched = rows.map(r => ({
      ...r,
      creePar: r.userId ? userMap[r.userId] : null
    }));
    
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/remboursements', async (req, res) => {
  try {
    const {
      factureId, numeroFacture, clientNom, clientPrenom, clientTelephone,
      voyageId, voyageNom, montantTotalFacture, montantPayeFacture,
      montantDuRemboursement, montantRembourse, resteARembourser, statut, modePaiement, motif
    } = req.body;

    const id = uuidv4();
    await pool.query(
      `INSERT INTO remboursements (
        id, factureId, numeroFacture, clientNom, clientPrenom, clientTelephone,
        voyageId, voyageNom, montantTotalFacture, montantPayeFacture,
        montantDuRemboursement, montantRembourse, resteARembourser, statut, modePaiement, motif, userId, boutique_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, factureId || null, numeroFacture || '', clientNom || '', clientPrenom || '', clientTelephone || '',
        voyageId || null, voyageNom || '', parseFloat(montantTotalFacture) || 0, parseFloat(montantPayeFacture) || 0,
        parseFloat(montantDuRemboursement) || 0, parseFloat(montantRembourse) || 0, parseFloat(resteARembourser) || 0,
        statut || 'partiel', modePaiement || 'cash', motif || '', req.user.id, req.user.boutique_id
      ]
    );

    const [rows] = await pool.query('SELECT * FROM remboursements WHERE id = ?', [id]);
    const [users] = await pool.query('SELECT id, nom, prenom, role FROM users WHERE id = ?', [req.user.id]);
    const result = {
      ...rows[0],
      creePar: users.length > 0 ? users[0] : null
    };
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/remboursements/:id', async (req, res) => {
  try {
    const {
      factureId, numeroFacture, clientNom, clientPrenom, clientTelephone,
      voyageId, voyageNom, montantTotalFacture, montantPayeFacture,
      montantDuRemboursement, montantRembourse, resteARembourser, statut, modePaiement, motif
    } = req.body;

    await pool.query(
      `UPDATE remboursements SET
        factureId = ?, numeroFacture = ?, clientNom = ?, clientPrenom = ?, clientTelephone = ?,
        voyageId = ?, voyageNom = ?, montantTotalFacture = ?, montantPayeFacture = ?,
        montantDuRemboursement = ?, montantRembourse = ?, resteARembourser = ?, statut = ?, modePaiement = ?, motif = ?
      WHERE id = ? AND boutique_id = ?`,
      [
        factureId || null, numeroFacture || '', clientNom || '', clientPrenom || '', clientTelephone || '',
        voyageId || null, voyageNom || '', parseFloat(montantTotalFacture) || 0, parseFloat(montantPayeFacture) || 0,
        parseFloat(montantDuRemboursement) || 0, parseFloat(montantRembourse) || 0, parseFloat(resteARembourser) || 0,
        statut || 'partiel', modePaiement || 'cash', motif || '', req.params.id, req.user.boutique_id
      ]
    );

    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/remboursements/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM remboursements WHERE id = ? AND boutique_id = ?', [req.params.id, req.user.boutique_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SUPER ADMIN ENDPOINTS ---
const superAdminMiddleware = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Accès réservé au Super Admin.' });
  }
  next();
};

app.get('/api/superadmin/boutiques', superAdminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, 
             (SELECT COUNT(*) FROM users u WHERE u.boutique_id = b.id) AS nb_users,
             (SELECT COALESCE(SUM(f.montantTotal), 0) FROM factures f WHERE f.boutique_id = b.id) AS chiffre_affaires
      FROM boutiques b
      ORDER BY b.createdAt DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/superadmin/boutiques', superAdminMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { nom, telephone, adresse, adminEmail, adminPassword, adminNom, adminPrenom, montantMensuel } = req.body;
    if (!nom) return res.status(400).json({ error: 'Le nom de la boutique est requis.' });
    
    const boutiqueId = uuidv4();
    
    // Create boutique with contact details and monthly payment
    await connection.query(
      'INSERT INTO boutiques (id, nom, telephone, adresse, statut, montant_mensuel) VALUES (?, ?, ?, ?, ?, ?)',
      [boutiqueId, nom, telephone || null, adresse || null, 'actif', montantMensuel ? parseFloat(montantMensuel) : null]
    );

    // Create default settings for this boutique with telephone & address!
    const [maxIdRow] = await connection.query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM settings');
    const nextId = maxIdRow[0].nextId;
    const defaultEntreprise = { nom, telephone1: telephone || '', email: adminEmail || '', adresse: adresse || '' };
    const defaultConfig = { prixKg: 6000, devise: 'FCFA', couleurPrimaire: '#6366f1', modeSombre: true, formatNumero: 'Fac-{YEAR2}-{NUM2}', modeleFacture: 'moderne', compteur: 0 };
    await connection.query(
      'INSERT INTO settings (id, boutique_id, entreprise, config) VALUES (?, ?, ?, ?)',
      [nextId, boutiqueId, JSON.stringify(defaultEntreprise), JSON.stringify(defaultConfig)]
    );
    
    // Create default admin user if credentials provided
    if (adminEmail && adminPassword) {
      const [existing] = await connection.query('SELECT 1 FROM users WHERE email = ?', [adminEmail]);
      if (existing.length > 0) {
        throw new Error("L'email de l'administrateur existe déjà.");
      }
      const userHash = await bcrypt.hash(adminPassword, 10);
      await connection.query(
        'INSERT INTO users (id, nom, prenom, email, password, role, active, boutique_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), adminNom || 'Admin', adminPrenom || 'Boutique', adminEmail, userHash, 'admin', 1, boutiqueId]
      );
    }
    
    await connection.commit();
    res.json({ id: boutiqueId, nom, telephone, adresse, statut: 'actif', createdAt: new Date(), montant_mensuel: montantMensuel });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.put('/api/superadmin/boutiques/:id', superAdminMiddleware, async (req, res) => {
  try {
    const { nom, telephone, adresse, statut, montant_mensuel } = req.body;
    if (statut) {
      if (statut !== 'actif' && statut !== 'inactif') {
        return res.status(400).json({ error: 'Statut invalide.' });
      }
      await pool.query(
        'UPDATE boutiques SET nom = ?, telephone = ?, adresse = ?, statut = ?, montant_mensuel = ? WHERE id = ?',
        [nom, telephone || null, adresse || null, statut, montant_mensuel != null ? parseFloat(montant_mensuel) : null, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE boutiques SET nom = ?, telephone = ?, adresse = ?, montant_mensuel = ? WHERE id = ?',
        [nom, telephone || null, adresse || null, montant_mensuel != null ? parseFloat(montant_mensuel) : null, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/superadmin/boutiques/:id', superAdminMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const boutiqueId = req.params.id;
    if (boutiqueId === 'fac-soil-uuid-1111') {
      return res.status(400).json({ error: "Impossible de supprimer la boutique d'origine fac-soil." });
    }

    // Cascade deletes:
    // 1. Delete invoice articles
    await connection.query(`
      DELETE FROM facture_articles 
      WHERE factureId IN (SELECT id FROM factures WHERE boutique_id = ?)
    `, [boutiqueId]);

    // 2. Delete invoices
    await connection.query('DELETE FROM factures WHERE boutique_id = ?', [boutiqueId]);

    // 3. Delete business child tables
    await connection.query('DELETE FROM epargnes WHERE boutique_id = ?', [boutiqueId]);
    await connection.query('DELETE FROM depenses WHERE boutique_id = ?', [boutiqueId]);
    await connection.query('DELETE FROM clients WHERE boutique_id = ?', [boutiqueId]);
    await connection.query('DELETE FROM voyages WHERE boutique_id = ?', [boutiqueId]);
    await connection.query('DELETE FROM users WHERE boutique_id = ?', [boutiqueId]);
    await connection.query('DELETE FROM settings WHERE boutique_id = ?', [boutiqueId]);
    
    // 4. Finally, delete the boutique itself
    await connection.query('DELETE FROM boutiques WHERE id = ?', [boutiqueId]);
    
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// --- BOUTIQUE PAYMENTS (CA du Super Admin) ---
app.get('/api/superadmin/payments', superAdminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT bp.*, b.nom AS boutique_nom, b.montant_mensuel
      FROM boutique_payments bp
      LEFT JOIN boutiques b ON bp.boutique_id = b.id
      ORDER BY bp.createdAt DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/superadmin/payments', superAdminMiddleware, async (req, res) => {
  try {
    const { boutique_id, montant, mois, description } = req.body;
    if (!boutique_id || !montant) return res.status(400).json({ error: 'boutique_id et montant requis.' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO boutique_payments (id, boutique_id, montant, mois, description) VALUES (?, ?, ?, ?, ?)',
      [id, boutique_id, parseFloat(montant), mois || null, description || null]
    );
    const [rows] = await pool.query('SELECT bp.*, b.nom AS boutique_nom FROM boutique_payments bp LEFT JOIN boutiques b ON bp.boutique_id = b.id WHERE bp.id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/superadmin/payments/:id', superAdminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM boutique_payments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send WhatsApp payment reminder for a boutique
app.post('/api/superadmin/payments/reminder', superAdminMiddleware, async (req, res) => {
  try {
    const { boutique_id, message, telephone } = req.body;
    if (!telephone || !message) return res.status(400).json({ error: 'telephone et message requis.' });
    // Format phone number
    let phone = telephone.replace(/\s+/g, '').replace(/^\+/, '');
    if (phone.startsWith('0')) phone = '221' + phone.slice(1);
    const encodedMsg = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMsg}`;
    res.json({ whatsappUrl, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN PERSONAL EXPENSES ---
app.get('/api/superadmin/depenses', superAdminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admin_depenses ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/superadmin/depenses', superAdminMiddleware, async (req, res) => {
  try {
    const { libelle, montant, categorie } = req.body;
    if (!libelle || !montant) return res.status(400).json({ error: 'libelle et montant requis.' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO admin_depenses (id, libelle, montant, categorie) VALUES (?, ?, ?, ?)',
      [id, libelle, parseFloat(montant), categorie || 'Autre']
    );
    const [rows] = await pool.query('SELECT * FROM admin_depenses WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/superadmin/depenses/:id', superAdminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM admin_depenses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Epargnes
app.get('/api/superadmin/epargnes', superAdminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admin_epargnes ORDER BY date_epargne DESC, createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/superadmin/epargnes', superAdminMiddleware, async (req, res) => {
  try {
    const { libelle, montant, date_epargne } = req.body;
    if (!libelle || !montant) return res.status(400).json({ error: 'libelle et montant requis.' });
    const id = uuidv4();
    const insertDate = date_epargne ? new Date(date_epargne) : new Date();
    await pool.query(
      'INSERT INTO admin_epargnes (id, libelle, montant, date_epargne) VALUES (?, ?, ?, ?)',
      [id, libelle, parseFloat(montant), insertDate]
    );
    const [rows] = await pool.query('SELECT * FROM admin_epargnes WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/superadmin/epargnes/:id', superAdminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM admin_epargnes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change boutique admin password
app.put('/api/superadmin/boutiques/:id/change-password', superAdminMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe doit avoir au moins 6 caractères.' });
    // Find the admin user of the boutique
    const [admins] = await pool.query("SELECT id FROM users WHERE boutique_id = ? AND role = 'admin' ORDER BY createdAt ASC LIMIT 1", [req.params.id]);
    if (admins.length === 0) return res.status(404).json({ error: 'Aucun administrateur trouvé pour cette boutique.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, admins[0].id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/superadmin/statistics', superAdminMiddleware, async (req, res) => {
  try {
    const [countBoutiques] = await pool.query('SELECT COUNT(*) AS total FROM boutiques');
    const [countActive] = await pool.query("SELECT COUNT(*) AS total FROM boutiques WHERE statut = 'actif'");
    const [countInactive] = await pool.query("SELECT COUNT(*) AS total FROM boutiques WHERE statut = 'inactif'");
    
    // CA = payments received from boutiques
    const [sumRevenue] = await pool.query('SELECT COALESCE(SUM(montant), 0) AS total FROM boutique_payments');
    // Dépenses = personal admin expenses
    const [sumExpenses] = await pool.query('SELECT COALESCE(SUM(montant), 0) AS total FROM admin_depenses');
    const [sumEpargnes] = await pool.query('SELECT COALESCE(SUM(montant), 0) AS total FROM admin_epargnes');
    
    // Revenue per boutique from boutique_payments
    const [boutiqueRevenues] = await pool.query(`
      SELECT b.nom, b.montant_mensuel, COALESCE(SUM(bp.montant), 0) AS ca,
             COALESCE(SUM(f.montantTotal), 0) AS ca_factures
      FROM boutiques b
      LEFT JOIN boutique_payments bp ON bp.boutique_id = b.id
      LEFT JOIN factures f ON f.boutique_id = b.id
      GROUP BY b.id, b.nom, b.montant_mensuel
      ORDER BY ca DESC
    `);

    // Monthly revenue trend (last 6 months)
    const [monthlyRevenue] = await pool.query(`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS mois, SUM(montant) AS total
      FROM boutique_payments
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY mois ASC
    `);

    const [monthlyExpenses] = await pool.query(`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS mois, SUM(montant) AS total
      FROM admin_depenses
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY mois ASC
    `);

    res.json({
      totalBoutiques: countBoutiques[0].total,
      activeBoutiques: countActive[0].total,
      inactiveBoutiques: countInactive[0].total,
      globalRevenue: sumRevenue[0].total,
      globalExpenses: sumExpenses[0].total,
      globalEpargnes: sumEpargnes[0].total,
      boutiqueRevenues,
      monthlyRevenue,
      monthlyExpenses
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/superadmin/epargnes', superAdminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, b.nom AS boutique_nom, u.nom AS user_nom, u.prenom AS user_prenom
      FROM epargnes e
      LEFT JOIN boutiques b ON e.boutique_id = b.id
      LEFT JOIN users u ON e.userId = u.id
      ORDER BY e.createdAt DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.SPACE_ID ? 7860 : (process.env.PORT || 3001);

// Démarre le serveur uniquement si on n'est pas sur Vercel
if (process.env.VERCEL !== '1' && !process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`🚀 EasyFac API Server is running on port ${PORT}`);
    
    // Seed Database on startup automatically
    try {
      // Safely create table epargnes if it doesn't exist
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS epargnes (
            id VARCHAR(255) PRIMARY KEY,
            libelle VARCHAR(255) NOT NULL,
            montant DECIMAL(15, 2) NOT NULL,
            voyageId VARCHAR(255),
            userId VARCHAR(255) DEFAULT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (voyageId) REFERENCES voyages(id) ON DELETE SET NULL
          )
        `);
        console.log('Table "epargnes" created or verified.');
      } catch (e) {
        console.error('Error creating table "epargnes":', e.message);
      }

      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS remboursements (
            id VARCHAR(255) PRIMARY KEY,
            factureId VARCHAR(255) DEFAULT NULL,
            numeroFacture VARCHAR(255) DEFAULT NULL,
            clientNom VARCHAR(255) DEFAULT NULL,
            clientPrenom VARCHAR(255) DEFAULT NULL,
            clientTelephone VARCHAR(255) DEFAULT NULL,
            voyageId VARCHAR(255) DEFAULT NULL,
            voyageNom VARCHAR(255) DEFAULT NULL,
            montantTotalFacture DECIMAL(15, 2) DEFAULT 0,
            montantPayeFacture DECIMAL(15, 2) DEFAULT 0,
            montantDuRemboursement DECIMAL(15, 2) NOT NULL DEFAULT 0,
            montantRembourse DECIMAL(15, 2) NOT NULL DEFAULT 0,
            resteARembourser DECIMAL(15, 2) NOT NULL DEFAULT 0,
            statut VARCHAR(50) DEFAULT 'partiel',
            modePaiement VARCHAR(50) DEFAULT 'cash',
            motif TEXT DEFAULT NULL,
            userId VARCHAR(255) DEFAULT NULL,
            boutique_id VARCHAR(255) DEFAULT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('Table "remboursements" created or verified.');
      } catch (e) {
        console.error('Error creating table "remboursements":', e.message);
      }

      // Safely add columns if they do not exist
      try {
        await pool.query('ALTER TABLE users ADD COLUMN telephone VARCHAR(100) DEFAULT NULL');
        console.log('Column "telephone" added to "users" table.');
      } catch (e) {}
      try {
        await pool.query('ALTER TABLE users ADD COLUMN active TINYINT DEFAULT 1');
        console.log('Column "active" added to "users" table.');
      } catch (e) {}
      try {
        await pool.query('ALTER TABLE factures ADD COLUMN rappelAutomatiqueSent TINYINT DEFAULT 0');
        console.log('Column "rappelAutomatiqueSent" added to "factures" table.');
      } catch (e) {}
      try {
        await pool.query('ALTER TABLE remboursements ADD COLUMN montantDuRemboursement DECIMAL(15,2) DEFAULT 0');
        console.log('Column "montantDuRemboursement" added to "remboursements" table.');
      } catch (e) {}

      // --- SAAS SCHEMAS & MIGRATIONS ---
      try {
        // Create boutique_payments table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS boutique_payments (
            id VARCHAR(255) PRIMARY KEY,
            boutique_id VARCHAR(255) NOT NULL,
            montant DECIMAL(15, 2) NOT NULL,
            mois VARCHAR(20) DEFAULT NULL,
            description TEXT DEFAULT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('Table "boutique_payments" verified.');
        // Create admin_depenses table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS admin_depenses (
            id VARCHAR(255) PRIMARY KEY,
            libelle VARCHAR(255) NOT NULL,
            montant DECIMAL(15, 2) NOT NULL,
            categorie VARCHAR(100) DEFAULT 'Autre',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('Table "admin_depenses" verified.');

        // Create admin_epargnes table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS admin_epargnes (
            id VARCHAR(255) PRIMARY KEY,
            libelle VARCHAR(255) NOT NULL,
            montant DECIMAL(15, 2) NOT NULL,
            date_epargne DATETIME DEFAULT CURRENT_TIMESTAMP,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('Table "admin_epargnes" verified.');
        // Add montant_mensuel column to boutiques if not exists
        try {
          await pool.query('ALTER TABLE boutiques ADD COLUMN montant_mensuel DECIMAL(15,2) DEFAULT NULL');
        } catch(e) {}
      } catch(e) { console.error('Tables creation error:', e.message); }
      // --- SAAS SCHEMAS & MIGRATIONS (CORE) ---
      try {
        // 1. Boutiques table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS boutiques (
            id VARCHAR(255) PRIMARY KEY,
            nom VARCHAR(255) NOT NULL,
            telephone VARCHAR(100) DEFAULT NULL,
            adresse VARCHAR(255) DEFAULT NULL,
            statut ENUM('actif', 'inactif') DEFAULT 'actif',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        try {
          await pool.query('ALTER TABLE boutiques ADD COLUMN telephone VARCHAR(100) DEFAULT NULL');
        } catch (e) {}
        try {
          await pool.query('ALTER TABLE boutiques ADD COLUMN adresse VARCHAR(255) DEFAULT NULL');
        } catch (e) {}
        console.log('SaaS: Table "boutiques" verified with contact columns.');

        // 2. Insert initial boutique fac-soil
        await pool.query(`
          INSERT IGNORE INTO boutiques (id, nom, statut) 
          VALUES ('fac-soil-uuid-1111', 'fac-soil', 'actif')
        `);
        console.log('SaaS: Boutique "fac-soil" seeded.');

        // 3. Alter tables to add boutique_id column
        const saasTables = ['users', 'voyages', 'clients', 'factures', 'depenses', 'epargnes', 'settings'];
        for (const t of saasTables) {
          try {
            await pool.query(`ALTER TABLE ${t} ADD COLUMN boutique_id VARCHAR(255) NULL`);
            console.log(`SaaS: Column "boutique_id" added to table "${t}".`);
          } catch (e) {
            // Already exists or other column error
          }
        }

        // 4. Update role column in users
        try {
          await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'employee') NOT NULL");
          console.log('SaaS: Role enum updated in "users" table.');
        } catch (e) {
          console.error("Error altering users role enum:", e.message);
        }

        // 5. Migrate all existing orphan records to fac-soil
        for (const t of saasTables) {
          try {
            if (t === 'users') {
              await pool.query(`UPDATE users SET boutique_id = 'fac-soil-uuid-1111' WHERE role != 'super_admin' AND boutique_id IS NULL`);
            } else {
              await pool.query(`UPDATE ${t} SET boutique_id = 'fac-soil-uuid-1111' WHERE boutique_id IS NULL`);
            }
          } catch (e) {
            console.error(`SaaS: Migration error for table "${t}":`, e.message);
          }
        }
        console.log('SaaS: Existing data migrated to "fac-soil" boutique successfully!');

        // 6. Seed Super Admin
        const adminEmail = 'soilihiabdou@gmail.com';
        const [existingAdmin] = await pool.query('SELECT * FROM users WHERE email = ?', [adminEmail]);
        if (existingAdmin.length === 0) {
          const superAdminHash = await bcrypt.hash('Passer123', 10);
          await pool.query(`
            INSERT INTO users (id, nom, prenom, email, password, role, boutique_id)
            VALUES (?, ?, ?, ?, ?, 'super_admin', NULL)
          `, [uuidv4(), 'Abdou', 'Soilihi', adminEmail, superAdminHash]);
          console.log('SaaS: Super Admin seeded successfully!');
        } else {
          await pool.query(`
            UPDATE users SET role = 'super_admin', boutique_id = NULL WHERE email = ?
          `, [adminEmail]);
          console.log('SaaS: Super Admin role enforced on existing email!');
        }
      } catch (saasErr) {
        console.error('SaaS: Migration failed at startup:', saasErr.message);
      }

      const seedUser = async (nom, prenom, email, password, role, permissions = null, boutique_id = 'fac-soil-uuid-1111') => {
        const [existing] = await pool.query('SELECT COUNT(*) as count FROM users WHERE email = ?', [email]);
        if (existing[0].count === 0) {
          const hash = await bcrypt.hash(password, 10);
          await pool.query(
            'INSERT INTO users (id, nom, prenom, email, password, role, permissions, boutique_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), nom, prenom, email, hash, role, permissions ? JSON.stringify(permissions) : null, boutique_id]
          );
          console.log(`Default user created: ${email}`);
        }
      };

      await seedUser('Admin', 'Super', 'admin@easyfac.com', 'Passer123', 'admin');
      await seedUser('Faruck', 'Admin', 'faruck@gmail.com', 'Passer123', 'admin');
      await seedUser('Faruck', 'Admin', 'faruck@gmil.com', 'Passer123', 'admin');

      const empPermissions = {
        voirFactures: true, creerFacture: true, modifierFacture: true, supprimerFacture: true,
        voirVoyages: true, creerVoyage: true, modifierVoyage: true, supprimerVoyage: true,
        voirDepenses: true, creerDepense: true, modifierDepense: true, supprimerDepense: true,
        voirClients: true, creerClient: true, modifierClient: true, supprimerClient: true
      };
      await seedUser('Faruck', 'Employé', 'faruck-employe@gmail.com', 'Passer123', 'employee', empPermissions);
      console.log('✅ Database startup seeding completed successfully!');
      
      // Initialize dynamic cron scheduler at startup
      await initReminderCron();
    } catch (err) {
      console.error('❌ Failed to seed default users or init cron on startup:', err.message);
    }
  });
}

// Export de l'application pour Vercel (Serverless Functions)
module.exports = app;
