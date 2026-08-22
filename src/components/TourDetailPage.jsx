import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Users, Map, Receipt, PiggyBank, Scale, FileText,
  Play, CheckCircle, Trash2, MoreVertical, Plus, Clock, Image as ImageIcon,
  TrendingUp, ShieldAlert, Download, Mail, Check, X, Radio
} from 'lucide-react';
import { translations } from '../utils/translations';
import {
  listenToTour, updateTour, cancelTour, deleteTour,
  listenToTourMembers, respondToTourInvitation
} from '../utils/tourStorage';
import { getTourStatus } from '../utils/tourCalculations';
import { listenToIntercomSession, RiderIntercomEngine } from '../utils/riderIntercom';
import TourMembersTab from './TourMembersTab';
import TourMapTab from './TourMapTab';
import TourItineraryTab from './TourItineraryTab';
import TourExpensesTab from './TourExpensesTab';
import TourFundTab from './TourFundTab';
import TourSettlementTab from './TourSettlementTab';
import TourGalleryTab from './TourGalleryTab';
import TourAnalyticsTab from './TourAnalyticsTab';
import TourIntercomTab from './TourIntercomTab';
import FloatingIntercomBar from './FloatingIntercomBar';
import IncomingCallBanner from './IncomingCallBanner';
import TourSafetyModal from './TourSafetyModal';
import TourReportModal from './TourReportModal';

const SUB_TABS = [
  { id: 'members',   icon: Users,      labelBn: 'সদস্য',     labelEn: 'Members' },
  { id: 'intercom',  icon: Radio,      labelBn: 'ইন্টারকম',   labelEn: 'Intercom' },
  { id: 'map',       icon: Map,        labelBn: 'ম্যাপ',      labelEn: 'Map' },
  { id: 'itinerary', icon: Clock,      labelBn: 'ভ্রমণসূচি',  labelEn: 'Itinerary' },
  { id: 'expenses',  icon: Receipt,    labelBn: 'খরচ',      labelEn: 'Expenses' },
  { id: 'fund',      icon: PiggyBank,  labelBn: 'ফান্ড',     labelEn: 'Fund' },
  { id: 'settlement',icon: Scale,      labelBn: 'হিসাব',     labelEn: 'Settle' },
  { id: 'gallery',   icon: ImageIcon,  labelBn: 'গ্যালারি',   labelEn: 'Gallery' },
  { id: 'analytics', icon: TrendingUp, labelBn: 'পরিসংখ্যান', labelEn: 'Analytics' }
];

export default function TourDetailPage({ tourId, lang = 'bn', theme, user, onBack, onOpenCreate }) {
  const t = translations[lang] || translations['bn'];
  const [tour, setTour] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('members');
  const [showMenu, setShowMenu] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Global Tour Intercom Voice State
  const [intercomEngine, setIntercomEngine] = useState(null);
  const [intercomState, setIntercomState] = useState({
    isConnected: false,
    isMuted: false,
    isSpeaking: false,
    pttActive: false,
    pttMode: false,
    participants: {},
    peerCount: 0
  });
  const [activeIntercomSession, setActiveIntercomSession] = useState(null);

  useEffect(() => {
    if (!tourId) return;
    const unsub1 = listenToTour(tourId, (data) => {
      setTour(data);
      setLoading(false);
    });
    const unsub2 = listenToTourMembers(tourId, setMembers);
    const unsub3 = listenToIntercomSession(tourId, (session) => {
      setActiveIntercomSession(session);
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [tourId]);

  const isOrganizer = tour?.createdBy === user?.uid;
  const status = tour ? getTourStatus(tour.status) : null;
  const myMember = members.find(m => m.uid === user?.uid);

  const handleStatusChange = async (newStatus) => {
    setShowMenu(false);
    if (newStatus === 'deleted') {
      if (!window.confirm(t.confirmDeleteTour || 'Delete this tour?')) return;
      await deleteTour(tourId);
      onBack();
      return;
    }
    // Optimistic local update for instant UI response
    setTour(prev => prev ? { ...prev, status: newStatus } : prev);
    await updateTour(tourId, { status: newStatus });
  };

  const handleAcceptInvite = async () => {
    if (!user?.uid) return;
    await respondToTourInvitation(tourId, user.uid, true);
  };

  const handleDeclineInvite = async () => {
    if (!user?.uid) return;
    if (!window.confirm(lang === 'bn' ? 'আমন্ত্রণটি প্রত্যাখ্যান করবেন?' : 'Decline this tour invitation?')) return;
    await respondToTourInvitation(tourId, user.uid, false);
    onBack();
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-BD', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return iso; }
  };

  if (loading) {
    return (
      <div className="tour-detail-loading">
        <div className="tour-loading-spinner" />
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="tour-detail-error">
        <p>{t.tourNotFound}</p>
        <button onClick={onBack}>{lang === 'bn' ? '← ফিরে যান' : '← Back'}</button>
      </div>
    );
  }

  return (
    <div className="tour-detail-page">
      {/* Top bar */}
      <div className="tour-detail-topbar">
        <button className="tour-back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="tour-detail-header-info">
          <h2 className="tour-detail-title">{tour.title}</h2>
          <div className="tour-detail-meta">
            <span className="tour-status-badge" style={{ color: status.color, background: status.bg }}>
              {status[lang === 'bn' ? 'label' : 'labelEn']}
            </span>
            <span className="tour-detail-dates">
              {formatDate(tour.startDate)}{tour.endDate && tour.endDate !== tour.startDate ? ` → ${formatDate(tour.endDate)}` : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Emergency SOS Button */}
          <button
            className="tour-sos-header-btn"
            onClick={() => setShowSafetyModal(true)}
            title="Safety & Emergency SOS"
          >
            <ShieldAlert size={14} />
            <span>SOS</span>
          </button>

          {/* Quick Start / End Actions for Organizer */}
          {isOrganizer && tour.status === 'planned' && (
            <button
              className="tour-btn-primary small"
              onClick={() => handleStatusChange('active')}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: '11px', padding: '6px 10px', gap: '4px' }}
              title={t.startTour}
            >
              <Play size={12} />
              <span>{lang === 'bn' ? 'ট্যুর শুরু' : 'Start'}</span>
            </button>
          )}
          {isOrganizer && tour.status === 'active' && (
            <button
              className="tour-btn-primary small"
              onClick={() => handleStatusChange('completed')}
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', fontSize: '11px', padding: '6px 10px', gap: '4px' }}
              title={t.endTour}
            >
              <CheckCircle size={12} />
              <span>{lang === 'bn' ? 'ট্যুর শেষ' : 'End'}</span>
            </button>
          )}

          {onOpenCreate && (
            <button className="tour-add-btn" onClick={onOpenCreate} title={t.newTour}>
              <Plus size={14} />
              <span>{t.newTour}</span>
            </button>
          )}

          {/* 3-Dot Overflow Menu */}
          <div className="tour-menu-wrap">
            <button className="tour-menu-btn" onClick={() => setShowMenu(s => !s)}>
              <MoreVertical size={20} />
            </button>
            {showMenu && (
              <>
                <div className="tour-menu-overlay" onClick={() => setShowMenu(false)} />
                <div className="tour-dropdown-menu">
                  <button onClick={() => { setShowMenu(false); setShowReportModal(true); }}>
                    <Download size={14} /> {lang === 'bn' ? 'রিপোর্ট ডাউনলোড (PDF/Excel)' : 'Download Report'}
                  </button>
                  <button onClick={() => { setShowMenu(false); setShowSafetyModal(true); }}>
                    <ShieldAlert size={14} /> {lang === 'bn' ? 'সেফটি ও জরুরি হেল্প' : 'Safety & Helplines'}
                  </button>
                  {isOrganizer && tour.status === 'planned' && (
                    <button onClick={() => handleStatusChange('active')}><Play size={14} /> {t.startTour}</button>
                  )}
                  {isOrganizer && tour.status === 'active' && (
                    <button onClick={() => handleStatusChange('completed')}><CheckCircle size={14} /> {t.endTour}</button>
                  )}
                  {isOrganizer && (tour.status === 'planned' || tour.status === 'active') && (
                    <button onClick={() => handleStatusChange('cancelled')}><CheckCircle size={14} /> {t.cancelTour}</button>
                  )}
                  {isOrganizer && tour.status === 'cancelled' && (
                    <button onClick={() => handleStatusChange('planned')}><Play size={14} /> {lang === 'bn' ? 'পুনরায় শুরু' : 'Reactivate'}</button>
                  )}
                  {isOrganizer && (
                    <button className="danger" onClick={() => handleStatusChange('deleted')}>
                      <Trash2 size={14} /> {t.deleteTour}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pending Invitation Alert Banner */}
      {myMember?.status === 'invited' && (
        <div className="tour-invitation-accept-banner">
          <div className="tour-invitation-text">
            <Mail size={16} className="text-amber-400" />
            <div>
              <strong>{lang === 'bn' ? 'ট্যুর আমন্ত্রণ!' : 'Tour Invitation!'}</strong>
              <p>{tour.organizerName || 'অর্গানাইজার'} {lang === 'bn' ? 'আপনাকে এই ট্যুরে যোগ দিতে আমন্ত্রণ জানিয়েছেন।' : 'invited you to join this tour.'}</p>
            </div>
          </div>
          <div className="tour-invitation-actions">
            <button className="tour-btn-primary small" onClick={handleAcceptInvite} style={{ background: '#10b981', gap: '4px' }}>
              <Check size={13} />
              <span>{t.acceptInvite || 'গ্রহণ করুন'}</span>
            </button>
            <button className="tour-btn-ghost small" onClick={handleDeclineInvite} style={{ color: '#ef4444', gap: '4px' }}>
              <X size={13} />
              <span>{t.rejectInvite || 'বাতিল'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Route summary strip */}
      {tour.destinations?.length > 0 && (
        <div className="tour-route-strip">
          {tour.destinations.map((d, i) => (
            <React.Fragment key={i}>
              <span className="tour-route-dest">{i === 0 ? '🟢' : i === tour.destinations.length - 1 ? '🔴' : '🔵'} {d.name}</span>
              {i < tour.destinations.length - 1 && <span className="tour-route-arrow">→</span>}
            </React.Fragment>
          ))}
          {tour.estimatedDistanceKm > 0 && (
            <span className="tour-route-dist">· {tour.estimatedDistanceKm} km</span>
          )}
        </div>
      )}

      {/* Incoming Call Notification Banner */}
      <IncomingCallBanner
        activeSession={activeIntercomSession}
        currentUser={user}
        isConnected={intercomState.isConnected}
        onJoinCall={() => setActiveSubTab('intercom')}
        lang={lang}
      />

      {/* Floating Intercom Bar across non-intercom tabs */}
      {activeSubTab !== 'intercom' && intercomState.isConnected && (
        <FloatingIntercomBar
          intercomState={intercomState}
          intercomEngine={intercomEngine}
          onOpenIntercomTab={() => setActiveSubTab('intercom')}
          onLeaveCall={async () => {
            if (intercomEngine) {
              await intercomEngine.leave(true);
              setIntercomEngine(null);
              setIntercomState({
                isConnected: false,
                isMuted: false,
                isSpeaking: false,
                pttActive: false,
                pttMode: false,
                participants: {},
                peerCount: 0
              });
            }
          }}
          lang={lang}
        />
      )}

      {/* Sub-tab navigation */}
      <div className="tour-subtab-bar">
        {SUB_TABS.map(({ id, icon: Icon, labelBn, labelEn }) => (
          <button
            key={id}
            className={`tour-subtab-btn ${activeSubTab === id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(id)}
          >
            <Icon size={14} />
            <span>{lang === 'bn' ? labelBn : labelEn}</span>
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="tour-subtab-content">
        {activeSubTab === 'members' && (
          <TourMembersTab tourId={tourId} tour={tour} lang={lang} user={user} isOrganizer={isOrganizer} />
        )}
        {activeSubTab === 'intercom' && (
          <TourIntercomTab
            tourId={tourId}
            tour={tour}
            lang={lang}
            user={user}
            isOrganizer={isOrganizer}
            intercomEngine={intercomEngine}
            setIntercomEngine={setIntercomEngine}
            intercomState={intercomState}
            setIntercomState={setIntercomState}
          />
        )}
        {activeSubTab === 'map' && (
          <TourMapTab tourId={tourId} tour={tour} lang={lang} user={user} />
        )}
        {activeSubTab === 'itinerary' && (
          <TourItineraryTab tourId={tourId} tour={tour} lang={lang} user={user} isOrganizer={isOrganizer} />
        )}
        {activeSubTab === 'expenses' && (
          <TourExpensesTab tourId={tourId} tour={tour} lang={lang} user={user} />
        )}
        {activeSubTab === 'fund' && (
          <TourFundTab tourId={tourId} tour={tour} lang={lang} user={user} />
        )}
        {activeSubTab === 'settlement' && (
          <TourSettlementTab tourId={tourId} tour={tour} lang={lang} user={user} />
        )}
        {activeSubTab === 'gallery' && (
          <TourGalleryTab tourId={tourId} tour={tour} lang={lang} user={user} isOrganizer={isOrganizer} />
        )}
        {activeSubTab === 'analytics' && (
          <TourAnalyticsTab tourId={tourId} tour={tour} lang={lang} user={user} />
        )}
      </div>

      {/* Safety & SOS Modal */}
      {showSafetyModal && (
        <TourSafetyModal
          tourId={tourId}
          tour={tour}
          lang={lang}
          user={user}
          onClose={() => setShowSafetyModal(false)}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <TourReportModal
          tourId={tourId}
          tour={tour}
          lang={lang}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
