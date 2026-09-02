import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, MoreVertical, CheckCircle2, X, Sparkles, Laptop } from 'lucide-react';
import './PwaInstallPrompt.css';

export default function PwaInstallPrompt({ isOpen, onClose }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e) => setIsStandalone(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    // 2. Detect OS / Device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const androidDevice = /android/.test(userAgent);
    setIsIOS(iosDevice);
    setIsAndroid(androidDevice);

    // 3. Catch beforeinstallprompt event for Android / Chrome / Edge / Desktop
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Do not render anything if already running as standalone app or already installed in session
  if (isStandalone || installed || !isOpen) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      if (onClose) onClose();
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="pwa-modal-overlay" onClick={onClose}>
      <div className="pwa-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pwa-modal-header">
          <div className="pwa-app-brand">
            <img src="/logo.jpg" alt="EasyFac Logo" className="pwa-app-icon" />
            <div>
              <div className="pwa-app-title">
                Installer <span>EasyFac</span>
              </div>
              <span className="pwa-badge">
                <Sparkles size={11} /> Easyfac
              </span>
            </div>
          </div>
          <button className="pwa-close-btn" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="pwa-modal-body">
          <p className="pwa-intro-text">
            Installez EasyFac directement sur votre téléphone ou ordinateur pour un accès instantané, rapide et utilisable même hors-ligne !
          </p>

          {/* 1. Android / Desktop with 1-Click Native Prompt */}
          {deferredPrompt && (
            <div className="pwa-one-click-box">
              <div className="pwa-one-click-desc">
                <Smartphone size={22} className="pwa-icon-accent" />
                <div>
                  <strong>Installation en 1 clic disponible !</strong>
                  <p>Appuyez ci-dessous pour ajouter l'application à votre écran d'accueil.</p>
                </div>
              </div>
              <button className="btn btn-primary btn-lg pwa-install-btn" onClick={handleInstallClick}>
                <Download size={18} /> Installer l'application EasyFac
              </button>
            </div>
          )}

          {/* 2. iPhone / iPad (iOS) Specific Tutorial */}
          {isIOS && (
            <div className="pwa-tutorial-section ios">
              <div className="pwa-tutorial-title">
                <Smartphone size={18} /> Comment installer sur iPhone / iPad (Safari) :
              </div>
              <div className="pwa-steps-list">
                <div className="pwa-step-item">
                  <div className="pwa-step-num">1</div>
                  <div className="pwa-step-content">
                    Appuyez sur le bouton <strong>Partager</strong> <Share size={15} className="pwa-inline-icon share" /> en bas de l'écran (barre Safari).
                  </div>
                </div>
                <div className="pwa-step-item">
                  <div className="pwa-step-num">2</div>
                  <div className="pwa-step-content">
                    Faites défiler le menu vers le bas et appuyez sur <strong>« Sur l'écran d'accueil »</strong> <PlusSquare size={15} className="pwa-inline-icon add" />.
                  </div>
                </div>
                <div className="pwa-step-item">
                  <div className="pwa-step-num">3</div>
                  <div className="pwa-step-content">
                    Appuyez sur <strong>« Ajouter »</strong> en haut à droite pour valider.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Android / Chrome Tutorial (When native 1-click is not triggered) */}
          {!deferredPrompt && !isIOS && (
            <div className="pwa-tutorial-section android">
              <div className="pwa-tutorial-title">
                {isAndroid ? <Smartphone size={18} /> : <Laptop size={18} />} Comment installer sur {isAndroid ? 'Android (Chrome)' : 'Navigateur Web'} :
              </div>
              <div className="pwa-steps-list">
                <div className="pwa-step-item">
                  <div className="pwa-step-num">1</div>
                  <div className="pwa-step-content">
                    Cliquez sur le menu de votre navigateur (<strong>les 3 points <MoreVertical size={15} className="pwa-inline-icon" /></strong> en haut à droite).
                  </div>
                </div>
                <div className="pwa-step-item">
                  <div className="pwa-step-num">2</div>
                  <div className="pwa-step-content">
                    Sélectionnez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.
                  </div>
                </div>
                <div className="pwa-step-item">
                  <div className="pwa-step-num">3</div>
                  <div className="pwa-step-content">
                    Confirmez en appuyant sur <strong>« Installer »</strong>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="pwa-benefits-row">
            <div className="pwa-benefit">
              <CheckCircle2 size={14} className="pwa-check" /> Chargement instantané
            </div>
            <div className="pwa-benefit">
              <CheckCircle2 size={14} className="pwa-check" /> Mode hors-ligne
            </div>
            <div className="pwa-benefit">
              <CheckCircle2 size={14} className="pwa-check" /> Sans store d'application
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pwa-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
