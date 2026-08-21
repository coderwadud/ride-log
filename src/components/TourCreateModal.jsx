import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, MapPin, Plus, Trash2, ChevronRight, ChevronLeft, Loader, Check, Route, AlertCircle } from 'lucide-react';
import { translations } from '../utils/translations';
import { createTour } from '../utils/tourStorage';
import { calculateCostEstimate } from '../utils/tourCalculations';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

let destIdSeq = 0;
const EMPTY_DEST = () => ({ id: `dest_${Date.now()}_${++destIdSeq}_${Math.random().toString(36).substr(2, 5)}`, name: '', lat: null, lng: null });

export default function TourCreateModal({ lang = 'bn', theme, user, onClose, onCreated }) {
  const t = translations[lang] || translations['bn'];
  const [step, setStep] = useState(1); // 1=BasicInfo 2=Route 3=Cost
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Step 2 state
  const [destinations, setDestinations] = useState([EMPTY_DEST(), EMPTY_DEST()]);
  const [searchResults, setSearchResults] = useState({});
  const [searchLoading, setSearchLoading] = useState({});
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  // Step 3 state
  const [costParams, setCostParams] = useState({
    kmPerLiter: 40,
    fuelPricePerLiter: 135,
    days: 1,
    nights: 0,
    tollCostManual: '',
    foodPerDay: 300,
    hotelPerNight: 0,
    miscBudget: 0
  });
  const [costEstimate, setCostEstimate] = useState(null);

  const searchTimers = useRef({});

  // Auto-sync days & nights from start and end dates
  useEffect(() => {
    if (startDate && endDate) {
      const diffMs = new Date(endDate) - new Date(startDate);
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      const diffNights = Math.max(0, diffDays - 1);
      setCostParams(p => ({
        ...p,
        days: diffDays,
        nights: diffNights,
        hotelPerNight: diffNights > 0 && Number(p.hotelPerNight) === 0 ? 800 : p.hotelPerNight
      }));
    }
  }, [startDate, endDate]);

  // ── Destination search ────────────────────────────────────────────────────
  const searchPlace = useCallback((query, destId) => {
    if (!query || query.length < 3) { setSearchResults(r => ({ ...r, [destId]: [] })); return; }
    clearTimeout(searchTimers.current[destId]);
    searchTimers.current[destId] = setTimeout(async () => {
      setSearchLoading(l => ({ ...l, [destId]: true }));
      try {
        const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=bd&accept-language=${lang}`;
        const res = await fetch(url, { headers: { 'Accept-Language': lang } });
        const data = await res.json();
        setSearchResults(r => ({ ...r, [destId]: data }));
      } catch { setSearchResults(r => ({ ...r, [destId]: [] })); }
      finally { setSearchLoading(l => ({ ...l, [destId]: false })); }
    }, 400);
  }, [lang]);

  const updateDest = (id, field, value) => {
    setDestinations(d => d.map(dest => dest.id === id ? { ...dest, [field]: value } : dest));
  };

  const selectPlace = (destId, place) => {
    setDestinations(d => d.map(dest =>
      dest.id === destId ? { ...dest, name: place.display_name.split(',')[0], lat: parseFloat(place.lat), lng: parseFloat(place.lon) } : dest
    ));
    setSearchResults(r => ({ ...r, [destId]: [] }));
  };

  const addDestination = () => setDestinations(d => [...d, EMPTY_DEST()]);
  const removeDest = (id) => setDestinations(d => d.filter(dest => dest.id !== id));

  // ── Route calculation ─────────────────────────────────────────────────────
  const calculateRoutes = useCallback(async () => {
    const validDests = destinations.filter(d => d.lat && d.lng);
    if (validDests.length < 2) { setError(lang === 'bn' ? 'কমপক্ষে ২টি গন্তব্য নির্বাচন করুন।' : 'Select at least 2 destinations.'); return; }
    setError('');
    setRoutesLoading(true);
    setRoutes([]);
    try {
      const coords = validDests.map(d => `${d.lng},${d.lat}`).join(';');
      const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&alternatives=3`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length) {
        const routeList = data.routes.map((r, i) => ({
          index: i,
          distanceKm: (r.distance / 1000),
          durationHours: (r.duration / 3600),
          geometry: r.geometry
        }));
        setRoutes(routeList);
        setSelectedRouteIdx(0);

        // Pre-fill toll with standard formula if not manually specified
        const distKm = routeList[0]?.distanceKm || 0;
        setCostParams(p => ({
          ...p,
          tollCostManual: p.tollCostManual !== '' ? p.tollCostManual : Math.round(distKm * 0.5)
        }));
      } else {
        setError(t.noRoutesFound);
      }
    } catch { setError(t.noRoutesFound); }
    finally { setRoutesLoading(false); }
  }, [destinations, lang, t]);

  // ── Cost estimation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 3) return;
    const selectedRoute = routes[selectedRouteIdx];
    const distKm = selectedRoute?.distanceKm || 0;
    const numMembers = 1; // user starts as 1 member; others added after creation
    const estimate = calculateCostEstimate(distKm, numMembers, {
      ...costParams,
      days: Number(costParams.days) || 1,
      nights: Number(costParams.nights) || 0,
      tollCostManual: costParams.tollCostManual,
      foodPerPersonPerDay: costParams.foodPerDay,
      hotelPerPersonPerNight: costParams.hotelPerNight,
      miscBudget: costParams.miscBudget
    });
    setCostEstimate(estimate);
  }, [step, routes, selectedRouteIdx, costParams]);

  // ── Step validation ───────────────────────────────────────────────────────
  const validateStep = () => {
    if (step === 1) {
      if (!title.trim()) { setError(lang === 'bn' ? 'ট্যুরের নাম দিন।' : 'Enter tour title.'); return false; }
      if (new Date(endDate) < new Date(startDate)) { setError(lang === 'bn' ? 'শেষের তারিখ শুরুর তারিখের পরে হতে হবে।' : 'End date must be after start date.'); return false; }
    }
    if (step === 2 && routes.length === 0) { setError(lang === 'bn' ? 'রুট নির্বাচন করুন।' : 'Please calculate a route first.'); return false; }
    setError('');
    return true;
  };

  const handleNext = () => { if (validateStep()) setStep(s => s + 1); };
  const handleBack = () => { setError(''); setStep(s => s - 1); };

  // ── Create Tour ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!validateStep()) return;
    if (!user?.uid) {
      setError(lang === 'bn' ? 'ট্যুর তৈরি করতে লগইন করা প্রয়োজন।' : 'Please log in to create a tour.');
      return;
    }
    setSaving(true);
    try {
      const selectedRoute = routes[selectedRouteIdx];
      const tourData = {
        title: title.trim(),
        description: description.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        destinations: destinations.filter(d => d.lat).map(({ id, ...rest }) => rest),
        selectedRouteIndex: selectedRouteIdx,
        estimatedDistanceKm: selectedRoute?.distanceKm ? Math.round(selectedRoute.distanceKm * 10) / 10 : 0,
        estimatedDurationHours: selectedRoute?.durationHours ? Math.round(selectedRoute.durationHours * 10) / 10 : 0,
        costEstimate: costEstimate || {},
        routeGeometry: selectedRoute?.geometry || null
      };
      const userData = {
        displayName: user.displayName || user.name || 'Rider',
        email: user.email || '',
        photoURL: user.photoURL || '',
        phone: user.phone || ''
      };
      const tourId = await createTour(user.uid, userData, tourData);
      onCreated(tourId);
    } catch (err) {
      setError(err.message || 'Error creating tour');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tour-create-modal">
        {/* Header */}
        <div className="tour-create-header">
          <div className="tour-create-title-row">
            <Route size={20} />
            <span>{t.createTour}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Step indicators */}
        <div className="tour-step-indicators">
          {[1, 2, 3].map(s => (
            <div key={s} className={`tour-step-dot ${step >= s ? 'active' : ''} ${step === s ? 'current' : ''}`}>
              <span>{s}</span>
              <div className="tour-step-label">
                {s === 1 ? t.step1BasicInfo : s === 2 ? t.step2Route : t.step3Cost}
              </div>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="tour-create-body">
          {error && <div className="tour-error"><AlertCircle size={14} />{error}</div>}

          {/* ── Step 1: Basic Info ── */}
          {step === 1 && (
            <div className="tour-step-content">
              <div className="form-group">
                <label>{t.tourTitle} *</label>
                <input
                  className="tour-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t.tourTitlePlaceholder}
                  maxLength={80}
                />
              </div>
              <div className="form-group">
                <label>{t.tourDescription}</label>
                <textarea
                  className="tour-input tour-textarea"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t.tourDescriptionPlaceholder}
                  rows={3}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>{t.tourStartDate}</label>
                  <input className="tour-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t.tourEndDate}</label>
                  <input className="tour-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Route & Destinations ── */}
          {step === 2 && (
            <div className="tour-step-content">
              <div className="form-group">
                <label>{t.tourDestinations}</label>
                <div className="tour-destinations-list">
                  {destinations.map((dest, idx) => (
                    <div key={dest.id} className="tour-dest-row">
                      <div className="tour-dest-marker">
                        {idx === 0 ? '🟢' : idx === destinations.length - 1 ? '🔴' : '🔵'}
                      </div>
                      <div className="tour-dest-input-wrap">
                        <input
                          className="tour-input"
                          value={dest.name}
                          onChange={e => { updateDest(dest.id, 'name', e.target.value); searchPlace(e.target.value, dest.id); }}
                          placeholder={t.destinationPlaceholder}
                        />
                        {dest.lat && <span className="tour-dest-confirmed"><Check size={12} /> {dest.lat.toFixed(3)}, {dest.lng.toFixed(3)}</span>}
                        {searchLoading[dest.id] && <Loader size={12} className="spin" />}
                        {searchResults[dest.id]?.length > 0 && (
                          <div className="tour-search-dropdown">
                            {searchResults[dest.id].map(place => (
                              <button key={place.place_id} className="tour-search-result" onClick={() => selectPlace(dest.id, place)}>
                                <MapPin size={12} />
                                {place.display_name.split(',').slice(0, 2).join(', ')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {destinations.length > 2 && (
                        <button className="tour-dest-remove" onClick={() => removeDest(dest.id)}><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button className="tour-add-dest-btn" onClick={addDestination}>
                  <Plus size={14} /> {t.addDestination}
                </button>
              </div>

              <button
                className="tour-calc-route-btn"
                onClick={calculateRoutes}
                disabled={routesLoading}
              >
                {routesLoading ? <><Loader size={15} className="spin" /> {t.loadingRoutes}</> : <><Route size={15} /> {t.compareRoutes}</>}
              </button>

              {routes.length > 0 && (
                <div className="tour-routes-list">
                  {routes.map((route, idx) => (
                    <button
                      key={idx}
                      className={`tour-route-card ${selectedRouteIdx === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedRouteIdx(idx)}
                    >
                      <div className="tour-route-badge">{t.routeAlt} {idx + 1}</div>
                      <div className="tour-route-stats">
                        <span>📍 {route.distanceKm.toFixed(1)} km</span>
                        <span>⏱️ {Math.round(route.durationHours * 60)} min</span>
                      </div>
                      {selectedRouteIdx === idx && <div className="tour-route-selected-mark"><Check size={14} /></div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Cost Estimation ── */}
          {step === 3 && (
            <div className="tour-step-content">
              <div className="tour-cost-params">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>{t.kmPerLiter}</label>
                    <input className="tour-input" type="number" value={costParams.kmPerLiter} onChange={e => setCostParams(p => ({ ...p, kmPerLiter: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>{t.fuelPrice}</label>
                    <input className="tour-input" type="number" value={costParams.fuelPricePerLiter} onChange={e => setCostParams(p => ({ ...p, fuelPricePerLiter: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>{t.numDays}</label>
                    <input className="tour-input" type="number" min="1" value={costParams.days} onChange={e => setCostParams(p => ({ ...p, days: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>{t.numNights}</label>
                    <input className="tour-input" type="number" min="0" value={costParams.nights} onChange={e => setCostParams(p => ({ ...p, nights: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>🛣️ {t.tollBudget || t.tollCost}</label>
                    <input
                      className="tour-input"
                      type="number"
                      min="0"
                      value={costParams.tollCostManual}
                      placeholder={lang === 'bn' ? 'টোল বাজেট (৳)' : 'Toll budget (৳)'}
                      onChange={e => setCostParams(p => ({ ...p, tollCostManual: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>🍽️ {t.dailyFoodBudget || t.foodCost}</label>
                    <input
                      className="tour-input"
                      type="number"
                      min="0"
                      value={costParams.foodPerDay}
                      placeholder="300"
                      onChange={e => setCostParams(p => ({ ...p, foodPerDay: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>🏨 {t.nightHotelBudget || t.hotelCost}</label>
                    <input
                      className="tour-input"
                      type="number"
                      min="0"
                      value={costParams.hotelPerNight}
                      placeholder="800"
                      onChange={e => setCostParams(p => ({ ...p, hotelPerNight: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>📦 {t.emergencyBudget || t.miscCost}</label>
                    <input
                      className="tour-input"
                      type="number"
                      min="0"
                      value={costParams.miscBudget}
                      placeholder="0"
                      onChange={e => setCostParams(p => ({ ...p, miscBudget: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {costEstimate && (
                <div className="tour-cost-breakdown">
                  <div className="tour-cost-row">
                    <span>⛽ {t.fuelCost} ({costEstimate.litersNeeded || 0} L)</span>
                    <strong>৳{costEstimate.fuelCost.toLocaleString()}</strong>
                  </div>
                  <div className="tour-cost-row">
                    <span>🛣️ {t.tollCost}</span>
                    <strong>৳{costEstimate.tollCost.toLocaleString()}</strong>
                  </div>
                  <div className="tour-cost-row">
                    <span>🍽️ {t.foodCost} ({costParams.days || 1} {lang === 'bn' ? 'দিন' : 'days'})</span>
                    <strong>৳{costEstimate.foodCost.toLocaleString()}</strong>
                  </div>
                  {costEstimate.hotelCost > 0 && (
                    <div className="tour-cost-row">
                      <span>🏨 {t.hotelCost} ({costParams.nights || 0} {lang === 'bn' ? 'রাত' : 'nights'})</span>
                      <strong>৳{costEstimate.hotelCost.toLocaleString()}</strong>
                    </div>
                  )}
                  {costEstimate.miscCost > 0 && (
                    <div className="tour-cost-row">
                      <span>📦 {t.miscCost}</span>
                      <strong>৳{costEstimate.miscCost.toLocaleString()}</strong>
                    </div>
                  )}
                  <div className="tour-cost-row total">
                    <span>{t.totalCost}</span>
                    <strong className="tour-cost-total">৳{costEstimate.totalCost.toLocaleString()}</strong>
                  </div>
                  <div className="tour-cost-note">
                    ℹ️ {lang === 'bn' ? `আনুমানিক দূরত্ব: ${routes[selectedRouteIdx]?.distanceKm?.toFixed(1)} কিমি` : `Est. distance: ${routes[selectedRouteIdx]?.distanceKm?.toFixed(1)} km`}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="tour-create-footer">
          {step > 1 ? (
            <button className="tour-btn-secondary" onClick={handleBack}>
              <ChevronLeft size={16} /> {t.prevStep}
            </button>
          ) : (
            <button className="tour-btn-secondary" onClick={onClose}>{t.cancel}</button>
          )}

          {step < 3 ? (
            <button className="tour-btn-primary" onClick={handleNext}>
              {t.nextStep} <ChevronRight size={16} />
            </button>
          ) : (
            <button className="tour-btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader size={16} className="spin" /> : <Plus size={16} />}
              {t.createTourBtn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
