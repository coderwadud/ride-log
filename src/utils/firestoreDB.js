import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DEFAULT_BIKE = {
  id: 'bike_1',
  name: 'My Bike',
  regNumber: '',
  initialOdometer: 0,
  currentOdometer: 0,
  targetOilKm: 1000
};

const DEFAULT_DATA = {
  settings: { lang: 'bn', theme: 'dark' },
  activeBikeId: 'bike_1',
  bikes: [DEFAULT_BIKE],
  fuelLogs: [],
  serviceLogs: []
};

/**
 * Load user data from Firestore document `users/{uid}`
 */
export async function loadUserData(uid) {
  if (!uid) return DEFAULT_DATA;
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
    } else {
      // New user - return default fresh data
      return { ...DEFAULT_DATA };
    }
  } catch (err) {
    console.error('Error loading Firestore data for user:', uid, err);
    return { ...DEFAULT_DATA };
  }
}

/**
 * Save user data to Firestore document `users/{uid}`
 */
export async function saveUserData(uid, data) {
  if (!uid) return;
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
    console.error('Error saving Firestore data for user:', uid, err);
  }
}

/**
 * Clear user data in Firestore for the current user (Reset user data only)
 */
export async function resetUserDataInFirestore(uid) {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, {
      settings: { lang: 'bn', theme: 'dark' },
      activeBikeId: 'bike_1',
      bikes: [DEFAULT_BIKE],
      fuelLogs: [],
      serviceLogs: [],
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error resetting user data in Firestore:', uid, err);
  }
}
