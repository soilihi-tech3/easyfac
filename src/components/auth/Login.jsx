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

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setServerWakingUp(false);

    // Render.com free tier cold start can take up to 45-60s
    // Show a reassuring notice after 3.5s so user knows it is waking up
    const wakingTimer = setTimeout(() => {
      setServerWakingUp(true);
    }, 3500);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      clearTimeout(wakingTimer);

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Le serveur backend est en cours de réveil ou indisponible. Veuillez patienter quelques secondes et réessayer.');
      }

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erreur de connexion');

      login(data.user, data.token);
      navigate('/', { replace: true });
    } catch (err) {
      clearTimeout(timeoutId);
      clearTimeout(wakingTimer);
      if (err.name === 'AbortError') {
        setError('Le serveur ou votre connexion met trop de temps à répondre. Si le serveur était en veille, il vient de se réveiller. Veuillez réappuyer sur Se connecter.');
      } else {
        setError(err.message || 'Erreur de connexion au serveur');
      }
    } finally {
      setLoading(false);
      setServerWakingUp(false);
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
            <span style={{ fontSize: '0.85rem' }}>Le serveur démarre (mise en route après inactivité)... Veuillez patienter un instant.</span>
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
            {loading ? (serverWakingUp ? 'Démarrage du serveur...' : 'Connexion en cours...') : 'Se connecter'}
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

