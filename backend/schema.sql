CREATE DATABASE IF NOT EXISTS easyfac_db;
USE easyfac_db;

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(255) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  prenom VARCHAR(255) NOT NULL,
  telephone VARCHAR(100),
  email VARCHAR(255),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voyages (
  id VARCHAR(255) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  dateDepart DATE,
  statut ENUM('en_cours', 'termine', 'annule') DEFAULT 'en_cours',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  prenom VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') DEFAULT 'employee',
  voyageId VARCHAR(255),
  permissions TEXT DEFAULT NULL,
  telephone VARCHAR(100) DEFAULT NULL,
  active TINYINT DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voyageId) REFERENCES voyages(id) ON DELETE SET NULL
);

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
  dateLimite DATE,
  payerComores TINYINT DEFAULT 0,
  montantComores DECIMAL(15, 2) DEFAULT 0,
  userId VARCHAR(255) DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voyageId) REFERENCES voyages(id) ON DELETE SET NULL,
  FOREIGN KEY (expediteurId) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (destinataireId) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS facture_articles (
  id VARCHAR(255) PRIMARY KEY,
  factureId VARCHAR(255) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  quantite INT DEFAULT 1,
  prixUnitaire DECIMAL(15, 2) DEFAULT 0,
  total DECIMAL(15, 2) DEFAULT 0,
  FOREIGN KEY (factureId) REFERENCES factures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS depenses (
  id VARCHAR(255) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  montant DECIMAL(15, 2) NOT NULL,
  quantite INT DEFAULT 1,
  voyageId VARCHAR(255),
  userId VARCHAR(255) DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voyageId) REFERENCES voyages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS epargnes (
  id VARCHAR(255) PRIMARY KEY,
  libelle VARCHAR(255) NOT NULL,
  montant DECIMAL(15, 2) NOT NULL,
  voyageId VARCHAR(255),
  userId VARCHAR(255) DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voyageId) REFERENCES voyages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  entreprise JSON,
  config JSON
);

INSERT IGNORE INTO settings (id, entreprise, config) 
VALUES (1, 
  '{"nom": "Transport Sénégal SARL", "telephone1": "33 800 00 00", "telephone2": "77 000 00 00", "email": "contact@transport-sn.com", "siteWeb": "www.transport-sn.com", "adresse": "Dakar, Sénégal"}', 
  '{"prixKg": 6000, "devise": "FCFA", "modeleFacture": "moderne", "formatNumero": "Fac-{YEAR2}-{NUM2}", "modeSombre": true}'
);
