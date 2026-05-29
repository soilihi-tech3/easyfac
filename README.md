---
title: EasyFac Backend
emoji: 🚀
colorFrom: indigo
colorTo: green
sdk: docker
pinned: false
---

# EasyFac — Application Web de Facturation Intelligente

> Application de facturation professionnelle conçue pour les entreprises de transport et de colis en Afrique.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![React](https://img.shields.io/badge/React-18.2-61DAFB)
![Licence](https://img.shields.io/badge/licence-MIT-green)

---

## 📋 Présentation

**EasyFac** est une application web moderne et responsive permettant de :
- Gérer vos **clients** (ajout, modification, suppression, recherche rapide)
- Créer des **factures** avec calcul automatique kg → prix
- Suivre les **paiements** (complet / partiel / impayé)
- Gérer les **voyages** et analyser leur rentabilité
- Enregistrer les **dépenses** et calculer les bénéfices réels
- Consulter des **statistiques** détaillées avec graphiques

---

## 🚀 Installation et démarrage

### Prérequis
- **Node.js** v16 ou supérieur
- **npm** v8 ou supérieur

### Étapes

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer en mode développement
npm start
```

L'application s'ouvre automatiquement sur **http://localhost:3000**

### Build de production

```bash
npm run build
```

Les fichiers optimisés sont générés dans le dossier `/build`.

---

## 🗂️ Structure du projet

```
easyfac/
├── public/
│   └── index.html              # Point d'entrée HTML
├── src/
│   ├── index.js                # Point d'entrée React
│   ├── App.jsx                 # Routeur principal
│   ├── index.css               # Styles globaux + design system
│   ├── context/
│   │   └── AppContext.jsx      # Contexte global (thème, toasts, params)
│   ├── data/
│   │   └── store.js            # Gestion localStorage (CRUD complet)
│   └── components/
│       ├── layout/
│       │   ├── Layout.jsx      # Sidebar + topbar + navigation
│       │   └── Layout.css      # Styles layout responsive
│       ├── dashboard/
│       │   ├── Dashboard.jsx   # Accueil avec KPIs et graphiques
│       │   └── Dashboard.css
│       ├── clients/
│       │   └── Clients.jsx     # Gestion complète des clients
│       ├── factures/
│       │   ├── Factures.jsx    # Liste et filtres des factures
│       │   ├── FactureModal.jsx# Formulaire création/édition facture
│       │   └── ReceiptModal.jsx# Reçu imprimable + WhatsApp
│       ├── voyages/
│       │   └── Voyages.jsx     # Gestion des voyages + stats
│       ├── depenses/
│       │   └── Depenses.jsx    # Gestion des dépenses
│       ├── statistiques/
│       │   └── Statistiques.jsx# Graphiques et analyses avancées
│       └── parametres/
│           └── Parametres.jsx  # Configuration admin
├── package.json
└── README.md
```

---

## ✨ Fonctionnalités détaillées

### 📊 Dashboard
- Chiffre d'affaires mensuel en temps réel
- Montant encaissé et reste à payer
- Bénéfice net (revenus - dépenses)
- Graphique d'évolution sur 6 mois (AreaChart)
- Top clients actifs
- Factures récentes avec statuts
- Répartition des paiements (barres de progression)

### 📋 Factures
- Création avec numérotation automatique personnalisable
  - Format configurable : `FAC-{YEAR}-{NUM}`, `INV-{NUM}`, etc.
- **Recherche intelligente** : détecte les clients existants, propose d'en créer un sinon
- Calcul automatique : Poids (kg) × Prix/kg = Total
- Plusieurs articles par facture
- Modes de paiement : Cash, Orange Money, Wave, Mixte
- Statuts : Payé ✅ / Partiel 🟡 / Non payé ❌ (mis à jour automatiquement)
- **Reçu imprimable** avec logo, cachet et signature
- **Envoi direct WhatsApp**
- Filtres par statut, voyage, et recherche textuelle

### 👥 Clients
- Fiche client : Nom, Prénom, Téléphone, Adresse
- Recherche instantanée par nom ou numéro
- Statistiques par client (nb factures, CA total)
- Sélection automatique lors de la création d'une facture

### 🚌 Voyages
- Création de voyages avec date de départ
- **Association automatique** factures ↔ voyages
- Calcul en temps réel : Encaissé − Dépenses = Bénéfice
- Vue carte avec indicateurs financiers

### 💸 Dépenses
- Enregistrement des dépenses par voyage
- Calcul : Revenus totaux − Dépenses = Bénéfice réel
- Filtrage par voyage
- Sous-total automatique

### 📈 Statistiques
- Graphiques mensuels (BarChart + AreaChart)
- Répartition des factures (PieChart)
- Rentabilité par voyage (comparaison revenus/dépenses)
- Tableau de bord KPI : CA, Encaissé, Dépenses, Bénéfice

### ⚙️ Paramètres
- Infos entreprise (nom, téléphones, email, adresse, site web)
- Upload logo, signature numérique, cachet officiel
- Prix/kg configurable (par défaut 6 000 FCFA)
- Devise personnalisable (FCFA, XOF, EUR, USD, GNF...)
- Format de numérotation personnalisé
- 3 modèles de facture : Simple, Moderne, Professionnel
- Mode sombre / clair
- Couleur principale personnalisable

---

## 🎨 Design System

### Thèmes
| Élément | Mode sombre | Mode clair |
|---------|-------------|------------|
| Fond principal | `#0a0f1e` | `#f8fafc` |
| Cartes | `#141c2e` | `#ffffff` |
| Accent | `#f59e0b` | `#f59e0b` |

### Typographie
- **Titres** : Syne (Google Fonts) — Bold, Extrabold
- **Corps** : DM Sans (Google Fonts) — Regular, Medium, SemiBold

### Composants CSS prêts à l'emploi
```css
/* Boutons */
.btn .btn-primary .btn-secondary .btn-danger .btn-ghost .btn-sm .btn-icon

/* Badges */
.badge .badge-green .badge-red .badge-orange .badge-blue .badge-purple .badge-muted

/* Formulaires */
.form-group .form-label .form-input .form-select

/* Cartes et layout */
.card .stat-card .grid-2 .grid-3 .grid-4

/* Feedback */
.empty-state .alert .toast .skeleton
```

---

## 🗄️ Base de données (localStorage)

Toutes les données sont stockées en **localStorage** du navigateur, organisées par clés :

| Clé | Contenu |
|-----|---------|
| `ef_clients` | Liste des clients |
| `ef_factures` | Toutes les factures avec articles et paiements |
| `ef_voyages` | Voyages avec dates |
| `ef_depenses` | Dépenses liées aux voyages |
| `ef_parametres` | Configuration entreprise + préférences |
| `ef_seeded` | Flag pour éviter la re-génération des données démo |

> **Note :** Pour une version production avec backend Node.js + PostgreSQL (Neon Cloud), les appels `store.js` peuvent être remplacés par des appels API REST.

---

## 🔄 Migration vers backend Node.js + PostgreSQL

Cette application est conçue pour une migration facile vers un backend complet :

1. Remplacer les fonctions de `src/data/store.js` par des appels `fetch()` vers votre API
2. Utiliser les tables décrites dans le cahier des charges :
   - `users`, `clients`, `factures`, `articles_facture`
   - `paiements`, `voyages`, `depenses`, `parametres`
3. Ajouter une authentification JWT côté serveur

---

## 📱 Compatibilité

| Appareil | Support |
|----------|---------|
| Desktop (1200px+) | ✅ Complet |
| Tablet (768px-1200px) | ✅ Adaptatif |
| Mobile (< 768px) | ✅ Responsive |

---

## 📦 Dépendances principales

| Package | Version | Utilisation |
|---------|---------|-------------|
| `react` | 18.2 | Framework UI |
| `react-router-dom` | 6.x | Navigation SPA |
| `recharts` | 2.x | Graphiques (Area, Bar, Pie, Line) |
| `jspdf` + `jspdf-autotable` | — | Export PDF |
| `uuid` | 9.x | Génération d'IDs uniques |
| `date-fns` | 3.x | Manipulation des dates |

---

## 🛠️ Développement futur (roadmap)

- [ ] Backend Node.js + Express + API REST
- [ ] Base de données PostgreSQL (Neon Cloud)
- [ ] Authentification JWT (Admin / Employé)
- [ ] Export PDF haute qualité avec jsPDF
- [ ] QR Code sur chaque facture
- [ ] Mode PWA offline
- [ ] Notifications push (rappels de paiement)
- [ ] Multi-utilisateurs avec gestion des rôles
- [ ] Synchronisation cloud automatique

---

## 👨‍💻 Auteur

Projet **EasyFac v1.0** — Mars 2026  
Conçu pour le marché africain 🌍  
Stack : React.js · Node.js (prévu) · PostgreSQL (prévu)

---

## 📄 Licence

MIT License — Libre d'utilisation et de modification.
