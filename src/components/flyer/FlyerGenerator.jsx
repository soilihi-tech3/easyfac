import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import {
  Download, ArrowRightLeft, Plane, MapPin, Phone,
  Calendar, DollarSign, Sparkles, RefreshCw, Upload, AlertTriangle, Info, Image as ImageIcon, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './FlyerGenerator.css';

// SVG Flag Components
const SVGFlags = {
  senegal: (
    <svg viewBox="0 0 900 600" className="flag-svg">
      <rect width="300" height="600" fill="#00853F" />
      <rect x="300" width="300" height="600" fill="#FDEF42" />
      <rect x="600" width="300" height="600" fill="#E31B23" />
      <polygon points="450,230 473,300 547,300 487,343 510,413 450,370 390,413 413,343 353,300 427,300" fill="#00853F" />
    </svg>
  ),
  comores: (
    <svg viewBox="0 0 900 600" className="flag-svg">
      <rect width="900" height="150" y="0" fill="#FFC61E" />
      <rect width="900" height="150" y="150" fill="#FFFFFF" />
      <rect width="900" height="150" y="300" fill="#CE1126" />
      <rect width="900" height="150" y="450" fill="#3B5998" />
      <polygon points="0,0 450,300 0,600" fill="#009639" />
      <path d="M 120,300 A 90,90 0 1,0 230,225 A 75,75 0 1,1 120,300 Z" fill="#FFFFFF" />
      <polygon points="190,210 197,230 218,230 201,242 207,262 190,250 173,262 179,242 162,230 183,230" fill="#FFFFFF" />
      <polygon points="190,265 197,285 218,285 201,297 207,317 190,305 173,317 179,297 162,285 183,285" fill="#FFFFFF" />
      <polygon points="190,320 197,340 218,340 201,352 207,372 190,360 173,372 179,352 162,340 183,340" fill="#FFFFFF" />
      <polygon points="190,375 197,395 218,395 201,407 207,427 190,415 173,427 179,407 162,395 183,395" fill="#FFFFFF" />
    </svg>
  ),
  france: (
    <svg viewBox="0 0 900 600" className="flag-svg">
      <rect width="300" height="600" fill="#002395" />
      <rect x="300" width="300" height="600" fill="#FFFFFF" />
      <rect x="600" width="300" height="600" fill="#ED2939" />
    </svg>
  ),
  cote_ivoire: (
    <svg viewBox="0 0 900 600" className="flag-svg">
      <rect width="300" height="600" fill="#F77F00" />
      <rect x="300" width="300" height="600" fill="#FFFFFF" />
      <rect x="600" width="300" height="600" fill="#009E60" />
    </svg>
  ),
  mali: (
    <svg viewBox="0 0 900 600" className="flag-svg">
      <rect width="300" height="600" fill="#14B53A" />
      <rect x="300" width="300" height="600" fill="#FCD116" />
      <rect x="600" width="300" height="600" fill="#CE1126" />
    </svg>
  ),
  guinee: (
    <svg viewBox="0 0 900 600" className="flag-svg">
      <rect width="300" height="600" fill="#CE1126" />
      <rect x="300" width="300" height="600" fill="#FCD116" />
      <rect x="600" width="300" height="600" fill="#009460" />
    </svg>
  ),
  cameroun: (
    <svg viewBox="0 0 900 600" className="flag-svg">
      <rect width="300" height="600" fill="#007A5E" />
      <rect x="300" width="300" height="600" fill="#CE1126" />
      <rect x="600" width="300" height="600" fill="#FCD116" />
      <polygon points="450,250 465,295 512,295 474,323 489,368 450,340 411,368 426,323 388,295 435,295" fill="#FCD116" />
    </svg>
  )
};

const COUNTRY_OPTIONS = [
  { code: 'senegal', name: 'Sénégal (Dakar)', defaultCity: 'DAKAR', defaultPhone1: '+221 77 456 58 77', defaultPhone2: '+221 33 821 00 00' },
  { code: 'comores', name: 'Comores (Moroni)', defaultCity: 'MORONI', defaultPhone1: '+269 46 38 315', defaultPhone2: '+269 33 21 000' },
  { code: 'france', name: 'France (Paris)', defaultCity: 'PARIS', defaultPhone1: '+33 6 12 34 56 78', defaultPhone2: '' },
  { code: 'cote_ivoire', name: "Côte d'Ivoire (Abidjan)", defaultCity: 'ABIDJAN', defaultPhone1: '+225 07 08 09 10', defaultPhone2: '' },
  { code: 'mali', name: 'Mali (Bamako)', defaultCity: 'BAMAKO', defaultPhone1: '+223 70 12 34 56', defaultPhone2: '' },
  { code: 'guinee', name: 'Guinée (Conakry)', defaultCity: 'CONAKRY', defaultPhone1: '+224 620 12 34 56', defaultPhone2: '' },
  { code: 'cameroun', name: 'Cameroun (Douala)', defaultCity: 'DOUALA', defaultPhone1: '+237 690 12 34 56', defaultPhone2: '' },
];

const AIRLINE_OPTIONS = [
  { code: 'ethiopian', name: 'Ethiopian Airlines', brandText: 'Ethiopian', c1: '#CE1126', c2: '#FFC61E', c3: '#00853F' },
  { code: 'kenya', name: 'Kenya Airways', brandText: 'Kenya Airways', c1: '#E4002B', c2: '#000000', c3: '#008751' },
  { code: 'air_france', name: 'Air France', brandText: 'AIR FRANCE', c1: '#002157', c2: '#ED2939', c3: '#002157' },
  { code: 'ram', name: 'Royal Air Maroc', brandText: 'Royal Air Maroc', c1: '#C1272D', c2: '#006233', c3: '#C1272D' },
];

export default function FlyerGenerator() {
  const { user } = useAuth();
  let permissions = {};
  if (user?.permissions) {
    try {
      permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {}
  }

  if (user?.role === 'employee' && !permissions.voirFlyer) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Accès non autorisé</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>Vous ne disposez pas des droits d'accès requis pour utiliser le générateur de flyer.</p>
      </div>
    );
  }

  const flyerRef = useRef(null);
  const fileInputRef = useRef(null);
  const airlineFileInputRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Template State ('template1' | 'template2' | 'template3' | 'custom')
  const [templateId, setTemplateId] = useState('template1');
  const [customBgImage, setCustomBgImage] = useState(null);
  const [previewZoom, setPreviewZoom] = useState('fit');

  // Airline Selection & Sizing State
  const [selectedAirlineKey, setSelectedAirlineKey] = useState('custom');
  const [customAirlineLogo, setCustomAirlineLogo] = useState(null);
  const [planeScale, setPlaneScale] = useState(105);
  const [planePosY, setPlanePosY] = useState(-5);
  const [planeGlow, setPlaneGlow] = useState(true);

  // Form Fields
  const [departVille, setDepartVille] = useState('DAKAR');
  const [departFlagKey, setDepartFlagKey] = useState('senegal');
  const [departTel1, setDepartTel1] = useState('+221 77 456 58 77');
  const [departTel2, setDepartTel2] = useState('+221 33 821 00 00');

  const [destVille, setDestVille] = useState('MORONI');
  const [destFlagKey, setDestFlagKey] = useState('comores');
  const [destTel1, setDestTel1] = useState('+269 46 38 315');
  const [destTel2, setDestTel2] = useState('+269 33 21 000');

  const [dateDepot, setDateDepot] = useState('27 AOÛT');
  const [dateDepart, setDateDepart] = useState('28 AOÛT');
  const [prixKg, setPrixKg] = useState('6 000 CFA');

  // Red Warning Message & Information Fields
  const [avertissement, setAvertissement] = useState('⚠️ Colis déposés avant 18h00 maximum !');
  const [infoComplementaire, setInfoComplementaire] = useState('✈️ Vol direct sans escale — Service garanti 100% sécurisé');

  const [titreCompagnie, setTitreCompagnie] = useState('EXPRESS TERANGA BUSINESS');
  const [sousTitre, setSousTitre] = useState('VENTE DE KILOS');

  const [adresse1, setAdresse1] = useState('FANN HOCK CANAL VI');
  const [adresse2, setAdresse2] = useState('PHARMACIE FANN HOK');
  const [adresse3, setAdresse3] = useState('MORONI EGT');

  // Swap Departure <-> Destination (Cities, Flags, 2 Phone Numbers)
  const handleSwap = () => {
    setDepartVille(destVille);
    setDestVille(departVille);

    setDepartFlagKey(destFlagKey);
    setDestFlagKey(departFlagKey);

    setDepartTel1(destTel1);
    setDestTel1(departTel1);

    setDepartTel2(destTel2);
    setDestTel2(departTel2);
  };

  // Selection of Preset Countries
  const handleSelectDepartCountry = (code) => {
    const country = COUNTRY_OPTIONS.find(c => c.code === code);
    if (country) {
      setDepartFlagKey(country.code);
      setDepartVille(country.defaultCity);
      setDepartTel1(country.defaultPhone1);
      setDepartTel2(country.defaultPhone2 || '');
    }
  };

  const handleSelectDestCountry = (code) => {
    const country = COUNTRY_OPTIONS.find(c => c.code === code);
    if (country) {
      setDestFlagKey(country.code);
      setDestVille(country.defaultCity);
      setDestTel1(country.defaultPhone1);
      setDestTel2(country.defaultPhone2 || '');
    }
  };

  // Custom Image Upload Handler
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setCustomBgImage(uploadEvent.target.result);
        setTemplateId('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  // Custom Airline Image Upload
  const handleAirlineUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setCustomAirlineLogo(uploadEvent.target.result);
        setSelectedAirlineKey('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  // Export Canvas to JPEG Download
  const handleDownloadJPEG = async () => {
    if (!flyerRef.current) return;
    setDownloading(true);

    try {
      const element = flyerRef.current;
      const canvas = await html2canvas(element, {
        scale: 3, // High-res HD quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0d1627',
        logging: false
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `Flyer_${departVille.replace(/\s+/g, '_')}_A_${destVille.replace(/\s+/g, '_')}.jpg`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Erreur de génération du flyer:', err);
      alert('Erreur lors du téléchargement du flyer. Veuillez réessayer.');
    } finally {
      setDownloading(false);
    }
  };

  const currentAirline = AIRLINE_OPTIONS.find(a => a.code === selectedAirlineKey) || AIRLINE_OPTIONS[0];

  return (
    <div className="flyer-generator-container">
      {/* Header Bar */}
      <div className="flyer-page-header">
        <div>
          <h2>Générateur de Flyer Promo Pro</h2>
          <p>Personnalisez les vols, dates, tarifs et téléchargez en un clic votre flyer HD.</p>
        </div>
        <button
          className="flyer-download-main-btn"
          onClick={handleDownloadJPEG}
          disabled={downloading}
        >
          {downloading ? (
            <>
              <RefreshCw size={18} className="spin-icon" />
              Génération en cours...
            </>
          ) : (
            <>
              <Download size={18} />
              Télécharger le Flyer (JPEG)
            </>
          )}
        </button>
      </div>

      {/* Template Selector Bar */}
      <div className="template-selector-card">
        <span className="template-selector-label">🎨 Modèles de Flyer au choix :</span>
        <div className="template-grid-buttons">
          <button
            type="button"
            className={`template-btn ${templateId === 'template1' ? 'active' : ''}`}
            onClick={() => setTemplateId('template1')}
          >
            <span className="tpl-badge">1</span> ✈️ Teranga Air (Original)
          </button>

          <button
            type="button"
            className={`template-btn ${templateId === 'template2' ? 'active' : ''}`}
            onClick={() => setTemplateId('template2')}
          >
            <span className="tpl-badge">2</span> ⚡ Néon Cyber Cargo
          </button>

          <button
            type="button"
            className={`template-btn ${templateId === 'template3' ? 'active' : ''}`}
            onClick={() => setTemplateId('template3')}
          >
            <span className="tpl-badge">3</span> 🌟 Doré Prestige Promo
          </button>

          <button
            type="button"
            className={`template-btn custom-upload-btn ${templateId === 'custom' ? 'active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} /> 🖼️ {customBgImage ? 'Changer mon Image' : 'Importer mon Arrière-plan'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="flyer-workspace">
        {/* Left Side: Control Form Panel */}
        <div className="flyer-controls-panel">
          {/* Airline / Vol Concerné Custom Upload & Positionment */}
          <div className="form-group-card airline-selector-box">
            <label className="form-card-label" style={{ color: '#0284c7' }}>
              ✈️ Image de l'Avion & Positionnement
            </label>
            <div>
              <span className="field-sublabel">Importer votre Photo d'Avion Personnalisée</span>
              <button
                type="button"
                className="btn-upload-airline"
                onClick={() => airlineFileInputRef.current?.click()}
                style={{ padding: '10px 14px', fontSize: '13px', justifyContent: 'center' }}
              >
                <Upload size={16} /> {customAirlineLogo ? '📷 Photo d\'Avion Importée (Cliquer pour changer)' : '📷 Uploader une Photo d\'Avion'}
              </button>
              <input
                type="file"
                ref={airlineFileInputRef}
                onChange={handleAirlineUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>

            {/* Sliders for Sizing & Positioning the Airplane */}
            <div className="plane-sliders-row" style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px dashed rgba(2, 132, 199, 0.3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="slider-group">
                <div className="slider-label-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  <span>Taille de l'avion :</span>
                  <b style={{ color: '#0284c7' }}>{planeScale}%</b>
                </div>
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={planeScale}
                  onChange={e => setPlaneScale(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#0284c7' }}
                />
              </div>

              <div className="slider-group">
                <div className="slider-label-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  <span>Hauteur (Haute / Basse) :</span>
                  <b style={{ color: '#0284c7' }}>{planePosY}px</b>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  value={planePosY}
                  onChange={e => setPlanePosY(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#0284c7' }}
                />
              </div>
            </div>
          </div>

          {/* Quick Swap Arrow Header */}
          <div className="controls-section-title">
            <span>Trajet & Pays</span>
            <button
              type="button"
              className="swap-route-btn"
              onClick={handleSwap}
              title="Inverser Départ <-> Destination"
            >
              <ArrowRightLeft size={16} />
              <span>Inverser Départ ⇆ Destination</span>
            </button>
          </div>

          {/* Departure Field (2 Phone Numbers) */}
          <div className="form-group-card">
            <label className="form-card-label">🛫 Départ (Origine)</label>
            <div className="form-row-2">
              <div>
                <span className="field-sublabel">Pays / Drapeau</span>
                <select
                  className="flyer-select-input"
                  value={departFlagKey}
                  onChange={e => handleSelectDepartCountry(e.target.value)}
                >
                  {COUNTRY_OPTIONS.map(c => (
                    <option key={`dep-${c.code}`} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="field-sublabel">Nom de la Ville</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={departVille}
                  onChange={e => setDepartVille(e.target.value.toUpperCase())}
                  placeholder="Ex: DAKAR"
                />
              </div>
            </div>
            <div className="form-row-2" style={{ marginTop: '10px' }}>
              <div>
                <span className="field-sublabel">Tél 1 WhatsApp (Départ)</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={departTel1}
                  onChange={e => setDepartTel1(e.target.value)}
                  placeholder="+221 77 456 58 77"
                />
              </div>
              <div>
                <span className="field-sublabel">Tél 2 (Départ - Optionnel)</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={departTel2}
                  onChange={e => setDepartTel2(e.target.value)}
                  placeholder="+221 33 821 00 00"
                />
              </div>
            </div>
          </div>

          {/* Destination Field (2 Phone Numbers) */}
          <div className="form-group-card">
            <label className="form-card-label">🛬 Destination (Arrivée)</label>
            <div className="form-row-2">
              <div>
                <span className="field-sublabel">Pays / Drapeau</span>
                <select
                  className="flyer-select-input"
                  value={destFlagKey}
                  onChange={e => handleSelectDestCountry(e.target.value)}
                >
                  {COUNTRY_OPTIONS.map(c => (
                    <option key={`dest-${c.code}`} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="field-sublabel">Nom de la Ville</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={destVille}
                  onChange={e => setDestVille(e.target.value.toUpperCase())}
                  placeholder="Ex: MORONI"
                />
              </div>
            </div>
            <div className="form-row-2" style={{ marginTop: '10px' }}>
              <div>
                <span className="field-sublabel">Tél 1 WhatsApp (Destination)</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={destTel1}
                  onChange={e => setDestTel1(e.target.value)}
                  placeholder="+269 46 38 315"
                />
              </div>
              <div>
                <span className="field-sublabel">Tél 2 (Destination - Optionnel)</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={destTel2}
                  onChange={e => setDestTel2(e.target.value)}
                  placeholder="+269 33 21 000"
                />
              </div>
            </div>
          </div>

          {/* Dates & Pricing */}
          <div className="form-group-card">
            <label className="form-card-label">📅 Dates & Tarif du Kilo</label>
            <div className="form-row-3">
              <div>
                <span className="field-sublabel">Dernier Dépôt</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={dateDepot}
                  onChange={e => setDateDepot(e.target.value)}
                  placeholder="27 AOÛT"
                />
              </div>
              <div>
                <span className="field-sublabel">Date de Départ</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={dateDepart}
                  onChange={e => setDateDepart(e.target.value)}
                  placeholder="28 AOÛT"
                />
              </div>
              <div>
                <span className="field-sublabel">Prix / Kilo</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={prixKg}
                  onChange={e => setPrixKg(e.target.value)}
                  placeholder="6 000 CFA"
                />
              </div>
            </div>
          </div>

          {/* Red Warning Banner & Information Fields */}
          <div className="form-group-card warning-card-box">
            <label className="form-card-label" style={{ color: '#ef4444' }}>
              <AlertTriangle size={15} /> Message d'Avertissement  & Info
            </label>
            <div>
              <span className="field-sublabel" style={{ color: '#f87171' }}>Avertissement Important</span>
              <input
                type="text"
                className="flyer-text-input red-input"
                value={avertissement}
                onChange={e => setAvertissement(e.target.value)}
                placeholder="⚠️ Colis déposés avant 18h maximum !"
              />
            </div>
            <div style={{ marginTop: '10px' }}>
              <span className="field-sublabel">Information Complémentaire</span>
              <input
                type="text"
                className="flyer-text-input"
                value={infoComplementaire}
                onChange={e => setInfoComplementaire(e.target.value)}
                placeholder="✈️ Vol direct sans escale — Service garanti"
              />
            </div>
          </div>

          {/* Branding & Footer Addresses */}
          <div className="form-group-card">
            <label className="form-card-label">🏢 En-tête & Adresses</label>
            <div className="form-row-2">
              <div>
                <span className="field-sublabel">Titre Marque</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={titreCompagnie}
                  onChange={e => setTitreCompagnie(e.target.value)}
                />
              </div>
              <div>
                <span className="field-sublabel">Sous-titre</span>
                <input
                  type="text"
                  className="flyer-text-input"
                  value={sousTitre}
                  onChange={e => setSousTitre(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <span className="field-sublabel">Adresses en bas (Séparées par |)</span>
              <div className="form-row-3">
                <input
                  type="text"
                  className="flyer-text-input"
                  value={adresse1}
                  onChange={e => setAdresse1(e.target.value)}
                />
                <input
                  type="text"
                  className="flyer-text-input"
                  value={adresse2}
                  onChange={e => setAdresse2(e.target.value)}
                />
                <input
                  type="text"
                  className="flyer-text-input"
                  value={adresse3}
                  onChange={e => setAdresse3(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Realtime HD Visual Preview Render Box */}
        <div className="flyer-preview-column">
          <div className="preview-header-bar">
            <span>Aperçu HD — <b>{templateId.toUpperCase()}</b></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                className="flyer-zoom-select"
                value={previewZoom}
                onChange={e => setPreviewZoom(e.target.value)}
                title="Taille d'affichage de l'aperçu"
              >
                <option value="fit">📱 Adapté à l'écran</option>
                <option value="100">🔍 100% HD (Scrollbar)</option>
                <option value="75">🔍 75% Zoom</option>
                <option value="50">🔍 50% Zoom</option>
              </select>
              <button className="btn-quick-download" onClick={handleDownloadJPEG} disabled={downloading}>
                <Download size={14} /> JPEG
              </button>
            </div>
          </div>

          <div className="flyer-scroll-hint-banner">
            <span>↔️ <b>Barre de Défilement Active</b> : Faites glisser de gauche à droite ou utilisez la barre ci-dessous pour voir l'intégralité du flyer HD.</span>
          </div>

          <div className={`flyer-frame-wrapper zoom-mode-${previewZoom}`}>
            <div className="flyer-artboard-scaler-container">
              {/* The Actual Render Canvas Card */}
              <div className={`flyer-artboard template-theme-${templateId}`} ref={flyerRef}>

              {/* Background Image / Render Graphic */}
              <div className="flyer-bg-overlay">
                {templateId === 'custom' && customBgImage ? (
                  <img src={customBgImage} alt="Custom Background" className="custom-bg-img" />
                ) : (
                  <>
                    <div className="flyer-sky-gradient"></div>
                    {/* SVG / Image Airplane Graphic Container */}
                    <div
                      className="plane-graphic-container"
                      style={{
                        transform: `translateY(${planePosY}px) scale(${planeScale / 100})`,
                        transformOrigin: 'center center',
                        filter: planeGlow ? 'drop-shadow(0 8px 20px rgba(0,0,0,0.8))' : 'none'
                      }}
                    >
                      {selectedAirlineKey === 'custom' && customAirlineLogo ? (
                        <img src={customAirlineLogo} alt="Airline Plane" className="custom-airline-img" />
                      ) : (
                        <svg viewBox="0 0 1000 400" className="plane-svg-bg">
                          <defs>
                            <linearGradient id="planeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                              <stop offset="100%" stopColor="#f1f5f9" stopOpacity="0.95" />
                            </linearGradient>
                            <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#e2e8f0" />
                              <stop offset="100%" stopColor="#94a3b8" />
                            </linearGradient>
                          </defs>

                          <g transform="translate(140, 20) rotate(-3) scale(1.2)">
                            {/* Tail Fin */}
                            <path d="M 680 120 L 735 15 L 785 15 L 735 130 Z" fill={currentAirline.c1} />
                            <path d="M 700 80 L 730 30 L 760 30 L 730 90 Z" fill={currentAirline.c2} />
                            <path d="M 715 60 L 735 40 L 750 40 L 730 70 Z" fill={currentAirline.c3} />

                            {/* Main Fuselage */}
                            <path d="M 90 160 Q 240 115 700 135 L 720 165 Q 240 172 90 160 Z" fill="url(#planeGrad)" stroke="#cbd5e1" strokeWidth="1" />
                            {/* Cockpit Window */}
                            <path d="M 110 150 Q 130 140 155 143 Q 140 153 110 150 Z" fill="#0f172a" />

                            {/* Windows Line */}
                            <line x1="180" y1="146" x2="650" y2="146" stroke="#1e293b" strokeWidth="3" strokeDasharray="6,4" opacity="0.7" />

                            {/* Main Wings */}
                            <path d="M 370 155 L 485 245 L 530 245 L 445 155 Z" fill="url(#wingGrad)" stroke="#64748b" strokeWidth="1.5" />
                            {/* Jet Engine */}
                            <ellipse cx="420" cy="188" rx="42" ry="17" fill="#334155" />
                            <ellipse cx="382" cy="188" rx="8" ry="16" fill="#0284c7" />

                            {/* Airline Livery Stripes */}
                            <path d="M 160 154 Q 300 148 650 144" stroke={currentAirline.c1} strokeWidth="5" fill="none" strokeLinecap="round" />
                            <path d="M 160 159 Q 300 153 650 149" stroke={currentAirline.c2} strokeWidth="4" fill="none" strokeLinecap="round" />
                            <path d="M 160 163 Q 300 157 650 153" stroke={currentAirline.c3} strokeWidth="3" fill="none" strokeLinecap="round" />

                            {/* Airline Brand Name on Fuselage */}
                            <text x="310" y="138" fontFamily="Impact, Arial Black, sans-serif" fontWeight="900" fontSize="26" fill={currentAirline.c1} fontStyle="italic" letterSpacing="0.5">
                              {currentAirline.brandText}
                            </text>
                          </g>
                        </svg>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Flyer Top Header Branding */}
              <div className="flyer-top-brand">
                <div className="brand-logo-line">
                  <Plane className="brand-plane-icon" size={24} strokeWidth={2.8} />
                  <span className="brand-title">{titreCompagnie}</span>
                </div>
                <div className="brand-subtitle-line">
                  <span>{sousTitre}</span>
                </div>
              </div>

              {/* Middle Section: Origin -> Destination with Flags */}
              <div className="flyer-route-box">
                {/* Departure City */}
                <div className="city-flag-card">
                  <span className="city-name">{departVille}</span>
                  <div className="flag-wrapper">
                    {SVGFlags[departFlagKey] || SVGFlags['senegal']}
                  </div>
                </div>

                {/* Center Arrow & Price Badge */}
                <div className="route-center-col">
                  <div className="route-arrow-line">
                    <span className="arrow-shaft"></span>
                    <span className="arrow-head">►</span>
                  </div>

                  <div className="price-gold-badge">
                    <span className="price-text">{prixKg}</span>
                  </div>
                </div>

                {/* Destination City */}
                <div className="city-flag-card">
                  <span className="city-name">{destVille}</span>
                  <div className="flag-wrapper">
                    {SVGFlags[destFlagKey] || SVGFlags['comores']}
                  </div>
                </div>
              </div>

              {/* Sub-Dates Section */}
              <div className="flyer-dates-row">
                <div className="date-block">
                  <span className="date-label">Dernier dépôt :</span>
                  <span className="date-val-gold">{dateDepot}</span>
                </div>
                <div className="date-block">
                  <span className="date-label">Départ :</span>
                  <span className="date-val-gold">{dateDepart}</span>
                </div>
              </div>

              {/* ℹ️ INFO COMPLEMENTAIRE BANNER */}
              {infoComplementaire && (
                <div className="flyer-info-pill-banner">
                  <span>{infoComplementaire}</span>
                </div>
              )}

              {/* WhatsApp Contact Phone Numbers Pills (Up to 2 per side) */}
              <div className="flyer-phones-row">
                <div className="phone-pill-stack">
                  <div className="phone-pill">
                    <div className="wa-icon-circle">
                      <Phone size={13} fill="#ffffff" color="#ffffff" />
                    </div>
                    <span>{departTel1}</span>
                  </div>
                  {departTel2 && (
                    <div className="phone-pill secondary">
                      <div className="wa-icon-circle">
                        <Phone size={13} fill="#ffffff" color="#ffffff" />
                      </div>
                      <span>{departTel2}</span>
                    </div>
                  )}
                </div>

                <div className="phone-pill-stack">
                  <div className="phone-pill">
                    <div className="wa-icon-circle">
                      <Phone size={13} fill="#ffffff" color="#ffffff" />
                    </div>
                    <span>{destTel1}</span>
                  </div>
                  {destTel2 && (
                    <div className="phone-pill secondary">
                      <div className="wa-icon-circle">
                        <Phone size={13} fill="#ffffff" color="#ffffff" />
                      </div>
                      <span>{destTel2}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods Banner */}
              <div className="flyer-payment-section">
                <span className="payment-title">PAIEMENT DISPONIBLE :</span>
                <div className="payment-methods-pill">
                  <div className="pay-brand orange-money">
                    <span className="om-icon">↗</span>
                    <span className="om-text">Orange <b>Money</b></span>
                  </div>
                  <span className="pay-divider">|</span>
                  <div className="pay-brand wave-pay">
                    <span className="wave-icon">🐧</span>
                    <span className="wave-text">wave</span>
                  </div>
                </div>
              </div>

              {/* ⚠️ RED WARNING BANNER - PLACED AT THE BOTTOM */}
              {avertissement && (
                <div className="flyer-red-warning-banner bottom-banner">
                  <span>{avertissement}</span>
                </div>
              )}

              {/* Bottom Address Strip */}
              <div className="flyer-footer-strip">
                <div className="address-item">
                  <MapPin size={13} className="pin-icon" />
                  <span>{adresse1}</span>
                </div>
                <span className="addr-sep">|</span>
                <div className="address-item">
                  <MapPin size={13} className="pin-icon" />
                  <span>{adresse2}</span>
                </div>
                <span className="addr-sep">|</span>
                <div className="address-item">
                  <MapPin size={13} className="pin-icon" />
                  <span>{adresse3}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
