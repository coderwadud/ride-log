import React, { useState, useEffect } from 'react';
import { X, Wrench, Check } from 'lucide-react';
import { translations } from '../utils/translations';

const SERVICE_TAGS = [
  'catEngineOil',
  'catOilFilter',
  'catAirFilter',
  'catSparkPlug',
  'catBrakePad',
  'catChainLube',
  'catTire',
  'catGeneralService',
  'catBattery',
  'catOther'
];

export default function ServiceModal({ lang, isOpen, onClose, onSave, initialData, currentOdometer }) {
  const t = translations[lang];

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [odometer, setOdometer] = useState(currentOdometer || '');
  const [selectedTypes, setSelectedTypes] = useState(['catEngineOil']);
  const [serviceCost, setServiceCost] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [garageName, setGarageName] = useState('');
  const [isEngineOilChange, setIsEngineOilChange] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setDate(initialData.date || new Date().toISOString().slice(0, 10));
      setOdometer(initialData.odometer || '');
      setSelectedTypes(initialData.types || ['catEngineOil']);
      setServiceCost(initialData.serviceCost || '');
      setPartsCost(initialData.partsCost || '');
      setGarageName(initialData.garageName || '');
      setIsEngineOilChange(initialData.isEngineOilChange !== false);
      setNotes(initialData.notes || '');
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setOdometer(currentOdometer || '');
      setSelectedTypes(['catEngineOil']);
      setServiceCost('');
      setPartsCost('');
      setGarageName('');
      setIsEngineOilChange(true);
      setNotes('');
    }
  }, [initialData, currentOdometer, isOpen]);

  const toggleTag = (tagKey) => {
    if (selectedTypes.includes(tagKey)) {
      const updated = selectedTypes.filter(k => k !== tagKey);
      setSelectedTypes(updated);
      if (tagKey === 'catEngineOil') setIsEngineOilChange(false);
    } else {
      setSelectedTypes([...selectedTypes, tagKey]);
      if (tagKey === 'catEngineOil') setIsEngineOilChange(true);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!odometer) return;

    onSave({
      id: initialData?.id || `service_${Date.now()}`,
      date,
      odometer: Number(odometer),
      types: selectedTypes,
      serviceCost: Number(serviceCost || 0),
      partsCost: Number(partsCost || 0),
      garageName,
      isEngineOilChange,
      notes
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-drag-handle" />

        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wrench size={22} color="var(--accent-service)" />
            <h3 style={{ fontSize: '1.05rem' }}>
              {initialData ? t.serviceTitleEdit : t.serviceTitleAdd}
            </h3>
          </div>
          <button className="btn btn-icon" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.date}</label>
            <input 
              type="date" 
              className="form-input" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.odometer}</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="e.g. 14250" 
              value={odometer} 
              onChange={(e) => setOdometer(e.target.value)} 
              required 
            />
          </div>

          {/* Service Category Tags Selection */}
          <div className="form-group">
            <label className="form-label">{t.serviceTypes}</label>
            <div className="tags-grid">
              {SERVICE_TAGS.map(tagKey => {
                const isSelected = selectedTypes.includes(tagKey);
                return (
                  <label key={tagKey} className={`tag-checkbox ${isSelected ? 'checked' : ''}`}>
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => toggleTag(tagKey)} 
                    />
                    <span>{t[tagKey]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">{t.serviceCost}</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 200" 
                value={serviceCost} 
                onChange={(e) => setServiceCost(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.partsCost}</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 750" 
                value={partsCost} 
                onChange={(e) => setPartsCost(e.target.value)} 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t.garageName}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t.garagePlaceholder} 
              value={garageName} 
              onChange={(e) => setGarageName(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.notes}</label>
            <textarea 
              className="form-textarea" 
              rows={2} 
              placeholder={t.serviceNotesPlaceholder} 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-service" style={{ flex: 1 }}>
              <Check size={18} />
              <span>{t.save}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
