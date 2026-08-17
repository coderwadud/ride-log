/**
 * Firebase Analytics & Activity Tracking for RideLog BD
 * - Tracks key user events for Firebase Analytics dashboard
 * - Updates `lastActiveAt` in Firestore for inactive user detection
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAgD2gnEiEoalKfespgnhMA_H2DvPfrD5M",
  authDomain: "ridelogbd1.firebaseapp.com",
  projectId: "ridelogbd1",
  storageBucket: "ridelogbd1.firebasestorage.app",
  messagingSenderId: "4274608297",
  appId: "1:4274608297:web:6eff7fd5886eb238f1f1b8",
  measurementId: "G-7Z8T060VYV"
};

// Reuse existing Firebase app instance
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Analytics instance (lazy — only works in web/browser, not native Android)
let analyticsInstance = null;

async function getAnalyticsInstance() {
  if (analyticsInstance) return analyticsInstance;
  try {
    const supported = await isSupported();
    if (supported) {
      analyticsInstance = getAnalytics(app);
    }
  } catch (e) {
    // Analytics not supported in this environment (e.g. Android native WebView)
  }
  return analyticsInstance;
}

/**
 * Log a custom Firebase Analytics event
 * @param {string} eventName - Event name (snake_case)
 * @param {object} params - Additional event parameters
 */
export async function logAnalyticsEvent(eventName, params = {}) {
  try {
    const analytics = await getAnalyticsInstance();
    if (analytics) {
      logEvent(analytics, eventName, params);
    }
  } catch (e) {
    // Silently ignore analytics errors — never break the app
    console.debug('[Analytics] Event skipped:', eventName, e?.message);
  }
}

/**
 * Update `lastActiveAt` timestamp in Firestore user document.
 * Called every time the user opens the app or performs a key action.
 * Throttled to once every 5 minutes to avoid excess Firestore writes.
 * @param {string} uid - Firebase Auth user ID
 */
let lastActivePingTime = 0;
export async function updateLastActiveAt(uid) {
  if (!uid) return;

  const now = Date.now();
  // Throttle: only update if 5+ minutes have passed since last ping
  if (now - lastActivePingTime < 5 * 60 * 1000) return;

  try {
    lastActivePingTime = now;
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      lastActiveAt: serverTimestamp(),
      appVersion: '1.1'
    });
  } catch (e) {
    // Silently ignore — Firestore update failure should never crash the app
    console.debug('[Analytics] lastActiveAt update failed:', e?.message);
  }
}

// ── PREDEFINED EVENT HELPERS ──

/** Called when user signs in (Google or Email) */
export async function trackUserLogin(method = 'email') {
  await logAnalyticsEvent('login', { method });
}

/** Called when a new user creates an account */
export async function trackUserSignUp(method = 'email') {
  await logAnalyticsEvent('sign_up', { method });
}

/** Called when user adds a new fuel log entry */
export async function trackFuelLogAdded(bikeId) {
  await logAnalyticsEvent('fuel_log_added', { bike_id: bikeId });
}

/** Called when user adds a new service log entry */
export async function trackServiceLogAdded(bikeId) {
  await logAnalyticsEvent('service_log_added', { bike_id: bikeId });
}

/** Called when user uploads a private document */
export async function trackDocumentUploaded(docType) {
  await logAnalyticsEvent('document_uploaded', { doc_type: docType });
}

/** Called when user adds a new bike */
export async function trackBikeAdded() {
  await logAnalyticsEvent('bike_added');
}

/** Called when user exports or imports backup */
export async function trackBackupExported() {
  await logAnalyticsEvent('backup_exported');
}

/** Called when user switches language */
export async function trackLanguageChanged(lang) {
  await logAnalyticsEvent('language_changed', { language: lang });
}
