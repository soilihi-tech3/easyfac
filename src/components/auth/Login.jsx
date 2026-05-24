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
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
      
      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
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
      <div className="login-card">
        {/* Brand Logo centered */}
        <div className="login-logo-container">
          <img src="/logo.jpg" alt="easyfac" className="login-logo-img" />
        </div>

        {/* Header Texts */}
        <div className="login-header-group">
          <h2 className="login-welcome-title">Bon retour !</h2>
          <p className="login-welcome-subtitle">Connectez-vous à votre compte pour continuer.</p>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertCircle size={17} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email field */}
          <div className="login-form-group">
            <label className="login-input-label">Adresse Email</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <Mail size={16} />
              </span>
              <input
                type="email"
                className="login-input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password field with Label and Forgot Password link next to it */}
          <div className="login-form-group">
            <div className="login-label-row">
              <label className="login-input-label">Mot de passe</label>
              <a
                href="#forgot"
                className="login-forgot-link"
                onClick={(e) => {
                  e.preventDefault();
                  setError('Veuillez contacter votre administrateur pour réinitialiser votre mot de passe.');
                }}
              >
                Mot de passe oublié ?
              </a>
            </div>
            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Mot de passe"
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

          {/* Remember me Checkbox */}
          <div className="login-extra-row">
            <label className="login-remember-wrap">
              <input
                type="checkbox"
                className="login-checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span className="login-remember-text">Se souvenir de moi</span>
            </label>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="login-divider-container">
          <div className="login-divider-line" />
          <span className="login-divider-text">OU</span>
          <div className="login-divider-line" />
        </div>

        {/* Demo Option */}
        <button
          type="button"
          className="login-alternative-btn"
          onClick={handleDemoLogin}
          disabled={loading}
        >
          Se connecter avec le compte Démo
        </button>

        {/* Signup / Contact prompt */}
        <p className="login-signup-prompt">
          Pas encore de compte ?
          <a
            href="#admin"
            className="login-signup-link"
            onClick={(e) => {
              e.preventDefault();
              setError("Les comptes d'accès sont gérés par votre administrateur.");
            }}
          >
            Contacter l'administrateur
          </a>
        </p>
      </div>
    </div>
  );
}

