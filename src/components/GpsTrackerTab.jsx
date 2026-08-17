import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { 
  Play, Pause, Square, Navigation, RotateCcw, 
  Trash2, Calendar, Compass, History, Layers, Check
} from 'lucide-react';
import { saveTrip, getTripsLast3Days, deleteTrip, calculateDistanceKm } from '../utils/tripStorage';

// 5 100% Free Map Modes / Layers
const MAP_LAYERS = {
  street: {
    id: 'street',
    nameBn: 'স্ট্যান্ডার্ড রোড',
    nameEn: 'Street Map',
    icon: '🗺️',
    descBn: 'রাস্তাঘাট, মোড় ও ল্যান্ডমার্ক',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    subdomains: 'abc'
  },
  satellite: {
    id: 'satellite',
    nameBn: 'স্যাটেলাইট ছবি',
    nameEn: 'Satellite HD',
    icon: '🛰️',
    descBn: 'আকাশ থেকে পরিষ্কার উপগ্রহ দৃশ্য',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    subdomains: 'abc'
  },
  bike: {
    id: 'bike',
    nameBn: 'বাইক ও সাইকেল',
    nameEn: 'Bike & Cycle',
    icon: '🚲',
    descBn: 'বাইক রুট, সার্ভিস রোড ও লেন',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    maxZoom: 19,
    subdomains: 'abc'
  },
  terrain: {
    id: 'terrain',
    nameBn: 'ভূপ্রকৃতি ও পাহাড়',
    nameEn: 'Terrain & Topo',
    icon: '🏔️',
    descBn: 'উচ্চতা, পাহাড় ও পাহাড়ি রাস্তা',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
    subdomains: 'abc'
  },
  dark: {
    id: 'dark',
    nameBn: 'নাইট / ডার্ক মোড',
    nameEn: 'Dark Night',
    icon: '🌙',
    descBn: 'রাতের চোখের আরামদায়ক ডার্ক ম্যাপ',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 19,
    subdomains: 'abcd'
  }
};

// Custom Map Marker Icons using SVG data URIs
const createPulseIcon = () => L.divIcon({
  className: 'custom-pulse-marker',
  html: `
    <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(56, 189, 248, 0.4); animation: pulse 1.5s infinite;"></div>
      <div style="width: 14px; height: 14px; border-radius: 50%; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const createStartIcon = () => L.divIcon({
  className: 'custom-start-marker',
  html: `
    <div style="background: #10b981; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.5);">
      S
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const createEndIcon = () => L.divIcon({
  className: 'custom-end-marker',
  html: `
    <div style="background: #ef4444; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.5);">
      E
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const createBikePlaybackIcon = () => L.divIcon({
  className: 'custom-bike-marker',
  html: `
    <div style="background: linear-gradient(135deg, #38bdf8, #0284c7); color: #ffffff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.6); transition: transform 0.2s ease;">
      🏍️
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

export default function GpsTrackerTab({
  lang,
  theme,
  user,
  activeBike
}) {
  const isBn = lang === 'bn';
  const userId = user?.uid || 'guest';

  const [mode, setMode] = useState('live'); // 'live' or 'playback'

  // ── LIVE TRACKING STATES ──
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [tripDistanceKm, setTripDistanceKm] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedPoints, setRecordedPoints] = useState([]);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [tripStartTime, setTripStartTime] = useState(null);

  // ── 3-DAY PLAYBACK STATES ──
  const [tripsList, setTripsList] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x, 8x

  // ── MAP LAYER STATE ──
  const [selectedLayerKey, setSelectedLayerKey] = useState(() => {
    try {
      return localStorage.getItem('ridelog_map_layer') || (theme === 'dark' ? 'dark' : 'street');
    } catch (e) {
      return 'street';
    }
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const currentTileLayerRef = useRef(null);

  // ── MAP REFERENCES ──
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const livePolylineRef = useRef(null);
  const liveMarkerRef = useRef(null);
  const playbackPolylineRef = useRef(null);
  const playbackBikeMarkerRef = useRef(null);
  const playbackStartMarkerRef = useRef(null);
  const playbackEndMarkerRef = useRef(null);
  const watchIdRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const playbackIntervalRef = useRef(null);

  // Load 3-day trips on mount & mode change
  useEffect(() => {
    loadRecentTrips();
  }, [userId, mode]);

  const loadRecentTrips = async () => {
    const list = await getTripsLast3Days(userId);
    setTripsList(list);
    if (list.length > 0 && !selectedTrip) {
      setSelectedTrip(list[0]);
    }
  };

  // ── INITIALIZE LEAFLET MAP ──
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Remove existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultLat = 23.8103; // Dhaka default
    const defaultLng = 90.4125;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([defaultLat, defaultLng], 15);

    // Initial Base Tile Layer from saved preference
    const initialConfig = MAP_LAYERS[selectedLayerKey] || MAP_LAYERS.street;
    const initialLayer = L.tileLayer(initialConfig.url, {
      maxZoom: initialConfig.maxZoom || 19,
      subdomains: initialConfig.subdomains || 'abc'
    }).addTo(map);

    currentTileLayerRef.current = initialLayer;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    // Get initial user position with browser fallback
    const onInitialPos = (latitude, longitude, accuracy) => {
      setCurrentPosition([latitude, longitude]);
      setGpsAccuracy(Math.round(accuracy || 0));
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([latitude, longitude], 16);
      }
    };

    if (Capacitor.isNativePlatform()) {
      Geolocation.getCurrentPosition({ enableHighAccuracy: true })
        .then((pos) => {
          onInitialPos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        })
        .catch((err) => console.warn('Initial native geolocation warning:', err));
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => onInitialPos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => console.warn('Initial web geolocation error:', err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ── DYNAMIC MAP LAYER SWITCHER ──
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const layerConfig = MAP_LAYERS[selectedLayerKey] || MAP_LAYERS.street;

    if (currentTileLayerRef.current) {
      try {
        map.removeLayer(currentTileLayerRef.current);
      } catch (e) {}
    }

    const newLayer = L.tileLayer(layerConfig.url, {
      maxZoom: layerConfig.maxZoom || 19,
      subdomains: layerConfig.subdomains || 'abc'
    }).addTo(map);

    if (newLayer.bringToBack) {
      newLayer.bringToBack();
    }

    currentTileLayerRef.current = newLayer;

    try {
      localStorage.setItem('ridelog_map_layer', selectedLayerKey);
    } catch (e) {}
  }, [selectedLayerKey]);

  // ── LIVE TRACKING TIMER ──
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording, isPaused]);

  // ── LIVE TRACKING GPS WATCHER ──
  const startLiveRecording = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions();
        if (permission.location !== 'granted') {
          alert(isBn ? '⚠️ GPS লোকেশন পারমিশন দিন।' : '⚠️ Please allow GPS location permission.');
          return;
        }
      }

      setIsRecording(true);
      setIsPaused(false);
      setElapsedSeconds(0);
      setTripDistanceKm(0);
      setMaxSpeed(0);
      setCurrentSpeed(0);
      const initialPoints = [];
      if (currentPosition) {
        initialPoints.push({
          lat: currentPosition[0],
          lng: currentPosition[1],
          speed: 0,
          accuracy: gpsAccuracy || 10,
          altitude: 0,
          timestamp: Date.now()
        });
      }
      setRecordedPoints(initialPoints);
      setTripStartTime(new Date().toISOString());

      // Reset live polyline
      if (livePolylineRef.current) {
        livePolylineRef.current.remove();
        livePolylineRef.current = null;
      }

      const handleLocationUpdate = (latitude, longitude, speed, accuracy, altitude) => {
        const newCoord = [latitude, longitude];
        const speedKmH = speed ? Math.max(0, Math.round(speed * 3.6)) : 0;

        setCurrentPosition(newCoord);
        setCurrentSpeed(speedKmH);
        setGpsAccuracy(Math.round(accuracy || 0));
        setMaxSpeed((prev) => Math.max(prev, speedKmH));

        // Save point
        const pointObj = {
          lat: latitude,
          lng: longitude,
          speed: speedKmH,
          accuracy: Math.round(accuracy || 0),
          altitude: altitude || 0,
          timestamp: Date.now()
        };

        setRecordedPoints((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const distInc = calculateDistanceKm(last.lat, last.lng, latitude, longitude);
            // Add distance if movement is > 3 meters
            if (distInc > 0.003) {
              setTripDistanceKm((curr) => +(curr + distInc).toFixed(2));
            }
          }
          return [...prev, pointObj];
        });

        // Update Map Marker & Polyline
        if (mapInstanceRef.current) {
          const map = mapInstanceRef.current;

          // Live Rider Marker
          if (!liveMarkerRef.current) {
            liveMarkerRef.current = L.marker(newCoord, { icon: createPulseIcon() }).addTo(map);
          } else {
            liveMarkerRef.current.setLatLng(newCoord);
          }

          // Live Polyline
          setRecordedPoints((currentList) => {
            const latLngs = currentList.map((p) => [p.lat, p.lng]);
            if (!livePolylineRef.current && latLngs.length > 1) {
              livePolylineRef.current = L.polyline(latLngs, {
                color: '#0284c7',
                weight: 5,
                opacity: 0.85,
                smoothFactor: 1
              }).addTo(map);
            } else if (livePolylineRef.current) {
              livePolylineRef.current.setLatLngs(latLngs);
            }
            return currentList;
          });

          map.panTo(newCoord, { animate: true, duration: 0.5 });
        }
      };

      if (Capacitor.isNativePlatform()) {
        watchIdRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          (position, err) => {
            if (err || !position) return;
            const { latitude, longitude, speed, accuracy, altitude } = position.coords;
            handleLocationUpdate(latitude, longitude, speed, accuracy, altitude);
          }
        );
      } else if (navigator.geolocation) {
        // Standard Web Browser / Localhost
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, speed, accuracy, altitude } = position.coords;
            handleLocationUpdate(latitude, longitude, speed, accuracy, altitude);
          },
          (err) => {
            console.warn('Web geolocation watch warning:', err);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    } catch (e) {
      console.error('Failed to start live ride:', e);
      alert(isBn ? '❌ GPS ট্র্যাকিং শুরু করতে সমস্যা হয়েছে।' : '❌ Failed to start GPS tracking.');
    }
  };

  const pauseLiveRecording = () => {
    setIsPaused(true);
  };

  const resumeLiveRecording = () => {
    setIsPaused(false);
  };

  const finishLiveRecording = async () => {
    if (watchIdRef.current !== null) {
      if (Capacitor.isNativePlatform()) {
        try {
          await Geolocation.clearWatch({ id: watchIdRef.current });
        } catch (e) {}
      } else if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);

    // Ensure we have at least 2 points to draw and playback
    let finalPoints = [...recordedPoints];
    if (finalPoints.length === 0 && currentPosition) {
      finalPoints = [
        { lat: currentPosition[0], lng: currentPosition[1], speed: 0, accuracy: 10, altitude: 0, timestamp: Date.now() - 5000 },
        { lat: currentPosition[0] + 0.0001, lng: currentPosition[1] + 0.0001, speed: 0, accuracy: 10, altitude: 0, timestamp: Date.now() }
      ];
    } else if (finalPoints.length === 1) {
      finalPoints.push({
        lat: finalPoints[0].lat + 0.0001,
        lng: finalPoints[0].lng + 0.0001,
        speed: 0,
        accuracy: 10,
        altitude: 0,
        timestamp: Date.now()
      });
    }

    if (finalPoints.length < 2) {
      alert(isBn ? 'পর্যাপ্ত রাইড ডাটা পাওয়া যায়নি। অনুগ্রহ করে GPS চালু রাখুন।' : 'Not enough ride data. Please keep GPS active.');
      return;
    }

    const defaultTitle = isBn
      ? `রাইড - ${new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}`
      : `Ride - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const tripTitle = prompt(
      isBn ? 'রাইডের নাম দিন (যেমন: ধানমন্ডি থেকে উত্তরা):' : 'Enter Trip Title (e.g. Home to Office):',
      defaultTitle
    );

    if (tripTitle === null) return; // User cancelled

    const avgSpeed = elapsedSeconds > 0 ? +((tripDistanceKm / (elapsedSeconds / 3600))).toFixed(1) : 0;

    const newTrip = {
      id: `trip_${Date.now()}`,
      userId,
      bikeId: activeBike?.id || 'bike_1',
      bikeName: activeBike?.name || 'My Bike',
      title: tripTitle || defaultTitle,
      startTime: tripStartTime || new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: Math.max(1, elapsedSeconds),
      distanceKm: tripDistanceKm,
      maxSpeedKmH: maxSpeed,
      avgSpeedKmH: isNaN(avgSpeed) ? 0 : avgSpeed,
      points: finalPoints
    };

    await saveTrip(newTrip);
    alert(isBn ? '✅ রাইড সফলভাবে সংরক্ষিত হয়েছে!' : '✅ Trip saved successfully!');
    await loadRecentTrips();
    setSelectedTrip(newTrip);
    setMode('playback');
  };

  // ── 3-DAY PLAYBACK CONTROLS ──
  useEffect(() => {
    if (mode !== 'playback' || !selectedTrip || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const points = selectedTrip.points || [];

    if (points.length === 0) return;

    // Clear previous playback markers
    if (playbackPolylineRef.current) playbackPolylineRef.current.remove();
    if (playbackBikeMarkerRef.current) playbackBikeMarkerRef.current.remove();
    if (playbackStartMarkerRef.current) playbackStartMarkerRef.current.remove();
    if (playbackEndMarkerRef.current) playbackEndMarkerRef.current.remove();

    const latLngs = points.map((p) => [p.lat, p.lng]);

    // Draw full route polyline with gradient style
    playbackPolylineRef.current = L.polyline(latLngs, {
      color: '#38bdf8',
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Start & End markers
    playbackStartMarkerRef.current = L.marker(latLngs[0], { icon: createStartIcon() }).addTo(map);
    playbackEndMarkerRef.current = L.marker(latLngs[latLngs.length - 1], { icon: createEndIcon() }).addTo(map);

    // Moving Bike Marker
    playbackBikeMarkerRef.current = L.marker(latLngs[0], { icon: createBikePlaybackIcon() }).addTo(map);

    // Fit map bounds to show full route
    map.fitBounds(playbackPolylineRef.current.getBounds(), { padding: [40, 40] });

    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [selectedTrip, mode]);

  // Handle Playback Interval Animation
  useEffect(() => {
    if (isPlaying && selectedTrip?.points?.length) {
      const intervalMs = Math.max(50, 400 / playbackSpeed);

      playbackIntervalRef.current = setInterval(() => {
        setPlaybackIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= selectedTrip.points.length) {
            setIsPlaying(false);
            return prevIndex;
          }

          const currentPoint = selectedTrip.points[nextIndex];
          const newPos = [currentPoint.lat, currentPoint.lng];

          if (playbackBikeMarkerRef.current) {
            playbackBikeMarkerRef.current.setLatLng(newPos);
          }

          return nextIndex;
        });
      }, intervalMs);
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }

    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    };
  }, [isPlaying, playbackSpeed, selectedTrip]);

  const handleSliderSeek = (e) => {
    const index = parseInt(e.target.value, 10);
    setPlaybackIndex(index);
    if (selectedTrip?.points?.[index] && playbackBikeMarkerRef.current) {
      const pt = selectedTrip.points[index];
      playbackBikeMarkerRef.current.setLatLng([pt.lat, pt.lng]);
    }
  };

  const handleCenterOnMe = () => {
    if (currentPosition && mapInstanceRef.current) {
      mapInstanceRef.current.setView(currentPosition, 17, { animate: true });
    }
  };

  const handleDeleteCurrentTrip = async (tripId) => {
    if (confirm(isBn ? 'আপনি কি এই রাইড রেকর্ডটি মুছে ফেলতে চান?' : 'Delete this trip record?')) {
      await deleteTrip(tripId);
      await loadRecentTrips();
      setSelectedTrip(null);
    }
  };

  const formatTimeStr = (sec) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentPlaybackPoint = selectedTrip?.points?.[playbackIndex] || null;

  return (
    <div className="gps-tracker-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
      {/* ── Top Mode Switcher (Live vs Playback) ── */}
      <div style={{
        display: 'flex',
        background: 'rgba(30, 41, 59, 0.7)',
        padding: '4px',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        gap: '4px'
      }}>
        <button
          type="button"
          onClick={() => setMode('live')}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: '10px',
            fontSize: '0.86rem',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            background: mode === 'live' ? 'linear-gradient(135deg, #0284c7, #0ea5e9)' : 'transparent',
            color: mode === 'live' ? '#ffffff' : 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <Compass size={16} />
          <span>{isBn ? '🔴 লাইভ রাইড ট্র্যাক' : '🔴 Live Ride'}</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('playback')}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: '10px',
            fontSize: '0.86rem',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            background: mode === 'playback' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
            color: mode === 'playback' ? '#ffffff' : 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <History size={16} />
          <span>{isBn ? '📼 ৩ দিনের প্লে-ব্যাক' : '📼 3-Day Playback'}</span>
        </button>
      </div>

      {/* ── MAP VIEWPORT ── */}
      <div style={{ position: 'relative', width: '100%', height: '360px', borderRadius: '18px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Floating Top-Right Action Controls */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {/* Map Layer Switcher Button */}
          <button
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title={isBn ? 'ম্যাপ লেয়ার পরিবর্তন করুন' : 'Change Map Layer'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: showLayerMenu ? '#0284c7' : 'rgba(15, 23, 42, 0.88)',
              border: '1px solid var(--border-color)',
              color: showLayerMenu ? '#ffffff' : '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            <Layers size={18} />
          </button>

          {/* Center on Me Action Button */}
          <button
            type="button"
            onClick={handleCenterOnMe}
            title={isBn ? 'আমার বর্তমান অবস্থান' : 'My Location'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid var(--border-color)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            <Navigation size={18} />
          </button>
        </div>

        {/* ── Interactive Map Layers Menu Popover ── */}
        {showLayerMenu && (
          <div
            style={{
              position: 'absolute',
              top: '58px',
              right: '12px',
              zIndex: 1001,
              background: 'linear-gradient(145deg, #1e293b, #0f172a)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '16px',
              padding: '12px',
              width: '240px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              backdropFilter: 'blur(10px)',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Layers size={14} color="#38bdf8" />
                <span>{isBn ? 'ম্যাপ লেয়ার নির্বাচন' : 'Select Map Layer'}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowLayerMenu(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            {Object.values(MAP_LAYERS).map((layer) => {
              const isSelected = selectedLayerKey === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => {
                    setSelectedLayerKey(layer.id);
                    setShowLayerMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid #0284c7' : '1px solid transparent',
                    background: isSelected ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{layer.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? '#38bdf8' : '#f1f5f9' }}>
                        {isBn ? layer.nameBn : layer.nameEn}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        {layer.descBn}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check size={16} color="#38bdf8" />}
                </button>
              );
            })}
          </div>
        )}

        {/* GPS Accuracy Indicator */}
        {gpsAccuracy !== null && mode === 'live' && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.74rem',
            fontWeight: 700,
            color: gpsAccuracy < 15 ? '#10b981' : '#f59e0b',
            border: '1px solid var(--border-color)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: gpsAccuracy < 15 ? '#10b981' : '#f59e0b' }} />
            <span>GPS ±{gpsAccuracy}m</span>
          </div>
        )}
      </div>

      {/* ── MODE 1: LIVE RIDE DASHBOARD & CONTROLS ── */}
      {mode === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Live Speed & Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px'
          }}>
            {/* Speedometer */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {isBn ? 'বর্তমান স্পিড' : 'Speed'}
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#38bdf8', lineHeight: '1.1', margin: '4px 0' }}>
                {currentSpeed}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>km/h</span>
            </div>

            {/* Distance */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {isBn ? 'দূরত্ব' : 'Distance'}
              </span>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#10b981', lineHeight: '1.1', margin: '4px 0' }}>
                {tripDistanceKm}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>km</span>
            </div>

            {/* Elapsed Time */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {isBn ? 'সময়কাল' : 'Time'}
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', lineHeight: '1.1', margin: '6px 0' }}>
                {formatTimeStr(elapsedSeconds)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                Max: {maxSpeed} km/h
              </span>
            </div>
          </div>

          {/* Live Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {!isRecording ? (
              <button
                type="button"
                onClick={startLiveRecording}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.96rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 6px 18px rgba(14, 165, 233, 0.4)'
                }}
              >
                <Play size={20} fill="#ffffff" />
                <span>{isBn ? 'রাইড শুরু করুন (Start Ride)' : 'Start Ride'}</span>
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    type="button"
                    onClick={resumeLiveRecording}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Play size={18} fill="#ffffff" />
                    <span>{isBn ? 'পুনরায় শুরু' : 'Resume'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pauseLiveRecording}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '14px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Pause size={18} />
                    <span>{isBn ? 'পজ করুন' : 'Pause'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={finishLiveRecording}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 6px 18px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <Square size={18} fill="#ffffff" />
                  <span>{isBn ? 'রাইড শেষ করুন' : 'Finish Ride'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODE 2: 3-DAY PLAYBACK DASHBOARD & CONTROLS ── */}
      {mode === 'playback' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Trip Selector Dropdown */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            padding: '12px 14px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} color="#10b981" />
                <span>{isBn ? 'গত ৩ দিনের রাইড তালিকা:' : 'Trips from last 3 days:'}</span>
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                {tripsList.length} {isBn ? 'টি রাইড' : 'trips'}
              </span>
            </div>

            {tripsList.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center', padding: '8px 0' }}>
                {isBn ? 'গত ৩ দিনে কোনো সংরক্ষিত রাইড পাওয়া যায়নি।' : 'No saved trips in the last 3 days.'}
              </p>
            ) : (
              <select
                className="form-select"
                value={selectedTrip?.id || ''}
                onChange={(e) => {
                  const target = tripsList.find((t) => t.id === e.target.value);
                  setSelectedTrip(target || null);
                }}
                style={{ width: '100%', fontSize: '0.86rem', padding: '8px 12px' }}
              >
                {tripsList.map((t) => {
                  const dateStr = new Date(t.startTime).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
                    month: 'short',
                    day: 'numeric'
                  });
                  const timeStr = new Date(t.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <option key={t.id} value={t.id}>
                      📅 {dateStr} ({timeStr}) • {t.title} - {t.distanceKm} km
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Selected Trip Animated Playback Console */}
          {selectedTrip && (
            <div style={{
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '18px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Trip Header & Quick Stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {selectedTrip.title}
                  </h4>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {new Date(selectedTrip.startTime).toLocaleString(isBn ? 'bn-BD' : 'en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => handleDeleteCurrentTrip(selectedTrip.id)}
                  title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Trip Metrics Banner */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px',
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{isBn ? 'দূরত্ব' : 'Dist'}</span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#10b981' }}>{selectedTrip.distanceKm} km</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{isBn ? 'সময়' : 'Time'}</span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f59e0b' }}>{formatTimeStr(selectedTrip.durationSeconds)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{isBn ? 'টপ স্পিড' : 'Max'}</span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8' }}>{selectedTrip.maxSpeedKmH} km/h</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{isBn ? 'গড় স্পিড' : 'Avg'}</span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#a78bfa' }}>{selectedTrip.avgSpeedKmH} km/h</div>
                </div>
              </div>

              {/* Playback Timeline Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                  <span>🟢 {isBn ? 'শুরু' : 'Start'}</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                    {currentPlaybackPoint ? `⚡ ${currentPlaybackPoint.speed} km/h` : ''}
                  </span>
                  <span>🏁 {isBn ? 'গন্তব্য' : 'Finish'}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, (selectedTrip.points?.length || 1) - 1)}
                  value={playbackIndex}
                  onChange={handleSliderSeek}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
              </div>

              {/* Playback Controls & Multipliers */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Play / Pause */}
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.86rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} fill="#ffffff" />}
                    <span>{isPlaying ? (isBn ? 'পজ' : 'Pause') : (isBn ? 'প্লে করুন' : 'Play')}</span>
                  </button>

                  {/* Reset */}
                  <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => {
                      setIsPlaying(false);
                      setPlaybackIndex(0);
                      if (selectedTrip.points?.[0] && playbackBikeMarkerRef.current) {
                        playbackBikeMarkerRef.current.setLatLng([selectedTrip.points[0].lat, selectedTrip.points[0].lng]);
                      }
                    }}
                    title={isBn ? 'পুনরায় শুরু' : 'Reset'}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                {/* Speed Multipliers */}
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '2px', gap: '2px' }}>
                  {[1, 2, 4, 8].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setPlaybackSpeed(spd)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        background: playbackSpeed === spd ? '#38bdf8' : 'transparent',
                        color: playbackSpeed === spd ? '#0f172a' : 'var(--text-muted)'
                      }}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
