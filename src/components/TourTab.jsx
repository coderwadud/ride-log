import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Users, Calendar, ChevronRight, Route, AlertCircle } from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToMyTours } from '../utils/tourStorage';
import { getTourStatus } from '../utils/tourCalculations';
import TourCreateModal from './TourCreateModal';
import TourDetailPage from './TourDetailPage';

export default function TourTab({ lang = 'bn', theme, user }) {
  const t = translations[lang] || translations['bn'];
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTourId, setActiveTourId] = useState(null);

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
    setActiveTourId(tourId);
  }, []);

  if (activeTourId) {
    return (
      <>
        <TourDetailPage
          tourId={activeTourId}
          lang={lang}
          theme={theme}
          user={user}
          onBack={() => setActiveTourId(null)}
          onOpenCreate={() => setShowCreate(true)}
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

  const activeTours = tours.filter(t => t.status === 'active');
  const plannedTours = tours.filter(t => t.status === 'planned');
  const pastTours = tours.filter(t => t.status === 'completed' || t.status === 'cancelled');

  return (
    <div className="tour-tab">
      {/* Header */}
      <div className="tour-tab-header">
        <div className="tour-tab-title">
          <Route size={22} className="tour-tab-icon" />
          <span>{t.myTours}</span>
        </div>
        <button className="tour-create-btn" onClick={() => setShowCreate(true)}>
          <Plus size={18} />
          {t.newTour}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="tour-loading">
          <div className="tour-loading-spinner" />
        </div>
      ) : tours.length === 0 ? (
        <div className="tour-empty">
          <div className="tour-empty-icon">
            <MapPin size={48} />
          </div>
          <h3>{t.noTours}</h3>
          <p>{t.noToursDesc}</p>
          <button className="tour-empty-btn" onClick={() => setShowCreate(true)}>
            <Plus size={18} />
            {t.createTour}
          </button>
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

      {showCreate && (
        <TourCreateModal
          lang={lang}
          theme={theme}
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={handleTourCreated}
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
