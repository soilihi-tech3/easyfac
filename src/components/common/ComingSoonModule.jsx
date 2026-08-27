import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Lock, Sparkles, ArrowLeft, ShieldAlert } from 'lucide-react';
import './ComingSoonModule.css';

export default function ComingSoonModule({ moduleName = 'Cette fonctionnalité' }) {
  const navigate = useNavigate();

  return (
    <div className="coming-soon-container">
      <div className="coming-soon-card">
        {/* Glow decoration */}
        <div className="coming-soon-glow" />

        <div className="coming-soon-icon-wrapper">
          <div className="coming-soon-pulse-ring" />
          <Clock className="coming-soon-icon" size={44} />
          <Lock className="coming-soon-lock-badge" size={18} />
        </div>

        <div className="coming-soon-badge">
          <Sparkles size={13} />
          <span>Bientôt disponible</span>
        </div>

        <h1 className="coming-soon-title">
          {moduleName} est temporairement désactivé(e)
        </h1>

        <p className="coming-soon-description">
          Cette fonctionnalité a été suspendue ou mise en maintenance par la direction (Super Admin).
          Nos équipes travaillent pour la rendre disponible très prochainement.
        </p>

        <div className="coming-soon-notice-box">
          <ShieldAlert size={18} className="notice-icon" />
          <span>
            Merci de patienter. Pour toute urgence ou question d'accès, veuillez contacter votre administrateur principal.
          </span>
        </div>

        <button className="coming-soon-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          <span>Retour au tableau de bord</span>
        </button>
      </div>
    </div>
  );
}
