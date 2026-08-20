import React, { useState, useEffect, useRef } from 'react';
import {
  X, User, Shield, Lock, FileText, Upload, Plus, Trash2, Edit3,
  Eye, LogOut, Check, FileCheck, FileCode2, Image as ImageIcon,
  CreditCard, ShieldCheck, AlertCircle, FileSpreadsheet, Download,
  MessageSquare, Calendar, Send, Clock, Ticket, CheckCircle2, Clock3, MessageCircle,
  ArrowLeft, ChevronRight, ExternalLink, Briefcase
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  getPrivateDocuments,
  addPrivateDocument,
  updatePrivateDocument,
  deletePrivateDocument,
  downloadOrShareDocument,
  validateDocumentFile
} from '../utils/documentStorage';
import { trackDocumentUploaded, updateLastActiveAt } from '../utils/analytics';
import { submitUserFeedback, listenToUserTickets } from '../utils/firestoreDB';
import { getCurrentAppVersion } from '../utils/appVersion';
import PDFViewerModal from './PDFViewerModal';

const DOC_TYPES = [
  { key: 'license', label: 'ড্রাইভিং লাইসেন্স', labelEn: 'Driving License', icon: CreditCard, color: '#38bdf8' },
  { key: 'registration', label: 'রেজিস্ট্রেশন কার্ড (স্মার্ট কার্ড)', labelEn: 'Registration (Smart Card)', icon: FileCheck, color: '#10b981' },
  { key: 'tax_token', label: 'ট্যাক্স টোকেন', labelEn: 'Tax Token', icon: FileText, color: '#f59e0b' },
  { key: 'fitness', label: 'ফিটনেস সনদ', labelEn: 'Fitness Certificate', icon: ShieldCheck, color: '#8b5cf6' },
  { key: 'insurance', label: 'ইন্স্যুরেন্স পেপার', labelEn: 'Insurance Paper', icon: Shield, color: '#ec4899' },
  { key: 'other', label: 'অন্যান্য ফাইল', labelEn: 'Other Document', icon: FileCode2, color: '#94a3b8' }
];

export default function ProfileModal({
  lang,
  isOpen,
  onClose,
  user,
  settings,
  onUpdateSettings,
  hasJobHolderAccess,
  remoteFeatures,
  bikes = [],
  activeBikeId,
  onLogout,
  onOpenFeedbackPage
}) {
  const fileInputRef = useRef(null);
  const userId = user?.uid || 'guest';

  const [documents, setDocuments] = useState([]);
  const [selectedBikeId, setSelectedBikeId] = useState(activeBikeId || 'all');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('license');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Edit states
  const [editingDocId, setEditingDocId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('license');
  const [editExpiryDate, setEditExpiryDate] = useState('');

  // Ticket count state
  const [userTickets, setUserTickets] = useState([]);

  // Preview Modal state
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadDocs();
    }
  }, [isOpen, userId]);

  // Real-time listener for user tickets count
  useEffect(() => {
    if (isOpen) {
      const unsub = listenToUserTickets(userId, (tickets) => {
        setUserTickets(tickets);
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, [isOpen, userId]);

  const loadDocs = async () => {
    const docs = await getPrivateDocuments(userId);
    setDocuments(docs);
  };

  if (!isOpen) return null;

  const isBn = lang === 'bn';

  const filteredDocs = documents.filter(doc => {
    if (selectedBikeId === 'all') return true;
    return doc.bikeId === selectedBikeId;
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateDocumentFile(file);
      if (!validation.valid) {
        alert(validation.message);
        e.target.value = '';
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      if (!title) {
        // Auto fill title from file name
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setTitle(cleanName);
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert(isBn ? 'অনুগ্রহ করে একটি ফাইল সিলেক্ট করুন' : 'Please select a file');
      return;
    }

    setIsUploading(true);
    try {
      const updatedList = await addPrivateDocument({
        userId,
        bikeId: selectedBikeId === 'all' ? (activeBikeId || 'bike_1') : selectedBikeId,
        title: title || selectedFile.name,
        docType,
        expiryDate,
        file: selectedFile
      });
      setDocuments(updatedList);
      setShowUploadForm(false);
      setTitle('');
      setExpiryDate('');
      setSelectedFile(null);
      setDocType('license');
      // Analytics: track document upload
      trackDocumentUploaded(docType);
      if (userId && userId !== 'guest') updateLastActiveAt(userId);
    } catch (err) {
      console.error('Document upload error:', err);
      alert(err?.message || (isBn ? '❌ ফাইল আপলোড ব্যর্থ হয়েছে' : '❌ Document save failed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveEdit = async (docId) => {
    const updated = await updatePrivateDocument(userId, docId, {
      title: editTitle,
      docType: editType,
      expiryDate: editExpiryDate
    });
    setDocuments(updated);
    setEditingDocId(null);
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;

    setFeedbackLoading(true);
    const dynamicAppVersion = await getCurrentAppVersion();

    try {
      // 1. Save in Firestore database and generate Ticket ID
      const res = await submitUserFeedback({
        uid: user?.uid || 'guest',
        email: user?.email || 'not_provided',
        name: user?.displayName || 'App User',
        type: feedbackType,
        message: feedbackMessage,
        appVersion: dynamicAppVersion
      });

      const assignedTicketId = res?.ticketId || `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
      setSubmittedTicketInfo(assignedTicketId);

      // 2. Send silent background email with Ticket ID to your inbox
      const feedbackPayload = {
        ticketId: `#${assignedTicketId}`,
        name: user?.displayName || 'App User',
        email: user?.email || 'not_provided',
        type: feedbackType === 'bug'
          ? 'Bug / Problem Report (সমস্যা)'
          : feedbackType === 'feature_request'
            ? 'Feature Request (নতুন ফিচার)'
            : 'General Feedback (মতামত)',
        message: feedbackMessage.trim(),
        createdAt: new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' }),
        appVersion: dynamicAppVersion,
        status: 'pending',
        _subject: `[RideLog BD] Ticket #${assignedTicketId} (${feedbackType.toUpperCase()}) from ${user?.displayName || 'User'}`,
        _template: 'table',
        _captcha: 'false'
      };

      fetch('https://formsubmit.co/ajax/waliitsolution@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(feedbackPayload)
      }).catch((err) => console.debug('Direct email delivery notice:', err));

      setFeedbackSuccess(true);
      setFeedbackMessage('');
    } catch (err) {
      console.warn('Feedback submit fallback:', err);
      const fallbackTicket = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
      setSubmittedTicketInfo(fallbackTicket);
      setFeedbackSuccess(true);
      setFeedbackMessage('');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const getExpiryBadge = (expStr) => {
    if (!expStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(expStr);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        bg: 'rgba(239, 68, 68, 0.18)',
        color: '#ef4444',
        border: 'rgba(239, 68, 68, 0.35)',
        label: isBn ? `⚠️ মেয়াদ শেষ (${Math.abs(diffDays)} দিন আগে)` : `⚠️ Expired (${Math.abs(diffDays)}d ago)`
      };
    } else if (diffDays <= 15) {
      return {
        bg: 'rgba(245, 158, 11, 0.18)',
        color: '#f59e0b',
        border: 'rgba(245, 158, 11, 0.35)',
        label: isBn ? `⏳ মেয়াদ শেষ হবে ${diffDays} দিনে` : `⏳ Expires in ${diffDays}d`
      };
    } else {
      return {
        bg: 'rgba(16, 185, 129, 0.15)',
        color: '#10b981',
        border: 'rgba(16, 185, 129, 0.3)',
        label: isBn ? `✓ মেয়াদ: ${expStr}` : `✓ Valid till: ${expStr}`
      };
    }
  };

  const handleDelete = async (docId) => {
    if (confirm(isBn ? 'আপনি কি নিশ্চিত যে এই ডকুমেন্টটি মুছে ফেলবেন?' : 'Are you sure to delete this document?')) {
      const updated = await deletePrivateDocument(userId, docId);
      setDocuments(updated);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getDocumentPreviewUrl = (doc) => {
    if (!doc) return '';
    const fileSrc = doc.fileData || doc.cloudUrl || doc.localUri || '';
    if (typeof fileSrc === 'string' && fileSrc.startsWith('data:application/pdf')) {
      try {
        const cleanBase64 = fileSrc.replace(/^data:.*?;base64,/, '');
        const byteCharacters = atob(cleanBase64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blob = new Blob(byteArrays, { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      } catch (e) {
        console.warn('PDF blob generation fallback:', e);
      }
    }
    return fileSrc;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxHeight: '92vh', overflowY: 'auto', maxWidth: '520px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={22} color="var(--accent-mileage)" />
            <h3 style={{ fontSize: '1.1rem' }}>
              {isBn ? 'প্রোফাইল ও বাইক ডকুমেন্টস' : 'Profile & Bike Documents'}
            </h3>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* ===== User Profile Summary Card ===== */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              referrerPolicy="no-referrer"
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid rgba(56, 189, 248, 0.4)'
              }}
            />
          ) : (
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #38bdf8, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)'
            }}>
              {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.displayName || (isBn ? 'রাইডার প্রোফাইল' : 'Rider Profile')}
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email || (isBn ? 'অফলাইন প্রোফাইল' : 'Offline Account')}
            </p>
          </div>
        </div>



        {/* ===== Storage Privacy Notice Card ===== */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <Shield size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} color="#10b981" />
              <span>{isBn ? '১০০% প্রাইভেট অ্যাপ মেমোরি স্টোরেজ (ROM)' : '100% Private App ROM Storage'}</span>
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: '1.4' }}>
              {isBn
                ? 'ডকুমেন্টগুলো কোনো ক্লাউড সার্ভারে যাবে না। ফোনের গোপন অ্যাপ ফোল্ডারে সংরক্ষিত থাকবে। ফোনের গ্যালারি বা ফাইল ম্যানেজারে এগুলো দেখা যাবে না।'
                : 'Documents are stored securely inside the app private memory. Completely hidden from phone gallery & external file managers.'}
            </p>
          </div>
        </div>

        {/* ===== Bike Selector Filter & Add Button Header ===== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h4 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-main)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} color="var(--accent-mileage)" />
              <span>{isBn ? 'বাইক ডকুমেন্টস' : 'Bike Documents'} ({filteredDocs.length})</span>
            </h4>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUploadForm(!showUploadForm)}
            style={{ padding: '6px 12px', fontSize: '0.78rem', gap: '6px' }}
          >
            {showUploadForm ? <X size={15} /> : <Plus size={15} />}
            <span>{showUploadForm ? (isBn ? 'বাতিল' : 'Cancel') : (isBn ? 'আপলোড করুন' : 'Upload Doc')}</span>
          </button>
        </div>

        {/* ===== Upload Form Dropdown ===== */}
        {showUploadForm && (
          <form
            onSubmit={handleUploadSubmit}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed var(--accent-mileage)',
              borderRadius: '14px',
              padding: '14px',
              marginBottom: '18px'
            }}
          >
            <h5 style={{ fontSize: '0.88rem', margin: '0 0 12px 0', color: 'var(--accent-mileage)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} color="var(--accent-mileage)" />
              <span>{isBn ? 'নতুন ডকুমেন্ট আপলোড করুন' : 'Upload New Document'}</span>
            </h5>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label">{isBn ? 'ডকুমেন্টের নাম' : 'Document Title'}</label>
              <input
                type="text"
                className="form-input"
                placeholder={isBn ? 'যেমন: স্মার্ট কার্ড / ড্রাইভিং লাইসেন্স' : 'e.g. Smart Card 2026'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label">{isBn ? 'ডকুমেন্ট ক্যাটাগরি' : 'Document Type'}</label>
              <select
                className="form-select"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map(type => (
                  <option key={type.key} value={type.key}>
                    {isBn ? type.label : type.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="var(--accent-mileage)" />
                <span>{isBn ? 'মেয়াদ উত্তীর্ণের তারিখ (ঐচ্ছিক)' : 'Expiry Date (Optional)'}</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">
                {isBn ? 'ফাইল সিলেক্ট করুন (সর্বোচ্চ ৫০০ KB - JPG, PNG, WEBP, PDF)' : 'Select File (Max 500 KB - JPG, PNG, WEBP, PDF)'}
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                className="form-input"
                onChange={handleFileChange}
                required
              />
              {selectedFile && (
                <p style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '4px' }}>
                  ✓ {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUploading}
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
            >
              <Upload size={16} />
              <span>{isUploading ? (isBn ? 'সংরক্ষিত হচ্ছে...' : 'Saving...') : (isBn ? 'প্রাইভেট মেমোরিতে সেভ করুন' : 'Save Privately')}</span>
            </button>
          </form>
        )}

        {/* ===== Documents List ===== */}
        {filteredDocs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '30px 15px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '14px',
            border: '1px dashed var(--border-color)',
            marginBottom: '20px'
          }}>
            <FileText size={36} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              {isBn ? 'কোনো গোপন ডকুমেন্ট আপলোড করা হয়নি।' : 'No private documents uploaded yet.'}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>
              {isBn ? 'উপরের "আপলোড করুন" বাটনে চাপ দিয়ে লাইসেন্স বা পেপারস সেভ করে রাখুন।' : 'Click "Upload Doc" above to keep your papers safe.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {filteredDocs.map(doc => {
              const categoryInfo = DOC_TYPES.find(t => t.key === doc.docType) || DOC_TYPES[5];
              const IconComp = categoryInfo.icon;
              const isEditing = editingDocId === doc.id;
              const expBadge = getExpiryBadge(doc.expiryDate);

              return (
                <div
                  key={doc.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: '10px',
                        background: `${categoryInfo.color}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: categoryInfo.color,
                        flexShrink: 0
                      }}>
                        <IconComp size={20} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
                            <input
                              type="text"
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                            />
                            <input
                              type="date"
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                              value={editExpiryDate}
                              onChange={(e) => setEditExpiryDate(e.target.value)}
                            />
                          </div>
                        ) : (
                          <h5 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {doc.title}
                          </h5>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: `${categoryInfo.color}20`,
                            color: categoryInfo.color
                          }}>
                            {isBn ? categoryInfo.label : categoryInfo.labelEn}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {formatFileSize(doc.fileSize)}
                          </span>

                          {/* Expiry Badge */}
                          {expBadge && !isEditing && (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: expBadge.bg,
                              color: expBadge.color,
                              border: `1px solid ${expBadge.border}`
                            }}>
                              {expBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {/* View / Preview */}
                      <button
                        type="button"
                        className="btn btn-icon"
                        onClick={() => setPreviewDoc(doc)}
                        title={isBn ? 'ডকুমেন্ট দেখুন' : 'View Document'}
                        style={{ color: 'var(--accent-mileage)', borderColor: 'rgba(56,189,248,0.2)' }}
                      >
                        <Eye size={16} />
                      </button>

                      {/* Download Direct */}
                      <button
                        type="button"
                        className="btn btn-icon"
                        onClick={() => downloadOrShareDocument(doc)}
                        title={isBn ? 'ডাউনলোড করুন' : 'Download Document'}
                        style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.25)' }}
                      >
                        <Download size={16} />
                      </button>

                      {/* Edit / Save */}
                      {isEditing ? (
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => handleSaveEdit(doc.id)}
                          title={isBn ? 'সেভ করুন' : 'Save Edit'}
                          style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
                        >
                          <Check size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => {
                            setEditingDocId(doc.id);
                            setEditTitle(doc.title);
                            setEditType(doc.docType);
                            setEditExpiryDate(doc.expiryDate || '');
                          }}
                          title={isBn ? 'এডিট করুন' : 'Edit Document'}
                        >
                          <Edit3 size={15} color="var(--text-muted)" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        className="btn btn-icon"
                        onClick={() => handleDelete(doc.id)}
                        title={isBn ? 'মুছে ফেলুন' : 'Delete Document'}
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== Corporate Job Holder Mode Settings (Only visible if Admin granted access or Master is ON) ===== */}
        {hasJobHolderAccess && (
          <div style={{
            background: 'var(--card-bg, rgba(255,255,255,0.04))',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings?.jobHolderMode ? '14px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Briefcase size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {isBn ? '💼 কর্পোরেট / জব হোল্ডার মোড' : '💼 Corporate / Job Holder Mode'}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {isBn ? 'মাসিক কনভেয়েন্স ভাতা ও সেভিংস ট্র্যাকিং' : 'Monthly Conveyance Allowance & Savings'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, margin: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(settings?.jobHolderMode)}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    onUpdateSettings?.({
                      ...settings,
                      jobHolderMode: isChecked,
                      monthlyConveyance: settings?.monthlyConveyance || 7000
                    });
                  }}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: settings?.jobHolderMode ? '#10b981' : 'rgba(148, 163, 184, 0.3)',
                  transition: '0.3s',
                  borderRadius: 24
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: 18,
                    width: 18,
                    left: settings?.jobHolderMode ? 23 : 3,
                    bottom: 3,
                    backgroundColor: '#ffffff',
                    transition: '0.3s',
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </span>
              </label>
            </div>

            {/* Allowance Input (Only shown when mode is ON) */}
            {settings?.jobHolderMode && (
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255,255,255,0.06)'
              }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {isBn ? 'অফিস থেকে প্রাপ্ত মাসিক বাইক কনভেয়েন্স ভাতা (টাকা):' : 'Monthly Bike Conveyance Allowance (৳):'}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#38bdf8' }}>৳</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={settings?.monthlyConveyance || ''}
                    placeholder="7000"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateSettings?.({ ...settings, monthlyConveyance: val });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 30px',
                      background: 'var(--bg-main, rgba(0,0,0,0.2))',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Quick select presets */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {[7000, 10000, 15000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => onUpdateSettings?.({ ...settings, monthlyConveyance: amt })}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: settings?.monthlyConveyance === amt ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                        color: settings?.monthlyConveyance === amt ? '#38bdf8' : 'var(--text-muted)',
                        border: settings?.monthlyConveyance === amt ? '1px solid #38bdf8' : '1px solid transparent',
                        cursor: 'pointer'
                      }}
                    >
                      ৳{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Support & Tickets Action Row ===== */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {/* Button 1: Send Feedback / New Ticket */}
          <button
            type="button"
            className="btn"
            onClick={() => {
              onClose();
              onOpenFeedbackPage?.('new');
            }}
            style={{
              flex: userTickets.length > 0 ? 1 : 'unset',
              width: userTickets.length > 0 ? 'auto' : '100%',
              background: 'rgba(56, 189, 248, 0.1)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '12px',
              fontSize: '0.84rem',
              fontWeight: 700,
              padding: '11px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <MessageSquare size={16} />
            <span>{isBn ? 'ফিডব্যাক / রিপোর্ট' : 'Send Feedback'}</span>
          </button>

          {/* Button 2: My Support Tickets Button (Visible if user has tickets) */}
          {userTickets.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                onClose();
                onOpenFeedbackPage?.('list');
              }}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.2))',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px',
                fontSize: '0.84rem',
                fontWeight: 700,
                padding: '11px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.15)'
              }}
            >
              <Ticket size={16} />
              <span>{isBn ? 'আমার টিকিট' : 'My Tickets'}</span>
              <span style={{
                background: '#10b981',
                color: '#ffffff',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>
                {userTickets.length}
              </span>
            </button>
          )}
        </div>

        {/* ===== Logout Section ===== */}
        {onLogout && (
          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn"
              onClick={() => { onClose(); onLogout(); }}
              style={{
                width: '100%',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: 700,
                padding: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <LogOut size={17} />
              <span>{isBn ? 'অ্যাকাউন্ট লগআউট করুন' : 'Logout Account'}</span>
            </button>
          </div>
        )}

        {/* ===== Document Preview Sub-Modal ===== */}
        {previewDoc && (() => {
          const isPdf = previewDoc.fileType?.includes('pdf') || previewDoc.fileData?.startsWith('data:application/pdf') || previewDoc.fileName?.toLowerCase().endsWith('.pdf');
          
          if (isPdf) {
            return (
              <PDFViewerModal
                isOpen={!!previewDoc}
                document={previewDoc}
                onClose={() => setPreviewDoc(null)}
                onDownloadOrShare={downloadOrShareDocument}
                lang={lang}
              />
            );
          }

          const displayUrl = getDocumentPreviewUrl(previewDoc);

          return (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.94)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                padding: '12px'
              }}
              onClick={() => setPreviewDoc(null)}
            >
              {/* Preview Header */}
              <div style={{ paddingTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ minWidth: 0, flex: 1, marginRight: '10px' }}>
                  <h4 style={{ fontSize: '0.98rem', color: '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {previewDoc.title}
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '2px 0 0' }}>
                    🖼️ Image Document • {formatFileSize(previewDoc.fileSize)}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadOrShareDocument(previewDoc);
                    }}
                    title={isBn ? 'ডাউনলোড / শেয়ার' : 'Download / Share'}
                    style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                  >
                    <Download size={17} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => setPreviewDoc(null)}
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Preview Body */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  width: '100%',
                  height: 'calc(100% - 50px)',
                  borderRadius: '12px',
                  background: 'transparent'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={displayUrl}
                  alt={previewDoc.title}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
