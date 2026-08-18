import { db } from './firebase';
import {
  doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where,
  getDocs, writeBatch, deleteField
} from 'firebase/firestore';

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
 * Helper to execute Firestore batches safely (handles >500 ops limit)
 */
async function commitBatchOperations(operations) {
  const CHUNK_SIZE = 450;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data, op.options || {});
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

/**
 * Load user data from Firestore with Rock-Solid Dual-Safety Fallback
 */
export async function loadUserData(uid) {
  if (!uid) return DEFAULT_DATA;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    const rootData = userSnap.exists() ? userSnap.data() : {};

    let bikes = (rootData.bikes && rootData.bikes.length > 0) ? rootData.bikes : [DEFAULT_BIKE];
    let fuelLogs = Array.isArray(rootData.fuelLogs) ? rootData.fuelLogs : [];
    let serviceLogs = Array.isArray(rootData.serviceLogs) ? rootData.serviceLogs : [];
    let activeBikeId = rootData.activeBikeId || 'bike_1';
    let settings = rootData.settings || DEFAULT_DATA.settings;

    // If rootData already has logs, return immediately for instant 0ms load!
    if (fuelLogs.length > 0 || serviceLogs.length > 0) {
      fuelLogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      serviceLogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      return {
        settings,
        activeBikeId,
        bikes: bikes.length > 0 ? bikes : [DEFAULT_BIKE],
        fuelLogs,
        serviceLogs
      };
    }

    // Otherwise, try reading subcollections with a fast 2-second timeout
    try {
      const bikesRef = collection(db, 'users', uid, 'bikes');
      const fuelLogsRef = collection(db, 'users', uid, 'fuel_logs');
      const serviceLogsRef = collection(db, 'users', uid, 'service_logs');

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));

      const [bikesSnap, fuelLogsSnap, serviceLogsSnap] = await Promise.race([
        Promise.all([
          getDocs(bikesRef).catch(() => null),
          getDocs(fuelLogsRef).catch(() => null),
          getDocs(serviceLogsRef).catch(() => null)
        ]),
        timeoutPromise
      ]);

      if (bikesSnap && !bikesSnap.empty) {
        bikes = bikesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      if (fuelLogsSnap && !fuelLogsSnap.empty) {
        fuelLogs = fuelLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      if (serviceLogsSnap && !serviceLogsSnap.empty) {
        serviceLogs = serviceLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (subErr) {
      console.debug('Subcollection read fallback to root document:', subErr);
    }

    // Sort logs by date descending
    fuelLogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    serviceLogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return {
      settings,
      activeBikeId,
      bikes: bikes.length > 0 ? bikes : [DEFAULT_BIKE],
      fuelLogs,
      serviceLogs
    };
  } catch (err) {
    console.error('Error loading Firestore data for user:', uid, err);
    return { ...DEFAULT_DATA };
  }
}

/**
 * Save user data to Firestore (Dual-Safe: preserves both root document and subcollections)
 */
export async function saveUserData(uid, data) {
  if (!uid || !data) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    const rootUpdates = {
      settings: data.settings || DEFAULT_DATA.settings,
      activeBikeId: data.activeBikeId || 'bike_1',
      bikes: data.bikes || [DEFAULT_BIKE],
      fuelLogs: data.fuelLogs || [],
      serviceLogs: data.serviceLogs || [],
      schemaVersion: '2.0',
      updatedAt: new Date().toISOString()
    };

    if (data.email) rootUpdates.email = data.email;
    if (data.displayName) rootUpdates.displayName = data.displayName;
    if (data.photoURL) rootUpdates.photoURL = data.photoURL;

    // 1. Primary Save to root user doc (Ensures 100% safety and immediate accessibility)
    await setDoc(userDocRef, rootUpdates, { merge: true });

    // 2. Secondary Sync to subcollections in background (if rules allow)
    try {
      const operations = [];

      // Save bikes
      for (const bike of (data.bikes || [DEFAULT_BIKE])) {
        const bId = bike.id || 'bike_1';
        operations.push({
          type: 'set',
          ref: doc(db, 'users', uid, 'bikes', bId),
          data: { ...bike, id: bId }
        });
      }

      // Save fuel logs
      for (const fuel of (data.fuelLogs || [])) {
        const fId = fuel.id || `fuel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        operations.push({
          type: 'set',
          ref: doc(db, 'users', uid, 'fuel_logs', fId),
          data: { ...fuel, id: fId }
        });
      }

      // Save service logs
      for (const service of (data.serviceLogs || [])) {
        const sId = service.id || `service_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        operations.push({
          type: 'set',
          ref: doc(db, 'users', uid, 'service_logs', sId),
          data: { ...service, id: sId }
        });
      }

      await commitBatchOperations(operations);
    } catch (subErr) {
      console.debug('Background subcollection write skipped:', subErr);
    }
  } catch (err) {
    console.error('Error saving Firestore data for user:', uid, err);
  }
}

/**
 * Clear user data in Firestore subcollections (Reset user data only)
 */
export async function resetUserDataInFirestore(uid) {
  if (!uid) return;
  try {
    const operations = [];

    // Delete all bikes, fuel logs, service logs in subcollections
    const [bikesSnap, fuelLogsSnap, serviceLogsSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'bikes')),
      getDocs(collection(db, 'users', uid, 'fuel_logs')),
      getDocs(collection(db, 'users', uid, 'service_logs'))
    ]);

    bikesSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
    fuelLogsSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
    serviceLogsSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));

    // Reset default bike in subcollection
    operations.push({
      type: 'set',
      ref: doc(db, 'users', uid, 'bikes', 'bike_1'),
      data: DEFAULT_BIKE
    });

    // Reset root user doc
    operations.push({
      type: 'set',
      ref: doc(db, 'users', uid),
      data: {
        settings: { lang: 'bn', theme: 'dark' },
        activeBikeId: 'bike_1',
        schemaVersion: '2.0',
        updatedAt: new Date().toISOString()
      }
    });

    await commitBatchOperations(operations);
  } catch (err) {
    console.error('Error resetting user Firestore subcollection data:', uid, err);
  }
}

/**
 * Permanently delete the user's Firestore document `users/{uid}` and all subcollections
 * Called before deleting Firebase Auth account.
 */
export async function deleteUserAllData(uid) {
  if (!uid) return;
  try {
    const operations = [];

    const [bikesSnap, fuelLogsSnap, serviceLogsSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'bikes')),
      getDocs(collection(db, 'users', uid, 'fuel_logs')),
      getDocs(collection(db, 'users', uid, 'service_logs'))
    ]);

    bikesSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
    fuelLogsSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
    serviceLogsSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));

    // Delete root doc
    operations.push({ type: 'delete', ref: doc(db, 'users', uid) });

    await commitBatchOperations(operations);
  } catch (err) {
    console.error('Error deleting user Firestore subcollections:', uid, err);
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
 * Send follow-up reply message from rider on an existing ticket
 */
export async function sendUserTicketReply(feedbackId, userId, messageText) {
  if (!feedbackId || !messageText || !messageText.trim()) return false;
  try {
    const newMsg = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      senderName: 'Rider',
      text: messageText.trim(),
      createdAt: new Date().toISOString()
    };

    const collectionsToTry = ['feedbacks', 'supportTickets', 'tickets'];
    for (const colName of collectionsToTry) {
      try {
        const fRef = doc(db, colName, feedbackId);
        const fSnap = await getDoc(fRef);
        let existingMsgs = [];
        if (fSnap.exists() && Array.isArray(fSnap.data().messages)) {
          existingMsgs = fSnap.data().messages;
        }
        await setDoc(fRef, {
          messages: [...existingMsgs, newMsg],
          updatedAt: new Date().toISOString(),
          status: 'in_progress'
        }, { merge: true });
      } catch (e) {}
    }

    if (userId && userId !== 'guest') {
      try {
        const uRef = doc(db, 'users', userId);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          const uData = uSnap.data();
          const fList = uData.feedbacks || uData.userFeedbacks || uData.tickets || [];
          const newList = fList.map(f => {
            if (f.id === feedbackId) {
              const msgs = Array.isArray(f.messages) ? f.messages : [];
              return {
                ...f,
                messages: [...msgs, newMsg],
                updatedAt: new Date().toISOString(),
                status: 'in_progress'
              };
            }
            return f;
          });
          await updateDoc(uRef, { userFeedbacks: newList, feedbacks: newList });
        }
      } catch (e) {}
    }
    return true;
  } catch (err) {
    console.error('Error sending user ticket reply:', err);
    return false;
  }
}

/**
 * Real-time listener for user support tickets & status directly from root 'feedbacks' collection
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

  try {
    // Primary: Query the root 'feedbacks' collection in real-time
    const q = query(collection(db, 'feedbacks'), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const tickets = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Sort newest first
        tickets.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        callback(tickets);
      } else {
        // Fallback: check user document if root collection is empty
        const userDocRef = doc(db, 'users', uid);
        getDoc(userDocRef).then((snap) => {
          if (snap.exists() && snap.data().feedbacks?.length) {
            callback(snap.data().feedbacks);
          } else {
            try {
              const stored = JSON.parse(localStorage.getItem('ridelog_offline_feedbacks') || '[]');
              callback(stored);
            } catch (e) {
              callback([]);
            }
          }
        }).catch(() => callback([]));
      }
    }, (err) => {
      console.warn('Root feedbacks query notice, falling back to user document listener:', err);
      // Fallback: Listen to user's personal document feedbacks
      const userDocRef = doc(db, 'users', uid);
      return onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const tickets = snap.data().feedbacks || [];
          callback(tickets);
        } else {
          try {
            const stored = JSON.parse(localStorage.getItem('ridelog_offline_feedbacks') || '[]');
            callback(stored);
          } catch (e) {
            callback([]);
          }
        }
      });
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
              message: data.message || data.description || '',
              description: data.description || data.message || '',
              bannerUrl: data.bannerUrl || data.imageUrl || '',
              imageUrl: data.imageUrl || data.bannerUrl || '',
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

