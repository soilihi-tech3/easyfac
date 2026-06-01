import React, { useState, useEffect } from 'react';
import { getParametres, updateParametres, getVoyages, getParametresCache, getVoyagesCache, API_URL } from '../../data/store';
import { useApp } from '../../context/AppContext';
import {
  Save, Building2, Image, Settings2, FileText as FileIcon,
  Palette, AlertTriangle, Trash2, Sun, Moon, Upload,
  CheckCircle, MessageCircle
} from 'lucide-react';

const SectionCard = ({ Icon, title, iconColor = 'var(--brand)', children }) => (
  <div className="card">
    <div className="flex items-center gap-3" style={{ marginBottom: 22 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `color-mix(in srgb, ${iconColor} 15%, transparent)`,
        color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{title}</h3>
    </div>
    {children}
  </div>
);

export default function Parametres() {
  const [params, setParams] = useState(() => getParametresCache() || null);
  const [voyages, setVoyages] = useState(() => getVoyagesCache() || []);
  const [loading, setLoading] = useState(() => !getParametresCache());
  const [saving, setSaving] = useState(false);
  const [waStatus, setWaStatus] = useState({ status: 'LOADING', qr: null, phone: null });
  const { toast, refreshData, toggleTheme, isDark } = useApp();

  useEffect(() => {
    let interval;
    const fetchWaStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/whatsapp/status`, {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
          setWaStatus(data);
        }
      } catch (err) {
        console.error('Erreur WhatsApp status:', err);
      }
    };

    fetchWaStatus();
    interval = setInterval(fetchWaStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!getParametresCache()) setLoading(true);
      try {
        const [p, allVoyages] = await Promise.all([getParametres(), getVoyages()]);
        setParams(p);
        setVoyages(allVoyages);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateEnt  = (field, val) => setParams(p => ({ ...p, entreprise: { ...p.entreprise,  [field]: val } }));
  const updateConf = (field, val) => setParams(p => ({ ...p, config:     { ...p.config,      [field]: val } }));

  if (loading || !params) return <div className="page-enter" style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>;

  const handleLogoUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setParams(p => ({ ...p, entreprise: { ...p.entreprise, [field]: ev.target.result } }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateParametres(params);
      await refreshData();
      toast('Paramètres sauvegardés avec succès');
    } catch (err) {
      toast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleWaLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/whatsapp/logout`, { 
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        toast('Déconnecté de WhatsApp avec succès');
        setWaStatus({ status: 'LOADING', qr: null, phone: null });
      }
    } catch (err) {
      toast('Erreur lors de la déconnexion WhatsApp', 'error');
    }
  };

  return (
    <div className="page-enter">
      <div className="sticky-top-section">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="page-title">Paramètres</h1>
            <p className="page-subtitle">Configuration de votre application</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
            <Save size={16} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Infos Entreprise */}
        <SectionCard Icon={Building2} title="Informations de l'entreprise">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Nom de l'entreprise</label>
              <input className="form-input" value={params.entreprise?.nom || ''} onChange={e => updateEnt('nom', e.target.value)} placeholder="Transport Sénégal SARL" />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={params.entreprise?.email || ''} onChange={e => updateEnt('email', e.target.value)} placeholder="contact@transport-sn.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Site web</label>
              <input className="form-input" value={params.entreprise?.siteWeb || ''} onChange={e => updateEnt('siteWeb', e.target.value)} placeholder="www.transport-sn.com" />
            </div>

            {/* SÉNÉGAL */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-default)', marginTop: 12, paddingTop: 16 }}>
              <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand)', marginBottom: 4 }}>1. Agence principale (Sénégal)</h4>
            </div>
            <div className="form-group">
              <label className="form-label">Ville / Lieu (Sénégal)</label>
              <input className="form-input" value={params.entreprise?.adresse || ''} onChange={e => updateEnt('adresse', e.target.value)} placeholder="Dakar, Sénégal" />
            </div>
            <div className="form-group">
              <label className="form-label">Rue (Sénégal)</label>
              <input className="form-input" value={params.entreprise?.rueSenegal || ''} onChange={e => updateEnt('rueSenegal', e.target.value)} placeholder="FANN HOCK ,Canal VI terminus 71" />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Sénégal 1</label>
              <input className="form-input" value={params.entreprise?.telephone1 || ''} onChange={e => updateEnt('telephone1', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Sénégal 2</label>
              <input className="form-input" value={params.entreprise?.telephone2 || ''} onChange={e => updateEnt('telephone2', e.target.value)} />
            </div>

            {/* COMORES */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-default)', marginTop: 12, paddingTop: 16 }}>
              <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand)', marginBottom: 4 }}>2. Agence secondaire (Comores)</h4>
            </div>
            <div className="form-group">
              <label className="form-label">Ville / Lieu (Comores)</label>
              <input className="form-input" value={params.entreprise?.lieuComores || ''} onChange={e => updateEnt('lieuComores', e.target.value)} placeholder="Moroni, Comores" />
            </div>
            <div className="form-group">
              <label className="form-label">Rue (Comores)</label>
              <input className="form-input" value={params.entreprise?.rueComores || ''} onChange={e => updateEnt('rueComores', e.target.value)} placeholder="Moroni EGT t" />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Comores 1</label>
              <input className="form-input" value={params.entreprise?.telComores1 || ''} onChange={e => updateEnt('telComores1', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Comores 2</label>
              <input className="form-input" value={params.entreprise?.telComores2 || ''} onChange={e => updateEnt('telComores2', e.target.value)} />
            </div>

            {/* TROISIÈME ADRESSE */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-default)', marginTop: 12, paddingTop: 16 }}>
              <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand)', marginBottom: 4 }}>3. Autre Adresse / 3ème Agence (Facultatif)</h4>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Nom de l'agence / Libellé de l'adresse</label>
              <input className="form-input" value={params.entreprise?.nomAutre || ''} onChange={e => updateEnt('nomAutre', e.target.value)} placeholder="AUTRE ADRESSE, AGENCE SENEGAL 2, etc." />
            </div>
            <div className="form-group">
              <label className="form-label">Ville / Lieu (Autre)</label>
              <input className="form-input" value={params.entreprise?.lieuAutre || ''} onChange={e => updateEnt('lieuAutre', e.target.value)} placeholder="Mutsamudu, Anjouan" />
            </div>
            <div className="form-group">
              <label className="form-label">Rue (Autre)</label>
              <input className="form-input" value={params.entreprise?.rueAutre || ''} onChange={e => updateEnt('rueAutre', e.target.value)} placeholder="Quartier commercial" />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Autre 1</label>
              <input className="form-input" value={params.entreprise?.telAutre1 || ''} onChange={e => updateEnt('telAutre1', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Autre 2</label>
              <input className="form-input" value={params.entreprise?.telAutre2 || ''} onChange={e => updateEnt('telAutre2', e.target.value)} />
            </div>
          </div>
        </SectionCard>

        {/* Logo & Documents */}
        <SectionCard Icon={Image} title="Logo & Documents" iconColor="var(--purple)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 16 }}>
            {[
              { key: 'logo',      label: 'Logo entreprise' },
              { key: 'signature', label: 'Signature' },
              { key: 'cachet',    label: 'Cachet officiel' },
            ].map(item => (
              <div
                key={item.key}
                style={{
                  border: '2px dashed var(--border-default)',
                  borderRadius: 12, padding: 20, textAlign: 'center',
                  cursor: 'pointer', transition: 'all var(--transition)',
                  position: 'relative'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = ''; }}
                onClick={() => document.getElementById(`upload_${item.key}`).click()}
              >
                <input
                  id={`upload_${item.key}`}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleLogoUpload(e, item.key)}
                />
                {params.entreprise?.[item.key] && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Supprimer cet élément (${item.label}) ?`)) {
                        setParams(p => ({
                          ...p,
                          entreprise: {
                            ...p.entreprise,
                            [item.key]: ''
                          }
                        }));
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--danger)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = 'var(--danger)'; }}
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                {params.entreprise?.[item.key] ? (
                  <img
                    src={params.entreprise[item.key]}
                    alt={item.label}
                    style={{ maxHeight: 72, maxWidth: '100%', objectFit: 'contain', marginBottom: 10 }}
                  />
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    <Upload size={28} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
                  </div>
                )}
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 4 }}>Cliquer pour uploader</div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Configuration */}
        <SectionCard Icon={Settings2} title="Configuration" iconColor="var(--warning)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Prix par kg ({params.config?.devise || 'FCFA'})</label>
              <input className="form-input" type="number" value={params.config?.prixKg || 6000} onChange={e => updateConf('prixKg', parseFloat(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Devise</label>
              <select
                className="form-input form-select"
                value={params.config?.devise || 'FCFA'}
                onChange={e => {
                  const oldDevise = params.config?.devise || 'FCFA';
                  const newDevise = e.target.value;
                  let newPrixKg = params.config?.prixKg || 6000;
                  if (oldDevise === 'FCFA' && newDevise === 'EUR') {
                    newPrixKg = Math.round((newPrixKg / 655.957) * 100) / 100;
                  } else if (oldDevise === 'EUR' && newDevise === 'FCFA') {
                    newPrixKg = Math.round(newPrixKg * 655.957);
                  } else if (oldDevise === 'FCFA' && newDevise === 'KMF') {
                    newPrixKg = Math.round(newPrixKg * 0.75);
                  } else if (oldDevise === 'KMF' && newDevise === 'FCFA') {
                    newPrixKg = Math.round(newPrixKg / 0.75);
                  } else if (oldDevise === 'EUR' && newDevise === 'KMF') {
                    newPrixKg = Math.round(newPrixKg * 491.96775);
                  } else if (oldDevise === 'KMF' && newDevise === 'EUR') {
                    newPrixKg = Math.round((newPrixKg / 491.96775) * 100) / 100;
                  }
                  setParams(p => ({
                    ...p,
                    config: {
                      ...p.config,
                      devise: newDevise,
                      prixKg: newPrixKg
                    }
                  }));
                }}
              >
                <option value="FCFA">FCFA</option>
                <option value="EUR">EUR</option>
                <option value="KMF">KMF</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Format de numérotation</label>
              <input className="form-input" value={params.config?.formatNumero || 'Fac-{YEAR2}-{NUM2}'} onChange={e => updateConf('formatNumero', e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {'{'+'YEAR2'+'}'} = année (2 ch.) · {'{'+'NUM2'+'}'} = numéro (2 ch.) · {'{'+'YEAR'+'}'} = 4 ch. · {'{'+'NUM'+'}'} = 4 ch.
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">Couleur principale (reçus)</label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={params.config?.couleurPrimaire || '#6366f1'}
                  onChange={e => updateConf('couleurPrimaire', e.target.value)}
                  style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid var(--border-default)', cursor: 'pointer', background: 'none', padding: 2 }}
                />
                <input
                  className="form-input"
                  value={params.config?.couleurPrimaire || '#6366f1'}
                  onChange={e => updateConf('couleurPrimaire', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <label className="form-label">Voyage actif par défaut (assignation automatique)</label>
              <select className="form-input form-select" value={params.config?.voyageDefautId || ''} onChange={e => updateConf('voyageDefautId', e.target.value)}>
                <option value="">Sélectionner un voyage actif par défaut...</option>
                {voyages.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nom} ({new Date(v.dateDepart).toLocaleDateString('fr-FR')})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Lorsqu'un voyage par défaut est choisi, il sera pré-sélectionné et verrouillé pour la création de factures et de dépenses.
              </span>
            </div>
          </div>
        </SectionCard>

        {/* WhatsApp & Rappels */}
        <SectionCard Icon={MessageCircle} title="WhatsApp & Rappels" iconColor="#25d366">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            {/* Status Section */}
            <div style={{ padding: 16, border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-surface)' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>État de la connexion WhatsApp</h4>
              
              {waStatus.status === 'LOADING' && <div>Chargement du statut...</div>}
              
              {waStatus.status === 'CONNECTED' && (
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ color: '#25d366', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={16} /> Connecté
                    </div>
                    {waStatus.phone && <div style={{ fontSize: 12, marginTop: 4 }}>Numéro : {waStatus.phone}</div>}
                  </div>
                  <button className="btn btn-secondary" onClick={handleWaLogout}>Déconnecter</button>
                </div>
              )}

              {waStatus.status === 'QR_READY' && waStatus.qr && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, marginBottom: 10, color: 'var(--warning)' }}>
                    Non connecté. Scannez ce QR code avec l'application WhatsApp de votre téléphone (Appareils connectés).
                  </div>
                  <img src={waStatus.qr} alt="WhatsApp QR Code" style={{ maxWidth: 200, margin: '0 auto', display: 'block', border: '1px solid var(--border-default)', borderRadius: 8 }} />
                </div>
              )}

              {waStatus.status === 'INITIALIZING' && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Initialisation du client WhatsApp... (patientez)</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Message de fin / Formule de politesse (Rappel WhatsApp)</label>
              <textarea
                className="form-input"
                rows={4}
                value={params.config?.rappelCordial || ''}
                onChange={e => updateConf('rappelCordial', e.target.value)}
                placeholder="Merci de bien vouloir régulariser ce solde restant au plus tard à cette date.&#10;Nous restons à votre entière disposition.&#10;&#10;Cordialement,"
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: '10px 12px', lineHeight: 1.5 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Personnalisez la formule de politesse envoyée en bas de vos rappels WhatsApp (manuels et automatiques). Les détails de la facture (numéro, nom, montant total, déjà payé, reste à payer, échéance) restent insérés au-dessus automatiquement de manière identique.
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 18, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Activer les rappels automatiques</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Envoyer automatiquement les messages aux clients dont la date d'échéance est dépassée.
                  </p>
                </div>
                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 46, height: 26, flexShrink: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={!!params.config?.rappelAutomatique} 
                    onChange={e => updateConf('rappelAutomatique', e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: params.config?.rappelAutomatique ? '#25d366' : 'var(--border-default)',
                    transition: '0.3s', borderRadius: 26
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: 20, width: 20, left: 3, bottom: 3,
                      backgroundColor: '#fff', transition: '0.3s', borderRadius: '50%',
                      transform: params.config?.rappelAutomatique ? 'translateX(20px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }} />
                  </span>
                </label>
              </div>

              {params.config?.rappelAutomatique && (
                <div className="form-group" style={{ maxWidth: 200 }}>
                  <label className="form-label">Heure d'envoi des rappels</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={params.config?.rappelHeure || '08:00'} 
                    onChange={e => updateConf('rappelHeure', e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Heure locale à laquelle le robot enverra les messages.
                  </span>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Modèle de facture */}
        <SectionCard Icon={FileIcon} title="Modèle de facture" iconColor="var(--info)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
            {[
              { value: 'simple',        label: 'Simple',         desc: 'Design épuré, rapide' },
              { value: 'moderne',       label: 'Moderne',        desc: 'Coloré, contemporain' },
              { value: 'professionnel', label: 'Professionnel',  desc: 'Premium avec logo' },
            ].map(m => {
              const active = (params.config?.modeleFacture || 'moderne') === m.value;
              return (
                <div
                  key={m.value}
                  onClick={() => updateConf('modeleFacture', m.value)}
                  style={{
                    border: `2px solid ${active ? 'var(--brand)' : 'var(--border-default)'}`,
                    background: active ? 'var(--brand-muted)' : 'var(--bg-surface)',
                    borderRadius: 12, padding: 18, cursor: 'pointer',
                    transition: 'all var(--transition)', textAlign: 'center',
                  }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <FileIcon size={26} style={{ color: active ? 'var(--brand)' : 'var(--text-muted)', margin: '0 auto' }} />
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: 5, color: active ? 'var(--brand)' : 'var(--text-primary)', fontSize: 14 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{m.desc}</div>
                  {active && (
                    <div style={{ marginTop: 10 }}>
                      <span className="badge badge-brand"><CheckCircle size={10} /> Actif</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Apparence */}
        <SectionCard Icon={Palette} title="Apparence" iconColor="var(--purple)">
          <div className="flex items-center justify-between" style={{ padding: '16px 20px', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-default)' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Mode {isDark ? 'sombre' : 'clair'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Actuellement en mode {isDark ? 'sombre' : 'clair'}</div>
            </div>
            <button className="btn btn-secondary" onClick={toggleTheme}>
              {isDark ? <><Sun size={15} /> Mode clair</> : <><Moon size={15} /> Mode sombre</>}
            </button>
          </div>
        </SectionCard>

        {/* Danger Zone */}
        <div className="card" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.03)' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--danger-muted)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} strokeWidth={1.8} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--danger)' }}>Zone de danger</h3>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
            Ces actions sont irréversibles. Toutes vos données seront définitivement perdues.
          </p>
          <button className="btn btn-danger" onClick={handleReset}>
            <Trash2 size={15} /> Réinitialiser toutes les données
          </button>
        </div>
      </div>
    </div>
  );
}
