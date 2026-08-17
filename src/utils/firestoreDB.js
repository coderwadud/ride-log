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
 * Load user data from Firestore Sub-collections with Auto-Migration from legacy single doc
 */
export async function loadUserData(uid) {
  if (!uid) return DEFAULT_DATA;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    const rootData = userSnap.exists() ? userSnap.data() : {};

    // 1. Fetch subcollections
    const bikesRef = collection(db, 'users', uid, 'bikes');
    const fuelLogsRef = collection(db, 'users', uid, 'fuel_logs');
    const serviceLogsRef = collection(db, 'users', uid, 'service_logs');

    const [bikesSnap, fuelLogsSnap, serviceLogsSnap] = await Promise.all([
      getDocs(bikesRef),
      getDocs(fuelLogsRef),
      getDocs(serviceLogsRef)
    ]);

    const hasSubcollectionData = !bikesSnap.empty || !fuelLogsSnap.empty || !serviceLogsSnap.empty;

    // 2. If subcollections exist, load directly from subcollections
    if (hasSubcollectionData) {
      const bikes = bikesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const fuelLogs = fuelLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const serviceLogs = serviceLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Sort logs by date descending
      fuelLogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      serviceLogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      // Clean up legacy array fields from root doc if they still linger
      if (rootData.bikes || rootData.fuelLogs || rootData.serviceLogs) {
        setDoc(userDocRef, {
          bikes: deleteField(),
          fuelLogs: deleteField(),
          serviceLogs: deleteField(),
          schemaVersion: '2.0'
        }, { merge: true }).catch(() => {});
      }

      return {
        settings: rootData.settings || DEFAULT_DATA.settings,
        activeBikeId: rootData.activeBikeId || (bikes[0]?.id || 'bike_1'),
        bikes: bikes.length > 0 ? bikes : [DEFAULT_BIKE],
        fuelLogs,
        serviceLogs
      };
    }

    // 3. AUTO-MIGRATION: If subcollections are empty but legacy doc has array data
    const legacyBikes = rootData.bikes || [];
    const legacyFuelLogs = rootData.fuelLogs || [];
    const legacyServiceLogs = rootData.serviceLogs || [];

    if (legacyBikes.length > 0 || legacyFuelLogs.length > 0 || legacyServiceLogs.length > 0) {
      console.log('⚡ Auto-migrating user data to Firestore sub-collections for:', uid);
      const operations = [];

      // Migrate bikes
      for (const bike of (legacyBikes.length > 0 ? legacyBikes : [DEFAULT_BIKE])) {
        const bId = bike.id || 'bike_1';
        operations.push({
          type: 'set',
          ref: doc(db, 'users', uid, 'bikes', bId),
          data: { ...bike, id: bId }
        });
      }

      // Migrate fuel logs
      for (const fuel of legacyFuelLogs) {
        const fId = fuel.id || `fuel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        operations.push({
          type: 'set',
          ref: doc(db, 'users', uid, 'fuel_logs', fId),
          data: { ...fuel, id: fId }
        });
      }

      // Migrate service logs
      for (const service of legacyServiceLogs) {
        const sId = service.id || `service_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        operations.push({
          type: 'set',
          ref: doc(db, 'users', uid, 'service_logs', sId),
          data: { ...service, id: sId }
        });
      }

      // Update root user doc: strip legacy arrays and set schemaVersion 2.0
      operations.push({
        type: 'set',
        ref: userDocRef,
        data: {
          settings: rootData.settings || DEFAULT_DATA.settings,
          activeBikeId: rootData.activeBikeId || 'bike_1',
          schemaVersion: '2.0',
          migratedAt: new Date().toISOString(),
          bikes: deleteField(),
          fuelLogs: deleteField(),
          serviceLogs: deleteField()
        },
        options: { merge: true }
      });

      // Execute migration batch
      await commitBatchOperations(operations);
      console.log('✅ Auto-migration to sub-collections successfully completed!');

      return {
        settings: rootData.settings || DEFAULT_DATA.settings,
        activeBikeId: rootData.activeBikeId || 'bike_1',
        bikes: legacyBikes.length > 0 ? legacyBikes : [DEFAULT_BIKE],
        fuelLogs: legacyFuelLogs,
        serviceLogs: legacyServiceLogs
      };
    }

    // 4. Fresh new user
    return { ...DEFAULT_DATA };
  } catch (err) {
    console.error('Error loading Firestore subcollection data for user:', uid, err);
    return { ...DEFAULT_DATA };
  }
}

/**
 * Save user data to Firestore Sub-collections (High Performance & Scalable)
 */
export async function saveUserData(uid, data) {
  if (!uid || !data) return;
  try {
    const operations = [];

    // 1. Update root user doc (only light metadata, no giant arrays)
    const userDocRef = doc(db, 'users', uid);
    operations.push({
      type: 'set',
      ref: userDocRef,
      data: {
        settings: data.settings || DEFAULT_DATA.settings,
        activeBikeId: data.activeBikeId || 'bike_1',
        schemaVersion: '2.0',
        updatedAt: new Date().toISOString(),
        bikes: deleteField(),
        fuelLogs: deleteField(),
        serviceLogs: deleteField()
      },
      options: { merge: true }
    });

    // 2. Fetch existing subcollection docs to handle updates and clean deletions
    const [existingBikesSnap, existingFuelsSnap, existingServicesSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'bikes')),
      getDocs(collection(db, 'users', uid, 'fuel_logs')),
      getDocs(collection(db, 'users', uid, 'service_logs'))
    ]);

    const currentBikeIds = new Set((data.bikes || [DEFAULT_BIKE]).map(b => b.id || 'bike_1'));
    const currentFuelIds = new Set((data.fuelLogs || []).map(f => f.id));
    const currentServiceIds = new Set((data.serviceLogs || []).map(s => s.id));

    // Save/Update Bikes
    for (const bike of (data.bikes || [DEFAULT_BIKE])) {
      const bId = bike.id || 'bike_1';
      operations.push({
        type: 'set',
        ref: doc(db, 'users', uid, 'bikes', bId),
        data: { ...bike, id: bId }
      });
    }

    // Delete removed bikes
    for (const d of existingBikesSnap.docs) {
      if (!currentBikeIds.has(d.id)) {
        operations.push({ type: 'delete', ref: d.ref });
      }
    }

    // Save/Update Fuel Logs
    for (const fuel of (data.fuelLogs || [])) {
      const fId = fuel.id || `fuel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      operations.push({
        type: 'set',
        ref: doc(db, 'users', uid, 'fuel_logs', fId),
        data: { ...fuel, id: fId }
      });
    }

    // Delete removed fuel logs
    for (const d of existingFuelsSnap.docs) {
      if (!currentFuelIds.has(d.id)) {
        operations.push({ type: 'delete', ref: d.ref });
      }
    }

    // Save/Update Service Logs
    for (const service of (data.serviceLogs || [])) {
      const sId = service.id || `service_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      operations.push({
        type: 'set',
        ref: doc(db, 'users', uid, 'service_logs', sId),
        data: { ...service, id: sId }
      });
    }

    // Delete removed service logs
    for (const d of existingServicesSnap.docs) {
      if (!currentServiceIds.has(d.id)) {
        operations.push({ type: 'delete', ref: d.ref });
      }
    }

    // 3. Commit all batch operations
    await commitBatchOperations(operations);
  } catch (err) {
    console.error('Error saving Firestore subcollection data for user:', uid, err);
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

