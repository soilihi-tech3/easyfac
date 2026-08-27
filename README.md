# EasyFac 🚀 — Logiciel de Facturation et Logistique Intelligent

> **EasyFac** est une application d'entreprise moderne et performante, conçue spécifiquement pour les agences de transit, de transport de colis et de logistique opérant entre l'Europe et l'Afrique. 

L'application intègre une architecture résiliente avec synchronisation hors-ligne (Offline Sync Engine), un convertisseur de devises dynamique en temps réel, et un module d'automatisation des relances et d'envoi de factures via WhatsApp Web.

---

## 📋 Table des matières
1. [Fonctionnalités Clés](#-fonctionnalités-clés)
2. [Architecture Technique](#-architecture-technique)
3. [Installation & Démarrage Rapide](#-installation--démarrage-rapide)
4. [Documentation d'Intégration WhatsApp (Étape par Étape)](#-documentation-dintégration-whatsapp-étape-par-étape)
5. [Système Multi-Devises en Temps Réel](#-système-multi-devises-en-temps-réel)
6. [Structure du Projet](#-structure-du-projet)
7. [Base de Données & Modèle de Synchronisation](#-base-de-données--modèle-de-synchronisation)
8. [Déploiement en Production](#-déploiement-en-production)

---

## ✨ Fonctionnalités Clés

- **Tableau de Bord Exécutif** : Visualisation en temps réel du Chiffre d'Affaires (CA), des montants encaissés, des restes à payer, du bénéfice net (recettes - dépenses), et graphiques financiers interactifs (AreaChart, BarChart).
- **Gestion des Factures & Colis** :
  - Création de factures avec calcul automatique à partir du poids (Poids kg × Prix/kg = Frais de Fret).
  - Numérotation automatique hautement personnalisable (ex: `FAC-{YEAR2}-{NUM2}`).
  - Modèle de règlement mixte (versement partiel en Europe / solde réglable aux Comores ou en Afrique de l'Ouest).
- **Rapports & Reçus Professionnels** : Génération de reçus avec logo personnalisé, cachet et signature numérique, déclinés en 3 styles modernes (Simple, Moderne, Professionnel) et imprimables au format PDF.
- **Gestion des Voyages (Transits)** : Regroupement des factures par voyage pour analyser la rentabilité globale en déduisant les dépenses opérationnelles de fret.
- **Relances & Communications Automatisées** : Module WhatsApp permettant de notifier les clients individuellement ou d'envoyer des communiqués groupés.

---

## 💻 Architecture Technique

Le projet repose sur une stack robuste et optimisée pour une expérience utilisateur rapide et fluide :
- **Frontend** : React.js (v18), React Router (v6), Recharts (graphiques), Lucide Icons.
- **Design System** : CSS Vanilla premium (Glassmorphism, animations fluides, support Dark/Light mode automatique, couleurs personnalisables).
- **Backend** : Node.js (Express), API REST sécurisée par authentification JWT.
- **Base de Données** : MySQL avec pool de connexions optimisé.
- **Moteur d'automatisation** : Puppeteer + `whatsapp-web.js` pour piloter des instances WhatsApp isolées par boutique (Multi-tenant).
- **Moteur Offline** : Système de file d'attente (Sync Queue) et mise en cache `localStorage` côté client pour une résilience en cas de coupure réseau.

---

## 🚀 Installation & Démarrage Rapide


### 3. Installation des Dépendances
Installez les dépendances pour la partie client et la partie serveur :
```bash
# À la racine (frontend)
npm install

# Dans le dossier backend
cd backend
npm install
cd ..
```

### 4. Lancement en Mode Développement

```bash
# Démarrer le backend (Port 3001)
cd backend
npm start

# Dans un autre terminal, démarrer le frontend (Port 3000)
npm run dev
```

---

## 💬 Documentation d'Intégration WhatsApp (Étape par Étape)

L'intégration WhatsApp utilise une instance automatisée de navigateur web sans tête (Headless Chrome) pilotée par Puppeteer et `whatsapp-web.js`. Ce système est entièrement **multi-tenant** : chaque boutique configure et connecte son propre numéro de téléphone de manière 100% isolée.

### Étape 1 : Préparation du serveur (Dépendances Puppeteer)
Sur les serveurs Linux ou dans les conteneurs Docker (VPS, Render, AWS), Puppeteer nécessite l'installation préalable de certaines dépendances système pour exécuter Chrome :
```bash
sudo apt-get update && sudo apt-get install -y \
  gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
  libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 \
  libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
  libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
  libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
  libappindicator1 libnss3 lsb-release xdg-utils wget libgbm-dev
```

### Étape 2 : Connexion de votre compte WhatsApp
Dans l'application EasyFac, accédez à la page **Paramètres** ⚙️, puis dans la section **WhatsApp**, vous disposez de deux méthodes de connexion sécurisées :

#### Option A : Connexion par QR Code (Méthode Classique)
1. Cliquez sur **Générer le QR Code**.
2. Sur l'application WhatsApp de votre téléphone, ouvrez le menu et allez dans **Appareils connectés** > **Connecter un appareil**.
3. Scannez le QR Code affiché sur l'écran d'EasyFac. La détection et la synchronisation s'effectuent en temps réel.

#### Option B : Connexion par Code d'Association (Méthode Recommandée)
1. Saisissez votre numéro de téléphone au format international (ex: `2693345678` pour les Comores, ou `221711692537` pour le Sénégal). *N'ajoutez pas le symbole `+`*.
2. Cliquez sur **Générer le code d'association**.
3. Attendez quelques secondes. L'application va afficher un code à 8 caractères (ex: `AB34-XY78`).
4. Sur votre téléphone, ouvrez WhatsApp > **Appareils connectés** > **Connecter un appareil** > **Associer avec le numéro de téléphone plutôt**.
5. Saisissez le code de 8 caractères fourni par EasyFac.

Une fois connecté, le statut passera à **CONNECTÉ** avec indication du numéro associé. La session sera sauvegardée dans le dossier `backend/.wwebjs_auth/session-{boutiqueId}` pour éviter d'avoir à vous reconnecter lors des redémarrages du serveur.

### Étape 3 : Fonctionnalités d'Automatisation WhatsApp

#### 1. Envoi Instantané de Facture (PDF)
Depuis le modal de visualisation de facture (Reçu), cliquez sur **Envoyer par WhatsApp**.
- Le serveur génère le PDF à la volée.
- Il convertit le fichier en base64 via `MessageMedia`.
- L'instance WhatsApp de la boutique envoie le document directement au numéro du client avec un message d'accompagnement personnalisé.

#### 2. Rappels Automatiques Quotidiens (Cron Job)
Un job récurrent (`cron`) s'exécute en arrière-plan toutes les 5 minutes au niveau du serveur.
- Il filtre les factures avec des statuts **Impayé** ou **Partiel**.
- Il génère automatiquement le message de relance récapitulant le solde restant à payer (dans la bonne devise).
- Si le client a choisi le règlement aux Comores, le rappel mentionne automatiquement l'équivalent converti en Franc Comorien (KMF).
- Le message est transmis de manière invisible sans action humaine requise.

---

## 💱 Système Multi-Devises en Temps Réel

EasyFac intègre un système d'affichage et de saisie multi-devises transparent :
- **Devises gérées** : FCFA, EUR, USD, KMF (Franc Comorien).
- **Consistance Financière** : Toutes les données financières stockées en base de données MySQL restent écrites dans la devise par défaut de la boutique (ex: `FCFA`), assurant la cohérence et l'intégrité des rapports financiers globaux.
- **Conversion In-Memory** : Lors du chargement ou de la sauvegarde, le cache et le store traduisent automatiquement les montants selon les taux de change à l'instant T.
- **Taux de change en temps réel** : Les taux sont récupérés de l'API externe `open.er-api.com/v6/latest/USD`, via un proxy backend avec cache de 12 heures pour contourner les limitations de requêtes (rate limits) et assurer un temps de chargement instantané.

---

## 🗂️ Structure du Projet

```
easyfac/
├── backend/
│   ├── services/
│   │   ├── exchangeRates.js    # Calculs et cache des taux de change
│   │   └── whatsappClient.js   # Gestionnaire multi-tenant WhatsApp Web (Puppeteer)
│   ├── routes/
│   │   └── whatsapp.js         # Endpoints de contrôle WhatsApp
│   ├── schema.sql              # Modèle de données MySQL
│   └── server.js               # Serveur API principal Node.js
├── src/
│   ├── index.js                # Point d'entrée React
│   ├── App.jsx                 # Routage principal
│   ├── index.css               # Design system et jetons CSS
│   ├── context/
│   │   ├── AppContext.jsx      # Suivi de la devise d'affichage et des taux
│   │   └── AuthContext.jsx     # Session utilisateur & Rôles
│   ├── data/
│   │   └── store.js            # Intercepteur & Synchroniseur de base de données
│   └── components/
│       ├── layout/
│       │   └── Layout.jsx      # Structure globale & Sélecteur de devise
│       ├── factures/
│       │   ├── Factures.jsx    # Tableaux de bord de facturation
│       │   ├── FactureModal.jsx# Formulaire et conversion de colis
│       │   └── ReceiptModal.jsx# Impression de reçus et envoi WhatsApp
│       └── parametres/
│           └── Parametres.jsx  # Configuration des boutiques
```

---

## 🗄️ Base de Données & Modèle de Synchronisation

En cas d'utilisation hors-ligne :
1. Les actions utilisateur (création client, facture, dépenses) sont enregistrées localement dans le cache du navigateur (`localStorage`) et résolues instantanément dans la devise active.
2. Les requêtes en attente sont empilées dans une file d'attente de synchronisation (`ef_sync_queue`).
3. Dès que la connexion réseau est rétablie, les opérations sont dépilées séquentiellement vers le serveur backend de manière transparente.

---

## 📦 Déploiement en Production

### 1. Build Client
Générez le bundle React optimisé :
```bash
npm run build
```
Les fichiers du dossier `/build` peuvent être servis par le serveur Express (`server.js`) ou via un CDN/Nginx.

### 2. Déploiement Cloud (VPS / Docker)
Le projet contient un fichier Dockerfile prêt pour un déploiement cloud (Render, Heroku, VPS). Assurez-vous simplement que le conteneur dispose des dépendances pour Google Chrome décrites à l'étape WhatsApp.

---

## 📄 Licence

Ce projet est sous licence **MIT** — Libre d'utilisation et de modification pour vos besoins commerciaux.

