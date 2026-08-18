import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, MessageSquare, Plus, Ticket, CheckCircle2, Clock,
  AlertCircle, Send, Copy, Check, MessageCircle, RefreshCw, ChevronRight,
  Shield, Sparkles, Filter, FileText
} from 'lucide-react';
import { submitUserFeedback, listenToUserTickets } from '../utils/firestoreDB';
import { getCurrentAppVersion } from '../utils/appVersion';
import Footer from './Footer';

export default function FeedbackPage({
  lang,
  theme,
  user,
  onBack,
  initialTicketId = null,
  initialViewMode = 'list' // 'list', 'details', 'new'
}) {
  const isBn = lang === 'bn';
  const userId = user?.uid || 'guest';

  const [viewMode, setViewMode] = useState(initialTicketId ? 'details' : initialViewMode); // 'list', 'details', 'new'
  const [userTickets, setUserTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'in_progress', 'done'
  const [copiedId, setCopiedId] = useState(false);

  // New Ticket Form States
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [createdTicketInfo, setCreatedTicketInfo] = useState(null);

  // Real-time listener for user tickets
  useEffect(() => {
    if (!userId) return;

    const unsub = listenToUserTickets(userId, (tickets) => {
      setUserTickets(tickets);

      // If initialTicketId provided or current selected ticket was updated
      if (initialTicketId) {
        const match = tickets.find(t => (t.ticketId === initialTicketId || t.id === initialTicketId));
        if (match) {
          setSelectedTicket(match);
          setViewMode('details');
        }
      } else if (selectedTicket) {
        const updated = tickets.find(t => (t.ticketId === selectedTicket.ticketId || t.id === selectedTicket.id));
        if (updated) setSelectedTicket(updated);
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [userId, initialTicketId]);

  const handleCopyTicketId = (id) => {
    if (!id) return;
    try {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (e) {}
  };

  const handleNewTicketSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim() || feedbackLoading) return;

    setFeedbackLoading(true);
    setFeedbackSuccess(false);

    try {
      const appVersion = await getCurrentAppVersion();
      const res = await submitUserFeedback({
        uid: user?.uid || 'guest',
        name: user?.displayName || 'User',
        email: user?.email || '',
        type: feedbackType,
        message: feedbackMessage.trim(),
        appVersion: appVersion || '1.2.0'
      });

      setFeedbackLoading(false);
      setFeedbackSuccess(true);
      setCreatedTicketInfo(res);
      setFeedbackMessage('');
    } catch (err) {
      console.error('Feedback submit error:', err);
      setFeedbackLoading(false);
      alert(isBn ? 'মেসেজ পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Failed to send feedback. Please try again.');
    }
  };

  // Filtered Tickets
  const filteredTickets = userTickets.filter((tkt) => {
    if (filterStatus === 'all') return true;
    const s = (tkt.status || 'pending').toLowerCase().trim();
    if (filterStatus === 'done') return s === 'resolved' || s === 'done' || s === 'fixed' || s === 'completed';
    if (filterStatus === 'in_progress') return s === 'in_progress' || s === 'processing' || s === 'working';
    if (filterStatus === 'pending') return s === 'pending' || s === 'new' || s === 'open';
    return true;
  });

  const getStatusMeta = (statusStr) => {
    const s = (statusStr || 'pending').toLowerCase().trim();
    const isResolved = s === 'resolved' || s === 'done' || s === 'fixed' || s === 'completed' || s === 'success';
    const isInProgress = s === 'in_progress' || s === 'processing' || s === 'working' || s === 'ongoing';
    const isClosed = s === 'closed' || s === 'rejected' || s === 'cancelled';

    if (isResolved) {
      return {
        key: 'done',
        label: isBn ? '✓ সমাধান হয়েছে (Done)' : '✓ Resolved',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: 'rgba(16, 185, 129, 0.35)',
        step: 3
      };
    }
    if (isInProgress) {
      return {
        key: 'in_progress',
        label: isBn ? '⚡ কাজ চলছে (In Progress)' : '⚡ In Progress',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.15)',
        border: 'rgba(56, 189, 248, 0.35)',
        step: 2
      };
    }
    if (isClosed) {
      return {
        key: 'closed',
        label: isBn ? '✕ বন্ধ (Closed)' : '✕ Closed',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.35)',
        step: 3
      };
    }
    return {
      key: 'pending',
      label: isBn ? '⏳ পর্যালোচনায় আছে (Pending)' : '⏳ Pending Review',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.35)',
      step: 1
    };
  };

  const getTypeLabel = (type) => {
    if (type === 'bug') return isBn ? '🐛 সমস্যা (Bug)' : 'Bug Report';
    if (type === 'feature_request') return isBn ? '✨ নতুন ফিচার (Feature)' : 'Feature Request';
    return isBn ? '💡 সাধারণ মতামত (Feedback)' : 'General Feedback';
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'var(--bg-main)',
      color: 'var(--text-main)',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: '40px'
    }}>
      {/* ── TOP STICKY APP BAR ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'details' || viewMode === 'new') {
                setViewMode('list');
                setSelectedTicket(null);
                setFeedbackSuccess(false);
              } else {
                onBack();
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={18} color="#38bdf8" />
              <span>
                {viewMode === 'details'
                  ? (isBn ? 'টিকিট বিবরণ' : 'Ticket Details')
                  : viewMode === 'new'
                    ? (isBn ? 'নতুন সাপোর্ট টিকিট' : 'New Support Ticket')
                    : (isBn ? 'সাপোর্ট ও ফিডব্যাক' : 'Support & Feedback')}
              </span>
            </h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {viewMode === 'details'
                ? `#${selectedTicket?.ticketId || selectedTicket?.id || ''}`
                : isBn ? 'আপনার যেকোনো সমস্যা ও পরামর্শ জানান' : 'Direct developer support & bug tracking'}
            </p>
          </div>
        </div>

        {viewMode === 'list' && (
          <button
            type="button"
            onClick={() => {
              setFeedbackSuccess(false);
              setViewMode('new');
            }}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(14, 165, 233, 0.35)'
            }}
          >
            <Plus size={16} />
            <span>{isBn ? 'নতুন টিকিট' : 'New Ticket'}</span>
          </button>
        )}
      </header>

      {/* ── PAGE CONTENT CONTAINER ── */}
      <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ========================================================= */}
        {/* 1. TICKET DETAILS PAGE (ফুল ডিটেইলস পেজ)                 */}
        {/* ========================================================= */}
        {viewMode === 'details' && selectedTicket && (() => {
          const tkt = selectedTicket;
          const statusMeta = getStatusMeta(tkt.status);
          const adminNote = tkt.adminReply || tkt.adminNote || tkt.admin_reply || tkt.admin_note || tkt.reply || tkt.note;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease' }}>
              {/* Ticket Hero Banner */}
              <div style={{
                background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '18px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#38bdf8' }}>
                        #{tkt.ticketId || tkt.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyTicketId(tkt.ticketId || tkt.id)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: copiedId ? '#10b981' : '#94a3b8',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '0.68rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {copiedId ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedId ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কপি' : 'Copy')}</span>
                      </button>
                    </div>
                    <span style={{
                      fontSize: '0.74rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#cbd5e1',
                      fontWeight: 600
                    }}>
                      {getTypeLabel(tkt.type)}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    padding: '5px 12px',
                    borderRadius: '20px',
                    background: statusMeta.bg,
                    color: statusMeta.color,
                    border: `1px solid ${statusMeta.border}`,
                    boxShadow: `0 2px 10px ${statusMeta.bg}`
                  }}>
                    {statusMeta.label}
                  </span>
                </div>

                {/* Progress Stepper Visual */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: statusMeta.step >= 1 ? 1 : 0.4 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: statusMeta.step >= 1 ? '#38bdf8' : '#64748b', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                      1
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusMeta.step >= 1 ? '#f8fafc' : '#64748b' }}>
                      {isBn ? 'জমা দেওয়া হয়েছে' : 'Submitted'}
                    </span>
                  </div>

                  <div style={{ flex: 1, height: '2px', background: statusMeta.step >= 2 ? '#38bdf8' : 'rgba(255,255,255,0.1)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: statusMeta.step >= 2 ? 1 : 0.4 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: statusMeta.step >= 2 ? '#f59e0b' : '#64748b', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                      2
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusMeta.step >= 2 ? '#f8fafc' : '#64748b' }}>
                      {isBn ? 'পর্যালোচনা' : 'In Review'}
                    </span>
                  </div>

                  <div style={{ flex: 1, height: '2px', background: statusMeta.step >= 3 ? '#10b981' : 'rgba(255,255,255,0.1)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: statusMeta.step >= 3 ? 1 : 0.4 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: statusMeta.step >= 3 ? '#10b981' : '#64748b', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                      ✓
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusMeta.step >= 3 ? '#10b981' : '#64748b' }}>
                      {isBn ? 'সমাধান' : 'Done'}
                    </span>
                  </div>
                </div>
              </div>

              {/* User Original Message Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isBn ? 'আপনার পাঠানো বার্তা / সমস্যা:' : 'Your Original Message / Bug Report:'}
                </span>
                <p style={{
                  fontSize: '0.92rem',
                  color: '#f8fafc',
                  margin: 0,
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line',
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  {tkt.message}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  <span>{isBn ? 'অ্যাপ সংস্করণ:' : 'App Version:'} {tkt.appVersion || '1.2.0'}</span>
                  <span>{new Date(tkt.createdAt).toLocaleString(isBn ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              </div>

              {/* Admin Reply & Note Box */}
              <div style={{
                background: adminNote
                  ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(16, 185, 129, 0.18))'
                  : 'rgba(255, 255, 255, 0.02)',
                border: adminNote
                  ? '1px solid rgba(56, 189, 248, 0.45)'
                  : '1px dashed rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: adminNote ? '0 8px 24px rgba(0, 0, 0, 0.3)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageCircle size={16} color="#38bdf8" />
                    <span>{isBn ? 'অ্যাডমিন নোট ও উত্তর (Admin Response):' : 'Admin Response & Status Note:'}</span>
                  </span>
                  {tkt.updatedAt && (
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {new Date(tkt.updatedAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {adminNote ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{
                      fontSize: '0.94rem',
                      color: '#ffffff',
                      margin: 0,
                      lineHeight: '1.5',
                      fontWeight: 600,
                      background: 'rgba(0,0,0,0.25)',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(56, 189, 248, 0.2)'
                    }}>
                      "{adminNote}"
                    </p>

                    {/* Attached Image Preview */}
                    {(tkt.replyImageUrl || (tkt.replyLink && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(tkt.replyLink))) && (
                      <img
                        src={tkt.replyImageUrl || tkt.replyLink}
                        alt="Attachment"
                        style={{
                          maxHeight: '180px',
                          width: '100%',
                          objectFit: 'contain',
                          borderRadius: '12px',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          background: 'rgba(0, 0, 0, 0.3)'
                        }}
                      />
                    )}

                    {/* Custom Link Button */}
                    {tkt.replyLink && (
                      <a
                        href={tkt.replyLink}
                        target="_system"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(tkt.replyLink, '_system');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px 16px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          textDecoration: 'none',
                          boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)'
                        }}
                      >
                        <span>{tkt.replyLinkLabel || (isBn ? 'লিংক খুলুন' : 'Open Link')}</span>
                        <ChevronRight size={14} />
                      </a>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>
                    {isBn
                      ? 'অ্যাডমিন টিম আপনার বার্তাটি পর্যালোচনা করছে। কোনো আপডেট বা সমাধান হলে এখানে অ্যাডমিন নোট হিসেবে দেখা যাবে।'
                      : 'Our engineering team is currently reviewing your ticket. Any updates will appear here automatically.'}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* 2. CREATE NEW TICKET FORM (নতুন টিকিট পেজ)                */}
        {/* ========================================================= */}
        {viewMode === 'new' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s ease' }}>
            {feedbackSuccess && createdTicketInfo ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.2))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '16px',
                padding: '24px 18px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  {isBn ? 'টিকিট সফলভাবে তৈরি হয়েছে!' : 'Ticket Created Successfully!'}
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#cbd5e1', margin: 0 }}>
                  {isBn ? 'আপনার ট্র্যাকিং নম্বর:' : 'Your Tracking Ticket ID:'}
                </p>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: '#38bdf8',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '8px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  letterSpacing: '1px'
                }}>
                  #{createdTicketInfo.ticketId}
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('list');
                      setFeedbackSuccess(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      background: '#10b981',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.86rem',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {isBn ? 'টিকিট তালিকায় যান' : 'View in Tickets'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackSuccess(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#f8fafc',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  >
                    {isBn ? 'আরেকটি পাঠান' : 'Send Another'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleNewTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Category Selection */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    {isBn ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category'}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
                    {[
                      { key: 'bug', label: isBn ? '🐛 সমস্যা' : 'Bug', desc: isBn ? 'অ্যাপে সমস্যা' : 'App issue' },
                      { key: 'feature_request', label: isBn ? '✨ ফিচার' : 'Feature', desc: isBn ? 'নতুন প্রস্তাব' : 'New request' },
                      { key: 'feedback', label: isBn ? '💡 মতামত' : 'Feedback', desc: isBn ? 'পরামর্শ' : 'General' }
                    ].map((item) => {
                      const isSelected = feedbackType === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setFeedbackType(item.key)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '12px',
                            border: isSelected ? '1px solid #38bdf8' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                            color: isSelected ? '#38bdf8' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>{item.label}</span>
                          <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message TextArea */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
                    {isBn ? 'আপনার বিস্তারিত বার্তা লিখুন' : 'Describe your issue or feedback in detail'}
                  </label>
                  <textarea
                    rows={6}
                    className="form-input"
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder={isBn
                      ? 'কোথায় সমস্যা হচ্ছে বা আপনার কী ফিচার প্রয়োজন তা বিস্তারিতভাবে লিখুন...'
                      : 'Please describe the steps to reproduce or details of your request...'}
                    required
                    style={{
                      marginTop: '6px',
                      borderRadius: '12px',
                      lineHeight: '1.45',
                      fontSize: '0.88rem',
                      padding: '12px'
                    }}
                  />
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={feedbackLoading || !feedbackMessage.trim()}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '14px',
                    background: feedbackLoading || !feedbackMessage.trim()
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    border: 'none',
                    cursor: feedbackLoading || !feedbackMessage.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 16px rgba(14, 165, 233, 0.4)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Send size={18} />
                  <span>
                    {feedbackLoading
                      ? (isBn ? 'টিকিট তৈরি হচ্ছে...' : 'Creating Ticket...')
                      : (isBn ? 'টিকিট জমা দিন' : 'Submit Support Ticket')}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. TICKETS LIST PAGE (সম্পূর্ণ টিকিট তালিকা)                */}
        {/* ========================================================= */}
        {viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.2s ease' }}>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { key: 'all', label: isBn ? 'সব' : 'All', count: userTickets.length },
                { key: 'pending', label: isBn ? 'পর্যালোচনা' : 'Pending', count: userTickets.filter(t => (t.status || 'pending').toLowerCase() === 'pending').length },
                { key: 'in_progress', label: isBn ? 'চলমান' : 'In Progress', count: userTickets.filter(t => (t.status || '').toLowerCase() === 'in_progress').length },
                { key: 'done', label: isBn ? 'সমাধান' : 'Done', count: userTickets.filter(t => ['resolved', 'done', 'fixed'].includes((t.status || '').toLowerCase())).length }
              ].map((f) => {
                const isActive = filterStatus === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilterStatus(f.key)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: isActive ? '1px solid #38bdf8' : '1px solid var(--border-color)',
                      background: isActive ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      color: isActive ? '#38bdf8' : 'var(--text-muted)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>{f.label}</span>
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: isActive ? '#38bdf8' : 'rgba(255,255,255,0.08)',
                      color: isActive ? '#0f172a' : '#cbd5e1',
                      fontWeight: 800
                    }}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Empty State */}
            {filteredTickets.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 18px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '16px',
                border: '1px dashed rgba(255, 255, 255, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Ticket size={42} color="#64748b" />
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0, color: '#94a3b8' }}>
                  {isBn ? 'কোনো সাপোর্ট টিকিট পাওয়া যায়নি' : 'No support tickets found'}
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, maxWidth: '280px' }}>
                  {isBn ? 'আপনার কোনো সমস্যা বা পরামর্শ থাকলে নতুন টিকিট তৈরি করুন।' : 'Submit a new ticket if you encounter any issue or have suggestions.'}
                </p>
                <button
                  type="button"
                  onClick={() => setViewMode('new')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '12px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: '4px'
                  }}
                >
                  {isBn ? '+ নতুন টিকিট তৈরি করুন' : '+ Create New Ticket'}
                </button>
              </div>
            ) : (
              /* Ticket Cards List */
              filteredTickets.map((tkt) => {
                const statusMeta = getStatusMeta(tkt.status);
                const adminNote = tkt.adminReply || tkt.adminNote || tkt.admin_reply || tkt.admin_note || tkt.reply || tkt.note;

                return (
                  <div
                    key={tkt.id || tkt.ticketId}
                    onClick={() => {
                      setSelectedTicket(tkt);
                      setViewMode('details');
                    }}
                    style={{
                      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8' }}>
                          #{tkt.ticketId || tkt.id}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#cbd5e1',
                          fontWeight: 600
                        }}>
                          {getTypeLabel(tkt.type)}
                        </span>
                      </div>

                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '12px',
                        background: statusMeta.bg,
                        color: statusMeta.color,
                        border: `1px solid ${statusMeta.border}`
                      }}>
                        {statusMeta.label}
                      </span>
                    </div>

                    {/* Message Preview */}
                    <p style={{
                      fontSize: '0.84rem',
                      color: '#e2e8f0',
                      margin: 0,
                      lineHeight: '1.4',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '8px 10px',
                      borderRadius: '8px'
                    }}>
                      {tkt.message}
                    </p>

                    {/* Admin Reply Snippet (if exists) */}
                    {(() => {
                      const tktLink = tkt.replyLink || tkt.reply_link || tkt.linkUrl || tkt.link;
                      const tktLinkLabel = tkt.replyLinkLabel || tkt.reply_link_label || tkt.linkLabel || tkt.buttonTitle;
                      const tktImg = tkt.replyImageUrl || tkt.reply_image_url || tkt.imageUrl || tkt.image;

                      if (!adminNote && !tktLink && !tktImg) return null;

                      return (
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(16, 185, 129, 0.15))',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <span style={{
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            color: '#38bdf8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            <MessageCircle size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
                            <span>{isBn ? 'উত্তর:' : 'Reply:'} {adminNote || (isBn ? 'অ্যাডমিনের আপডেট সংযুক্তি' : 'Admin attachment included')}</span>
                          </span>

                          {tktLink && (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: '#0ea5e9',
                              background: 'rgba(14, 165, 233, 0.15)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              width: 'fit-content',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              🔗 {tktLinkLabel || (isBn ? 'অ্যাকশন লিংক' : 'Action Link')}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#64748b' }}>
                      <span>{new Date(tkt.createdAt).toLocaleString(isBn ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span style={{ color: '#38bdf8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span>{isBn ? 'বিস্তারিত দেখুন' : 'View Details'}</span>
                        <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Branding Footer */}
        <div style={{ marginTop: '20px' }}>
          <Footer lang={lang} theme={theme} />
        </div>
      </div>
    </div>
  );
}
