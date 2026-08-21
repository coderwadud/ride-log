import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Navigation, Eye, EyeOff, Loader, Route, Compass,
  Fuel, Clock, Check, ExternalLink, ArrowRight, Sparkles, Layers
} from 'lucide-react';
import { translations } from '../utils/translations';
import {
  listenToTourMembers, listenToLiveLocations,
  updateLiveLocation, clearLiveLocation, updateMemberField
} from '../utils/tourStorage';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

export default function TourMapTab({ tourId, tour, lang = 'bn', user }) {
  const t = translations[lang] || translations['bn'];
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const routeLayersRef = useRef([]);
  const markerLayersRef = useRef({});
  const locationWatchRef = useRef(null);

  const [members, setMembers] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);

  // Routes state
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  // ── 1. Init Leaflet map ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    let isMounted = true;

    import('leaflet').then(L => {
      if (!isMounted || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [23.685, 90.356],
        zoom: 7,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
      }).addTo(map);

      leafletMapRef.current = map;
      setMapReady(true);
    }).catch(err => {
      console.error('Leaflet load error:', err);
    });

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      stopLocationSharing();
    };
  }, []);

  // ── 2. Fetch OSRM Alternative Routes & Directions ─────────────────────────
  const fetchDrivingRoutes = useCallback(async () => {
    const validDests = (tour?.destinations || []).filter(d => d.lat && d.lng);
    if (validDests.length < 2) return;

    setRoutesLoading(true);
    setRouteError('');
    try {
      const coords = validDests.map(d => `${d.lng},${d.lat}`).join(';');
      const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&alternatives=3&steps=true`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes?.length > 0) {
        const kmPerLiter = tour?.costEstimate?.kmPerLiter || 40;
        const fuelPrice = tour?.costEstimate?.fuelPricePerLiter || 135;

        const routeList = data.routes.map((r, idx) => {
          const distKm = Math.round((r.distance / 1000) * 10) / 10;
          const durationHours = r.duration / 3600;
          const fuelLiters = Math.round((distKm / kmPerLiter) * 10) / 10;
          const fuelCost = Math.round(fuelLiters * fuelPrice);

          return {
            index: idx,
            distanceKm: distKm,
            durationHours,
            fuelLiters,
            fuelCost,
            geometry: r.geometry,
            summary: r.legs?.[0]?.summary || `Route ${idx + 1}`
          };
        });

        // Sort: fastest first
        routeList.sort((a, b) => a.durationHours - b.durationHours);
        setRoutes(routeList);
        setSelectedRouteIdx(tour?.selectedRouteIndex || 0);
      } else {
        setRouteError(t.noRoutesFound || 'No routes found');
      }
    } catch (err) {
      console.error('Route fetch error:', err);
      // Fallback: If tour has saved routeGeometry, use that
      if (tour?.routeGeometry) {
        setRoutes([{
          index: 0,
          distanceKm: tour.estimatedDistanceKm || 0,
          durationHours: tour.estimatedDurationHours || 0,
          fuelLiters: Math.round(((tour.estimatedDistanceKm || 0) / 40) * 10) / 10,
          fuelCost: Math.round(((tour.estimatedDistanceKm || 0) / 40) * 135),
          geometry: tour.routeGeometry,
          summary: 'Saved Route'
        }]);
      }
    } finally {
      setRoutesLoading(false);
    }
  }, [tour?.destinations, tour?.selectedRouteIndex, tour?.costEstimate, tour?.routeGeometry, tour?.estimatedDistanceKm, tour?.estimatedDurationHours, t.noRoutesFound]);

  useEffect(() => {
    if (tour?.destinations?.length >= 2) {
      fetchDrivingRoutes();
    }
  }, [tour?.destinations, fetchDrivingRoutes]);

  // ── 3. Draw Routes & Waypoints on Leaflet Map ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;

    import('leaflet').then(L => {
      const map = leafletMapRef.current;
      if (!map) return;

      // Clear existing route layers
      routeLayersRef.current.forEach(layer => layer.remove());
      routeLayersRef.current = [];

      // 3.1 Draw destination markers
      const validDests = (tour?.destinations || []).filter(d => d.lat && d.lng);
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
              <span class="tour-waypoint-name">${dest.name}</span>
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

      // 3.2 Draw alternative routes first (in background / dashed)
      routes.forEach((r, idx) => {
        if (!r.geometry || idx === selectedRouteIdx) return;
        try {
          const altLayer = L.geoJSON(r.geometry, {
            style: {
              color: '#94a3b8',
              weight: 4,
              opacity: 0.5,
              dashArray: '6 6'
            }
          }).addTo(map);

          altLayer.on('click', () => setSelectedRouteIdx(idx));
          routeLayersRef.current.push(altLayer);
        } catch (e) {}
      });

      // 3.3 Draw active selected route on top (solid, glowing, vibrant)
      const activeRoute = routes[selectedRouteIdx];
      if (activeRoute?.geometry) {
        try {
          // Glow background line
          const glowLayer = L.geoJSON(activeRoute.geometry, {
            style: {
              color: '#38bdf8',
              weight: 8,
              opacity: 0.35
            }
          }).addTo(map);
          routeLayersRef.current.push(glowLayer);

          // Core primary driving line
          const mainLayer = L.geoJSON(activeRoute.geometry, {
            style: {
              color: '#6366f1',
              weight: 5,
              opacity: 0.95
            }
          }).addTo(map);
          routeLayersRef.current.push(mainLayer);

          // Fit bounds to the route
          map.fitBounds(mainLayer.getBounds(), { padding: [40, 40], maxZoom: 15 });
        } catch (e) {}
      } else if (validDests.length > 0) {
        // Fit to markers if no route geometry
        const group = L.featureGroup(routeLayersRef.current);
        map.fitBounds(group.getBounds(), { padding: [40, 40] });
      }
    });
  }, [mapReady, routes, selectedRouteIdx, tour?.destinations, lang]);

  // ── 4. Listen to members and live locations ────────────────────────────────
  useEffect(() => {
    const unsub1 = listenToTourMembers(tourId, setMembers);
    const unsub2 = listenToLiveLocations(tourId, setLiveLocations);
    return () => { unsub1(); unsub2(); };
  }, [tourId]);

  // ── 5. Update live location markers on map ─────────────────────────────────
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;
    import('leaflet').then(L => {
      // Remove stale markers
      Object.keys(markerLayersRef.current).forEach(uid => {
        const stillPresent = liveLocations.some(loc => loc.uid === uid);
        if (!stillPresent) {
          markerLayersRef.current[uid]?.remove();
          delete markerLayersRef.current[uid];
        }
      });

      // Add / update live markers
      liveLocations.forEach(loc => {
        const member = members.find(m => m.uid === loc.uid);
        const name = member?.name || (loc.uid === user?.uid ? (lang === 'bn' ? 'আমি' : 'Me') : loc.uid);
        const isMe = loc.uid === user?.uid;
        const initials = (name || '?')[0].toUpperCase();

        const icon = L.divIcon({
          className: '',
          html: `<div class="tour-live-marker ${isMe ? 'me' : ''}">${initials}<div class="tour-live-pulse"></div></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        if (markerLayersRef.current[loc.uid]) {
          markerLayersRef.current[loc.uid].setLatLng([loc.lat, loc.lng]);
        } else {
          const marker = L.marker([loc.lat, loc.lng], { icon })
            .addTo(leafletMapRef.current)
            .bindPopup(`<strong>${name}</strong><br>${loc.speed?.toFixed(0) || 0} km/h`);
          markerLayersRef.current[loc.uid] = marker;
        }
      });
    });
  }, [liveLocations, mapReady, members, lang, user?.uid]);

  // ── 6. Location sharing ───────────────────────────────────────────────────
  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) return;
    locationWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: (pos.coords.speed || 0) * 3.6,
          heading: pos.coords.heading || 0,
          accuracy: pos.coords.accuracy || 0
        };
        updateLiveLocation(tourId, user.uid, coords);
      },
      null,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    setSharingLocation(true);
    updateMemberField(tourId, user.uid, { shareLocation: true });
  }, [tourId, user?.uid]);

  const stopLocationSharing = useCallback(() => {
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    setSharingLocation(false);
    if (user?.uid) {
      clearLiveLocation(tourId, user.uid);
      updateMemberField(tourId, user.uid, { shareLocation: false });
    }
  }, [tourId, user?.uid]);

  const toggleSharing = () => {
    if (sharingLocation) stopLocationSharing();
    else startLocationSharing();
  };

  // ── 7. Open Google Maps Navigation Link ────────────────────────────────────
  const openGoogleMaps = () => {
    const validDests = (tour?.destinations || []).filter(d => d.lat && d.lng);
    if (validDests.length < 2) return;

    const origin = validDests[0];
    const destination = validDests[validDests.length - 1];
    const waypoints = validDests.slice(1, -1);

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    if (waypoints.length > 0) {
      const wpStr = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
      url += `&waypoints=${encodeURIComponent(wpStr)}`;
    }
    window.open(url, '_blank');
  };

  const activeRoute = routes[selectedRouteIdx] || routes[0];
  const liveCount = liveLocations.length;

  const formatHoursMins = (hrs) => {
    if (!hrs) return '--';
    const totalMinutes = Math.round(hrs * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (lang === 'bn') {
      return `${h > 0 ? `${h} ঘণ্টা ` : ''}${m} মিনিট`;
    }
    return `${h > 0 ? `${h}h ` : ''}${m}m`;
  };

  return (
    <div className="tour-map-tab">
      {/* Controls bar */}
      <div className="tour-map-controls">
        <div className="tour-map-live-info">
          <Navigation size={14} />
          <span>{liveCount} {lang === 'bn' ? 'জন লাইভ' : 'live'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="tour-gmaps-btn"
            onClick={openGoogleMaps}
            title={lang === 'bn' ? 'গুগল ম্যাপে নেভিগেশন খুলুন' : 'Open in Google Maps'}
          >
            <Compass size={14} />
            <span>{lang === 'bn' ? 'নেভিগেশন' : 'Navigate'}</span>
            <ExternalLink size={12} />
          </button>

          <button
            className={`tour-location-share-btn ${sharingLocation ? 'active' : ''}`}
            onClick={toggleSharing}
          >
            {sharingLocation ? <><Eye size={14} /> {t.liveLocationOn}</> : <><EyeOff size={14} /> {t.liveLocationOff}</>}
          </button>
        </div>
      </div>

      {/* Privacy notice */}
      {!sharingLocation && (
        <div className="tour-map-privacy-note">
          🔒 {t.shareLocationDesc}
        </div>
      )}

      {/* Leaflet map */}
      <div className="tour-map-wrapper">
        <div ref={mapRef} className="tour-map-container" />

        {routesLoading && (
          <div className="tour-map-route-loading">
            <Loader size={18} className="spin" />
            <span>{lang === 'bn' ? 'রুট ও দিকনির্দেশনা প্রস্তুত হচ্ছে...' : 'Calculating road routes...'}</span>
          </div>
        )}
      </div>

      {/* Route Direction & Fuel Comparison Card */}
      {routes.length > 0 && (
        <div className="tour-route-info-card">
          <div className="tour-route-info-header">
            <div className="tour-route-info-title">
              <Route size={16} className="text-indigo-400" />
              <span>{lang === 'bn' ? 'রুট ও জ্বালানি হিসাব' : 'Route & Fuel Insights'}</span>
            </div>
            <span className="tour-route-badge-count">
              {routes.length} {lang === 'bn' ? 'টি বিকল্প রুট' : 'routes available'}
            </span>
          </div>

          {/* Route Options Switcher Tabs */}
          <div className="tour-route-tabs">
            {routes.map((r, idx) => {
              const isSelected = selectedRouteIdx === idx;
              const isFastest = idx === 0;

              return (
                <button
                  key={idx}
                  className={`tour-route-tab-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedRouteIdx(idx)}
                >
                  <div className="tour-route-tab-top">
                    <span className="tour-route-tab-label">
                      {lang === 'bn' ? `রুট ${idx + 1}` : `Route ${idx + 1}`}
                    </span>
                    {isFastest && (
                      <span className="tour-route-tag-fastest">
                        <Sparkles size={10} /> {lang === 'bn' ? 'সেরা / দ্রুততম' : 'Fastest'}
                      </span>
                    )}
                  </div>

                  <div className="tour-route-tab-stats">
                    <strong>{r.distanceKm} km</strong>
                    <span>• {formatHoursMins(r.durationHours)}</span>
                  </div>

                  <div className="tour-route-tab-fuel">
                    <span>⛽ {r.fuelLiters} L (৳{r.fuelCost})</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Route Detailed Summary Strip */}
          {activeRoute && (
            <div className="tour-route-active-details">
              <div className="tour-route-stat-box">
                <span className="label">📍 {lang === 'bn' ? 'মোট দূরত্ব' : 'Distance'}</span>
                <span className="val">{activeRoute.distanceKm} km</span>
              </div>
              <div className="tour-route-stat-box">
                <span className="label">⏱️ {lang === 'bn' ? 'আনুমানিক সময়' : 'Time'}</span>
                <span className="val">{formatHoursMins(activeRoute.durationHours)}</span>
              </div>
              <div className="tour-route-stat-box">
                <span className="label">⛽ {lang === 'bn' ? 'জ্বালানি খরচ' : 'Fuel Cost'}</span>
                <span className="val highlight">৳{activeRoute.fuelCost} ({activeRoute.fuelLiters}L)</span>
              </div>
            </div>
          )}

          {/* Destination Waypoint Sequence */}
          {tour?.destinations?.length > 0 && (
            <div className="tour-waypoints-timeline">
              <div className="tour-waypoints-timeline-title">
                <Layers size={13} />
                <span>{lang === 'bn' ? 'যাত্রাপথ ও স্টপসমূহ' : 'Route Stops & Destinations'}</span>
              </div>
              <div className="tour-waypoints-chips">
                {tour.destinations.map((d, i) => (
                  <React.Fragment key={i}>
                    <div className="tour-waypoint-chip">
                      <span className="dot">{i === 0 ? '🟢' : i === tour.destinations.length - 1 ? '🔴' : '🔵'}</span>
                      <span className="name">{d.name}</span>
                    </div>
                    {i < tour.destinations.length - 1 && <span className="arrow">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live members legend */}
      {liveLocations.length > 0 && (
        <div className="tour-live-legend">
          {liveLocations.map(loc => {
            const member = members.find(m => m.uid === loc.uid);
            const name = member?.name || (loc.uid === user?.uid ? (lang === 'bn' ? 'আমি' : 'Me') : '?');
            return (
              <div key={loc.uid} className="tour-live-legend-item">
                <div className={`tour-live-dot ${loc.uid === user?.uid ? 'me' : ''}`}>{name[0]}</div>
                <span>{name}</span>
                <span className="tour-live-speed">{loc.speed?.toFixed(0) || 0} km/h</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
