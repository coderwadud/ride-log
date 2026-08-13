import React, { useState, useEffect, useRef } from 'react';
import { X, Bike, Check, Download, Upload, Plus, Trash2, Edit2, CloudCheck, CloudOff, RefreshCw, LogOut } from 'lucide-react';
import { translations } from '../utils/translations';

export default function BikeModal({ 
  lang, 
  isOpen, 
  onClose, 
  onSave, 
  bikes = [],
  activeBikeId,
  onSelectBike,
  onAddBike,
  onDeleteBike,
  bikeProfile, 
  onClearAllData, 
  onExportData, 
  onImportData,
  gdriveUser,
  gdriveSyncing,
  onGoogleLogin,
  onGoogleLogout,
  onTriggerSync
}) {
  const t = translations[lang];
  const fileInputRef = useRef(null);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [name, setName] = useState(bikeProfile?.name || 'Yamaha FZS V3');
  const [regNumber, setRegNumber] = useState(bikeProfile?.regNumber || '');
  const [initialOdometer, setInitialOdometer] = useState(bikeProfile?.initialOdometer || 0);
  const [targetOilKm, setTargetOilKm] = useState(bikeProfile?.targetOilKm || 1000);

  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    if (bikeProfile && !isAddingNew) {
      setName(bikeProfile.name || '');
      setRegNumber(bikeProfile.regNumber || '');
      setInitialOdometer(bikeProfile.initialOdometer || 0);
      setTargetOilKm(bikeProfile.targetOilKm || 1000);
    }
  }, [bikeProfile, isOpen, isAddingNew]);

  const handleStartNewBike = () => {
    setIsAddingNew(true);
    setName('');
    setRegNumber('');
    setInitialOdometer(0);
    setTargetOilKm(1000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isAddingNew) {
      onAddBike({
        name: name || 'My Bike',
        regNumber,
        initialOdometer: Number(initialOdometer) || 0,
        currentOdometer: Number(initialOdometer) || 0,
        targetOilKm: Number(targetOilKm) || 1000
      });
      setIsAddingNew(false);
    } else {
      onSave({
        ...bikeProfile,
        name: name || 'My Bike',
        regNumber,
        initialOdometer: Number(initialOdometer),
        targetOilKm: Number(targetOilKm)
      });
    }
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
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bike size={22} color="var(--accent-mileage)" />
            <h3 style={{ fontSize: '1.1rem' }}>
              {isAddingNew 
                ? (lang === 'bn' ? '➕ নতুন বাইক যোগ করুন' : '➕ Add New Bike') 
                : t.bikeProfileTitle}
            </h3>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* ===== Multi-Bike Management Card List ===== */}
        {!isAddingNew && (
          <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {lang === 'bn' ? '🏍️ আপনার বাইকসমূহ (' + bikes.length + 'টি)' : '🏍️ Your Bikes (' + bikes.length + ')'}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartNewBike}
                style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
              >
                <Plus size={14} />
                <span>{lang === 'bn' ? 'নতুন বাইক' : 'Add Bike'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {bikes.map((bike) => {
                const isActive = bike.id === activeBikeId;
                return (
                  <div
                    key={bike.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: isActive ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div 
                      onClick={() => onSelectBike(bike.id)}
                      style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <Bike size={16} color={isActive ? '#10b981' : '#94a3b8'} />
                      <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: isActive ? '#10b981' : 'var(--text-main)' }}>
                          {bike.name} {isActive && <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Active)</span>}
                        </p>
                        {bike.regNumber && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{bike.regNumber}</p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-icon"
                        onClick={() => {
                          onSelectBike(bike.id);
                          setIsAddingNew(false);
                        }}
                        title="Edit Details"
                        style={{ padding: '4px' }}
                      >
                        <Edit2 size={14} color="var(--text-muted)" />
                      </button>

                      {bikes.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => {
                            if (confirm(lang === 'bn' ? `আপনি কি "${bike.name}" বাইকটি মুছে ফেলতে চান?` : `Delete bike "${bike.name}"?`)) {
                              onDeleteBike(bike.id);
                            }
                          }}
                          title="Delete Bike"
                          style={{ padding: '4px', color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== Bike Profile Form ===== */}
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

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ flex: 1 }} 
              onClick={() => {
                if (isAddingNew) setIsAddingNew(false);
                else onClose();
              }}
            >
              {t.cancel}
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Check size={18} />
              <span>{isAddingNew ? (lang === 'bn' ? 'যুক্ত করুন' : 'Add') : t.save}</span>
            </button>
          </div>
        </form>

        {/* ===== Google Drive Cloud Sync Section ===== */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ☁️ {lang === 'bn' ? 'গুগল ড্রাইভ ক্লাউড ডাটাবেজ' : 'Google Drive Cloud Database'}
          </p>

          {gdriveUser ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                {gdriveUser.picture ? (
                  <img src={gdriveUser.picture} alt="Google Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                ) : (
                  <CloudCheck size={28} color="#10b981" />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
                    {gdriveUser.name || 'Google Drive Connected'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }} className="truncate">
                    {gdriveUser.email}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={gdriveSyncing}
                  onClick={onTriggerSync}
                  style={{ flex: 1, fontSize: '0.78rem', padding: '7px 10px', gap: '6px' }}
                >
                  <RefreshCw size={14} className={gdriveSyncing ? 'animate-spin' : ''} />
                  <span>{gdriveSyncing ? (lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...') : (lang === 'bn' ? '🔄 ক্লাউড সিঙ্ক করুন' : 'Sync Now')}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onGoogleLogout}
                  style={{ fontSize: '0.78rem', padding: '7px 10px', gap: '4px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <LogOut size={14} />
                  <span>{lang === 'bn' ? 'সাইন আউট' : 'Sign Out'}</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={onGoogleLogin}
              style={{
                width: '100%',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: 'var(--accent-mileage)',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '10px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <CloudCheck size={18} />
              <span>{lang === 'bn' ? '☁️ Google দিয়ে কানেক্ট করুন (অটো ড্রাইভ সিঙ্ক)' : '☁️ Connect Google Drive (Auto Sync)'}</span>
            </button>
          )}
        </div>

        {/* ===== Local Data Backup & Restore Section ===== */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {lang === 'bn' ? '📦 ম্যানুয়াল মেমোরি এক্সপোর্ট ও ইম্পোর্ট' : '📦 Local File Export & Import'}
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '0.82rem', gap: '6px' }}
              onClick={async () => { 
                const res = await onExportData?.(); 
                if (res?.method === 'clipboard') {
                  alert(lang === 'bn' ? '📋 ব্যাকআপ ডাটা ক্লিপবোর্ডে কপি করা হয়েছে!' : '📋 Backup copied to clipboard!');
                }
              }}
            >
              <Download size={15} />
              <span>{lang === 'bn' ? 'এক্সপোর্ট' : 'Export'}</span>
            </button>

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

          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn"
              style={{ 
                flex: 1, 
                fontSize: '0.75rem', 
                padding: '6px 8px', 
                background: 'rgba(255, 255, 255, 0.04)', 
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)'
              }}
              onClick={async () => {
                const res = await onExportData?.();
                if (res?.jsonStr || typeof res === 'object') {
                  alert(lang === 'bn' ? '📋 ব্যাকআপ কোড ক্লিপবোর্ডে কপি করা হয়েছে!' : '📋 Backup code copied to clipboard!');
                }
              }}
            >
              📋 {lang === 'bn' ? 'কোড কপি করুন' : 'Copy Code'}
            </button>

            <button
              type="button"
              className="btn"
              style={{ 
                flex: 1, 
                fontSize: '0.75rem', 
                padding: '6px 8px', 
                background: 'rgba(56, 189, 248, 0.08)', 
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: 'var(--accent-mileage)'
              }}
              onClick={() => {
                const pasted = prompt(lang === 'bn' ? 'আপনার ব্যাকআপ কোড পেস্ট করুন:' : 'Paste your backup JSON code:');
                if (pasted) {
                  const result = onImportData(pasted);
                  if (result?.success === false) {
                    alert(lang === 'bn' ? '❌ কোডটি সঠিক নয়!' : '❌ Invalid backup code!');
                  } else {
                    alert(lang === 'bn' ? '✅ ডাটা সফলভাবে যুক্ত হয়েছে!' : '✅ Data imported successfully!');
                    onClose();
                  }
                }
              }}
            >
              📋 {lang === 'bn' ? 'কোড পেস্ট করুন' : 'Paste Code'}
            </button>
          </div>

          {/* Clear All Data Button */}
          {onClearAllData && (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              {!showConfirmReset ? (
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setShowConfirmReset(true)}
                  style={{ 
                    width: '100%', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    color: 'var(--accent-danger)',
                    border: '1px solid rgba(239, 68, 68, 0.22)',
                    fontSize: '0.8rem',
                    padding: '9px',
                    fontWeight: 600
                  }}
                >
                  {lang === 'bn' ? '🗑️ সমস্ত ডাটা রিসেট করুন' : '🗑️ Reset / Clear All Data'}
                </button>
              ) : (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--accent-danger)', fontWeight: 700, marginBottom: '10px' }}>
                    {lang === 'bn' ? '⚠️ আপনি কি নিশ্চিত যে সমস্ত ডাটা মুছে ফেলবেন?' : '⚠️ Confirm clearing all stored data?'}
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px' }}
                      onClick={() => setShowConfirmReset(false)}
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ 
                        flex: 1, 
                        background: '#ef4444', 
                        color: '#ffffff', 
                        fontSize: '0.8rem', 
                        fontWeight: 700,
                        padding: '6px',
                        border: 'none'
                      }}
                      onClick={() => {
                        setShowConfirmReset(false);
                        onClearAllData();
                      }}
                    >
                      {lang === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Yes, Reset All'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

