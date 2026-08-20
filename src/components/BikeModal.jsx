import React, { useState, useEffect, useRef } from 'react';
import { X, Bike, Check, Download, Upload, Plus, Trash2, Edit2, CloudCheck, CloudOff, RefreshCw, LogOut, Copy, ClipboardPaste, AlertTriangle, UserX, FileText, FileSpreadsheet } from 'lucide-react';
import { translations } from '../utils/translations';
import { deleteUserAllData } from '../utils/firestoreDB';
import { deleteUserAccount } from '../utils/firebase';
import { exportRiderComprehensiveStatementPDF, exportFuelAndServiceToExcel } from '../utils/exportUtils';

export default function BikeModal({ 
  lang, 
  isOpen, 
  onClose, 
  user,
  onSave, 
  bikes = [],
  activeBikeId,
  onSelectBike,
  onAddBike,
  onDeleteBike,
  bikeProfile, 
  fuelLogs = [],
  serviceLogs = [],
  fuelStats = {},
  serviceStats = {},
  onClearAllData, 
  onExportData, 
  onImportData,
  gdriveUser,
  gdriveSyncing,
  onGoogleLogin,
  onGoogleLogout,
  onTriggerSync,
  onLogout
}) {
  const t = translations[lang];
  const fileInputRef = useRef(null);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [name, setName] = useState(bikeProfile?.name || 'Yamaha FZS V3');
  const [regNumber, setRegNumber] = useState(bikeProfile?.regNumber || '');
  const [initialOdometer, setInitialOdometer] = useState(bikeProfile?.initialOdometer || 0);
  const [targetOilKm, setTargetOilKm] = useState(bikeProfile?.targetOilKm || 1000);

  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Account Deactivation states
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateStep, setDeactivateStep] = useState(1); // 1 = warning, 2 = final confirm

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
      if (typeof onAddBike === 'function') {
        onAddBike({
          name: name || 'My Bike',
          regNumber,
          initialOdometer: Number(initialOdometer) || 0,
          currentOdometer: Number(initialOdometer) || 0,
          targetOilKm: Number(targetOilKm) || 1000
        });
      }
      setIsAddingNew(false);
    } else {
      if (typeof onSave === 'function') {
        onSave({
          ...bikeProfile,
          name: name || 'My Bike',
          regNumber,
          initialOdometer: Number(initialOdometer),
          targetOilKm: Number(targetOilKm)
        });
      }
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

  const handleDeactivateAccount = async () => {
    if (deactivateStep === 1) {
      setDeactivateStep(2);
      return;
    }

    setDeactivateLoading(true);
    try {
      const uid = user?.uid;
      if (uid && uid !== 'guest') {
        await deleteUserAllData(uid);
      }
      await deleteUserAccount();
    } catch (err) {
      console.error('Account deletion error:', err);
      if (err?.code === 'auth/requires-recent-login') {
        alert(lang === 'bn'
          ? '⚠️ নিরাপত্তার জন্য, অনুগ্রহ করে লগআউট করে আবার লগইন করুন, তারপর আবার চেষ্টা করুন।'
          : '⚠️ For security, please logout and login again, then retry account deletion.');
        setShowDeactivateConfirm(false);
        setDeactivateStep(1);
      } else {
        alert(lang === 'bn' ? '❌ একাউন্ট ডিলিট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : '❌ Account deletion failed. Please try again.');
      }
    } finally {
      setDeactivateLoading(false);
    }
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

        {/* ===== Firebase Cloud Database Status Section ===== */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🔥 {lang === 'bn' ? 'ফায়ারবেস ক্লাউড ডাটাবেজ' : 'Firebase Cloud Database'}
          </p>

          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
              <CloudCheck size={20} />
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
                {lang === 'bn' ? 'সরাসরি ক্লাউড সিঙ্ক চালু আছে' : 'Live Cloud Sync Active'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {lang === 'bn' ? 'আপনার সমস্ত ডাটা নিরাপদে ফায়ারবেস ক্লাউডে সংরক্ষিত হচ্ছে।' : 'Your data is securely saved in your Firebase account.'}
              </p>
            </div>
          </div>
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
              <span>{lang === 'bn' ? 'ইম্পোর্ট (JSON/CSV)' : 'Import (JSON/CSV)'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,text/csv,application/json"
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
                if (res?.jsonStr) {
                  try {
                    await navigator.clipboard.writeText(res.jsonStr);
                  } catch (e) {
                    console.error('Clipboard copy error:', e);
                  }
                  alert(lang === 'bn' ? 'ব্যাকআপ কোড ক্লিপবোর্ডে কপি করা হয়েছে!' : 'Backup code copied to clipboard!');
                }
              }}
            >
              <Copy size={14} />
              <span>{lang === 'bn' ? 'কোড কপি করুন' : 'Copy Code'}</span>
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
                color: 'var(--accent-mileage)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
              onClick={() => {
                const pasted = prompt(lang === 'bn' ? 'আপনার ব্যাকআপ কোড (JSON বা CSV) পেস্ট করুন:' : 'Paste your backup code (JSON or CSV):');
                if (pasted) {
                  const result = onImportData(pasted);
                  if (result?.success === false) {
                    alert(lang === 'bn' ? 'কোডটি সঠিক নয়!' : 'Invalid backup code!');
                  } else {
                    alert(lang === 'bn' ? 'ডাটা সফলভাবে যুক্ত হয়েছে!' : 'Data imported successfully!');
                    onClose();
                  }
                }
              }}
            >
              <ClipboardPaste size={14} />
              <span>{lang === 'bn' ? 'কোড পেস্ট করুন' : 'Paste Code'}</span>
            </button>
          </div>

          {/* Quick PDF Statement & Excel Export Row */}
          <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                exportRiderComprehensiveStatementPDF({
                  user,
                  bike: bikeProfile,
                  fuelLogs,
                  serviceLogs,
                  fuelStats,
                  serviceStats,
                  lang
                });
              }}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(3, 105, 161, 0.2))',
                color: '#38bdf8',
                border: '1px solid rgba(2, 132, 199, 0.35)',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
            >
              <FileText size={14} />
              <span>{lang === 'bn' ? 'PDF স্টেটমেন্ট' : 'PDF Statement'}</span>
            </button>

            <button
              type="button"
              className="btn"
              onClick={async () => {
                await exportFuelAndServiceToExcel({
                  bike: bikeProfile,
                  fuelLogs,
                  serviceLogs,
                  fuelStats,
                  serviceStats,
                  lang
                });
              }}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.2))',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
            >
              <FileSpreadsheet size={14} />
              <span>{lang === 'bn' ? 'Excel রিপোর্ট' : 'Excel Report'}</span>
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
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={15} />
                  <span>{lang === 'bn' ? 'সমস্ত ডাটা রিসেট করুন' : 'Reset / Clear All Data'}</span>
                </button>
              ) : (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--accent-danger)', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} color="#ef4444" />
                    <span>{lang === 'bn' ? 'আপনি কি নিশ্চিত যে সমস্ত ডাটা মুছে ফেলবেন?' : 'Confirm clearing all stored data?'}</span>
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

          {/* Permanent Delete Account Option */}
          {user && (
            <div style={{ marginTop: '10px', textAlign: 'center' }}>
              <button
                type="button"
                className="btn"
                onClick={() => { setShowDeactivateConfirm(true); setDeactivateStep(1); }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid rgba(107, 114, 128, 0.25)',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              >
                <UserX size={15} />
                <span>{lang === 'bn' ? 'একাউন্ট স্থায়ীভাবে মুছে ফেলুন' : 'Permanently Delete Account'}</span>
              </button>
            </div>
          )}

          {/* Logout Button Section */}
          {onLogout && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                style={{
                  width: '100%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <LogOut size={16} />
                <span>{lang === 'bn' ? 'অ্যাকাউন্ট লগআউট করুন' : 'Logout Account'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== Account Deactivation Confirm Modal ===== */}
      {showDeactivateConfirm && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => { setShowDeactivateConfirm(false); setDeactivateStep(1); }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '20px',
              padding: '28px 24px',
              maxWidth: '380px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <UserX size={32} color="#ef4444" />
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171', margin: '0 0 8px 0' }}>
                {deactivateStep === 1
                  ? (lang === 'bn' ? '⚠️ একাউন্ট ডিলিট করবেন?' : '⚠️ Delete Account?')
                  : (lang === 'bn' ? '🚨 শেষ সুযোগ!' : '🚨 Last Warning!')
                }
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, lineHeight: '1.6' }}>
                {deactivateStep === 1
                  ? (lang === 'bn'
                    ? 'এই অ্যাকশনটি সম্পূর্ণ অপরিবর্তনীয়। আপনার সমস্ত বাইক ডাটা, ফুয়েল লগ, সার্ভিস লগ ও ডকুমেন্ট চিরতরে মুছে যাবে।'
                    : 'This action is completely irreversible. All your bike data, fuel logs, service logs, and documents will be permanently erased.')
                  : (lang === 'bn'
                    ? 'আপনি কি সত্যিই নিশ্চিত? "হ্যাঁ, ডিলিট করুন" চাপলে আর ফিরিয়ে আনা সম্ভব হবে না।'
                    : 'Are you absolutely sure? Pressing "Yes, Delete" cannot be undone. Ever.')
                }
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                disabled={deactivateLoading}
                onClick={handleDeactivateAccount}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: deactivateLoading ? 'not-allowed' : 'pointer',
                  opacity: deactivateLoading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <UserX size={17} />
                <span>
                  {deactivateLoading
                    ? (lang === 'bn' ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...')
                    : deactivateStep === 1
                      ? (lang === 'bn' ? 'পরের ধাপ →' : 'Next Step →')
                      : (lang === 'bn' ? 'হ্যাঁ, চিরতরে ডিলিট করুন' : 'Yes, Permanently Delete')
                  }
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setShowDeactivateConfirm(false); setDeactivateStep(1); }}
                style={{
                  padding: '11px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer'
                }}
              >
                {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

