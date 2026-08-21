import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Phone, Shield, ShieldCheck, MapPin, X,
  Radio, CheckCircle2, Navigation, ExternalLink, Wrench, HeartPulse, Fuel
} from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToTourSosAlerts, broadcastSosAlert, resolveSosAlert } from '../utils/tourStorage';

const EMERGENCY_NUMBERS = [
  { nameBn: 'জাতীয় জরুরি সেবা (পুলিশ, অ্যাম্বুলেন্স, ফায়ার)', nameEn: 'National Emergency Helpline', number: '999', icon: Phone },
  { nameBn: 'হাইওয়ে পুলিশ কন্ট্রোল রুম', nameEn: 'Highway Police Control Room', number: '01320-182555', icon: Shield },
  { nameBn: 'ফায়ার সার্ভিস ও রেসকিউ', nameEn: 'Fire Service & Rescue', number: '102', icon: Phone },
  { nameBn: 'বিআরটিএ হেল্পলাইন', nameEn: 'BRTA Helpline', number: '16107', icon: Phone }
];

export default function TourSafetyModal({ tourId, tour, lang = 'bn', user, onClose }) {
  const t = translations[lang] || translations['bn'];

  const [alerts, setAlerts] = useState([]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [sosSuccess, setSosSuccess] = useState(false);
  const [safeSuccess, setSafeSuccess] = useState(false);

  useEffect(() => {
    if (!tourId) return;
    const unsub = listenToTourSosAlerts(tourId, setAlerts);
    return unsub;
  }, [tourId]);

  const handleBroadcastSOS = async () => {
    if (!window.confirm(lang === 'bn' ? 'আপনি কি ট্যুরের সকল সদস্যের কাছে জরুরি SOS অ্যালার্ট ও আপনার লোকেশন পাঠাতে চান?' : 'Broadcast emergency SOS alert and location to all tour members?')) return;

    setBroadcasting(true);
    try {
      let lat = null;
      let lng = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (e) {}
      }

      await broadcastSosAlert(tourId, {
        senderUid: user?.uid || 'rider',
        senderName: user?.displayName || user?.email?.split('@')[0] || 'Rider',
        lat,
        lng,
        type: 'sos',
        message: '🚨 জরুরি সাহায্য প্রয়োজন! (Emergency Assistance Needed)'
      });

      setSosSuccess(true);
      setTimeout(() => setSosSuccess(false), 5000);
    } catch (err) {
      console.error('Error broadcasting SOS:', err);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleImSafe = async () => {
    try {
      await broadcastSosAlert(tourId, {
        senderUid: user?.uid || 'rider',
        senderName: user?.displayName || user?.email?.split('@')[0] || 'Rider',
        type: 'safe_checkin',
        message: '🟢 আমি নিরাপদে পৌঁছেছি / ঠিক আছি (I am Safe)'
      });
      setSafeSuccess(true);
      setTimeout(() => setSafeSuccess(false), 5000);
    } catch (err) {
      console.error('Safe checkin error:', err);
    }
  };

  const handleResolveAlert = async (alertId) => {
    await resolveSosAlert(tourId, alertId);
  };

  const openLocationOnMap = (lat, lng) => {
    if (!lat || !lng) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  const openNearbySearch = (query) => {
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}+near+me`, '_blank');
  };

  return (
    <div className="modal-overlay">
      <div className="tour-safety-modal" style={{ maxWidth: '560px', width: '95%' }}>
        {/* Header */}
        <div className="tour-create-header">
          <div className="tour-create-title-row">
            <Shield size={18} className="text-red-400" />
            <span>{t.safetySOS || 'সেফটি ও জরুরি SOS সেন্টার'}</span>
          </div>
          <button className="tour-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="tour-create-body" style={{ maxHeight: '75vh' }}>
          {/* SOS & Safe Check-in Action Bar */}
          <div className="tour-sos-banner">
            <button
              className="tour-sos-big-btn"
              onClick={handleBroadcastSOS}
              disabled={broadcasting}
            >
              <Radio size={22} className="spin" />
              <span>{broadcasting ? 'অ্যালার্ট পাঠানো হচ্ছে...' : (t.broadcastSOS || '🚨 জরুরি SOS অ্যালার্ট পাঠান')}</span>
            </button>

            <button
              className="tour-safe-checkin-btn"
              onClick={handleImSafe}
            >
              <ShieldCheck size={18} />
              <span>{t.imSafe || '🟢 আমি ঠিক আছি (Safe Check-in)'}</span>
            </button>
          </div>

          {sosSuccess && (
            <div className="tour-alert-success" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', textAlign: 'center' }}>
              🚨 জরুরি SOS অ্যালার্ট সব সদস্যের কাছে পাঠানো হয়েছে!
            </div>
          )}

          {safeSuccess && (
            <div className="tour-alert-success" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', textAlign: 'center' }}>
              🟢 আপনার নিরাপদ স্ট্যাটাস শেয়ার হয়েছে।
            </div>
          )}

          {/* Active Alerts List */}
          {alerts.filter(a => a.status === 'active').length > 0 && (
            <div className="tour-active-alerts-section">
              <strong style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} /> সক্রিয় জরুরি অ্যালার্ট
              </strong>
              <div className="tour-active-alerts-list">
                {alerts.filter(a => a.status === 'active').map(alt => (
                  <div key={alt.id} className={`tour-alert-card ${alt.type}`}>
                    <div className="tour-alert-card-header">
                      <strong>{alt.senderName}</strong>
                      <span className="tour-alert-time">{new Date(alt.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="tour-alert-msg">{alt.message}</p>

                    <div className="tour-alert-actions">
                      {alt.lat && alt.lng && (
                        <button
                          className="tour-btn-ghost small"
                          onClick={() => openLocationOnMap(alt.lat, alt.lng)}
                        >
                          <Navigation size={12} />
                          <span>লোকেশন ম্যাপে দেখুন</span>
                        </button>
                      )}
                      <button
                        className="tour-btn-primary small"
                        style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }}
                        onClick={() => handleResolveAlert(alt.id)}
                      >
                        <CheckCircle2 size={12} />
                        <span>সমাধান হয়েছে</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nearby Emergency Finder Buttons */}
          <div className="tour-nearby-services-section">
            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>🏥 নিকটস্থ জরুরি সেবা (১-ক্লিকে ম্যাপে খুঁজুন)</strong>
            <div className="tour-nearby-buttons-grid">
              <button className="tour-nearby-btn" onClick={() => openNearbySearch('hospital medical')}>
                <HeartPulse size={16} className="text-red-400" />
                <span>নিকটস্থ হাসপাতাল</span>
                <ExternalLink size={11} className="arrow" />
              </button>

              <button className="tour-nearby-btn" onClick={() => openNearbySearch('motorcycle repair garage mechanic')}>
                <Wrench size={16} className="text-amber-400" />
                <span>বাইক গ্যারেজ / মেকানিক</span>
                <ExternalLink size={11} className="arrow" />
              </button>

              <button className="tour-nearby-btn" onClick={() => openNearbySearch('petrol pump fuel station')}>
                <Fuel size={16} className="text-blue-400" />
                <span>পেট্রোল পাম্প / ফুয়েল</span>
                <ExternalLink size={11} className="arrow" />
              </button>
            </div>
          </div>

          {/* Emergency Helpline Contacts */}
          <div className="tour-helplines-section">
            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>📞 জরুরি হেল্পলাইন ও নম্বর</strong>
            <div className="tour-helplines-list">
              {EMERGENCY_NUMBERS.map((h, i) => {
                const Icon = h.icon;
                return (
                  <a key={i} href={`tel:${h.number.replace(/[^0-9]/g, '')}`} className="tour-helpline-row">
                    <div className="tour-helpline-icon">
                      <Icon size={16} />
                    </div>
                    <div className="tour-helpline-info">
                      <strong>{lang === 'bn' ? h.nameBn : h.nameEn}</strong>
                      <span className="tour-helpline-num">{h.number}</span>
                    </div>
                    <div className="tour-call-badge">
                      <Phone size={12} />
                      <span>কল করুন</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
