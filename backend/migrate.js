const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')))
      ? { rejectUnauthorized: true }
      : undefined
  });

  try {
    console.log('Running migrations...');

    // Drop tables and recreate them to ensure clean state since we're in dev
    // First drop facture_articles to avoid foreign key constraint error
    await connection.query('DROP TABLE IF EXISTS facture_articles');
    
    // Then alter factures or drop it. We'll drop factures.
    await connection.query('DROP TABLE IF EXISTS factures');

    // Recreate factures
    await connection.query(`
      CREATE TABLE IF NOT EXISTS factures (
        id VARCHAR(255) PRIMARY KEY,
        numero VARCHAR(255) NOT NULL,
        voyageId VARCHAR(255),
        expediteurId VARCHAR(255),
        destinataireId VARCHAR(255),
        poidsTotal DECIMAL(10, 2) DEFAULT 0,
        prixKg DECIMAL(15, 2) DEFAULT 0,
        fraisFret DECIMAL(15, 2) DEFAULT 0,
        montantTotal DECIMAL(15, 2) DEFAULT 0,
        montantPaye DECIMAL(15, 2) DEFAULT 0,
        modePaiement ENUM('cash', 'orange_money', 'wave', 'mixte') DEFAULT 'cash',
        statut ENUM('paye', 'partiel', 'non_paye') DEFAULT 'non_paye',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (voyageId) REFERENCES voyages(id) ON DELETE SET NULL,
        FOREIGN KEY (expediteurId) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (destinataireId) REFERENCES clients(id) ON DELETE SET NULL
      )
    `);

    // Recreate facture_articles
    await connection.query(`
      CREATE TABLE IF NOT EXISTS facture_articles (
        id VARCHAR(255) PRIMARY KEY,
        factureId VARCHAR(255) NOT NULL,
        nom VARCHAR(255) NOT NULL,
        quantite INT DEFAULT 1,
        prixUnitaire DECIMAL(15, 2) DEFAULT 0,
        total DECIMAL(15, 2) DEFAULT 0,
        FOREIGN KEY (factureId) REFERENCES factures(id) ON DELETE CASCADE
      )
    `);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
