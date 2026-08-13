import React from 'react';
import { X, Smartphone, Download, CheckCircle2 } from 'lucide-react';
import { translations } from '../utils/translations';

export default function PWAInstallModal({ lang, isOpen, onClose, deferredPrompt, onTriggerInstall }) {
  const t = translations[lang];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-drag-handle" />

        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Smartphone size={24} color="var(--accent-fuel)" />
            <h3 style={{ fontSize: '1.05rem' }}>{t.installPromptTitle}</h3>
          </div>
          <button className="btn btn-icon" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ textAlign: 'center', margin: '16px 0' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #10b981, #38bdf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            color: '#000',
            boxShadow: '0 0 24px rgba(16, 185, 129, 0.35)'
          }}>
            <Smartphone size={32} />
          </div>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>{t.appName} App</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t.installPromptDesc}
          </p>
        </div>

        {deferredPrompt ? (
          <button className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }} onClick={onTriggerInstall}>
            <Download size={18} />
            <span>{t.installBtn}</span>
          </button>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <h5 style={{ color: 'var(--accent-mileage)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>{t.stepTitle}</span>
            </h5>
            <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>{t.step1}</li>
              <li>{t.step2}</li>
              <li>{t.step3}</li>
              <li>{t.step4}</li>
            </ol>
          </div>
        )}

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
