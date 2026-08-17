import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where } from 'firebase/firestore';

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

/**
 * Permanently delete the user's Firestore document `users/{uid}`
 * Called before deleting Firebase Auth account.
 */
export async function deleteUserAllData(uid) {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting user Firestore data:', uid, err);
  }
}

/**
 * Save or update user FCM Token in Firestore for targeted push notifications
 */
export async function saveUserFCMToken(uid, token) {
  if (!uid || !token) return;
  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, {
      fcmToken: token,
      lastTokenAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.debug('Failed to save FCM token to Firestore:', err);
  }
}

/**
 * Submit user feedback or issue report directly to Firestore 'feedbacks' collection
 */
/**
 * Submit user feedback or issue report directly to Firestore 'feedbacks' collection
 * with automatic fallback inside users/{uid} document if root permissions are restricted.
 */
export async function submitUserFeedback({ uid, email, name, type = 'feedback', message, appVersion = '1.1' }) {
  if (!message || !message.trim()) throw new Error('Message is required');
  
  const ticketShortId = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
  const feedbackId = `fb_${Date.now()}_${ticketShortId.toLowerCase()}`;

  const feedbackData = {
    id: feedbackId,
    ticketId: ticketShortId,
    uid: uid || 'anonymous',
    email: email || 'not_provided',
    name: name || 'User',
    type, // 'bug', 'feedback', 'feature_request'
    message: message.trim(),
    appVersion,
    createdAt: new Date().toISOString(),
    status: 'pending', // 'pending', 'in_progress', 'resolved', 'rejected'
    adminReply: ''
  };

  try {
    // Primary: Root 'feedbacks' collection
    const feedbackDocRef = doc(db, 'feedbacks', feedbackId);
    await setDoc(feedbackDocRef, feedbackData);

    // Also update inside user document for fast offline/local sync
    if (uid && uid !== 'guest' && uid !== 'anonymous') {
      try {
        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);
        const existingFeedbacks = userSnap.exists() ? (userSnap.data().feedbacks || []) : [];
        await setDoc(userDocRef, {
          feedbacks: [feedbackData, ...existingFeedbacks.filter(f => f.id !== feedbackId)]
        }, { merge: true });
      } catch (e) {}
    }

    return { success: true, ticketId: ticketShortId, feedbackData };
  } catch (err) {
    console.warn('Root feedbacks write permission notice, trying user document fallback:', err);
    
    // Fallback: Save inside user's own document
    if (uid && uid !== 'guest' && uid !== 'anonymous') {
      try {
        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);
        const existingFeedbacks = userSnap.exists() ? (userSnap.data().feedbacks || []) : [];
        await setDoc(userDocRef, {
          feedbacks: [feedbackData, ...existingFeedbacks.filter(f => f.id !== feedbackId)]
        }, { merge: true });
        return { success: true, ticketId: ticketShortId, feedbackData };
      } catch (fallbackErr) {
        console.error('User doc fallback failed:', fallbackErr);
      }
    }

    // Secondary fallback: Save in LocalStorage so feedback is preserved
    try {
      const lsKey = 'ridelog_offline_feedbacks';
      const stored = JSON.parse(localStorage.getItem(lsKey) || '[]');
      stored.unshift(feedbackData);
      localStorage.setItem(lsKey, JSON.stringify(stored));
      return { success: true, ticketId: ticketShortId, feedbackData };
    } catch (e) {
      throw err;
    }
  }
}

/**
 * Real-time listener for user support tickets & status
 */
export function listenToUserTickets(uid, callback) {
  if (!uid || uid === 'guest' || uid === 'anonymous') {
    // Read from local storage fallback
    try {
      const stored = JSON.parse(localStorage.getItem('ridelog_offline_feedbacks') || '[]');
      callback(stored);
    } catch (e) {
      callback([]);
    }
    return () => {};
  }

  // Listen to user's personal document feedbacks
  try {
    const userDocRef = doc(db, 'users', uid);
    return onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const tickets = snap.data().feedbacks || [];
        callback(tickets);
      } else {
        callback([]);
      }
    }, (err) => {
      console.warn('User tickets listener notice:', err);
      try {
        const stored = JSON.parse(localStorage.getItem('ridelog_offline_feedbacks') || '[]');
        callback(stored);
      } catch (e) {
        callback([]);
      }
    });
  } catch (err) {
    console.debug('Tickets listener setup notice:', err);
    return () => {};
  }
}

/**
 * Check if a newer version of the app is available in Firestore 'app_config/version'
 */
export async function checkAppUpdate(currentVersion = '1.1') {
  try {
    const docRef = doc(db, 'app_config', 'version');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const config = snap.data();
      const latestVersion = config.latestVersion || currentVersion;
      const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0;
      return {
        isUpdateAvailable,
        latestVersion,
        updateUrl: config.updateUrl || '',
        releaseNotes: config.releaseNotes || '',
        isMandatory: !!config.isMandatory
      };
    }
    return { isUpdateAvailable: false };
  } catch (err) {
    console.debug('App version check skipped:', err);
    return { isUpdateAvailable: false };
  }
}

/**
 * Real-time listener for app updates from Firestore 'app_config/version'
 */
export function listenToAppUpdates(currentVersion = '1.1', callback) {
  try {
    const docRef = doc(db, 'app_config', 'version');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const config = snap.data();
          const latestVersion = config.latestVersion || currentVersion;
          const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0;
          callback({
            isUpdateAvailable,
            latestVersion,
            updateUrl: config.updateUrl || '',
            releaseNotes: config.releaseNotes || '',
            isMandatory: !!config.isMandatory
          });
        } else {
          callback({ isUpdateAvailable: false });
        }
      },
      (err) => {
        console.warn('App version real-time listener notice:', err);
        callback({ isUpdateAvailable: false });
      }
    );
  } catch (err) {
    console.debug('App version listener setup skipped:', err);
    return () => {};
  }
}

/**
 * Real-time listener for in-app text campaign & announcement from Firestore 'app_config/campaign'
 */
export function listenToActiveCampaign(callback) {
  try {
    const docRef = doc(db, 'app_config', 'campaign');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.isActive) {
            callback({
              isActive: true,
              campaignId: data.campaignId ? `${data.campaignId}` : `camp_${data.updatedAt || 'active'}`,
              title: data.title || '',
              message: data.message || '',
              actionText: data.actionText || '',
              actionUrl: data.actionUrl || '',
              badge: data.badge || '',
              showEveryTime: !!data.showEveryTime || !!data.alwaysShow
            });
            return;
          }
        }
        callback({ isActive: false });
      },
      (err) => {
        console.warn('Active campaign listener notice:', err);
        callback({ isActive: false });
      }
    );
  } catch (err) {
    console.debug('Active campaign listener setup skipped:', err);
    return () => {};
  }
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

