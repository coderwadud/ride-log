import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, Shield, Lock, FileText, Upload, Plus, Trash2, Edit3, 
  Eye, LogOut, Check, FileCheck, FileCode2, Image as ImageIcon, 
  CreditCard, ShieldCheck, AlertCircle, FileSpreadsheet, Download, UserX
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
import { deleteUserAllData } from '../utils/firestoreDB';
import { deleteUserAccount } from '../utils/firebase';

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
  const [selectedFile, setSelectedFile] = useState(null);

  // Edit states
  const [editingDocId, setEditingDocId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('license');

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
        file: selectedFile
      });
      setDocuments(updatedList);
      setShowUploadForm(false);
      setTitle('');
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
      docType: editType
    });
    setDocuments(updated);
    setEditingDocId(null);
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
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
              🔒 {isBn ? '১০০% প্রাইভেট অ্যাপ মেমোরি স্টোরেজ (ROM)' : '🔒 100% Private App ROM Storage'}
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
            <h4 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-main)', fontWeight: 700 }}>
              📄 {isBn ? 'বাইক ডকুমেন্টস' : 'Bike Documents'} ({filteredDocs.length})
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
            <h5 style={{ fontSize: '0.88rem', margin: '0 0 12px 0', color: 'var(--accent-mileage)' }}>
              ➕ {isBn ? 'নতুন ডকুমেন্ট আপলোড করুন' : 'Upload New Document'}
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
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                        ) : (
                          <h5 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {doc.title}
                          </h5>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
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
      </div>
    </div>
  );
}
