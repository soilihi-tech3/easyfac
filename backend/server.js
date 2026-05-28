require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Password mismatch.');
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    
    const token = jwt.sign({ id: user.id, role: user.role, voyageId: user.voyageId }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPass } = user;
    res.json({ token, user: userWithoutPass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JWT Middleware
const authMiddleware = (req, res, next) => {
  // Allow status endpoint
  if (req.path === '/status') return next();
  
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

app.use('/api', authMiddleware);

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
    const [rows] = await pool.query('SELECT id, nom, prenom, email, role, voyageId, permissions, telephone, active, createdAt FROM users ORDER BY createdAt DESC');
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
      'INSERT INTO users (id, nom, prenom, email, password, role, voyageId, permissions, telephone, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, nom, prenom, email, hash, role || 'employee', cleanVoyageId, permString, telephone || null, activeVal]
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
        'UPDATE users SET nom=?, prenom=?, email=?, password=?, role=?, voyageId=?, permissions=?, telephone=?, active=? WHERE id=?',
        [nom, prenom, email, hash, role, cleanVoyageId, permString, telephone || null, activeVal, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET nom=?, prenom=?, email=?, role=?, voyageId=?, permissions=?, telephone=?, active=? WHERE id=?',
        [nom, prenom, email, role, cleanVoyageId, permString, telephone || null, activeVal, req.params.id]
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
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CLIENTS ---
app.get('/api/clients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients ORDER BY createdAt DESC');
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
      'INSERT INTO clients (id, nom, prenom, telephone, email) VALUES (?, ?, ?, ?, ?)',
      [id, nom, prenom, telephone, email]
    );
    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { nom, prenom, telephone, email } = req.body;
    await pool.query(
      'UPDATE clients SET nom = ?, prenom = ?, telephone = ?, email = ? WHERE id = ?',
      [nom, prenom, telephone, email, req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- VOYAGES ---
app.get('/api/voyages', async (req, res) => {
  try {
    let query = 'SELECT * FROM voyages ORDER BY dateDepart DESC';
    let params = [];
    if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM voyages WHERE id = ? ORDER BY dateDepart DESC';
      params = [req.user.voyageId];
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
      'INSERT INTO voyages (id, nom, dateDepart, statut) VALUES (?, ?, ?, ?)',
      [id, nom, dateDepart, statut || 'en_cours']
    );
    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/voyages/:id', async (req, res) => {
  try {
    const { nom, dateDepart, statut } = req.body;
    await pool.query(
      'UPDATE voyages SET nom = ?, dateDepart = ?, statut = ? WHERE id = ?',
      [nom, dateDepart, statut, req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/voyages/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM voyages WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- DEPENSES ---
app.get('/api/depenses', async (req, res) => {
  try {
    let query = 'SELECT * FROM depenses ORDER BY createdAt DESC';
    let params = [];
    if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM depenses WHERE voyageId = ? ORDER BY createdAt DESC';
      params = [req.user.voyageId];
    }
    const [rows] = await pool.query(query, params);
    const [users] = await pool.query('SELECT id, nom, prenom FROM users');
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
    if (req.user.role === 'employee' && req.user.voyageId) voyageId = req.user.voyageId;
    await pool.query(
      'INSERT INTO depenses (id, nom, montant, quantite, voyageId, userId) VALUES (?, ?, ?, ?, ?, ?)',
      [id, nom, montant, quantite || 1, voyageId || null, req.user.id]
    );
    res.json({ id, ...req.body, userId: req.user.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/depenses/:id', async (req, res) => {
  try {
    let { nom, montant, quantite, voyageId } = req.body;
    if (req.user.role === 'employee' && req.user.voyageId) voyageId = req.user.voyageId;
    await pool.query(
      'UPDATE depenses SET nom = ?, montant = ?, quantite = ?, voyageId = ? WHERE id = ?',
      [nom, montant, quantite || 1, voyageId || null, req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/depenses/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM depenses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PARAMETRES ---
app.get('/api/parametres', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    if (rows.length > 0) {
      res.json({
        entreprise: typeof rows[0].entreprise === 'string' ? JSON.parse(rows[0].entreprise) : rows[0].entreprise,
        config: typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config
      });
    } else {
      res.json({ entreprise: {}, config: {} });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/parametres', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    const { entreprise, config } = req.body;
    await pool.query(
      'UPDATE settings SET entreprise = ?, config = ? WHERE id = 1',
      [JSON.stringify(entreprise), JSON.stringify(config)]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- FACTURES (Complex: nested articles) ---
app.get('/api/factures', async (req, res) => {
  try {
    let query = 'SELECT * FROM factures ORDER BY createdAt DESC';
    let params = [];
    if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM factures WHERE voyageId = ? ORDER BY createdAt DESC';
      params = [req.user.voyageId];
    }
    const [factures] = await pool.query(query, params);
    const [articles] = await pool.query('SELECT * FROM facture_articles');
    
    // Group articles by factureId
    const articlesMap = {};
    articles.forEach(a => {
      if (!articlesMap[a.factureId]) articlesMap[a.factureId] = [];
      articlesMap[a.factureId].push(a);
    });

    // Populate factures with clients & creators
    const [clients] = await pool.query('SELECT * FROM clients');
    const clientMap = {};
    clients.forEach(c => clientMap[c.id] = c);

    const [users] = await pool.query('SELECT id, nom, prenom FROM users');
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

    // Increment the invoice counter in settings safely inside transaction
    const [settingsRows] = await connection.query('SELECT * FROM settings WHERE id = 1 FOR UPDATE');
    if (settingsRows.length > 0) {
      const settings = settingsRows[0];
      const config = typeof settings.config === 'string' ? JSON.parse(settings.config) : settings.config;
      config.compteur = (config.compteur || 0) + 1;
      await connection.query(
        'UPDATE settings SET config = ? WHERE id = 1',
        [JSON.stringify(config)]
      );
    }

    await connection.query(
      'INSERT INTO factures (id, numero, voyageId, expediteurId, destinataireId, poidsTotal, prixKg, fraisFret, montantTotal, montantPaye, modePaiement, statut, dateLimite, payerComores, montantComores, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, numero, voyageId || null, expediteurId || null, destinataireId || null, poidsTotal || 0, prixKg || 0, fraisFret || 0, montantTotal || 0, montantPaye || 0, modePaiement || 'cash', statut || 'non_paye', dateLimite, payerComores ? 1 : 0, montantComores || 0, req.user.id]
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
      'UPDATE factures SET numero = ?, voyageId = ?, expediteurId = ?, destinataireId = ?, poidsTotal = ?, prixKg = ?, fraisFret = ?, montantTotal = ?, montantPaye = ?, modePaiement = ?, statut = ?, dateLimite = ?, payerComores = ?, montantComores = ? WHERE id = ?',
      [numero, voyageId || null, expediteurId || null, destinataireId || null, poidsTotal || 0, prixKg || 0, fraisFret || 0, montantTotal || 0, montantPaye || 0, modePaiement || 'cash', statut || 'non_paye', dateLimite, payerComores ? 1 : 0, montantComores || 0, factureId]
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
  try {
    await pool.query('DELETE FROM factures WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- EPARGNES (SAVINGS) ---
app.get('/api/epargnes', async (req, res) => {
  try {
    let query = 'SELECT * FROM epargnes ORDER BY createdAt DESC';
    let params = [];
    if (req.user.role === 'employee' && req.user.voyageId) {
      query = 'SELECT * FROM epargnes WHERE voyageId = ? ORDER BY createdAt DESC';
      params = [req.user.voyageId];
    }
    const [rows] = await pool.query(query, params);
    
    // Conjoin the user details
    const [users] = await pool.query('SELECT id, nom, prenom, role FROM users');
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
      'INSERT INTO epargnes (id, libelle, montant, voyageId, userId) VALUES (?, ?, ?, ?, ?)',
      [id, libelle, parseFloat(montant) || 0, voyageId || null, req.user.id]
    );
    res.json({ id, libelle, montant, voyageId, userId: req.user.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/epargnes/:id', async (req, res) => {
  try {
    const { libelle, montant, voyageId } = req.body;
    await pool.query(
      'UPDATE epargnes SET libelle = ?, montant = ?, voyageId = ? WHERE id = ?',
      [libelle, parseFloat(montant) || 0, voyageId || null, req.params.id]
    );
    res.json({ id: req.params.id, libelle, montant, voyageId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/epargnes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM epargnes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;

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

      // Safely add columns if they do not exist
      try {
        await pool.query('ALTER TABLE users ADD COLUMN telephone VARCHAR(100) DEFAULT NULL');
        console.log('Column "telephone" added to "users" table.');
      } catch (e) {}
      try {
        await pool.query('ALTER TABLE users ADD COLUMN active TINYINT DEFAULT 1');
        console.log('Column "active" added to "users" table.');
      } catch (e) {}

      const seedUser = async (nom, prenom, email, password, role, permissions = null) => {
        const [existing] = await pool.query('SELECT COUNT(*) as count FROM users WHERE email = ?', [email]);
        if (existing[0].count === 0) {
          const hash = await bcrypt.hash(password, 10);
          await pool.query(
            'INSERT INTO users (id, nom, prenom, email, password, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), nom, prenom, email, hash, role, permissions ? JSON.stringify(permissions) : null]
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
    } catch (err) {
      console.error('❌ Failed to seed default users on startup:', err.message);
    }
  });
}

// Export de l'application pour Vercel (Serverless Functions)
module.exports = app;
