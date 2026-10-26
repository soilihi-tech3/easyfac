import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../data/store';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverWakingUp, setServerWakingUp] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
      return;
    }

    // Silently pre-warm backend connection so TLS and DNS are ready when user taps submit
    try {
      fetch(`${API_URL}/api/ping`, { method: 'GET', keepalive: true }).catch(() => {});
      fetch('/api/ping', { method: 'GET', keepalive: true }).catch(() => {});
    } catch (_) {}
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setServerWakingUp(false);
    setStatusMessage('Connexion en cours...');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Timer 1: Reassure user after 3.5s
    const timer1 = setTimeout(() => {
      setServerWakingUp(true);
      setStatusMessage('Le serveur démarre... Veuillez patienter.');
    }, 3500);

    // Timer 2: Reassure slow mobile data users after 15s
    const timer2 = setTimeout(() => {
      setStatusMessage('Connexion mobile en cours... Finalisation de la session, merci de patienter.');
    }, 15000);

    // Timer 3: After 30s
    const timer3 = setTimeout(() => {
      setStatusMessage('Réseau mobile lent détecté. Maintien de la connexion en cours...');
    }, 30000);

    const clearAllTimers = () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };

    // Candidate URLs: first direct to Render, then fallback to Vercel proxy
    const endpoints = [
      `${API_URL}/api/auth/login`,
      `/api/auth/login`
    ];

    let lastError = null;

    for (let i = 0; i < endpoints.length; i++) {
      const url = endpoints[i];
      if (i > 0) {
        setStatusMessage('Nouvelle tentative via route sécurisée...');
      }

      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            try { if (controller) controller.abort(); } catch (_) {}
            const err = new Error('timeout');
            err.name = 'AbortError';
            reject(err);
          }, 45000); // 45s per endpoint
        });

        const res = await Promise.race([
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
            ...(controller ? { signal: controller.signal } : {})
          }),
          timeoutPromise
        ]);

        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Le serveur est temporairement indisponible.');
        }

        const data = await res.json();

        if (!res.ok) {
          // If explicit credentials error, do not retry other endpoint!
          throw new Error(data.error || 'Erreur de connexion');
        }

        clearAllTimers();
        login(data.user, data.token);
        navigate('/', { replace: true });
        return; // Success!
      } catch (err) {
        lastError = err;
        // If wrong credentials, stop immediately and show error
        if (err.message && (err.message.includes('Identifiants incorrects') || err.message.includes('désactivé') || err.message.includes('maintenance'))) {
          break;
        }
        console.warn(`Connection to ${url} failed, trying next route if available:`, err.message);
      }
    }

    clearAllTimers();
    setLoading(false);
    setServerWakingUp(false);
    setStatusMessage('');

    if (lastError?.name === 'AbortError') {
      setError("La connexion mobile met trop de temps à répondre. Le serveur vient de se réveiller : veuillez réappuyer sur 'Se connecter'.");
    } else if (lastError instanceof TypeError || /fetch|network/i.test(lastError?.message || '')) {
      setError("Impossible de joindre le serveur avec la qualité actuelle du réseau mobile. Veuillez réappuyer sur 'Se connecter' pour réessayer.");
    } else {
      setError(lastError?.message || 'Erreur de connexion au serveur');
    }
  };

  const handleDemoLogin = () => {
    setEmail('admin@easyfac.com');
    setPassword('admin123');
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    }, 100);
  };

  return (
    <div className="login-container">
      {/* Premium organic liquid blobs behind the card */}
      <div className="login-blobs-container">
        <div className="login-blob blob-blue"></div>
        <div className="login-blob blob-teal"></div>
        <div className="login-blob blob-gold"></div>
      </div>

      <div className="login-card">
        {/* Brand Logo inside a teal/cyan circle ring */}
        <div className="login-logo-container">
          <div className="login-brand-ring">
            <img src="/logo.jpg" alt="easyfac" className="login-logo-img" />
          </div>
        </div>

        {/* Clean Header Title */}
        <h2 className="login-welcome-title">Bienvenue</h2>
        <p className="login-welcome-subtitle">Connectez-vous à votre compte pour continuer</p>

        {error && (
          <div className={`login-error-alert ${error.includes('administrateur') ? 'warning' : ''}`}>
            <AlertCircle size={17} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {serverWakingUp && !error && (
          <div className="login-error-alert warning" style={{ borderColor: 'var(--brand)', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--text-main, #1e293b)' }}>
            <AlertCircle size={17} style={{ flexShrink: 0, color: 'var(--brand, #2563eb)' }} />
            <span style={{ fontSize: '0.85rem' }}>{statusMessage || 'Le serveur démarre (mise en route après inactivité)... Veuillez patienter.'}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {/* Email field with baseline underline */}
          <div className="login-form-group">
            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <Mail size={18} />
              </span>
              <input
                type="email"
                className="login-input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Email Address"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>
          </div>

          {/* Password field with baseline underline */}
          <div className="login-form-group">
            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          {/* Submit button - rounded vibrant blue */}
          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (statusMessage || 'Connexion en cours...') : 'Se connecter'}
          </button>
        </form>

        {/* Minimal Centered Forgot Password Link */}
        <div className="login-forgot-wrapper">
          <a
            href="#forgot"
            className="login-forgot-link-centered"
            onClick={(e) => {
              e.preventDefault();
              setError('Pour des raisons de sécurité, veuillez contacter votre administrateur pour réinitialiser votre mot de passe.');
            }}
          >
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}

