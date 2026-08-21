import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Image as ImageIcon, Plus, Trash2, X, Download,
  Share2, HardDrive, Sparkles, User, Check, AlertCircle, Loader,
  Film, FileText, ExternalLink, Play, Cloud, CloudCheck, UploadCloud
} from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToTourGallery, addTourPhoto, deleteTourPhoto } from '../utils/tourStorage';
import {
  getDriveAccessToken,
  getTourDriveFolder,
  uploadMediaToGoogleDrive
} from '../utils/googleDriveStorage';
import { uploadDocumentToCloudinary } from '../utils/cloudinary';

export default function TourGalleryTab({ tourId, tour, lang = 'bn', user, isOrganizer }) {
  const t = translations[lang] || translations['bn'];
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [photos, setPhotos] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [hasDriveToken, setHasDriveToken] = useState(false);

  // Selected local file state before upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [driveApiNotEnabled, setDriveApiNotEnabled] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    if (!tourId) return;
    const unsub = listenToTourGallery(tourId, setPhotos);

    // Check if Google Drive token is currently cached in session
    const token = sessionStorage.getItem('rl_drive_token');
    const exp = sessionStorage.getItem('rl_drive_token_exp');
    if (token && exp && Number(exp) > Date.now()) {
      setHasDriveToken(true);
    }

    return unsub;
  }, [tourId]);

  // Connect / Authorize Google Drive with drive.file scope
  const handleConnectDrive = async () => {
    setDriveConnecting(true);
    setUploadError('');
    try {
      const token = await getDriveAccessToken();
      if (token) {
        setHasDriveToken(true);
      }
    } catch (err) {
      console.error('Drive connection error:', err);
      setUploadError(lang === 'bn' ? 'গুগল ড্রাইভ কানেক্ট করা সম্ভব হয়নি: ' + err.message : 'Failed to connect Google Drive: ' + err.message);
    } finally {
      setDriveConnecting(false);
    }
  };

  // Handle local file selection (Images, Videos, PDFs)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadError('');
    setDriveApiNotEnabled(false);

    let previewUrl = null;
    let fileType = 'other';

    if (file.type.startsWith('image/')) {
      fileType = 'image';
      previewUrl = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
      fileType = 'video';
      previewUrl = URL.createObjectURL(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      fileType = 'pdf';
    }

    setFilePreview({ url: previewUrl, type: fileType, name: file.name, size: file.size });
    setShowUploadModal(true);
    e.target.value = '';
  };

  // 1. Upload to Google Drive (Zero Firebase storage)
  const handleSaveToDrive = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    setDriveApiNotEnabled(false);
    setUploadProgress(lang === 'bn' ? 'গুগল ড্রাইভ অথেনটিকেশন যাচাই হচ্ছে...' : 'Authenticating Google Drive...');

    try {
      const token = await getDriveAccessToken();
      if (!token) throw new Error('Google Drive authentication failed');
      setHasDriveToken(true);

      setUploadProgress(lang === 'bn' ? 'ড্রাইভে ট্যুর ফোল্ডার প্রস্তুত হচ্ছে...' : 'Setting up Tour folder in Drive...');
      const folderId = await getTourDriveFolder(token, tour?.title || 'RideLog Tour');

      setUploadProgress(lang === 'bn' ? 'ফাইল আপনার গুগল ড্রাইভে আপলোড হচ্ছে...' : 'Uploading file to your Google Drive...');
      const driveMedia = await uploadMediaToGoogleDrive(token, selectedFile, folderId, caption);

      setUploadProgress(lang === 'bn' ? 'ট্যুর মেম্বারদের জন্য তথ্য সংরক্ষণ হচ্ছে...' : 'Saving to Tour Gallery...');
      await addTourPhoto(tourId, {
        ...driveMedia,
        caption: caption.trim(),
        uploadedBy: user?.uid || 'anonymous',
        uploaderName: user?.displayName || user?.email?.split('@')[0] || 'Rider',
        uploaderPhoto: user?.photoURL || '',
        source: 'google_drive'
      });

      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      setSelectedFile(null);
      setFilePreview(null);
      setCaption('');
      setShowUploadModal(false);
    } catch (err) {
      console.error('Upload to Drive error:', err);
      const errMsg = err.message || '';
      if (errMsg.includes('Google Drive API has not been used') || errMsg.includes('drive.googleapis.com') || errMsg.includes('disabled')) {
        setDriveApiNotEnabled(true);
        setUploadError(errMsg);
      } else {
        setUploadError(errMsg || 'Upload failed');
      }
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  // 2. Upload to Cloudinary CDN (Zero Firebase storage)
  const handleCloudinaryUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    setUploadProgress(lang === 'bn' ? 'ক্লাউড সিডিএন-এ ফাইল আপলোড হচ্ছে...' : 'Uploading to Cloud CDN...');

    try {
      const res = await uploadDocumentToCloudinary(selectedFile);
      if (!res.success || !res.url) {
        throw new Error(res.error || 'Cloud upload failed');
      }

      setUploadProgress(lang === 'bn' ? 'ট্যুর মেম্বারদের জন্য তথ্য সংরক্ষণ হচ্ছে...' : 'Saving to Tour Gallery...');
      await addTourPhoto(tourId, {
        photoUrl: res.url,
        previewUrl: res.url,
        thumbnailUrl: res.url,
        downloadUrl: res.url,
        fileName: selectedFile.name,
        fileType: filePreview?.type || 'image',
        mimeType: selectedFile.type || 'image/jpeg',
        fileSizeBytes: selectedFile.size || res.bytes || 0,
        caption: caption.trim(),
        uploadedBy: user?.uid || 'anonymous',
        uploaderName: user?.displayName || user?.email?.split('@')[0] || 'Rider',
        uploaderPhoto: user?.photoURL || '',
        source: 'cloudinary'
      });

      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      setSelectedFile(null);
      setFilePreview(null);
      setCaption('');
      setShowUploadModal(false);
    } catch (err) {
      console.error('Cloud upload error:', err);
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(lang === 'bn' ? 'এই ফাইলটি ট্যুর গ্যালারি থেকে সরাবেন?' : 'Remove this item from tour gallery?')) return;
    await deleteTourPhoto(tourId, item.id);
    if (selectedItem?.id === item.id) setSelectedItem(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="tour-gallery-tab">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Google Drive Status & Action Header */}
      <div className="tour-gallery-header">
        <div className="tour-gallery-count">
          <HardDrive size={16} className="text-indigo-400" />
          <span>{photos.length} {lang === 'bn' ? 'টি ফাইল (ছবি, ভিডিও ও PDF)' : 'Files (Photos, Videos & Docs)'}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!hasDriveToken ? (
            <button
              className="tour-btn-ghost small"
              onClick={handleConnectDrive}
              disabled={driveConnecting}
              style={{ color: '#818cf8', borderColor: 'rgba(99,102,241,0.4)' }}
            >
              <HardDrive size={13} />
              <span>{driveConnecting ? 'কানেক্ট হচ্ছে...' : (t.connectDrive || 'Google Drive কানেক্ট')}</span>
            </button>
          ) : (
            <div className="tour-drive-connected-badge">
              <CloudCheck size={14} />
              <span>Google Drive Connected</span>
            </div>
          )}

          <button
            className="tour-add-btn"
            onClick={() => cameraInputRef.current?.click()}
            title="Take Photo"
          >
            <Camera size={14} />
            <span>{t.takePhoto || 'ক্যামেরা'}</span>
          </button>

          <button
            className="tour-btn-primary small"
            onClick={() => fileInputRef.current?.click()}
            title="Upload File"
          >
            <Plus size={14} />
            <span>{lang === 'bn' ? 'ফাইল আপলোড' : 'Upload'}</span>
          </button>
        </div>
      </div>

      {/* Zero Firebase Storage Notice */}
      <div className="tour-gallery-drive-note">
        ☁️ {lang === 'bn'
          ? 'আপনার ছবি, ভিডিও ও PDF ফাইলসমূহ সরাসরি আপনার Google Drive বা ক্লাউড সিডিএন-এ সংরক্ষিত হয় (ফায়ারবেসে কোনো ফাইল রাখা হয় না)।'
          : 'Media files are stored on Google Drive or Cloud CDN (0 binary files on Firebase).'}
      </div>

      {/* Gallery Grid (Images, Videos, PDFs) */}
      {photos.length === 0 ? (
        <div className="tour-empty-state">
          <HardDrive size={40} className="text-gray-400" />
          <p>{lang === 'bn' ? 'এখনো কোনো ছবি, ভিডিও বা ডকুমেন্ট যোগ করা হয়নি। ট্যুরের সুন্দর মুহূর্তগুলো যোগ করুন!' : 'No media added yet. Upload photos, videos, and PDFs for your tour!'}</p>
          <button className="tour-btn-primary small" onClick={() => fileInputRef.current?.click()}>
            <Plus size={14} />
            <span>{lang === 'bn' ? 'প্রথম ফাইল আপলোড করুন' : 'Upload First File'}</span>
          </button>
        </div>
      ) : (
        <div className="tour-gallery-grid">
          {photos.map((item) => {
            const isVideo = item.fileType === 'video' || item.mimeType?.startsWith('video/');
            const isPdf = item.fileType === 'pdf' || item.mimeType === 'application/pdf';

            return (
              <div
                key={item.id}
                className={`tour-photo-card ${item.fileType || 'image'}`}
                onClick={() => setSelectedItem(item)}
              >
                {isVideo ? (
                  <div className="tour-video-thumb-wrap">
                    <div className="tour-video-play-icon"><Play size={20} fill="#fff" /></div>
                    <span className="tour-video-tag">VIDEO</span>
                  </div>
                ) : isPdf ? (
                  <div className="tour-pdf-thumb-wrap">
                    <FileText size={32} className="text-red-400" />
                    <span className="tour-pdf-name">{item.fileName || 'PDF Document'}</span>
                  </div>
                ) : (
                  <img
                    src={item.thumbnailUrl || item.previewUrl || item.photoUrl}
                    alt={item.caption || 'Tour Memory'}
                    className="tour-photo-thumb"
                    loading="lazy"
                  />
                )}

                <div className="tour-photo-overlay">
                  <div className="tour-photo-caption">{item.caption || item.fileName || '📸'}</div>
                  <div className="tour-photo-uploader">
                    <span>{item.uploaderName}</span>
                    {item.fileSizeBytes > 0 && <span> • {formatFileSize(item.fileSizeBytes)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Confirmation Modal */}
      {showUploadModal && filePreview && (
        <div className="modal-overlay">
          <div className="tour-create-modal" style={{ maxWidth: '480px' }}>
            <div className="tour-create-header">
              <div className="tour-create-title-row">
                <Cloud size={16} className="text-indigo-400" />
                <span>{lang === 'bn' ? 'ফাইল আপলোড করুন' : 'Upload File'}</span>
              </div>
              <button className="tour-close-btn" onClick={() => setShowUploadModal(false)}><X size={16} /></button>
            </div>

            <div className="tour-create-body">
              {/* Media Preview Box */}
              <div className="tour-photo-preview-wrap">
                {filePreview.type === 'image' && (
                  <img src={filePreview.url} alt="Preview" className="tour-preview-img" style={{ maxHeight: '220px', width: '100%', objectFit: 'contain' }} />
                )}
                {filePreview.type === 'video' && (
                  <video src={filePreview.url} controls className="tour-preview-img" style={{ maxHeight: '220px', width: '100%' }} />
                )}
                {filePreview.type === 'pdf' && (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-input)', borderRadius: '12px' }}>
                    <FileText size={48} className="text-red-400" style={{ margin: '0 auto 8px' }} />
                    <strong>{filePreview.name}</strong>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '4px 0 0' }}>{formatFileSize(filePreview.size)}</p>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>{lang === 'bn' ? 'ক্যাপশন বা বর্ণনা' : 'Caption / Description'}</label>
                <input
                  type="text"
                  className="form-input"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: সাজেক ভ্যালির সানসেট ভিডিও' : 'e.g. Sunset video at Sajek'}
                />
              </div>

              {uploadProgress && (
                <div className="tour-alert-success" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontSize: '11px', padding: '8px 12px', textAlign: 'center', marginTop: '10px' }}>
                  <Loader size={13} className="spin" style={{ display: 'inline', marginRight: '6px' }} />
                  <span>{uploadProgress}</span>
                </div>
              )}

              {uploadError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px', marginTop: '10px' }}>
                  <div style={{ color: '#ef4444', fontSize: '11px', lineHeight: '1.4' }}>
                    ⚠️ {uploadError}
                  </div>
                  {driveApiNotEnabled && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <a
                        href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=757251174457"
                        target="_blank"
                        rel="noreferrer"
                        className="tour-btn-primary small"
                        style={{ background: '#4f46e5', textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
                      >
                        <ExternalLink size={13} />
                        <span>Google Console-এ Drive API চালু করুন</span>
                      </a>
                      <button
                        className="tour-btn-ghost small"
                        onClick={handleCloudinaryUpload}
                        disabled={uploading}
                        style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.4)', justifyContent: 'center' }}
                      >
                        <UploadCloud size={13} />
                        <span>⚡ ক্লাউড সিডিএন-এ আপলোড করুন (Cloud CDN Upload)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="tour-create-footer" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <button className="tour-btn-ghost" onClick={() => setShowUploadModal(false)} disabled={uploading}>
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button className="tour-btn-ghost" onClick={handleCloudinaryUpload} disabled={uploading} title="Cloud Upload" style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>
                <UploadCloud size={14} />
                <span>{lang === 'bn' ? 'ক্লাউড সিডিএন আপলোড' : 'Cloud CDN'}</span>
              </button>
              <button className="tour-btn-primary" onClick={handleSaveToDrive} disabled={uploading}>
                <HardDrive size={14} />
                <span>{uploading ? (lang === 'bn' ? 'আপলোড হচ্ছে...' : 'Uploading...') : (lang === 'bn' ? 'Google Drive-এ আপলোড' : 'Google Drive')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Media Viewer Lightbox */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="tour-lightbox-modal" onClick={e => e.stopPropagation()}>
            <button className="tour-lightbox-close" onClick={() => setSelectedItem(null)}>
              <X size={20} />
            </button>

            {/* Media Content Display */}
            {selectedItem.fileType === 'video' || selectedItem.mimeType?.startsWith('video/') ? (
              <div style={{ width: '100%', maxWidth: '85vw', maxHeight: '70vh', display: 'flex', justifyContent: 'center' }}>
                {selectedItem.driveFileId ? (
                  <iframe
                    src={`https://drive.google.com/file/d/${selectedItem.driveFileId}/preview`}
                    style={{ width: '100%', minHeight: '360px', border: 'none', borderRadius: '12px' }}
                    allow="autoplay"
                    title="Tour Video"
                  />
                ) : (
                  <video src={selectedItem.photoUrl || selectedItem.previewUrl} controls style={{ width: '100%', maxHeight: '65vh', borderRadius: '12px' }} />
                )}
              </div>
            ) : selectedItem.fileType === 'pdf' || selectedItem.mimeType === 'application/pdf' ? (
              <div style={{ width: '100%', maxWidth: '85vw', minHeight: '360px', background: 'var(--bg-card)', borderRadius: '14px', padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <FileText size={56} className="text-red-400" />
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>{selectedItem.fileName || 'PDF Document'}</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>Uploaded by {selectedItem.uploaderName}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  {selectedItem.driveFileId ? (
                    <a
                      href={selectedItem.webViewLink || `https://drive.google.com/file/d/${selectedItem.driveFileId}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="tour-btn-primary small"
                      style={{ gap: '6px' }}
                    >
                      <ExternalLink size={14} />
                      <span>{lang === 'bn' ? 'Google Drive-এ PDF দেখুন' : 'Open in Google Drive'}</span>
                    </a>
                  ) : (
                    <a
                      href={selectedItem.photoUrl || selectedItem.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="tour-btn-primary small"
                      style={{ gap: '6px' }}
                    >
                      <Download size={14} />
                      <span>{lang === 'bn' ? 'PDF ডাউনলোড / ওপেন' : 'Open PDF'}</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <img
                src={selectedItem.previewUrl || selectedItem.photoUrl}
                alt="Full view"
                className="tour-lightbox-img"
              />
            )}

            {/* Media Details Footer */}
            <div className="tour-lightbox-info">
              <div className="tour-lightbox-meta">
                <strong>{selectedItem.caption || selectedItem.fileName || 'Tour Memory'}</strong>
                <span>Uploaded by {selectedItem.uploaderName} • {new Date(selectedItem.createdAt).toLocaleDateString()} {selectedItem.fileSizeBytes > 0 ? `(${formatFileSize(selectedItem.fileSizeBytes)})` : ''}</span>
              </div>

              <div className="tour-lightbox-actions">
                {selectedItem.driveFileId && (
                  <a
                    href={selectedItem.webViewLink || `https://drive.google.com/file/d/${selectedItem.driveFileId}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="tour-btn-ghost small"
                    title="Open in Google Drive"
                    style={{ color: '#818cf8', gap: '4px' }}
                  >
                    <ExternalLink size={14} />
                    <span>Drive</span>
                  </a>
                )}

                {(selectedItem.downloadUrl || selectedItem.photoUrl) && (
                  <a
                    href={selectedItem.downloadUrl || selectedItem.photoUrl}
                    download={selectedItem.fileName || 'tour_file'}
                    target="_blank"
                    rel="noreferrer"
                    className="tour-btn-ghost small"
                    title="Download File"
                  >
                    <Download size={14} />
                  </a>
                )}

                {(isOrganizer || selectedItem.uploadedBy === user?.uid) && (
                  <button
                    className="tour-delete-btn"
                    onClick={() => handleDeleteItem(selectedItem)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
