import React, { useState, useEffect, useRef } from 'react';
import { X, Bike, Check, Download, Upload } from 'lucide-react';
import { translations } from '../utils/translations';

export default function BikeModal({ lang, isOpen, onClose, onSave, bikeProfile, onClearAllData, onExportData, onImportData }) {
  const t = translations[lang];
  const fileInputRef = useRef(null);

  const [name, setName] = useState(bikeProfile?.name || 'Yamaha FZS V3');
  const [regNumber, setRegNumber] = useState(bikeProfile?.regNumber || '');
  const [initialOdometer, setInitialOdometer] = useState(bikeProfile?.initialOdometer || 0);
  const [targetOilKm, setTargetOilKm] = useState(bikeProfile?.targetOilKm || 1000);

  useEffect(() => {
    if (bikeProfile) {
      setName(bikeProfile.name || '');
      setRegNumber(bikeProfile.regNumber || '');
      setInitialOdometer(bikeProfile.initialOdometer || 0);
      setTargetOilKm(bikeProfile.targetOilKm || 1000);
    }
  }, [bikeProfile, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...bikeProfile,
      name,
      regNumber,
      initialOdometer: Number(initialOdometer),
      targetOilKm: Number(targetOilKm)
    });
    onClose();
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = onImportData(evt.target.result);
      if (result?.success === false) {
        alert(lang === 'bn' ? '❌ ফাইলটি সঠিক নয়!' : '❌ Invalid backup file!');
      } else {
        alert(lang === 'bn' ? '✅ ডাটা সফলভাবে যুক্ত হয়েছে! (duplicate বাদ দেওয়া হয়েছে)' : '✅ Data merged successfully! (duplicates skipped)');
        onClose();
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bike size={22} color="var(--accent-mileage)" />
            <h3 style={{ fontSize: '1.1rem' }}>{t.bikeProfileTitle}</h3>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.bikeName}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t.bikeNamePlaceholder} 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.regNumber}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t.regNumberPlaceholder} 
              value={regNumber} 
              onChange={(e) => setRegNumber(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.initialOdometer}</label>
            <input 
              type="number" 
              className="form-input" 
              value={initialOdometer} 
              onChange={(e) => setInitialOdometer(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.targetOilKm}</label>
            <input 
              type="number" 
              className="form-input" 
              value={targetOilKm} 
              onChange={(e) => setTargetOilKm(e.target.value)} 
              required 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Check size={18} />
              <span>{t.save}</span>
            </button>
          </div>

          {/* ===== Data Backup & Restore Section ===== */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {lang === 'bn' ? '📦 ডাটা ব্যাকআপ ও রিস্টোর' : '📦 Data Backup & Restore'}
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Export Button */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '0.82rem', gap: '6px' }}
                onClick={() => { onExportData?.(); }}
              >
                <Download size={15} />
                <span>{lang === 'bn' ? 'এক্সপোর্ট' : 'Export'}</span>
              </button>

              {/* Import Button */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '0.82rem', gap: '6px', color: 'var(--accent-mileage)', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} />
                <span>{lang === 'bn' ? 'ইম্পোর্ট' : 'Import'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '6px' }}>
              {lang === 'bn' 
                ? 'ইম্পোর্ট করলে নতুন ডাটা যোগ হবে, পুরনো ডাটা মুছবে না' 
                : 'Import adds new data without removing existing entries'}
            </p>
          </div>

          {/* Clear All Data */}
          {onClearAllData && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button 
                type="button" 
                className="btn" 
                onClick={onClearAllData}
                style={{ 
                  width: '100%', 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  color: 'var(--accent-danger)',
                  border: '1px solid rgba(239, 68, 68, 0.22)',
                  fontSize: '0.8rem',
                  padding: '8px'
                }}
              >
                {lang === 'bn' ? '🗑️ সমস্ত ডাটা রিসেট করুন' : '🗑️ Reset / Clear All Data'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
