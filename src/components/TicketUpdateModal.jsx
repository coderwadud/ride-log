import React from 'react';
import { MessageCircle, X, ArrowRight, CheckCircle2, AlertCircle, Clock, Check } from 'lucide-react';

export default function TicketUpdateModal({
  lang,
  isOpen,
  ticket,
  onViewDetails,
  onClose
}) {
  if (!isOpen || !ticket) return null;

  const isBn = lang === 'bn';
  const status = (ticket.status || 'pending').toLowerCase().trim();
  const isResolved = status === 'resolved' || status === 'done' || status === 'fixed' || status === 'completed';
  const isInProgress = status === 'in_progress' || status === 'processing' || status === 'working';
  const isClosed = status === 'closed' || status === 'rejected';

  const statusColor = isResolved ? '#10b981' : isInProgress ? '#38bdf8' : isClosed ? '#ef4444' : '#f59e0b';
  const statusBg = isResolved ? 'rgba(16, 185, 129, 0.15)' : isInProgress ? 'rgba(56, 189, 248, 0.15)' : isClosed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
  const statusBorder = isResolved ? 'rgba(16, 185, 129, 0.35)' : isInProgress ? 'rgba(56, 189, 248, 0.35)' : isClosed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)';

  const statusLabel = isResolved
    ? (isBn ? '✓ সমাধান হয়েছে (Done)' : '✓ Resolved')
    : isInProgress
      ? (isBn ? '⚡ কাজ চলছে (In Progress)' : '⚡ In Progress')
      : isClosed
        ? (isBn ? '✕ বন্ধ (Closed)' : '✕ Closed')
        : (isBn ? '⏳ পর্যালোচনায় আছে (Pending)' : '⏳ Pending Review');

  const adminMessage = ticket.adminReply || ticket.adminNote || ticket.admin_reply || ticket.admin_note || ticket.reply || ticket.note;
  const link = ticket.replyLink || ticket.reply_link || ticket.linkUrl || ticket.link;
  const linkLabel = ticket.replyLinkLabel || ticket.reply_link_label || ticket.linkLabel || ticket.buttonTitle;
  const imgUrl = ticket.replyImageUrl || ticket.reply_image_url || ticket.imageUrl || ticket.image || (link && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(link) ? link : null);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        zIndex: 999997,
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
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '22px',
          padding: '24px 20px',
          maxWidth: '420px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 25px rgba(56, 189, 248, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '12px',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
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
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>

        {/* Header Icon */}
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2))',
            border: '2px solid #38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            boxShadow: '0 4px 16px rgba(56, 189, 248, 0.3)',
            flexShrink: 0
          }}
        >
          <MessageCircle size={26} />
        </div>

        {/* Status Badge */}
        <div style={{ display: 'flex', items: 'center', gap: '8px', marginTop: '2px' }}>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '20px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.35)'
            }}
          >
            #{ticket.ticketId || ticket.id}
          </span>

          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '12px',
              background: statusBg,
              color: statusColor,
              border: `1px solid ${statusBorder}`
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Title */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', margin: 0, lineHeight: '1.3' }}>
          {isBn ? 'আপনার টিকিটে নতুন আপডেট এসেছে!' : 'Support Ticket Updated!'}
        </h3>

        {/* Admin Message & Action Box */}
        {(adminMessage || link || imgUrl) && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(16, 185, 129, 0.12))',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '14px',
              padding: '12px 14px',
              textAlign: 'left',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MessageCircle size={13} />
              <span>{isBn ? 'অ্যাডমিনের উত্তর (Admin Response):' : 'Admin Response:'}</span>
            </span>

            {adminMessage && (
              <p style={{
                fontSize: '0.84rem',
                color: '#f1f5f9',
                margin: 0,
                lineHeight: '1.45',
                fontWeight: 500,
                maxHeight: '140px',
                overflowY: 'auto'
              }}>
                "{adminMessage}"
              </p>
            )}

            {/* Attached Image Preview */}
            {imgUrl && (
              link ? (
                <a
                  href={link}
                  target="_system"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(link, '_system');
                  }}
                  style={{ display: 'block', cursor: 'pointer', width: '100%' }}
                >
                  <img
                    src={imgUrl}
                    alt="Attachment"
                    style={{
                      maxHeight: '120px',
                      width: '100%',
                      objectFit: 'contain',
                      borderRadius: '10px',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      marginTop: '2px',
                      transition: 'transform 0.2s ease'
                    }}
                  />
                </a>
              ) : (
                <img
                  src={imgUrl}
                  alt="Attachment"
                  style={{
                    maxHeight: '120px',
                    width: '100%',
                    objectFit: 'contain',
                    borderRadius: '10px',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    marginTop: '2px'
                  }}
                />
              )
            )}

            {/* Custom Link Action Button */}
            {link && (
              <a
                href={link}
                target="_system"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(link, '_system');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                  marginTop: '4px',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.35)',
                  cursor: 'pointer'
                }}
              >
                <span>{linkLabel || (isBn ? 'লিংক খুলুন' : 'Open Link')}</span>
                <ArrowRight size={14} />
              </a>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onViewDetails}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)'
            }}
          >
            <span>{isBn ? '🎫 সমস্ত বিবরণ দেখুন' : 'View Full Details'}</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '9px',
              borderRadius: '12px',
              background: 'transparent',
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: '0.82rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {isBn ? 'বুঝেছি / বন্ধ করুন' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}
