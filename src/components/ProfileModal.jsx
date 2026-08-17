import React, { useState, useEffect, useRef } from 'react';
import {
  X, User, Shield, Lock, FileText, Upload, Plus, Trash2, Edit3,
  Eye, LogOut, Check, FileCheck, FileCode2, Image as ImageIcon,
  CreditCard, ShieldCheck, AlertCircle, FileSpreadsheet, Download, UserX,
  MessageSquare, Calendar, Send, Clock, Ticket, CheckCircle2, Clock3, MessageCircle
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  getPrivateDocuments,
  addPrivateDocument,
  updatePrivateDocument,
  deletePrivateDocument,
  downloadOrShareDocument
} from '../utils/documentStorage';
import { trackDocumentUploaded, updateLastActiveAt } from '../utils/analytics';
import { deleteUserAllData, submitUserFeedback, listenToUserTickets } from '../utils/firestoreDB';
import { deleteUserAccount } from '../utils/firebase';
import { getCurrentAppVersion } from '../utils/appVersion';

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
  bikes = [],
  activeBikeId,
  onLogout
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

  // Feedback & Ticket states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackActiveSubTab, setFeedbackActiveSubTab] = useState('new'); // 'new' or 'tickets'
  const [feedbackType, setFeedbackType] = useState('feedback');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [submittedTicketInfo, setSubmittedTicketInfo] = useState(null);
  const [userTickets, setUserTickets] = useState([]);

  // Preview Modal state
  const [previewDoc, setPreviewDoc] = useState(null);

  // Account Deactivation states
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateStep, setDeactivateStep] = useState(1); // 1 = warning, 2 = final confirm

  useEffect(() => {
    if (isOpen) {
      loadDocs();
    }
  }, [isOpen, userId]);

  // Real-time listener for user tickets & status
  useEffect(() => {
    if (showFeedbackModal) {
      const unsub = listenToUserTickets(userId, (tickets) => {
        setUserTickets(tickets);
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, [showFeedbackModal, userId]);

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
      if (file.size > 25 * 1024 * 1024) {
        alert(isBn ? '❌ ফাইলের সাইজ ২৫MB এর নিচে হতে হবে!' : '❌ File size must be under 25MB!');
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
      alert(isBn ? '❌ ফাইল আপলোড ব্যর্থ হয়েছে' : '❌ Document save failed');
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

  const handleDeactivateAccount = async () => {
    if (deactivateStep === 1) {
      setDeactivateStep(2);
      return;
    }

    setDeactivateLoading(true);
    try {
      // Step 1: Delete all Firestore user data
      await deleteUserAllData(userId);
      // Step 2: Delete Firebase Auth account
      await deleteUserAccount();
      // onAuthChange in App.jsx will auto-detect logout and navigate to login screen
    } catch (err) {
      console.error('Account deletion error:', err);
      if (err?.code === 'auth/requires-recent-login') {
        alert(isBn
          ? '⚠️ নিরাপত্তার জন্য, অনুগ্রহ করে লগআউট করে আবার লগইন করুন, তারপর আবার চেষ্টা করুন।'
          : '⚠️ For security, please logout and login again, then retry account deletion.');
        setShowDeactivateConfirm(false);
        setDeactivateStep(1);
      } else {
        alert(isBn ? '❌ একাউন্ট ডিলিট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : '❌ Account deletion failed. Please try again.');
      }
    } finally {
      setDeactivateLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
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
              <label className="form-label">{isBn ? 'ফাইল সিলেক্ট করুন (ছবি/PDF)' : 'Select File (Image/PDF)'}</label>
              <input
                type="file"
                accept="image/*,application/pdf"
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
              const isImage = doc.fileType?.startsWith('image/') || doc.fileData?.startsWith('data:image/');
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

        {/* ===== Send Feedback / Support Button ===== */}
        <div style={{ marginBottom: '14px' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowFeedbackModal(true)}
            style={{
              width: '100%',
              background: 'rgba(56, 189, 248, 0.1)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '12px',
              fontSize: '0.86rem',
              fontWeight: 700,
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <MessageSquare size={17} />
            <span>{isBn ? 'মতামত বা সমস্যা জানান (সাপোর্ট)' : 'Send Feedback or Report Bug'}</span>
          </button>
        </div>

        {/* ===== Logout & Deactivate Section ===== */}
        {onLogout && (
          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Logout Button */}
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

            {/* Deactivate Account Button */}
            {user && (
              <button
                type="button"
                className="btn"
                onClick={() => { setShowDeactivateConfirm(true); setDeactivateStep(1); }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid rgba(107, 114, 128, 0.25)',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  transition: 'all 0.2s ease'
                }}
              >
                <UserX size={15} />
                <span>{isBn ? 'একাউন্ট স্থায়ীভাবে মুছে ফেলুন' : 'Permanently Delete Account'}</span>
              </button>
            )}
          </div>
        )}

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
                    ? (isBn ? '⚠️ একাউন্ট ডিলিট করবেন?' : '⚠️ Delete Account?')
                    : (isBn ? '🚨 শেষ সুযোগ!' : '🚨 Last Warning!')
                  }
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, lineHeight: '1.6' }}>
                  {deactivateStep === 1
                    ? (isBn
                      ? 'এই অ্যাকশনটি সম্পূর্ণ অপরিবর্তনীয়। আপনার সমস্ত বাইক ডাটা, ফুয়েল লগ, সার্ভিস লগ ও ডকুমেন্ট চিরতরে মুছে যাবে।'
                      : 'This action is completely irreversible. All your bike data, fuel logs, service logs, and documents will be permanently erased.')
                    : (isBn
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
                      ? (isBn ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...')
                      : deactivateStep === 1
                        ? (isBn ? 'পরের ধাপ →' : 'Next Step →')
                        : (isBn ? 'হ্যাঁ, চিরতরে ডিলিট করুন' : 'Yes, Permanently Delete')
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
                  {isBn ? 'বাতিল করুন' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Document Preview Sub-Modal ===== */}
        {previewDoc && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.9)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px'
            }}
            onClick={() => setPreviewDoc(null)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ fontSize: '1rem', color: '#ffffff', margin: 0 }}>
                  {previewDoc.title}
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>
                  {formatFileSize(previewDoc.fileSize)}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadOrShareDocument(previewDoc);
                  }}
                  title={isBn ? 'ডাউনলোড করুন' : 'Download Document'}
                  style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                >
                  <Download size={18} />
                </button>

                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => setPreviewDoc(null)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                width: '100%'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {previewDoc.fileData?.startsWith('data:image/') || previewDoc.fileType?.startsWith('image/') ? (
                <img
                  src={previewDoc.fileData || previewDoc.localUri}
                  alt={previewDoc.title}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '16px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444'
                  }}>
                    <FileText size={36} />
                  </div>

                  <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                    <h4 style={{ fontSize: '1.05rem', color: '#ffffff', margin: '0 0 6px 0', fontWeight: 700 }}>
                      {previewDoc.title}
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                      📄 {isBn ? 'এটি একটি PDF ডকুমেন্ট' : 'This is a PDF Document'} ({formatFileSize(previewDoc.fileSize)})
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => downloadOrShareDocument(previewDoc)}
                    style={{
                      padding: '12px 24px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#ffffff',
                      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={18} />
                    <span>{isBn ? 'PDF রিডার দিয়ে খুলুন / সেভ করুন' : 'Open / Save PDF'}</span>
                  </button>

                  {!Capacitor.isNativePlatform() && (
                    <iframe
                      src={previewDoc.fileData || previewDoc.localUri}
                      title={previewDoc.title}
                      style={{ width: '100%', height: '350px', border: 'none', background: '#ffffff', borderRadius: '8px', marginTop: '12px' }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Feedback & Support Modal ===== */}
        {showFeedbackModal && (
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
            onClick={() => setShowFeedbackModal(false)}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '20px',
                padding: '24px',
                maxWidth: '420px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={20} color="#38bdf8" />
                  <h4 style={{ fontSize: '1.05rem', color: '#ffffff', margin: 0, fontWeight: 700 }}>
                    {isBn ? 'সাপোর্ট ও ফিডব্যাক টিকিট' : 'Support & Feedback'}
                  </h4>
                </div>
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => setShowFeedbackModal(false)}
                  style={{ color: '#94a3b8' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sub-Tab Switcher: New vs My Tickets */}
              <div style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '12px',
                gap: '4px'
              }}>
                <button
                  type="button"
                  onClick={() => { setFeedbackActiveSubTab('new'); setFeedbackSuccess(false); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '9px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: feedbackActiveSubTab === 'new' ? '#0284c7' : 'transparent',
                    color: feedbackActiveSubTab === 'new' ? '#ffffff' : '#94a3b8',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={14} />
                  <span>{isBn ? 'নতুন মেসেজ' : 'New Ticket'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFeedbackActiveSubTab('tickets')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '9px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: feedbackActiveSubTab === 'tickets' ? '#10b981' : 'transparent',
                    color: feedbackActiveSubTab === 'tickets' ? '#ffffff' : '#94a3b8',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Ticket size={14} />
                  <span>{isBn ? 'আমার টিকিটসমূহ' : 'My Tickets'}</span>
                  {userTickets.length > 0 && (
                    <span style={{
                      background: 'rgba(0, 0, 0, 0.35)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}>
                      {userTickets.length}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: NEW TICKET FORM */}
              {feedbackActiveSubTab === 'new' && (
                <>
                  {feedbackSuccess ? (
                    <div style={{
                      padding: '20px 16px',
                      textAlign: 'center',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: '14px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <CheckCircle2 size={38} color="#10b981" />
                      <div>
                        <h5 style={{ color: '#10b981', fontSize: '1.05rem', margin: '0 0 4px 0', fontWeight: 800 }}>
                          {isBn ? 'সাপোর্ট টিকিট সফলভাবে তৈরি হয়েছে!' : 'Support Ticket Created!'}
                        </h5>
                        <div style={{
                          display: 'inline-block',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          padding: '3px 12px',
                          borderRadius: '20px',
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          margin: '4px 0 8px'
                        }}>
                          #{submittedTicketInfo}
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: '1.4' }}>
                          {isBn 
                            ? 'আপনার টিকিটটি রিভিউ করা হচ্ছে। "আমার টিকিটসমূহ" ট্যাবে যেকোনা সময় অগ্রগতির স্ট্যাটাস দেখতে পারবেন।' 
                            : 'Your ticket is being reviewed. You can track its progress under "My Tickets" tab anytime.'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setFeedbackActiveSubTab('tickets')}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '10px',
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            cursor: 'pointer'
                          }}
                        >
                          {isBn ? '🎫 টিকিট স্ট্যাটাস দেখুন' : 'View Tickets'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFeedbackSuccess(false); setSubmittedTicketInfo(null); }}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#e2e8f0',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            cursor: 'pointer'
                          }}
                        >
                          {isBn ? '+ নতুন আরেকটি পাঠান' : '+ Submit Another'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">{isBn ? 'মেসেজের ধরন / ক্যাটাগরি' : 'Feedback Category'}</label>
                        <select
                          className="form-select"
                          value={feedbackType}
                          onChange={(e) => setFeedbackType(e.target.value)}
                        >
                          <option value="feedback">{isBn ? '💡 সাধারণ মতামত / পরামর্শ' : '💡 General Feedback / Suggestion'}</option>
                          <option value="bug">{isBn ? '🐛 কোনো সমস্যা / বাগ রিপোর্ট' : '🐛 Bug / Problem Report'}</option>
                          <option value="feature_request">{isBn ? '✨ নতুন ফিচারের অনুরোধ' : '✨ Feature Request'}</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">{isBn ? 'আপনার বার্তা বিস্তারিত লিখুন' : 'Detailed Message'}</label>
                        <textarea
                          className="form-input"
                          rows={4}
                          placeholder={isBn ? 'আপনার সমস্যা বা মতামত বিস্তারিতভাবে লিখুন...' : 'Type your message or issue details here...'}
                          value={feedbackMessage}
                          onChange={(e) => setFeedbackMessage(e.target.value)}
                          required
                          style={{ resize: 'vertical', minHeight: '85px' }}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={feedbackLoading || !feedbackMessage.trim()}
                        style={{
                          padding: '11px',
                          fontSize: '0.88rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <Send size={16} />
                        <span>
                          {feedbackLoading
                            ? (isBn ? 'টিকিট তৈরি হচ্ছে...' : 'Creating Ticket...')
                            : (isBn ? 'মেসেজ পাঠান' : 'Submit Ticket')}
                        </span>
                      </button>
                    </form>
                  )}
                </>
              )}

              {/* TAB 2: MY TICKETS & STATUS TRACKER */}
              {feedbackActiveSubTab === 'tickets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto', paddingRight: '2px' }}>
                  {userTickets.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '30px 16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '14px',
                      border: '1px dashed rgba(255, 255, 255, 0.1)'
                    }}>
                      <Ticket size={34} color="#64748b" style={{ margin: '0 auto 8px' }} />
                      <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 8px 0' }}>
                        {isBn ? 'আপনার কোনো সাপোর্ট টিকিট পাওয়া যায়নি।' : 'No support tickets found.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setFeedbackActiveSubTab('new')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {isBn ? '+ নতুন টিকিট তৈরি করুন' : '+ Create New Ticket'}
                      </button>
                    </div>
                  ) : (
                    userTickets.map((tkt) => {
                      const status = tkt.status || 'pending';
                      const isPending = status === 'pending';
                      const isInProgress = status === 'in_progress';
                      const isResolved = status === 'resolved';

                      const statusColor = isResolved ? '#10b981' : isInProgress ? '#38bdf8' : isPending ? '#f59e0b' : '#ef4444';
                      const statusBg = isResolved ? 'rgba(16, 185, 129, 0.15)' : isInProgress ? 'rgba(56, 189, 248, 0.15)' : isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                      const statusBorder = isResolved ? 'rgba(16, 185, 129, 0.35)' : isInProgress ? 'rgba(56, 189, 248, 0.35)' : isPending ? 'rgba(245, 158, 11, 0.35)' : 'rgba(239, 68, 68, 0.35)';
                      
                      const statusLabel = isResolved
                        ? (isBn ? '✓ সমাধান হয়েছে (Resolved)' : '✓ Resolved')
                        : isInProgress
                          ? (isBn ? '⚡ কাজ চলছে (In Progress)' : '⚡ In Progress')
                          : isPending
                            ? (isBn ? '⏳ পর্যালোচনায় আছে (Pending)' : '⏳ Pending Review')
                            : (isBn ? '✕ বন্ধ (Closed)' : '✕ Closed');

                      const typeName = tkt.type === 'bug'
                        ? (isBn ? '🐛 সমস্যা' : 'Bug')
                        : tkt.type === 'feature_request'
                          ? (isBn ? '✨ ফিচার' : 'Feature')
                          : (isBn ? '💡 মতামত' : 'Feedback');

                      return (
                        <div
                          key={tkt.id || tkt.ticketId}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '14px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {/* Ticket Header & Status Badge */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38bdf8' }}>
                                #{tkt.ticketId || tkt.id}
                              </span>
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: '#cbd5e1',
                                fontWeight: 600
                              }}>
                                {typeName}
                              </span>
                            </div>

                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '12px',
                              background: statusBg,
                              color: statusColor,
                              border: `1px solid ${statusBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* User Message */}
                          <p style={{
                            fontSize: '0.82rem',
                            color: '#e2e8f0',
                            margin: 0,
                            lineHeight: '1.4',
                            whiteSpace: 'pre-line',
                            background: 'rgba(0, 0, 0, 0.2)',
                            padding: '8px 10px',
                            borderRadius: '8px'
                          }}>
                            {tkt.message}
                          </p>

                          {/* Admin Reply Box if present */}
                          {tkt.adminReply && (
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(16, 185, 129, 0.12))',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              borderRadius: '10px',
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px'
                            }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MessageCircle size={12} />
                                <span>{isBn ? 'অ্যাডমিনের উত্তর:' : 'Admin Reply:'}</span>
                              </span>
                              <p style={{ fontSize: '0.8rem', color: '#f1f5f9', margin: 0, lineHeight: '1.4' }}>
                                {tkt.adminReply}
                              </p>
                            </div>
                          )}

                          {/* Timestamp */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.68rem', color: '#64748b' }}>
                            <span>{new Date(tkt.createdAt).toLocaleString(isBn ? 'bn-BD' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
