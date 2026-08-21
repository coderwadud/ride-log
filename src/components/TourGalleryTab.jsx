import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Image as ImageIcon, Plus, Trash2, X, Download,
  Share2, HardDrive, Sparkles, User, Check
} from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToTourGallery, addTourPhoto, deleteTourPhoto } from '../utils/tourStorage';

export default function TourGalleryTab({ tourId, tour, lang = 'bn', user, isOrganizer }) {
  const t = translations[lang] || translations['bn'];
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState('');

  useEffect(() => {
    if (!tourId) return;
    const unsub = listenToTourGallery(tourId, setPhotos);
    return unsub;
  }, [tourId]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewDataUrl(event.target.result);
      setShowUploadModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (!previewDataUrl) return;
    setUploading(true);
    try {
      await addTourPhoto(tourId, {
        photoUrl: previewDataUrl,
        caption: caption.trim(),
        uploadedBy: user?.uid || 'anonymous',
        uploaderName: user?.displayName || user?.email?.split('@')[0] || 'Rider',
        uploaderPhoto: user?.photoURL || '',
        source: 'upload'
      });
      setPreviewDataUrl('');
      setCaption('');
      setShowUploadModal(false);
    } catch (err) {
      console.error('Error saving photo:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photo) => {
    if (!window.confirm(lang === 'bn' ? 'এই ছবিটি মুছে ফেলবেন?' : 'Delete this photo?')) return;
    await deleteTourPhoto(tourId, photo.id);
    if (selectedPhoto?.id === photo.id) setSelectedPhoto(null);
  };

  const handleDownload = (photoUrl, filename = 'tour_memory.jpg') => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = filename;
    link.click();
  };

  return (
    <div className="tour-gallery-tab">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
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

      {/* Top Action Bar */}
      <div className="tour-gallery-header">
        <div className="tour-gallery-count">
          <ImageIcon size={16} className="text-indigo-400" />
          <span>{photos.length} {lang === 'bn' ? 'টি ছবি ও স্মৃতি' : 'Photos & Memories'}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="tour-add-btn"
            onClick={() => cameraInputRef.current?.click()}
            title="Take Photo"
          >
            <Camera size={14} />
            <span>{t.takePhoto || 'ক্যামেরা'}</span>
          </button>

          <button
            className="tour-add-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Photo"
          >
            <Plus size={14} />
            <span>{t.uploadPhoto || 'আপলোড'}</span>
          </button>
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div className="tour-empty-state">
          <Camera size={40} className="text-gray-400" />
          <p>{lang === 'bn' ? 'এখনো কোনো ছবি যোগ করা হয়নি। ট্যুরের সুন্দর মুহূর্তগুলো যোগ করুন!' : 'No photos added yet. Capture memories with your tour mates!'}</p>
          <button className="tour-btn-primary small" onClick={() => fileInputRef.current?.click()}>
            <Plus size={14} />
            <span>{lang === 'bn' ? 'ছবি আপলোড করুন' : 'Upload First Photo'}</span>
          </button>
        </div>
      ) : (
        <div className="tour-gallery-grid">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="tour-photo-card"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img src={photo.photoUrl} alt={photo.caption || 'Tour Memory'} className="tour-photo-thumb" />
              <div className="tour-photo-overlay">
                <div className="tour-photo-caption">{photo.caption || '📸'}</div>
                <div className="tour-photo-uploader">
                  <span>{photo.uploaderName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Preview & Caption Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="tour-create-modal" style={{ maxWidth: '440px' }}>
            <div className="tour-create-header">
              <div className="tour-create-title-row">
                <Camera size={16} />
                <span>{lang === 'bn' ? 'ছবি যোগ করুন' : 'Add Photo'}</span>
              </div>
              <button className="tour-close-btn" onClick={() => setShowUploadModal(false)}><X size={16} /></button>
            </div>

            <div className="tour-create-body">
              <div className="tour-photo-preview-wrap">
                <img src={previewDataUrl} alt="Preview" className="tour-preview-img" />
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>{lang === 'bn' ? 'ক্যাপশন বা বর্ণনা (ঐচ্ছিক)' : 'Caption (Optional)'}</label>
                <input
                  type="text"
                  className="form-input"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: সাজেক ভ্যালির সূর্যাস্ত' : 'e.g. Sunset at Sajek Valley'}
                />
              </div>
            </div>

            <div className="tour-create-footer">
              <button className="tour-btn-ghost" onClick={() => setShowUploadModal(false)}>
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button className="tour-btn-primary" onClick={handleSavePhoto} disabled={uploading}>
                <Check size={14} />
                <span>{uploading ? 'আপলোড হচ্ছে...' : (lang === 'bn' ? 'গ্যালারিতে যুক্ত করুন' : 'Upload')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Lightbox View */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="tour-lightbox-modal" onClick={e => e.stopPropagation()}>
            <button className="tour-lightbox-close" onClick={() => setSelectedPhoto(null)}>
              <X size={20} />
            </button>

            <img src={selectedPhoto.photoUrl} alt="Full view" className="tour-lightbox-img" />

            <div className="tour-lightbox-info">
              <div className="tour-lightbox-meta">
                <strong>{selectedPhoto.caption || 'Tour Memory'}</strong>
                <span>Uploaded by {selectedPhoto.uploaderName} • {new Date(selectedPhoto.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="tour-lightbox-actions">
                <button
                  className="tour-btn-ghost small"
                  onClick={() => handleDownload(selectedPhoto.photoUrl)}
                  title="Download"
                >
                  <Download size={15} />
                </button>

                {(isOrganizer || selectedPhoto.uploadedBy === user?.uid) && (
                  <button
                    className="tour-delete-btn"
                    onClick={() => handleDeletePhoto(selectedPhoto)}
                    title="Delete"
                  >
                    <Trash2 size={15} />
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
