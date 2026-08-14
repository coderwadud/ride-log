import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

const DEFAULT_BIKE = {
  id: 'bike_1',
  name: 'My Bike',
  regNumber: '',
  initialOdometer: 0,
  currentOdometer: 0,
  targetOilKm: 1000
};

const DEFAULT_DATA = {
  settings: { lang: 'en', theme: 'dark' },
  activeBikeId: 'bike_1',
  bikes: [DEFAULT_BIKE],
  fuelLogs: [],
  serviceLogs: []
};

/** Get local user cache from localStorage for offline-first resilience (Native Mobile APK only) */
export function getLocalUserDataCache(uid) {
  if (!uid || !isNative) return null;
  try {
    const raw = localStorage.getItem(`ridelog_user_cache_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read local user cache:', e);
  }
  return null;
}

/** Save local user cache to localStorage (Native Mobile APK only) */
export function saveLocalUserDataCache(uid, data) {
  if (!uid || !data || !isNative) return;
  try {
    localStorage.setItem(`ridelog_user_cache_${uid}`, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to write local user cache:', e);
  }
}

/**
 * Perform 2-Way Merge between local data (including offline entries) and cloud data
 */
export function mergeDataSets(localData, cloudData) {
  if (!localData && !cloudData) return DEFAULT_DATA;
  if (!localData) return {
    settings: cloudData.settings || DEFAULT_DATA.settings,
    activeBikeId: cloudData.activeBikeId || DEFAULT_DATA.activeBikeId,
    bikes: (cloudData.bikes && cloudData.bikes.length > 0) ? cloudData.bikes : DEFAULT_DATA.bikes,
    fuelLogs: cloudData.fuelLogs || [],
    serviceLogs: cloudData.serviceLogs || []
  };
  if (!cloudData) return localData;

  // 1. Merge Bikes List (Update existing bike profiles + add new bikes)
  const bikeMap = new Map();
  const cloudBikes = Array.isArray(cloudData.bikes) ? cloudData.bikes : [];
  const localBikes = Array.isArray(localData.bikes) ? localData.bikes : [];

  cloudBikes.forEach(b => {
    if (b && b.id) bikeMap.set(b.id, { ...b });
  });

  localBikes.forEach(b => {
    if (b && b.id) {
      const existing = bikeMap.get(b.id);
      if (existing) {
        bikeMap.set(b.id, {
          ...existing,
          ...b,
          currentOdometer: Math.max(existing.currentOdometer || 0, b.currentOdometer || 0)
        });
      } else {
        bikeMap.set(b.id, { ...b });
      }
    }
  });

  const mergedBikes = Array.from(bikeMap.values());
  const finalBikes = mergedBikes.length > 0 ? mergedBikes : [DEFAULT_BIKE];

  // 2. Active Bike ID
  const activeBikeId = localData.activeBikeId || cloudData.activeBikeId || finalBikes[0]?.id || 'bike_1';

  // 3. Merge Fuel Logs by unique ID
  const fuelMap = new Map();
  const cloudFuel = Array.isArray(cloudData.fuelLogs) ? cloudData.fuelLogs : [];
  const localFuel = Array.isArray(localData.fuelLogs) ? localData.fuelLogs : [];

  cloudFuel.forEach(f => {
    if (f && f.id) fuelMap.set(f.id, { ...f, bikeId: f.bikeId || 'bike_1' });
  });

  localFuel.forEach(f => {
    if (f && f.id) fuelMap.set(f.id, { ...f, bikeId: f.bikeId || 'bike_1' });
  });

  const mergedFuelLogs = Array.from(fuelMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

  // 4. Merge Service Logs by unique ID
  const serviceMap = new Map();
  const cloudService = Array.isArray(cloudData.serviceLogs) ? cloudData.serviceLogs : [];
  const localService = Array.isArray(localData.serviceLogs) ? localData.serviceLogs : [];

  cloudService.forEach(s => {
    if (s && s.id) serviceMap.set(s.id, { ...s, bikeId: s.bikeId || 'bike_1' });
  });

  localService.forEach(s => {
    if (s && s.id) serviceMap.set(s.id, { ...s, bikeId: s.bikeId || 'bike_1' });
  });

  const mergedServiceLogs = Array.from(serviceMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

  // 5. Merge Settings
  const settings = {
    lang: localData.settings?.lang || cloudData.settings?.lang || 'en',
    theme: localData.settings?.theme || cloudData.settings?.theme || 'dark'
  };

  return {
    settings,
    activeBikeId,
    bikes: finalBikes,
    fuelLogs: mergedFuelLogs,
    serviceLogs: mergedServiceLogs
  };
}

/**
 * Load user data with platform distinction:
 * - On Web Browser: ALWAYS fetch live fresh data directly from Firestore Database (No Stale Local Cache)
 * - On Native Android App (APK): Use Offline-First Local Cache + 2-Way Cloud Merge
 */
export async function loadUserData(uid) {
  if (!uid) return DEFAULT_DATA;

  // ── 1. WEB BROWSER MODE: Direct Live Database Fetch ──
  if (!isNative) {
    try {
      const docRef = doc(db, 'users', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          settings: data.settings || DEFAULT_DATA.settings,
          activeBikeId: data.activeBikeId || DEFAULT_DATA.activeBikeId,
          bikes: (data.bikes && data.bikes.length > 0) ? data.bikes : DEFAULT_DATA.bikes,
          fuelLogs: data.fuelLogs || [],
          serviceLogs: data.serviceLogs || []
        };
      }
      return { ...DEFAULT_DATA };
    } catch (err) {
      console.error('Web Firestore live fetch error:', err);
      return { ...DEFAULT_DATA };
    }
  }

  // ── 2. NATIVE ANDROID APP (APK) MODE: Offline-First Cache & 2-Way Merge ──
  const localCache = getLocalUserDataCache(uid);

  try {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const cloudData = snap.data();
      const merged = mergeDataSets(localCache, cloudData);

      saveLocalUserDataCache(uid, merged);
      saveUserData(uid, merged).catch(e => console.warn('Cloud sync update failed:', e));

      return merged;
    } else {
      const initialData = localCache || DEFAULT_DATA;
      saveLocalUserDataCache(uid, initialData);
      saveUserData(uid, initialData).catch(e => console.warn('New user cloud init failed:', e));
      return initialData;
    }
  } catch (err) {
    console.warn('Native Android App offline mode. Using local cache:', err);
    if (localCache) return localCache;
    return DEFAULT_DATA;
  }
}

/**
 * Save user data to local cache AND Firestore document `users/{uid}`
 */
export async function saveUserData(uid, data) {
  if (!uid || !data) return;

  // Always update local cache first (Offline-First)
  saveLocalUserDataCache(uid, data);

  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, {
      settings: data.settings || DEFAULT_DATA.settings,
      activeBikeId: data.activeBikeId || 'bike_1',
      bikes: data.bikes || [DEFAULT_BIKE],
      fuelLogs: data.fuelLogs || [],
      serviceLogs: data.serviceLogs || [],
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving Firestore data (will retry when online):', err);
  }
}

/**
 * Clear user data in Firestore and local cache for the current user
 */
export async function resetUserDataInFirestore(uid) {
  if (!uid) return;
  const resetData = {
    settings: { lang: 'en', theme: 'dark' },
    activeBikeId: 'bike_1',
    bikes: [DEFAULT_BIKE],
    fuelLogs: [],
    serviceLogs: [],
    updatedAt: new Date().toISOString()
  };

  saveLocalUserDataCache(uid, resetData);

  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, resetData);
  } catch (err) {
    console.error('Error resetting user data in Firestore:', uid, err);
  }
}
