/**
 * Trip & GPS Storage using IndexedDB (100% Free & Local)
 * Stores full GPS coordinates, speeds, distances, and timestamps for route playback.
 */

const DB_NAME = 'RideLogTripsDB';
const DB_VERSION = 1;
const STORE_NAME = 'trips';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('startTime', 'startTime', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Calculate distance between two lat/lng coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Save a completed trip to IndexedDB
 */
export async function saveTrip(trip) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(trip);
      request.onsuccess = () => resolve(trip);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Error saving trip to IndexedDB:', err);
    // Fallback to localStorage
    saveTripToLocalStorage(trip);
    return trip;
  }
}

/**
 * Get all recorded trips for user
 */
export async function getTrips(userId = 'guest') {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result || [];
        const userTrips = all.filter((t) => (t.userId || 'guest') === userId);
        userTrips.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
        resolve(userTrips);
      };
      request.onerror = () => resolve(getTripsFromLocalStorage(userId));
    });
  } catch (err) {
    return getTripsFromLocalStorage(userId);
  }
}

/**
 * Get trips from the last 3 days
 */
export async function getTripsLast3Days(userId = 'guest') {
  const allTrips = await getTrips(userId);
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return allTrips.filter((t) => new Date(t.startTime).getTime() >= threeDaysAgo);
}

/**
 * Delete a trip
 */
export async function deleteTrip(tripId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(tripId);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    deleteTripFromLocalStorage(tripId);
    return true;
  }
}

// ── LOCAL STORAGE FALLBACK ──
const LS_TRIPS_KEY = 'ridelog_gps_trips';

function getTripsFromLocalStorage(userId) {
  try {
    const raw = localStorage.getItem(`${LS_TRIPS_KEY}_${userId}`);
    const trips = raw ? JSON.parse(raw) : [];
    trips.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
    return trips;
  } catch (e) {
    return [];
  }
}

function saveTripToLocalStorage(trip) {
  try {
    const userId = trip.userId || 'guest';
    const existing = getTripsFromLocalStorage(userId);
    const updated = [trip, ...existing.filter((t) => t.id !== trip.id)];
    localStorage.setItem(`${LS_TRIPS_KEY}_${userId}`, JSON.stringify(updated));
  } catch (e) {
    console.error('LocalStorage trip save error:', e);
  }
}

function deleteTripFromLocalStorage(tripId) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LS_TRIPS_KEY)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          const filtered = list.filter((t) => t.id !== tripId);
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
  } catch (e) {}
}
