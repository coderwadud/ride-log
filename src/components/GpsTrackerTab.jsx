import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { 
  Play, Pause, Square, Navigation, RotateCcw, 
  Trash2, Calendar, Compass, History, Layers, Check,
  Map, Globe, Bike, Mountain, Moon, Activity, Film,
  Gauge, Clock, Flag, MapPin, Zap, X, Sparkles, CheckCircle2, Save,
  Fuel, Wrench, ExternalLink
} from 'lucide-react';
import { saveTrip, getTripsLast3Days, deleteTrip, calculateDistanceKm } from '../utils/tripStorage';
import { filterGpsJitter, snapToRoadsOSRM, calculateBearing, smoothPathMovingAverage, fetchNearbyPumpsAndGarages } from '../utils/geoUtils';

// 5 100% Free Map Modes / Layers with Lucide SVG Icons
const MAP_LAYERS = {
  street: {
    id: 'street',
    nameBn: 'স্ট্যান্ডার্ড রোড',
    nameEn: 'Street Map',
    iconComponent: Map,
    color: '#38bdf8',
    descBn: 'রাস্তাঘাট, মোড় ও ল্যান্ডমার্ক',
    descEn: 'Roads, turns & local landmarks',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 22,
    maxNativeZoom: 19,
    subdomains: 'abc'
  },
  satellite: {
    id: 'satellite',
    nameBn: 'স্যাটেলাইট ছবি',
    nameEn: 'Satellite HD',
    iconComponent: Globe,
    color: '#10b981',
    descBn: 'আকাশ থেকে পরিষ্কার উপগ্রহ দৃশ্য',
    descEn: 'High-res aerial satellite view',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 22,
    maxNativeZoom: 18,
    subdomains: 'abc'
  },
  bike: {
    id: 'bike',
    nameBn: 'বাইক ও সাইকেল',
    nameEn: 'Bike & Cycle',
    iconComponent: Bike,
    color: '#f59e0b',
    descBn: 'বাইক রুট, সার্ভিস রোড ও লেন',
    descEn: 'Cycling infrastructure & bike tracks',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    maxZoom: 22,
    maxNativeZoom: 19,
    subdomains: 'abc'
  },
  terrain: {
    id: 'terrain',
    nameBn: 'ভূপ্রকৃতি ও পাহাড়',
    nameEn: 'Terrain & Topo',
    iconComponent: Mountain,
    color: '#8b5cf6',
    descBn: 'উচ্চতা, পাহাড় ও পাহাড়ি রাস্তা',
    descEn: 'Elevation contours & hills',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 22,
    maxNativeZoom: 17,
    subdomains: 'abc'
  },
  dark: {
    id: 'dark',
    nameBn: 'নাইট / ডার্ক মোড',
    nameEn: 'Dark Night',
    iconComponent: Moon,
    color: '#94a3b8',
    descBn: 'রাতের চোখের আরামদায়ক ডার্ক ম্যাপ',
    descEn: 'Eye-friendly night dark theme',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 22,
    maxNativeZoom: 19,
    subdomains: 'abcd'
  }
};

// Custom Map Marker Icons using SVG data URIs
const createBikeUserIcon = (heading = 0) => L.divIcon({
  className: 'custom-bike-user-marker',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(56, 189, 248, 0.3); border: 1.5px solid rgba(56, 189, 248, 0.6); animation: pulse 2s infinite ease-in-out;"></div>
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0284c7, #38bdf8);
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading || 0}deg);
        transition: transform 0.3s ease;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18.5" cy="17.5" r="3.5"/>
          <circle cx="5.5" cy="17.5" r="3.5"/>
          <circle cx="15" cy="5" r="1"/>
          <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

const createStartPinIcon = () => L.divIcon({
  className: 'custom-start-pin-marker',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="
        background: linear-gradient(135deg, #10b981, #059669);
        color: #ffffff;
        padding: 5px 9px;
        border-radius: 18px;
        font-size: 11px;
        font-weight: 800;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6);
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>Start</span>
      </div>
      <div style="width: 2px; height: 6px; background: #10b981;"></div>
    </div>
  `,
  iconSize: [60, 32],
  iconAnchor: [30, 32]
});

const createFinishPinIcon = () => L.divIcon({
  className: 'custom-finish-pin-marker',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #ffffff;
        padding: 5px 9px;
        border-radius: 18px;
        font-size: 11px;
        font-weight: 800;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6);
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>Finish</span>
      </div>
      <div style="width: 2px; height: 6px; background: #ef4444;"></div>
    </div>
  `,
  iconSize: [64, 32],
  iconAnchor: [32, 32]
});

const createBikePlaybackIcon = (heading = 0) => L.divIcon({
  className: 'custom-bike-marker',
  html: `
    <div style="
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #38bdf8, #0284c7);
      border: 2.5px solid #ffffff;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(${heading || 0}deg);
      transition: transform 0.3s ease;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18.5" cy="17.5" r="3.5"/>
        <circle cx="5.5" cy="17.5" r="3.5"/>
        <circle cx="15" cy="5" r="1"/>
        <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const createFuelPumpPoiIcon = () => L.divIcon({
  className: 'custom-poi-fuel-marker',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(245, 158, 11, 0.25); border: 1.5px solid rgba(245, 158, 11, 0.6); animation: pulse 2s infinite ease-in-out;"></div>
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        border: 2px solid #ffffff;
        box-shadow: 0 4px 10px rgba(245, 158, 11, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: bold;
        font-size: 14px;
      ">
        ⛽
      </div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

const createGaragePoiIcon = () => L.divIcon({
  className: 'custom-poi-garage-marker',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(167, 139, 250, 0.25); border: 1.5px solid rgba(167, 139, 250, 0.6); animation: pulse 2s infinite ease-in-out;"></div>
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        border: 2px solid #ffffff;
        box-shadow: 0 4px 10px rgba(139, 92, 246, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: bold;
        font-size: 14px;
      ">
        🔧
      </div>
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

  // ── SAVE TRIP MODAL STATES ──
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingTripData, setPendingTripData] = useState(null);
  const [customTripTitle, setCustomTripTitle] = useState('');
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [saveToastMsg, setSaveToastMsg] = useState('');

  // ── NEARBY PETROL PUMP & GARAGE FINDER STATES ──
  const [poiList, setPoiList] = useState([]);
  const [activePoiType, setActivePoiType] = useState(null); // 'fuel' or 'garage'
  const [isPoiLoading, setIsPoiLoading] = useState(false);
  const poiMarkersRef = useRef([]);

  const clearPoiMarkers = () => {
    if (mapInstanceRef.current && poiMarkersRef.current.length > 0) {
      poiMarkersRef.current.forEach((m) => m.remove());
      poiMarkersRef.current = [];
    }
    setPoiList([]);
    setActivePoiType(null);
  };

  const handleSearchNearbyPoi = async (type) => {
    if (activePoiType === type) {
      clearPoiMarkers();
      return;
    }

    if (!currentPosition) {
      alert(isBn ? '⚠️ আপনার বর্তমান GPS লোকেশন পাওয়া যায়নি।' : '⚠️ Current GPS location not available.');
      return;
    }

    setIsPoiLoading(true);
    setActivePoiType(type);

    try {
      const results = await fetchNearbyPumpsAndGarages(currentPosition[0], currentPosition[1], type, 6000);
      setPoiList(results);

      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        poiMarkersRef.current.forEach((m) => m.remove());
        poiMarkersRef.current = [];

        if (results.length === 0) {
          alert(isBn ? '⚠️ আশপাশের ৬ কিলোমিটারের মধ্যে কোনো তথ্য পাওয়া যায়নি।' : '⚠️ No nearby results found within 6 km.');
        } else {
          const bounds = L.latLngBounds([currentPosition]);

          results.forEach((item) => {
            const icon = type === 'fuel' ? createFuelPumpPoiIcon() : createGaragePoiIcon();
            const marker = L.marker([item.lat, item.lng], { icon }).addTo(map);

            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
            const popupHtml = `
              <div style="font-family: sans-serif; padding: 4px; max-width: 200px;">
                <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
                  ${item.name}
                </div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
                  📍 ${item.distanceKm} km away ${item.brand ? `• ${item.brand}` : ''}
                </div>
                <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="
                  display: inline-block;
                  background: #0284c7;
                  color: #ffffff;
                  padding: 5px 10px;
                  border-radius: 8px;
                  font-size: 11px;
                  font-weight: 700;
                  text-decoration: none;
                  text-align: center;
                ">
                  🗺️ নেভিগেট করুন
                </a>
              </div>
            `;

            marker.bindPopup(popupHtml);
            poiMarkersRef.current.push(marker);
            bounds.extend([item.lat, item.lng]);
          });

          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    } catch (e) {
      console.error('POI search error:', e);
    } finally {
      setIsPoiLoading(false);
    }
  };


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
  const liveStartMarkerRef = useRef(null);
  const liveEndMarkerRef = useRef(null);
  const playbackPolylineRef = useRef(null);
  const playbackBikeMarkerRef = useRef(null);
  const playbackStartMarkerRef = useRef(null);
  const playbackEndMarkerRef = useRef(null);
  const watchIdRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const startTimeEpochRef = useRef(null);
  const playbackIntervalRef = useRef(null);
  const currentHeadingRef = useRef(0);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
  
  // ── 🛡️ BULLETPROOF ACTIVE RIDE PERSISTENCE & AUTO-RECOVERY ──
  // If app is killed, swiped away, or closed, restore active ride on launch until "Finish Ride" is tapped
  useEffect(() => {
    try {
      const activeSessionStr = localStorage.getItem('ridelog_active_session_persistent_v1');
      if (activeSessionStr) {
        const session = JSON.parse(activeSessionStr);
        if (session && session.isRecording && session.startTimeEpoch) {
          console.log('⚡ Resuming persistent active ride session from storage...');
          setIsRecording(true);
          setIsPaused(session.isPaused || false);
          startTimeEpochRef.current = session.startTimeEpoch;
          
          const currentElapsed = Math.max(0, Math.floor((Date.now() - session.startTimeEpoch) / 1000));
          setElapsedSeconds(currentElapsed);
          setTripDistanceKm(session.tripDistanceKm || 0);
          setMaxSpeed(session.maxSpeed || 0);
          setRecordedPoints(session.recordedPoints || []);
          setTripStartTime(session.tripStartTime || new Date(session.startTimeEpoch).toISOString());

          // Re-attach live GPS watcher if not already watching
          if (!watchIdRef.current) {
            startGpsWatcherOnly();
          }
        }
      }
    } catch (e) {
      console.warn('Ride recovery error:', e);
    }
  }, []);


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
      attributionControl: false,
      maxZoom: 22,
      minZoom: 4
    }).setView([defaultLat, defaultLng], 16);

    // Initial Base Tile Layer from saved preference
    const initialConfig = MAP_LAYERS[selectedLayerKey] || MAP_LAYERS.street;
    const initialLayer = L.tileLayer(initialConfig.url, {
      maxZoom: 22,
      maxNativeZoom: initialConfig.maxNativeZoom || 19,
      subdomains: initialConfig.subdomains || 'abc'
    }).addTo(map);

    currentTileLayerRef.current = initialLayer;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    // Get initial user position with browser fallback
    const onInitialPos = (latitude, longitude, accuracy, heading) => {
      const coord = [latitude, longitude];
      setCurrentPosition(coord);
      setGpsAccuracy(Math.round(accuracy || 0));
      if (heading && !isNaN(heading)) {
        currentHeadingRef.current = heading;
      }
      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        map.setView(coord, 17);
        if (!liveMarkerRef.current) {
          liveMarkerRef.current = L.marker(coord, { icon: createBikeUserIcon(currentHeadingRef.current) }).addTo(map);
        } else {
          liveMarkerRef.current.setLatLng(coord);
          liveMarkerRef.current.setIcon(createBikeUserIcon(currentHeadingRef.current));
        }
      }
    };

    if (Capacitor.isNativePlatform()) {
      Geolocation.getCurrentPosition({ enableHighAccuracy: true })
        .then((pos) => {
          onInitialPos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.heading);
        })
        .catch((err) => console.warn('Initial native geolocation warning:', err));
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => onInitialPos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.heading),
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

  // ── PASSIVE GEOLOCATION WATCHER (Always shows bike icon at exact location when location is on) ──
  useEffect(() => {
    let passiveWatchId = null;

    const handlePassiveUpdate = (latitude, longitude, accuracy, heading) => {
      const coord = [latitude, longitude];
      setCurrentPosition(coord);
      setGpsAccuracy(Math.round(accuracy || 0));

      if (heading && !isNaN(heading)) {
        currentHeadingRef.current = heading;
      }

      // Only display live user bike marker on map when mode is 'live'
      if (mapInstanceRef.current && modeRef.current === 'live') {
        const map = mapInstanceRef.current;
        if (!liveMarkerRef.current) {
          liveMarkerRef.current = L.marker(coord, { icon: createBikeUserIcon(currentHeadingRef.current) }).addTo(map);
        } else {
          liveMarkerRef.current.setLatLng(coord);
          liveMarkerRef.current.setIcon(createBikeUserIcon(currentHeadingRef.current));
          if (!map.hasLayer(liveMarkerRef.current)) {
            liveMarkerRef.current.addTo(map);
          }
        }
      }
    };

    const initPassiveWatch = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          passiveWatchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
            (pos, err) => {
              if (err || !pos?.coords) return;
              handlePassiveUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.heading);
            }
          );
        } else if (navigator.geolocation) {
          passiveWatchId = navigator.geolocation.watchPosition(
            (pos) => {
              handlePassiveUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.heading);
            },
            (err) => console.warn('Passive web watch warning:', err),
            { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
          );
        }
      } catch (e) {
        console.warn('Failed to start passive location watcher:', e);
      }
    };

    initPassiveWatch();

    return () => {
      if (passiveWatchId !== null) {
        if (Capacitor.isNativePlatform()) {
          Geolocation.clearWatch({ id: passiveWatchId }).catch(() => {});
        } else if (navigator.geolocation) {
          navigator.geolocation.clearWatch(passiveWatchId);
        }
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
      maxZoom: 22,
      maxNativeZoom: layerConfig.maxNativeZoom || 19,
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
  // ── BACKGROUND APP STATE & REAL-TIME TIMER SYNCHRONIZATION ──
  useEffect(() => {
    if (isRecording && !isPaused) {
      if (!startTimeEpochRef.current) {
        startTimeEpochRef.current = Date.now() - (elapsedSeconds * 1000);
      }

      timerIntervalRef.current = setInterval(() => {
        if (startTimeEpochRef.current) {
          const diffSec = Math.floor((Date.now() - startTimeEpochRef.current) / 1000);
          setElapsedSeconds(Math.max(0, diffSec));
        } else {
          setElapsedSeconds((prev) => prev + 1);
        }
      }, 1000);

      // Request screen WakeLock to prevent GPS sensor sleep
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        navigator.wakeLock.request('screen').then((lock) => {
          wakeLockRef.current = lock;
        }).catch(() => {});
      }
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording, isPaused]);

  // Listen to App background/foreground transitions and Screen Wake/Visibility changes to auto-resync
  useEffect(() => {
    let sub = null;
    if (Capacitor.isNativePlatform()) {
      sub = App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          if (isRecording && !isPaused && startTimeEpochRef.current) {
            const diffSec = Math.floor((Date.now() - startTimeEpochRef.current) / 1000);
            setElapsedSeconds(Math.max(0, diffSec));
          }
          // Immediate GPS fix on resume
          Geolocation.getCurrentPosition({ enableHighAccuracy: true })
            .then((pos) => {
              if (pos?.coords) {
                const { latitude, longitude, speed, accuracy, altitude, heading } = pos.coords;
                setCurrentPosition([latitude, longitude]);
                setGpsAccuracy(Math.round(accuracy || 0));
                if (heading && !isNaN(heading)) currentHeadingRef.current = heading;
              }
            })
            .catch(() => {});
        }
      });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (isRecording && !isPaused) {
          if (startTimeEpochRef.current) {
            const diffSec = Math.floor((Date.now() - startTimeEpochRef.current) / 1000);
            setElapsedSeconds(Math.max(0, diffSec));
          }
          if ('wakeLock' in navigator && !wakeLockRef.current) {
            navigator.wakeLock.request('screen').then((lock) => {
              wakeLockRef.current = lock;
            }).catch(() => {});
          }
        }
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy, heading } = pos.coords;
              setCurrentPosition([latitude, longitude]);
              setGpsAccuracy(Math.round(accuracy || 0));
              if (heading && !isNaN(heading)) currentHeadingRef.current = heading;
            },
            () => {},
            { enableHighAccuracy: true, timeout: 4000 }
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (sub && typeof sub.remove === 'function') sub.remove();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRecording, isPaused]);

  // ── LIVE TRACKING GPS WATCHER ──
  // Dedicated GPS Watcher Re-Attacher for Auto-Recovery
  const startGpsWatcherOnly = async () => {
    try {
      const handleLocationUpdate = (latitude, longitude, speed, accuracy, altitude, heading) => {
        const newCoord = [latitude, longitude];
        const speedKmH = speed ? Math.max(0, Math.round(speed * 3.6)) : 0;

        setCurrentPosition(newCoord);
        setCurrentSpeed(speedKmH);
        setGpsAccuracy(Math.round(accuracy || 0));
        setMaxSpeed((prev) => Math.max(prev, speedKmH));

        if (heading && !isNaN(heading)) {
          currentHeadingRef.current = heading;
        }

        const pointObj = {
          lat: latitude,
          lng: longitude,
          speed: speedKmH,
          accuracy: Math.round(accuracy || 0),
          altitude: altitude || 0,
          timestamp: Date.now()
        };

        setRecordedPoints((prev) => {
          // 🛡️ JITTER & STATIONARY FILTER
          const filterRes = filterGpsJitter(prev, pointObj);
          let updated = prev;

          if (filterRes.accept) {
            let newDist = tripDistanceKm;
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const distInc = calculateDistanceKm(last.lat, last.lng, latitude, longitude);
              if (distInc > 0.003) {
                newDist = +(tripDistanceKm + distInc).toFixed(2);
                setTripDistanceKm(newDist);
              }
              if (!heading) {
                const bearing = calculateBearing(last.lat, last.lng, latitude, longitude);
                if (bearing) currentHeadingRef.current = bearing;
              }
            }
            updated = [...prev, pointObj];

            // 💾 CONTINUOUSLY PERSIST TO STORAGE ON VALID MOVEMENT
            try {
              localStorage.setItem('ridelog_active_session_persistent_v1', JSON.stringify({
                isRecording: true,
                isPaused: false,
                startTimeEpoch: startTimeEpochRef.current || Date.now(),
                tripStartTime: tripStartTime || new Date().toISOString(),
                tripDistanceKm: newDist,
                maxSpeed: Math.max(maxSpeed, speedKmH),
                recordedPoints: updated
              }));
            } catch (e) {}
          }

          // Update Map Marker & Polyline
          if (mapInstanceRef.current) {
            const map = mapInstanceRef.current;
            if (!liveMarkerRef.current) {
              liveMarkerRef.current = L.marker(newCoord, { icon: createBikeUserIcon(currentHeadingRef.current) }).addTo(map);
            } else {
              liveMarkerRef.current.setLatLng(newCoord);
              liveMarkerRef.current.setIcon(createBikeUserIcon(currentHeadingRef.current));
            }

            if (filterRes.accept && updated.length > 1) {
              const latLngs = updated.map((p) => [p.lat, p.lng]);
              if (!livePolylineRef.current) {
                livePolylineRef.current = L.polyline(latLngs, {
                  color: '#0284c7',
                  weight: 6,
                  opacity: 0.9,
                  smoothFactor: 2.0,
                  lineCap: 'round',
                  lineJoin: 'round'
                }).addTo(map);
              } else {
                livePolylineRef.current.setLatLngs(latLngs);
              }
            }

            map.panTo(newCoord, { animate: true, duration: 0.5 });
          }

          return updated;
        });
      };

      if (Capacitor.isNativePlatform()) {
        watchIdRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
          (position, err) => {
            if (err || !position) return;
            const { latitude, longitude, speed, accuracy, altitude } = position.coords;
            handleLocationUpdate(latitude, longitude, speed, accuracy, altitude);
          }
        );
      } else if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, speed, accuracy, altitude } = position.coords;
            handleLocationUpdate(latitude, longitude, speed, accuracy, altitude);
          },
          (err) => console.warn('Web geolocation watch warning:', err),
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        );
      }
    } catch (e) {
      console.warn('Watcher attach error:', e);
    }
  };

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
      startTimeEpochRef.current = Date.now();
      try {
        localStorage.setItem('ridelog_active_ride', JSON.stringify({ isRecording: true, startTime: Date.now() }));
      } catch (e) {}
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

      // Reset live polyline and end pin
      if (livePolylineRef.current) {
        livePolylineRef.current.remove();
        livePolylineRef.current = null;
      }
      if (liveEndMarkerRef.current) {
        liveEndMarkerRef.current.remove();
        liveEndMarkerRef.current = null;
      }

      // Place Green Start Pin Marker at starting position
      if (currentPosition && mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        if (liveStartMarkerRef.current) liveStartMarkerRef.current.remove();
        liveStartMarkerRef.current = L.marker(currentPosition, { icon: createStartPinIcon() }).addTo(map);
      }

      const handleLocationUpdate = (latitude, longitude, speed, accuracy, altitude, heading) => {
        const newCoord = [latitude, longitude];
        const speedKmH = speed ? Math.max(0, Math.round(speed * 3.6)) : 0;

        setCurrentPosition(newCoord);
        setCurrentSpeed(speedKmH);
        setGpsAccuracy(Math.round(accuracy || 0));
        setMaxSpeed((prev) => Math.max(prev, speedKmH));

        if (heading && !isNaN(heading)) {
          currentHeadingRef.current = heading;
        }

        const pointObj = {
          lat: latitude,
          lng: longitude,
          speed: speedKmH,
          accuracy: Math.round(accuracy || 0),
          altitude: altitude || 0,
          timestamp: Date.now()
        };

        setRecordedPoints((prev) => {
          // 🛡️ JITTER & STATIONARY FILTER
          const filterRes = filterGpsJitter(prev, pointObj);
          let updated = prev;

          if (filterRes.accept) {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const distInc = calculateDistanceKm(last.lat, last.lng, latitude, longitude);
              if (distInc > 0.003) {
                setTripDistanceKm((curr) => +(curr + distInc).toFixed(2));
              }
              if (!heading) {
                const bearing = calculateBearing(last.lat, last.lng, latitude, longitude);
                if (bearing) currentHeadingRef.current = bearing;
              }
            }
            updated = [...prev, pointObj];
          }

          // Update Map Marker & Polyline
          if (mapInstanceRef.current) {
            const map = mapInstanceRef.current;

            if (!liveMarkerRef.current) {
              liveMarkerRef.current = L.marker(newCoord, { icon: createBikeUserIcon(currentHeadingRef.current) }).addTo(map);
            } else {
              liveMarkerRef.current.setLatLng(newCoord);
              liveMarkerRef.current.setIcon(createBikeUserIcon(currentHeadingRef.current));
            }

            if (filterRes.accept && updated.length > 1) {
              const latLngs = updated.map((p) => [p.lat, p.lng]);
              if (!livePolylineRef.current) {
                livePolylineRef.current = L.polyline(latLngs, {
                  color: '#0284c7',
                  weight: 6,
                  opacity: 0.9,
                  smoothFactor: 2.0,
                  lineCap: 'round',
                  lineJoin: 'round'
                }).addTo(map);
              } else {
                livePolylineRef.current.setLatLngs(latLngs);
              }
            }

            map.panTo(newCoord, { animate: true, duration: 0.5 });
          }

          return updated;
        });
      };

      if (Capacitor.isNativePlatform()) {
        watchIdRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
          (position, err) => {
            if (err || !position?.coords) return;
            const { latitude, longitude, speed, accuracy, altitude, heading } = position.coords;
            handleLocationUpdate(latitude, longitude, speed, accuracy, altitude, heading);
          }
        );
      } else if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, speed, accuracy, altitude, heading } = position.coords;
            handleLocationUpdate(latitude, longitude, speed, accuracy, altitude, heading);
          },
          (err) => console.warn('Web geolocation watch warning:', err),
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
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
    startTimeEpochRef.current = null;
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    try {
      localStorage.removeItem('ridelog_active_ride');
      localStorage.removeItem('ridelog_active_session_persistent_v1');
    } catch (e) {}

    // Ensure road snapping / smoothing on final route points before saving
    let rawPoints = [...recordedPoints];
    let finalPoints = rawPoints;

    if (rawPoints.length >= 2) {
      try {
        finalPoints = await snapToRoadsOSRM(rawPoints);
      } catch (e) {
        finalPoints = smoothPathMovingAverage(rawPoints);
      }
    } else if (rawPoints.length === 0 && currentPosition) {
      finalPoints = [
        { lat: currentPosition[0], lng: currentPosition[1], speed: 0, accuracy: 10, altitude: 0, timestamp: Date.now() - 5000 },
        { lat: currentPosition[0] + 0.0001, lng: currentPosition[1] + 0.0001, speed: 0, accuracy: 10, altitude: 0, timestamp: Date.now() }
      ];
    } else if (rawPoints.length === 1) {
      finalPoints.push({
        lat: rawPoints[0].lat + 0.0001,
        lng: rawPoints[0].lng + 0.0001,
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

    // Place Red Finish Pin Marker at end position
    if (finalPoints.length > 0 && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const lastPt = finalPoints[finalPoints.length - 1];
      if (liveEndMarkerRef.current) liveEndMarkerRef.current.remove();
      liveEndMarkerRef.current = L.marker([lastPt.lat, lastPt.lng], { icon: createFinishPinIcon() }).addTo(map);
    }

    const defaultTitle = isBn
      ? `রাইড - ${new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}`
      : `Ride - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const avgSpeed = elapsedSeconds > 0 ? +((tripDistanceKm / (elapsedSeconds / 3600))).toFixed(1) : 0;

    // Open Custom Save Trip Modal
    setPendingTripData({
      userId,
      bikeId: activeBike?.id || 'bike_1',
      bikeName: activeBike?.name || 'My Bike',
      startTime: tripStartTime || new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: Math.max(1, elapsedSeconds),
      distanceKm: tripDistanceKm,
      maxSpeedKmH: maxSpeed,
      avgSpeedKmH: isNaN(avgSpeed) ? 0 : avgSpeed,
      points: finalPoints,
      defaultTitle
    });
    setCustomTripTitle(defaultTitle);
    setIsSaveModalOpen(true);
  };

  const handleConfirmSaveTrip = async () => {
    if (!pendingTripData || isSavingTrip) return;
    setIsSavingTrip(true);

    try {
      const newTrip = {
        id: `trip_${Date.now()}`,
        userId: pendingTripData.userId,
        bikeId: pendingTripData.bikeId,
        bikeName: pendingTripData.bikeName,
        title: customTripTitle.trim() || pendingTripData.defaultTitle,
        startTime: pendingTripData.startTime,
        endTime: pendingTripData.endTime,
        durationSeconds: pendingTripData.durationSeconds,
        distanceKm: pendingTripData.distanceKm,
        maxSpeedKmH: pendingTripData.maxSpeedKmH,
        avgSpeedKmH: pendingTripData.avgSpeedKmH,
        points: pendingTripData.points
      };

      await saveTrip(newTrip);
      setIsSaveModalOpen(false);
      setPendingTripData(null);
      setSaveToastMsg(isBn ? '✅ রাইড সফলভাবে সংরক্ষিত হয়েছে!' : '✅ Trip saved successfully!');
      setTimeout(() => setSaveToastMsg(''), 4000);

      await loadRecentTrips();
      setSelectedTrip(newTrip);
      setMode('playback');
    } catch (e) {
      console.error('Failed to save trip:', e);
    } finally {
      setIsSavingTrip(false);
    }
  };

  const handleDeleteCurrentTrip = async (tripId) => {
    if (!tripId) return;
    const confirmed = window.confirm(isBn ? 'আপনি কি নিশ্চিতভাবে এই রাইডটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this trip?');
    if (!confirmed) return;

    await deleteTrip(tripId, userId);
    const updatedList = tripsList.filter((t) => t.id !== tripId);
    setTripsList(updatedList);
    setSelectedTrip(updatedList[0] || null);
  };

  const handleDiscardTrip = () => {
    setIsSaveModalOpen(false);
    setPendingTripData(null);
    setCustomTripTitle('');
  };

  // ── 3-DAY PLAYBACK CONTROLS ──
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (mode === 'playback') {
      // 🙈 Hide Live Ride Markers when in Playback mode so only 1 bike marker exists!
      if (liveMarkerRef.current) liveMarkerRef.current.remove();
      if (liveStartMarkerRef.current) liveStartMarkerRef.current.remove();
      if (liveEndMarkerRef.current) liveEndMarkerRef.current.remove();

      if (!selectedTrip) return;
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

      // Start Pin & Finish Pin markers
      playbackStartMarkerRef.current = L.marker(latLngs[0], { icon: createStartPinIcon() }).addTo(map);
      playbackEndMarkerRef.current = L.marker(latLngs[latLngs.length - 1], { icon: createFinishPinIcon() }).addTo(map);

      // Moving Bike Marker
      const initialBearing = points.length > 1 ? calculateBearing(points[0].lat, points[0].lng, points[1].lat, points[1].lng) : 0;
      playbackBikeMarkerRef.current = L.marker(latLngs[0], { icon: createBikePlaybackIcon(initialBearing) }).addTo(map);

      // Fit map bounds to show full route
      map.fitBounds(playbackPolylineRef.current.getBounds(), { padding: [40, 40] });

      setPlaybackIndex(0);
      setIsPlaying(false);
    } else {
      // 🟢 Restoring Live Mode
      // Clear playback markers
      if (playbackPolylineRef.current) playbackPolylineRef.current.remove();
      if (playbackBikeMarkerRef.current) playbackBikeMarkerRef.current.remove();
      if (playbackStartMarkerRef.current) playbackStartMarkerRef.current.remove();
      if (playbackEndMarkerRef.current) playbackEndMarkerRef.current.remove();

      // Re-add live bike marker to map
      if (currentPosition) {
        if (!liveMarkerRef.current) {
          liveMarkerRef.current = L.marker(currentPosition, { icon: createBikeUserIcon(currentHeadingRef.current) }).addTo(map);
        } else {
          liveMarkerRef.current.addTo(map);
          liveMarkerRef.current.setLatLng(currentPosition);
          liveMarkerRef.current.setIcon(createBikeUserIcon(currentHeadingRef.current));
        }
      }
    }
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
          const prevPoint = selectedTrip.points[prevIndex];
          const newPos = [currentPoint.lat, currentPoint.lng];

          let pHeading = 0;
          if (prevPoint) {
            pHeading = calculateBearing(prevPoint.lat, prevPoint.lng, currentPoint.lat, currentPoint.lng);
          }

          if (playbackBikeMarkerRef.current) {
            playbackBikeMarkerRef.current.setLatLng(newPos);
            playbackBikeMarkerRef.current.setIcon(createBikePlaybackIcon(pHeading));
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
              top: '56px',
              right: '12px',
              zIndex: 1001,
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98))',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '14px',
              padding: '10px',
              width: '230px',
              maxHeight: 'calc(100% - 68px)',
              overflowY: 'auto',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(56, 189, 248, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              backdropFilter: 'blur(12px)',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: '2px 4px'
                }}
              >
                ✕
              </button>
            </div>

            {Object.values(MAP_LAYERS).map((layer) => {
              const isSelected = selectedLayerKey === layer.id;
              const IconComp = layer.iconComponent;
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
                    padding: '6px 8px',
                    borderRadius: '8px',
                    border: isSelected ? `1px solid ${layer.color}` : '1px solid transparent',
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: layer.color,
                      flexShrink: 0
                    }}>
                      <IconComp size={15} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? '#ffffff' : '#f1f5f9' }}>
                        {isBn ? layer.nameBn : layer.nameEn}
                      </span>
                      <span style={{ fontSize: '0.64rem', color: '#94a3b8', lineHeight: 1.2 }}>
                        {isBn ? layer.descBn : layer.descEn}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} color={layer.color} />}
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

        {/* Floating Nearby POI Finder Buttons (Bottom Left of Map) */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 1000,
          display: 'flex',
          gap: '6px'
        }}>
          <button
            type="button"
            onClick={() => handleSearchNearbyPoi('fuel')}
            disabled={isPoiLoading}
            title={isBn ? 'আশপাশের পেট্রোল পাম্প খুঁজুন' : 'Search nearby fuel pumps'}
            style={{
              padding: '7px 12px',
              borderRadius: '20px',
              background: activePoiType === 'fuel' ? '#f59e0b' : 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              color: activePoiType === 'fuel' ? '#ffffff' : '#f59e0b',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease'
            }}
          >
            <Fuel size={14} />
            <span>{isPoiLoading && activePoiType === 'fuel' ? (isBn ? 'খোঁজা হচ্ছে...' : 'Searching...') : (isBn ? '⛽ পাম্প' : '⛽ Pumps')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSearchNearbyPoi('garage')}
            disabled={isPoiLoading}
            title={isBn ? 'আশপাশের বাইক গ্যারেজ খুঁজুন' : 'Search nearby bike garages'}
            style={{
              padding: '7px 12px',
              borderRadius: '20px',
              background: activePoiType === 'garage' ? '#8b5cf6' : 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              color: activePoiType === 'garage' ? '#ffffff' : '#c084fc',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease'
            }}
          >
            <Wrench size={14} />
            <span>{isPoiLoading && activePoiType === 'garage' ? (isBn ? 'খোঁজা হচ্ছে...' : 'Searching...') : (isBn ? '🔧 গ্যারেজ' : '🔧 Garages')}</span>
          </button>

          {activePoiType && (
            <button
              type="button"
              onClick={clearPoiMarkers}
              style={{
                padding: '7px 10px',
                borderRadius: '20px',
                background: 'rgba(239, 68, 68, 0.88)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── NEARBY POI RESULTS TRAY ── */}
      {poiList.length > 0 && (
        <div style={{
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
          border: `1px solid ${activePoiType === 'fuel' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`,
          borderRadius: '18px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {activePoiType === 'fuel' ? <Fuel size={16} color="#f59e0b" /> : <Wrench size={16} color="#c084fc" />}
              <span>
                {isBn
                  ? `আশপাশের ${activePoiType === 'fuel' ? 'পেট্রোল পাম্পসমূহ' : 'গ্যারেজ & সার্ভিস সেন্টার'}`
                  : `Nearby ${activePoiType === 'fuel' ? 'Fuel Stations' : 'Garages & Repair Shops'}`}
              </span>
            </span>
            <button
              type="button"
              onClick={clearPoiMarkers}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕ {isBn ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {poiList.map((poi) => {
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`;
              return (
                <div
                  key={poi.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', paddingRight: '8px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {poi.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      📍 {poi.distanceKm} {isBn ? 'কিমি দূরে' : 'km away'} {poi.brand ? `• ${poi.brand}` : ''}
                    </span>
                  </div>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      textDecoration: 'none',
                      flexShrink: 0,
                      boxShadow: '0 3px 10px rgba(2, 132, 199, 0.3)'
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>{isBn ? 'নেভিগেট' : 'Directions'}</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
                    <MapPin size={13} color="#10b981" />
                    <span>{isBn ? 'শুরু' : 'Start'}</span>
                  </span>
                  <span style={{ color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {currentPlaybackPoint && (
                      <>
                        <Zap size={13} color="#38bdf8" />
                        <span>{currentPlaybackPoint.speed} km/h</span>
                      </>
                    )}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 600 }}>
                    <Flag size={13} color="#ef4444" />
                    <span>{isBn ? 'গন্তব্য' : 'Finish'}</span>
                  </span>
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

      {/* ── SAVE TRIP CUSTOM MODAL (NO BROWSER ALERT / PROMPT) ── */}
      {isSaveModalOpen && pendingTripData && (
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={handleDiscardTrip}>
          <div className="modal-content" style={{ maxWidth: '460px', padding: '24px', borderRadius: '20px', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(2, 132, 199, 0.3))', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Flag size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    {isBn ? 'রাইড সংরক্ষণ করুন' : 'Save Trip Summary'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {isBn ? 'আপনার রাইডের নাম দিন এবং পরিসংখ্যান দেখুন' : 'Name your trip and review performance'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-icon"
                onClick={handleDiscardTrip}
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Ride Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Navigation size={12} color="#38bdf8" /> {isBn ? 'দূরত্ব' : 'Distance'}
                </span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                  {pendingTripData.distanceKm.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{isBn ? 'কিমি' : 'km'}</span>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} color="#10b981" /> {isBn ? 'সময়' : 'Duration'}
                </span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                  {Math.floor(pendingTripData.durationSeconds / 60)}m {pendingTripData.durationSeconds % 60}s
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={12} color="#f59e0b" /> {isBn ? 'সর্বোচ্চ গতি' : 'Max Speed'}
                </span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                  {Math.round(pendingTripData.maxSpeedKmH)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>km/h</span>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Gauge size={12} color="#a78bfa" /> {isBn ? 'গড় গতি' : 'Avg Speed'}
                </span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#a78bfa', marginTop: '2px' }}>
                  {pendingTripData.avgSpeedKmH} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>km/h</span>
                </div>
              </div>
            </div>

            {/* Trip Title Input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                {isBn ? 'রাইডের নাম / শিরোনাম:' : 'Trip Title / Destination:'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  value={customTripTitle}
                  onChange={(e) => setCustomTripTitle(e.target.value)}
                  placeholder={isBn ? 'যেমন: বাসা থেকে অফিস / ধানমন্ডি থেকে উত্তরা' : 'e.g. Home to Office / Highway Ride'}
                  style={{ width: '100%', height: '42px', paddingLeft: '12px', paddingRight: '36px', fontSize: '0.88rem', borderRadius: '12px' }}
                  autoFocus
                />
                {customTripTitle && (
                  <button
                    type="button"
                    onClick={() => setCustomTripTitle('')}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Suggestion Pills */}
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                {isBn ? 'দ্রুত পরামর্শ (Quick Presets):' : 'Quick Presets:'}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { bn: '🏠 ➔ 🏢 বাসা থেকে অফিস', en: '🏠 ➔ 🏢 Home to Office' },
                  { bn: '🏢 ➔ 🏠 অফিস থেকে বাসা', en: '🏢 ➔ 🏠 Office to Home' },
                  { bn: '🛣️ হাইওয়ে রাইড', en: '🛣️ Highway Tour' },
                  { bn: '🌆 সিটি রাইড', en: '🌆 City Ride' },
                  { bn: '☕ ইভনিং হাওয়া', en: '☕ Evening Hangout' }
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCustomTripTitle(isBn ? preset.bn : preset.en)}
                    style={{
                      fontSize: '0.74rem',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isBn ? preset.bn : preset.en}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDiscardTrip}
                disabled={isSavingTrip}
                style={{ flex: 1, height: '42px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmSaveTrip}
                disabled={isSavingTrip}
                style={{
                  flex: 2,
                  height: '42px',
                  borderRadius: '12px',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                  cursor: isSavingTrip ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Save size={16} />
                <span>{isSavingTrip ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'রাইড সংরক্ষণ করুন' : 'Save Trip')}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Success Toast */}
      {saveToastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '30px',
          fontSize: '0.88rem',
          fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.3s ease'
        }}>
          <CheckCircle2 size={18} />
          <span>{saveToastMsg}</span>
        </div>
      )}
    </div>
  );
}
