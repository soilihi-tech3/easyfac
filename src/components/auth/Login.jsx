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
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Le serveur backend est en cours de réveil ou indisponible. Veuillez patienter quelques secondes et réessayer.');
      }

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erreur de connexion');

      login(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('admin@easyfac.com');
    setPassword('admin123');
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
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
            {loading ? 'Connexion en cours...' : 'Se connecter'}
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

