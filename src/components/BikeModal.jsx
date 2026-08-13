import React, { useState, useEffect } from 'react';
import { X, Bike, Check } from 'lucide-react';
import { translations } from '../utils/translations';

export default function BikeModal({ lang, isOpen, onClose, onSave, bikeProfile }) {
  const t = translations[lang];

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
        </form>
      </div>
    </div>
  );
}
