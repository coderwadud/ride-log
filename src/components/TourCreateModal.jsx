import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, MapPin, Plus, Trash2, ChevronRight, ChevronLeft, Loader, 
  Check, Route, AlertCircle, Sparkles, Zap, Compass, Clock, Fuel,
  CheckCircle2, Info, Navigation
} from 'lucide-react';
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

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const routeLayersRef = useRef([]);

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

  // ── Format Duration Helper ────────────────────────────────────────────────
  const formatDuration = useCallback((hours) => {
    if (!hours) return '--';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (lang === 'bn') {
      return `${h > 0 ? `${h} ঘণ্টা ` : ''}${m} মিনিট`;
    }
    return `${h > 0 ? `${h}h ` : ''}${m}m`;
  }, [lang]);

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

  // ── Route calculation with Steps & Geometry ──────────────────────────────
  const calculateRoutes = useCallback(async () => {
    const validDests = destinations.filter(d => d.lat && d.lng);
    if (validDests.length < 2) { 
      setError(lang === 'bn' ? 'কমপক্ষে ২টি গন্তব্য নির্বাচন করুন।' : 'Select at least 2 destinations.'); 
      return; 
    }
    setError('');
    setRoutesLoading(true);
    setRoutes([]);
    try {
      const coords = validDests.map(d => `${d.lng},${d.lat}`).join(';');
      const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&alternatives=3&steps=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length) {
        const kmPerLiter = Number(costParams.kmPerLiter) || 40;
        const fuelPrice = Number(costParams.fuelPricePerLiter) || 135;

        const routeList = data.routes.map((r, i) => {
          const distKm = Math.round((r.distance / 1000) * 10) / 10;
          const durationHours = r.duration / 3600;
          const fuelLiters = Math.round((distKm / kmPerLiter) * 10) / 10;
          const fuelCost = Math.round(fuelLiters * fuelPrice);
          const roadName = r.legs?.[0]?.summary || `Route ${i + 1}`;

          return {
            index: i,
            distanceKm: distKm,
            durationHours: durationHours,
            fuelLiters: fuelLiters,
            fuelCost: fuelCost,
            summary: roadName,
            geometry: r.geometry
          };
        });

        // Find fastest and shortest routes for smart recommendation
        let fastestIdx = 0;
        let shortestIdx = 0;
        routeList.forEach((r, idx) => {
          if (r.durationHours < routeList[fastestIdx].durationHours) fastestIdx = idx;
          if (r.distanceKm < routeList[shortestIdx].distanceKm) shortestIdx = idx;
        });

        const analyzed = routeList.map((r, idx) => ({
          ...r,
          isFastest: idx === fastestIdx,
          isShortest: idx === shortestIdx,
          isBestRecommended: idx === fastestIdx // Fastest route via highway is best for tours
        }));

        setRoutes(analyzed);
        setSelectedRouteIdx(fastestIdx);

        // Pre-fill toll with standard formula if not manually specified
        const distKm = analyzed[0]?.distanceKm || 0;
        setCostParams(p => ({
          ...p,
          tollCostManual: p.tollCostManual !== '' ? p.tollCostManual : Math.round(distKm * 0.5)
        }));
      } else {
        setError(t.noRoutesFound);
      }
    } catch { 
      setError(t.noRoutesFound); 
    } finally { 
      setRoutesLoading(false); 
    }
  }, [destinations, lang, t, costParams.kmPerLiter, costParams.fuelPricePerLiter]);

  // ── Leaflet Map Setup & Invalidation in Step 2 ────────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    if (!mapContainerRef.current) return;

    let isMounted = true;
    if (!leafletMapRef.current) {
      import('leaflet').then(L => {
        if (!isMounted || !mapContainerRef.current) return;
        if (leafletMapRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [23.685, 90.356],
          zoom: 7,
          zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        }).addTo(map);

        leafletMapRef.current = map;
        setTimeout(() => {
          if (map) map.invalidateSize();
        }, 250);
      }).catch(err => {
        console.error('Leaflet load error:', err);
      });
    } else {
      setTimeout(() => {
        if (leafletMapRef.current) leafletMapRef.current.invalidateSize();
      }, 200);
    }
  }, [step]);

  // ── Draw Waypoint Markers & Routes on Leaflet Map ─────────────────────────
  useEffect(() => {
    if (step !== 2 || !leafletMapRef.current) return;

    import('leaflet').then(L => {
      const map = leafletMapRef.current;
      if (!map) return;

      // Clear existing layers
      routeLayersRef.current.forEach(layer => layer.remove());
      routeLayersRef.current = [];

      const validDests = destinations.filter(d => d.lat && d.lng);

      // 1. Draw Waypoint Markers
      validDests.forEach((dest, i) => {
        const isStart = i === 0;
        const isEnd = i === validDests.length - 1;
        const markerColor = isStart ? '#10b981' : isEnd ? '#ef4444' : '#38bdf8';
        const markerEmoji = isStart ? '🚩' : isEnd ? '🏁' : `${i + 1}`;

        const icon = L.divIcon({
          className: '',
          html: `
            <div class="tour-waypoint-pin" style="border-color: ${markerColor}">
              <div class="tour-waypoint-badge" style="background: ${markerColor}">${markerEmoji}</div>
              <span class="tour-waypoint-name">${dest.name || `Point ${i + 1}`}</span>
            </div>
          `,
          iconSize: [120, 36],
          iconAnchor: [60, 36]
        });

        const m = L.marker([dest.lat, dest.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${isStart ? (lang === 'bn' ? 'শুরুর স্থান' : 'Start') : isEnd ? (lang === 'bn' ? 'গন্তব্য' : 'Destination') : `${lang === 'bn' ? 'স্টপ' : 'Stop'} ${i}`}</strong><br>${dest.name}`);

        routeLayersRef.current.push(m);
      });

      // 2. Draw Alternative Routes in Dashed Gray Lines
      routes.forEach((r, idx) => {
        if (!r.geometry || idx === selectedRouteIdx) return;
        try {
          const altLayer = L.geoJSON(r.geometry, {
            style: {
              color: '#94a3b8',
              weight: 4,
              opacity: 0.55,
              dashArray: '6 6'
            }
          }).addTo(map);

          altLayer.on('click', () => setSelectedRouteIdx(idx));
          routeLayersRef.current.push(altLayer);
        } catch (e) {}
      });

      // 3. Draw Active Selected Route with Glowing Vibrant Line
      const activeRoute = routes[selectedRouteIdx];
      if (activeRoute?.geometry) {
        try {
          const glowLayer = L.geoJSON(activeRoute.geometry, {
            style: {
              color: '#38bdf8',
              weight: 8,
              opacity: 0.35
            }
          }).addTo(map);
          routeLayersRef.current.push(glowLayer);

          const mainLayer = L.geoJSON(activeRoute.geometry, {
            style: {
              color: '#6366f1',
              weight: 5,
              opacity: 0.95
            }
          }).addTo(map);
          routeLayersRef.current.push(mainLayer);

          map.fitBounds(mainLayer.getBounds(), { padding: [30, 30], maxZoom: 15 });
        } catch (e) {}
      } else if (validDests.length > 0) {
        const group = L.featureGroup(routeLayersRef.current);
        if (group.getLayers().length > 0) {
          map.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 14 });
        }
      }
    });
  }, [step, routes, selectedRouteIdx, destinations, lang]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

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

  const activeRoute = routes[selectedRouteIdx] || routes[0];
  const fastestRoute = routes.find(r => r.isFastest);
  const shortestRoute = routes.find(r => r.isShortest);

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

          {/* ── Step 2: Route, Interactive Map & Recommendation ── */}
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
                          placeholder={idx === 0 ? (lang === 'bn' ? 'শুরুর স্থান (যেমন: ঢাকা)' : 'Starting location (e.g. Dhaka)') : idx === destinations.length - 1 ? (lang === 'bn' ? 'চূড়ান্ত গন্তব্য (যেমন: কক্সবাজার)' : 'Final destination (e.g. Cox\'s Bazar)') : t.destinationPlaceholder}
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

              {/* Calculate Routes Button */}
              <button
                className="tour-calc-route-btn"
                onClick={calculateRoutes}
                disabled={routesLoading}
              >
                {routesLoading ? <><Loader size={15} className="spin" /> {t.loadingRoutes}</> : <><Route size={15} /> {t.compareRoutes}</>}
              </button>

              {/* 🗺️ Interactive Route Map Preview */}
              <div className="tour-create-map-section">
                <div className="tour-create-map-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Compass size={14} className="text-indigo-400" />
                    {t.liveRouteMap || (lang === 'bn' ? 'ম্যাপে রুটের লাইভ প্রিভিউ' : 'Live Route Map Preview')}
                  </span>
                  {routes.length > 1 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {t.clickMapOrCard || (lang === 'bn' ? 'ম্যাপের লাইনে ক্লিক করে রুট পরিবর্তন করুন' : 'Click route line to select')}
                    </span>
                  )}
                </div>

                <div className="tour-create-map-container">
                  <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

                  <div className="tour-create-map-badge">
                    <Navigation size={11} />
                    <span>{routes.length > 0 ? `${routes.length} ${lang === 'bn' ? 'টি রুট' : 'routes'}` : (lang === 'bn' ? 'রুট ম্যাপ' : 'Route Map')}</span>
                  </div>

                  {routesLoading && (
                    <div className="tour-map-route-loading">
                      <Loader size={15} className="spin" />
                      <span>{lang === 'bn' ? 'ম্যাপে রুট ড্র করা হচ্ছে...' : 'Drawing routes on map...'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 💡 Smart Route Recommendation Box */}
              {routes.length > 0 && activeRoute && (
                <div className="tour-recommendation-card">
                  <div className="tour-recommendation-header">
                    <div className="tour-recommendation-title">
                      <Sparkles size={14} className="text-indigo-400" />
                      <span>{t.routeInsights || (lang === 'bn' ? 'রুট অ্যানালাইসিস ও সেরা পরামর্শ' : 'Route Insights & Recommendation')}</span>
                    </div>
                    {activeRoute.isBestRecommended && (
                      <span className="tour-recommendation-pill">
                        <CheckCircle2 size={11} /> {t.bestRouteRecommended || (lang === 'bn' ? 'সেরা পছন্দ' : 'Recommended')}
                      </span>
                    )}
                  </div>

                  <p className="tour-recommendation-text">
                    {lang === 'bn' ? (
                      activeRoute.isBestRecommended && activeRoute.isShortest ? (
                        <>💡 <strong>রুট {activeRoute.index + 1}</strong> সবচেয়ে সেরা বিকল্প — এটি সবচেয়ে দ্রুততম ({formatDuration(activeRoute.durationHours)}) এবং দূরত্বও সবচেয়ে কম ({activeRoute.distanceKm} কিমি)।</>
                      ) : activeRoute.isBestRecommended ? (
                        <>💡 <strong>রুট {activeRoute.index + 1}</strong> সবচেয়ে সেরা পছন্দ — হাইওয়ে প্রশস্ত থাকায় {shortestRoute ? `${Math.round((shortestRoute.durationHours - activeRoute.durationHours) * 60)} মিনিট সময় বাঁচবে` : 'দ্রুত পৌঁছানো যাবে'} এবং বাইক রাইড আরামদায়ক হবে।</>
                      ) : activeRoute.isShortest ? (
                        <>💡 <strong>রুট {activeRoute.index + 1}</strong> শর্টকাট — দূরত্ব {fastestRoute ? `${(fastestRoute.distanceKm - activeRoute.distanceKm).toFixed(1)} কিমি কম` : 'কম'}, তবে লোকাল সড়কের কারণে সময় কিছুটা বেশি লাগতে পারে।</>
                      ) : (
                        <>💡 <strong>বিকল্প রুট {activeRoute.index + 1}</strong> — দূরত্ব {activeRoute.distanceKm} কিমি ও আনুমানিক সময় {formatDuration(activeRoute.durationHours)}।</>
                      )
                    ) : (
                      activeRoute.isBestRecommended && activeRoute.isShortest ? (
                        <>💡 <strong>Route {activeRoute.index + 1}</strong> is the best choice — it is both the fastest ({formatDuration(activeRoute.durationHours)}) and shortest ({activeRoute.distanceKm} km).</>
                      ) : activeRoute.isBestRecommended ? (
                        <>💡 <strong>Route {activeRoute.index + 1}</strong> is recommended — saves {shortestRoute ? `${Math.round((shortestRoute.durationHours - activeRoute.durationHours) * 60)} mins` : 'time'} with smoother highway conditions.</>
                      ) : activeRoute.isShortest ? (
                        <>💡 <strong>Route {activeRoute.index + 1}</strong> is a shortcut — {fastestRoute ? `${(fastestRoute.distanceKm - activeRoute.distanceKm).toFixed(1)} km shorter` : 'shorter distance'}, but may take slightly longer.</>
                      ) : (
                        <>💡 <strong>Route {activeRoute.index + 1}</strong> — Distance: {activeRoute.distanceKm} km, Duration: {formatDuration(activeRoute.durationHours)}.</>
                      )
                    )}
                  </p>
                </div>
              )}

              {/* 🛣️ Route Selection Cards */}
              {routes.length > 0 && (
                <div className="tour-routes-list">
                  {routes.map((route, idx) => {
                    const isSelected = selectedRouteIdx === idx;
                    return (
                      <button
                        key={idx}
                        className={`tour-route-item-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedRouteIdx(idx)}
                      >
                        <div className="tour-route-item-top">
                          <div className="tour-route-item-label">
                            <span>{t.routeAlt} {idx + 1}</span>
                            {route.summary && <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 'normal' }}>({route.summary})</span>}
                          </div>

                          <div className="tour-route-badges-wrap">
                            {route.isBestRecommended && (
                              <span className="tour-badge-best">
                                <Sparkles size={10} /> {lang === 'bn' ? 'সেরা পছন্দ' : 'Best'}
                              </span>
                            )}
                            {route.isFastest && !route.isBestRecommended && (
                              <span className="tour-badge-fastest">
                                <Zap size={10} /> {t.fastest || 'Fastest'}
                              </span>
                            )}
                            {route.isShortest && (
                              <span className="tour-badge-shortest">
                                📏 {t.shortest || 'Shortest'}
                              </span>
                            )}
                            {isSelected && (
                              <div style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}>
                                <Check size={16} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="tour-route-item-stats">
                          <div className="tour-route-stat-item">
                            <span>📍</span>
                            <strong>{route.distanceKm} km</strong>
                          </div>
                          <div className="tour-route-stat-item">
                            <Clock size={12} />
                            <strong>{formatDuration(route.durationHours)}</strong>
                          </div>
                          <div className="tour-route-stat-item fuel">
                            <Fuel size={12} />
                            <strong>৳{route.fuelCost} ({route.fuelLiters}L)</strong>
                          </div>
                        </div>
                      </button>
                    );
                  })}
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
