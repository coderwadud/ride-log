import React from 'react';
import { Download, Sparkles, X, ArrowUpCircle } from 'lucide-react';

export default function UpdateModal({
  lang,
  isOpen,
  updateInfo,
  onClose
}) {
  if (!isOpen || !updateInfo) return null;

  const isBn = lang === 'bn';
  const { latestVersion, updateUrl, releaseNotes, isMandatory } = updateInfo;

  const handleUpdate = () => {
    if (updateUrl) {
      window.open(updateUrl, '_system');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '22px',
          padding: '28px 24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '16px',
          position: 'relative'
        }}
      >
        {!isMandatory && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Update Icon */}
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2))',
            border: '2px solid #38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8'
          }}
        >
          <ArrowUpCircle size={36} />
        </div>

        {/* Title */}
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
            🚀 {isBn ? 'নতুন আপডেট চলে এসেছে!' : 'New Update Available!'}
          </h3>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}
          >
            Version {latestVersion}
          </span>
        </div>

        {/* Release Notes */}
        {releaseNotes ? (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '12px 14px',
              textAlign: 'left',
              width: '100%',
              fontSize: '0.82rem',
              color: '#cbd5e1',
              maxHeight: '120px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: '#10b981', fontWeight: 700 }}>
              <Sparkles size={14} />
              <span>{isBn ? 'নতুন কি আছে:' : "What's New:"}</span>
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-line', lineHeight: '1.4' }}>
              {releaseNotes}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0 }}>
            {isBn 
              ? 'আরও ভালো পারফরম্যান্স এবং নতুন ফিচারের জন্য এখনই অ্যাপটি আপডেট করে নিন।' 
              : 'Please update to the latest version for better performance and new features.'}
          </p>
        )}

        {/* Actions */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={handleUpdate}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.92rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)'
            }}
          >
            <Download size={18} />
            <span>{isBn ? 'এখনই আপডেট করুন' : 'Update Now'}</span>
          </button>

          {!isMandatory && (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '12px',
                background: 'transparent',
                color: '#94a3b8',
                fontWeight: 600,
                fontSize: '0.82rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {isBn ? 'পরে করবো' : 'Maybe Later'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
