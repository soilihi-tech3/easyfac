import React, { useState, useEffect } from 'react';
import { getParametres, updateParametres, getVoyages } from '../../data/store';
import { useApp } from '../../context/AppContext';
import {
  Save, Building2, Image, Settings2, FileText as FileIcon,
  Palette, AlertTriangle, Trash2, Sun, Moon, Upload,
  CheckCircle
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
  const [params, setParams] = useState(null);
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast, refreshData, toggleTheme, isDark } = useApp();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">Configuration de votre application</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          <Save size={16} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Infos Entreprise */}
        <SectionCard Icon={Building2} title="Informations de l'entreprise">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Nom de l'entreprise</label>
              <input className="form-input" value={params.entreprise?.nom || ''} onChange={e => updateEnt('nom', e.target.value)} placeholder="Transport Sénégal SARL" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Adresse / Lieu principal (Sénégal)</label>
              <input className="form-input" value={params.entreprise?.adresse || ''} onChange={e => updateEnt('adresse', e.target.value)} placeholder="Dakar, Sénégal" />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Sénégal 1</label>
              <input className="form-input" value={params.entreprise?.telephone1 || ''} onChange={e => updateEnt('telephone1', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Sénégal 2</label>
              <input className="form-input" value={params.entreprise?.telephone2 || ''} onChange={e => updateEnt('telephone2', e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
              <label className="form-label">Adresse / Lieu secondaire (Comores)</label>
              <input className="form-input" value={params.entreprise?.lieuComores || ''} onChange={e => updateEnt('lieuComores', e.target.value)} placeholder="Moroni, Comores" />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Comores 1</label>
              <input className="form-input" value={params.entreprise?.telComores1 || ''} onChange={e => updateEnt('telComores1', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Comores 2</label>
              <input className="form-input" value={params.entreprise?.telComores2 || ''} onChange={e => updateEnt('telComores2', e.target.value)} />
            </div>

            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={params.entreprise?.email || ''} onChange={e => updateEnt('email', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Site web</label>
              <input className="form-input" value={params.entreprise?.siteWeb || ''} onChange={e => updateEnt('siteWeb', e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </SectionCard>

        {/* Logo & Documents */}
        <SectionCard Icon={Image} title="Logo & Documents" iconColor="var(--purple)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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

        {/* Modèle de facture */}
        <SectionCard Icon={FileIcon} title="Modèle de facture" iconColor="var(--info)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
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
