import React, { useState, useEffect } from 'react';
import { X, Fuel, Check } from 'lucide-react';
import { translations } from '../utils/translations';

export default function FuelModal({ lang, isOpen, onClose, onSave, initialData, currentOdometer }) {
  const t = translations[lang];

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [odometer, setOdometer] = useState(currentOdometer || '');
  const [liters, setLiters] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('130'); // default BDT octane price
  const [isFullTank, setIsFullTank] = useState(true);
  const [stationName, setStationName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setDate(initialData.date || new Date().toISOString().slice(0, 10));
      setOdometer(initialData.odometer || '');
      setLiters(initialData.liters || '');
      setTotalAmount(initialData.totalAmount || '');
      setPricePerLiter(initialData.pricePerLiter || '130');
      setIsFullTank(initialData.isFullTank !== false);
      setStationName(initialData.stationName || '');
      setNotes(initialData.notes || '');
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setOdometer(currentOdometer || '');
      setLiters('');
      setTotalAmount('');
      setPricePerLiter('130');
      setIsFullTank(true);
      setStationName('');
      setNotes('');
    }
  }, [initialData, currentOdometer, isOpen]);

  const handleLitersChange = (e) => {
    const val = e.target.value;
    setLiters(val);
    if (val && pricePerLiter) {
      setTotalAmount((parseFloat(val) * parseFloat(pricePerLiter)).toFixed(0));
    }
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    setTotalAmount(val);
    if (val && pricePerLiter) {
      setLiters((parseFloat(val) / parseFloat(pricePerLiter)).toFixed(2));
    }
  };

  const handlePriceChange = (e) => {
    const val = e.target.value;
    setPricePerLiter(val);
    if (liters && val) {
      setTotalAmount((parseFloat(liters) * parseFloat(val)).toFixed(0));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!odometer || !liters || !totalAmount) return;

    onSave({
      id: initialData?.id || `fuel_${Date.now()}`,
      date,
      odometer: Number(odometer),
      liters: Number(liters),
      totalAmount: Number(totalAmount),
      pricePerLiter: Number(pricePerLiter),
      isFullTank,
      stationName,
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
            <Fuel size={22} color="var(--accent-fuel)" />
            <h3 style={{ fontSize: '1.05rem' }}>
              {initialData ? t.fuelTitleEdit : t.fuelTitleAdd}
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

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">{t.liters}</label>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                placeholder="e.g. 9.5" 
                value={liters} 
                onChange={handleLitersChange} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.pricePerLiter}</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="130" 
                value={pricePerLiter} 
                onChange={handlePriceChange} 
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t.totalAmount}</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="e.g. 1235" 
              value={totalAmount} 
              onChange={handleAmountChange} 
              required 
            />
          </div>

          {/* Full Tank Toggle Checkbox */}
          <div className="form-group">
            <label className="tag-checkbox checked" style={{ cursor: 'pointer', padding: '10px 12px' }}>
              <input 
                type="checkbox" 
                checked={isFullTank} 
                onChange={(e) => setIsFullTank(e.target.checked)} 
              />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{t.fullTank}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{t.fullTankDesc}</div>
              </div>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">{t.stationName}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t.stationPlaceholder} 
              value={stationName} 
              onChange={(e) => setStationName(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.notes}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t.notesPlaceholder} 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
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
