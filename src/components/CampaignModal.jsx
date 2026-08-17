import React from 'react';
import { Megaphone, X, ArrowRight, Check } from 'lucide-react';

export default function CampaignModal({
  lang,
  isOpen,
  campaign,
  onClose
}) {
  if (!isOpen || !campaign || !campaign.isActive) return null;

  const isBn = lang === 'bn';
  const { title, message, actionText, actionUrl, badge } = campaign;

  const handleActionClick = () => {
    if (actionUrl) {
      window.open(actionUrl, '_system');
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        zIndex: 999998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.25s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '22px',
          padding: '26px 22px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(245, 158, 11, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '14px',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close X Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>

        {/* Announcement Megaphone Icon */}
        <div
          style={{
            width: '62px',
            height: '62px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(239, 68, 68, 0.2))',
            border: '2px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.25)'
          }}
        >
          <Megaphone size={30} />
        </div>

        {/* Badge */}
        <span
          style={{
            fontSize: '0.74rem',
            fontWeight: 800,
            padding: '3px 12px',
            borderRadius: '20px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          {badge || (isBn ? '📢 বিশেষ নোটিশ' : '📢 Announcement')}
        </span>

        {/* Title */}
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', margin: 0, lineHeight: '1.3' }}>
          {title}
        </h3>

        {/* Message Body */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '14px 16px',
            textAlign: 'left',
            width: '100%',
            fontSize: '0.86rem',
            color: '#e2e8f0',
            lineHeight: '1.5',
            maxHeight: '180px',
            overflowY: 'auto'
          }}
        >
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>
            {message}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          {actionUrl ? (
            <button
              type="button"
              onClick={handleActionClick}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.92rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
              }}
            >
              <span>{actionText || (isBn ? 'বিস্তারিত দেখুন' : 'Learn More')}</span>
              <ArrowRight size={16} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              background: actionUrl ? 'transparent' : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              color: actionUrl ? '#94a3b8' : '#ffffff',
              fontWeight: 700,
              fontSize: '0.86rem',
              border: actionUrl ? 'none' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {!actionUrl && <Check size={16} />}
            <span>{isBn ? 'বুঝেছি / বন্ধ করুন' : 'Got it / Dismiss'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
