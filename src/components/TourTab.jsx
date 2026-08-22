import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Plus, Users, Calendar, ChevronRight, Route,
  Calculator, Mail, Check, X, Sparkles, Filter
} from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToMyTours, respondToTourInvitation } from '../utils/tourStorage';
import { getTourStatus } from '../utils/tourCalculations';
import TourCreateModal from './TourCreateModal';
import TourDetailPage from './TourDetailPage';
import TourCostEstimatorModal from './TourCostEstimatorModal';

export default function TourTab({
  lang = 'bn',
  theme,
  user,
  intercomEngine,
  setIntercomEngine,
  intercomState,
  setIntercomState,
  intercomTourId,
  setIntercomTourId
}) {
  const t = translations[lang] || translations['bn'];
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEstimator, setShowEstimator] = useState(false);
  const [activeTourId, setActiveTourId] = useState(null);
  const [filterTab, setFilterTab] = useState('all'); // all | created | joined | invited

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);
    const unsub = listenToMyTours(user.uid, (list) => {
      setTours(list);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const handleTourCreated = useCallback((tourId) => {
    setShowCreate(false);
    setShowEstimator(false);
    setActiveTourId(tourId);
  }, []);

  const handleAcceptInvite = async (e, tourId) => {
    e.stopPropagation();
    await respondToTourInvitation(tourId, user.uid, true);
  };

  const handleRejectInvite = async (e, tourId) => {
    e.stopPropagation();
    await respondToTourInvitation(tourId, user.uid, false);
  };

  const currentViewingTourId = activeTourId || (intercomState?.isConnected ? intercomTourId : null);

  if (currentViewingTourId) {
    return (
      <>
        <TourDetailPage
          tourId={currentViewingTourId}
          lang={lang}
          theme={theme}
          user={user}
          onBack={() => setActiveTourId(null)}
          onOpenCreate={() => setShowCreate(true)}
          intercomEngine={intercomEngine}
          setIntercomEngine={setIntercomEngine}
          intercomState={intercomState}
          setIntercomState={setIntercomState}
          setIntercomTourId={setIntercomTourId}
        />
        {showCreate && (
          <TourCreateModal
            lang={lang}
            theme={theme}
            user={user}
            onClose={() => setShowCreate(false)}
            onCreated={handleTourCreated}
          />
        )}
      </>
    );
  }

  // Segment tours
  const createdTours = tours.filter(t => t.createdBy === user?.uid);
  const joinedTours = tours.filter(t => t.createdBy !== user?.uid && t.memberIds?.includes(user?.uid));

  // Filter based on tab
  const displayTours = filterTab === 'created'
    ? createdTours
    : filterTab === 'joined'
    ? joinedTours
    : tours;

  const activeTours = displayTours.filter(t => t.status === 'active');
  const plannedTours = displayTours.filter(t => t.status === 'planned');
  const pastTours = displayTours.filter(t => t.status === 'completed' || t.status === 'cancelled');

  return (
    <div className="tour-tab">
      {/* Header */}
      <div className="tour-tab-header">
        <div className="tour-tab-title">
          <Route size={22} className="tour-tab-icon" />
          <span>{t.myTours}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="tour-estimator-header-btn"
            onClick={() => setShowEstimator(true)}
            title={t.costEstimatorTitle || 'ট্যুর খরচ ক্যালকুলেটর'}
          >
            <Calculator size={15} />
            <span>{lang === 'bn' ? 'খরচ ক্যালকুলেটর' : 'Estimator'}</span>
          </button>

          <button className="tour-create-btn" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            <span>{t.newTour}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="tour-filter-bar">
        <button
          className={`tour-filter-tab ${filterTab === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          {t.filterAll || 'সব ট্যুর'} ({tours.length})
        </button>
        <button
          className={`tour-filter-tab ${filterTab === 'created' ? 'active' : ''}`}
          onClick={() => setFilterTab('created')}
        >
          {t.filterCreated || 'আমার তৈরি'} ({createdTours.length})
        </button>
        <button
          className={`tour-filter-tab ${filterTab === 'joined' ? 'active' : ''}`}
          onClick={() => setFilterTab('joined')}
        >
          {t.filterJoined || 'যুক্ত হওয়া'} ({joinedTours.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="tour-loading">
          <div className="tour-loading-spinner" />
        </div>
      ) : displayTours.length === 0 ? (
        <div className="tour-empty">
          <div className="tour-empty-icon">
            <MapPin size={44} />
          </div>
          <h3>{t.noTours}</h3>
          <p>{t.noToursDesc}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="tour-empty-btn" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              <span>{t.createTour}</span>
            </button>
            <button className="tour-btn-ghost" onClick={() => setShowEstimator(true)}>
              <Calculator size={16} />
              <span>{t.costEstimatorTitle || 'খরচ ক্যালকুলেটর'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="tour-list">
          {activeTours.length > 0 && (
            <TourSection title={lang === 'bn' ? '🟢 চলমান ট্যুর' : '🟢 Active Tours'} tours={activeTours} onSelect={setActiveTourId} lang={lang} t={t} />
          )}
          {plannedTours.length > 0 && (
            <TourSection title={lang === 'bn' ? '📅 পরিকল্পিত ট্যুর' : '📅 Planned Tours'} tours={plannedTours} onSelect={setActiveTourId} lang={lang} t={t} />
          )}
          {pastTours.length > 0 && (
            <TourSection title={lang === 'bn' ? '📁 অতীত ট্যুর' : '📁 Past Tours'} tours={pastTours} onSelect={setActiveTourId} lang={lang} t={t} />
          )}
        </div>
      )}

      {/* Create Tour Wizard Modal */}
      {showCreate && (
        <TourCreateModal
          lang={lang}
          theme={theme}
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={handleTourCreated}
        />
      )}

      {/* Standalone Cost Estimator Modal */}
      {showEstimator && (
        <TourCostEstimatorModal
          lang={lang}
          onClose={() => setShowEstimator(false)}
          onConvertToTour={(estimateData) => {
            setShowEstimator(false);
            setShowCreate(true);
          }}
        />
      )}
    </div>
  );
}

function TourSection({ title, tours, onSelect, lang, t }) {
  return (
    <div className="tour-section">
      <div className="tour-section-title">{title}</div>
      {tours.map(tour => (
        <TourCard key={tour.id} tour={tour} onSelect={onSelect} lang={lang} t={t} />
      ))}
    </div>
  );
}

function TourCard({ tour, onSelect, lang, t }) {
  const status = getTourStatus(tour.status);
  const memberCount = (tour.memberIds?.length || 0) + (tour.guestMembers?.length || 0);

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-BD', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch { return iso; }
  };

  return (
    <button className="tour-card" onClick={() => onSelect(tour.id)}>
      <div className="tour-card-body">
        <div className="tour-card-top">
          <h4 className="tour-card-title">{tour.title}</h4>
          <span className="tour-status-badge" style={{ color: status.color, background: status.bg }}>
            {status[lang === 'bn' ? 'label' : 'labelEn']}
          </span>
        </div>

        {tour.destinations?.length > 0 && (
          <div className="tour-card-destinations">
            <MapPin size={12} />
            <span>{tour.destinations.map(d => d.name).join(' → ')}</span>
          </div>
        )}

        <div className="tour-card-meta">
          <span className="tour-card-meta-item">
            <Calendar size={12} />
            {formatDate(tour.startDate)}
          </span>
          <span className="tour-card-meta-item">
            <Users size={12} />
            {memberCount} {lang === 'bn' ? 'জন' : 'members'}
          </span>
          {tour.estimatedDistanceKm > 0 && (
            <span className="tour-card-meta-item">
              <Route size={12} />
              {tour.estimatedDistanceKm.toFixed(0)} km
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={18} className="tour-card-arrow" />
    </button>
  );
}
