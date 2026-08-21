import React, { useState, useEffect } from 'react';
import {
  Clock, Plus, Trash2, CheckCircle2, Coffee, Utensils,
  Fuel, Bed, Camera, Flag, MapPin, Check, AlertCircle, X
} from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToTourStops, addTourStop, updateTourStop, deleteTourStop } from '../utils/tourStorage';

const PURPOSES = [
  { id: 'tea', labelBn: 'চা বিরতি', labelEn: 'Tea Break', icon: Coffee, color: '#f59e0b' },
  { id: 'lunch', labelBn: 'লাঞ্চ / খাবার', labelEn: 'Lunch / Meal', icon: Utensils, color: '#10b981' },
  { id: 'fuel', labelBn: 'ফুয়েল রিফিল', labelEn: 'Fuel Refill', icon: Fuel, color: '#ef4444' },
  { id: 'hotel', labelBn: 'হোটেল চেক-ইন', labelEn: 'Hotel Check-in', icon: Bed, color: '#6366f1' },
  { id: 'sight', labelBn: 'দর্শনীয় স্থান', labelEn: 'Sightseeing', icon: Camera, color: '#ec4899' },
  { id: 'other', labelBn: 'অন্যান্য স্টপ', labelEn: 'Other Stop', icon: Flag, color: '#8b5cf6' }
];

export default function TourItineraryTab({ tourId, tour, lang = 'bn', user, isOrganizer }) {
  const t = translations[lang] || translations['bn'];

  const [stops, setStops] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [stopName, setStopName] = useState('');
  const [location, setLocation] = useState('');
  const [purpose, setPurpose] = useState('tea');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [durationMins, setDurationMins] = useState(20);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!tourId) return;
    const unsub = listenToTourStops(tourId, setStops);
    return unsub;
  }, [tourId]);

  const handleAddStop = async (e) => {
    e.preventDefault();
    if (!stopName.trim()) return;

    setSaving(true);
    try {
      await addTourStop(tourId, {
        name: stopName,
        location,
        purpose,
        arrivalTime,
        departureTime,
        durationMins,
        notes,
        order: stops.length + 1
      });
      // Reset form
      setStopName('');
      setLocation('');
      setArrivalTime('');
      setDepartureTime('');
      setNotes('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding stop:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleStopStatus = async (stop) => {
    const nextStatus = stop.status === 'upcoming' ? 'arrived' : stop.status === 'arrived' ? 'departed' : 'upcoming';
    await updateTourStop(tourId, stop.id, { status: nextStatus });
  };

  const handleDeleteStop = async (stopId) => {
    if (!window.confirm(lang === 'bn' ? 'এই স্টপটি মুছে ফেলবেন?' : 'Delete this stop?')) return;
    await deleteTourStop(tourId, stopId);
  };

  return (
    <div className="tour-itinerary-tab">
      {/* Top Header & Actions */}
      <div className="tour-expenses-total-bar">
        <span>📍 {stops.length} {lang === 'bn' ? 'টি নির্ধারিত স্টপ ও ভ্রমণসূচি' : 'Scheduled Stops'}</span>
        {isOrganizer && (
          <button
            className="tour-add-btn"
            onClick={() => setShowAddForm(s => !s)}
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            <span>{showAddForm ? (lang === 'bn' ? 'বাতিল' : 'Cancel') : (t.addStop || 'স্টপ যোগ করুন')}</span>
          </button>
        )}
      </div>

      {/* Add Stop Form Modal / Inline */}
      {showAddForm && (
        <form className="tour-expense-form" onSubmit={handleAddStop}>
          <div className="form-group">
            <label>{lang === 'bn' ? 'স্টপের নাম (যেমন: কুমিল্লা হাইওয়ে ইন)' : 'Stop Name'}</label>
            <input
              type="text"
              className="form-input"
              required
              value={stopName}
              onChange={e => setStopName(e.target.value)}
              placeholder="e.g. Cumilla Highway Inn"
            />
          </div>

          <div className="tour-grid-2">
            <div className="form-group">
              <label>{lang === 'bn' ? 'উদ্দেশ্য' : 'Purpose'}</label>
              <select
                className="form-select"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
              >
                {PURPOSES.map(p => (
                  <option key={p.id} value={p.id}>
                    {lang === 'bn' ? p.labelBn : p.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{lang === 'bn' ? 'বিরতির সময় (মিনিট)' : 'Duration (mins)'}</label>
              <input
                type="number"
                className="form-input"
                value={durationMins}
                onChange={e => setDurationMins(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="tour-grid-2">
            <div className="form-group">
              <label>{lang === 'bn' ? 'পৌঁছানোর সম্ভাব্য সময়' : 'Planned Arrival'}</label>
              <input
                type="time"
                className="form-input"
                value={arrivalTime}
                onChange={e => setArrivalTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{lang === 'bn' ? 'ছাড়ার সম্ভাব্য সময়' : 'Planned Departure'}</label>
              <input
                type="time"
                className="form-input"
                value={departureTime}
                onChange={e => setDepartureTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{lang === 'bn' ? 'নোট বা নির্দেশনা' : 'Notes / Instructions'}</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={lang === 'bn' ? 'যেমন: নাস্তা ও তেল রিফিল' : 'e.g. Breakfast and fuel refill'}
            />
          </div>

          <button type="submit" className="tour-btn-primary" disabled={saving}>
            <Check size={14} />
            <span>{saving ? 'সংরক্ষণ হচ্ছে...' : (lang === 'bn' ? 'স্টপ যুক্ত করুন' : 'Save Stop')}</span>
          </button>
        </form>
      )}

      {/* Itinerary Timeline */}
      <div className="tour-itinerary-timeline">
        {stops.length === 0 ? (
          <div className="tour-empty-state">
            <Clock size={36} className="text-gray-400" />
            <p>{lang === 'bn' ? 'এখনো কোনো স্টপ বা ভ্রমণসূচি যোগ করা হয়নি।' : 'No itinerary stops added yet.'}</p>
            {isOrganizer && (
              <button className="tour-btn-primary small" onClick={() => setShowAddForm(true)}>
                <Plus size={14} />
                <span>{lang === 'bn' ? 'প্রথম স্টপ যোগ করুন' : 'Add First Stop'}</span>
              </button>
            )}
          </div>
        ) : (
          stops.map((stop, idx) => {
            const purposeMeta = PURPOSES.find(p => p.id === stop.purpose) || PURPOSES[0];
            const Icon = purposeMeta.icon;
            const isArrived = stop.status === 'arrived';
            const isDeparted = stop.status === 'departed';

            return (
              <div key={stop.id} className={`tour-stop-card ${stop.status}`}>
                <div className="tour-stop-left">
                  <div className="tour-stop-num">{idx + 1}</div>
                  <div className="tour-stop-icon" style={{ background: `${purposeMeta.color}20`, color: purposeMeta.color }}>
                    <Icon size={16} />
                  </div>
                </div>

                <div className="tour-stop-body">
                  <div className="tour-stop-title-row">
                    <strong>{stop.name}</strong>
                    <span className="tour-stop-purpose-badge" style={{ color: purposeMeta.color, background: `${purposeMeta.color}15` }}>
                      {lang === 'bn' ? purposeMeta.labelBn : purposeMeta.labelEn}
                    </span>
                  </div>

                  <div className="tour-stop-meta-row">
                    {stop.arrivalTime && <span>⏱️ {stop.arrivalTime}</span>}
                    {stop.departureTime && <span>→ {stop.departureTime}</span>}
                    <span>• {stop.durationMins} {lang === 'bn' ? 'মিনিট' : 'mins'}</span>
                  </div>

                  {stop.notes && <p className="tour-stop-notes">📝 {stop.notes}</p>}
                </div>

                <div className="tour-stop-actions">
                  <button
                    className={`tour-stop-status-btn ${stop.status}`}
                    onClick={() => toggleStopStatus(stop)}
                    title={lang === 'bn' ? 'স্ট্যাটাস পরিবর্তন করুন' : 'Toggle status'}
                  >
                    {isDeparted ? '🏁 Departed' : isArrived ? '🟢 Arrived' : '⏳ Upcoming'}
                  </button>

                  {isOrganizer && (
                    <button
                      className="tour-delete-btn"
                      onClick={() => handleDeleteStop(stop.id)}
                      title="Delete stop"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
