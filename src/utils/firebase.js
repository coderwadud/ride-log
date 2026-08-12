import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: "AIzaSyAgD2gnEiEoalKfespgnhMA_H2DvPfrD5M",
  authDomain: "ridelogbd1.firebaseapp.com",
  projectId: "ridelogbd1",
  storageBucket: "ridelogbd1.firebasestorage.app",
  messagingSenderId: "4274608297",
  appId: "1:4274608297:web:6eff7fd5886eb238f1f1b8",
  measurementId: "G-7Z8T060VYV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

/**
 * Sign in with Google.
 * Handles both Native One-Tap Credential Manager and standard Google Account Chooser.
 */
export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const res = await FirebaseAuthentication.signInWithGoogle({
        scopes: ['profile', 'email']
      });

      const idToken = res.credential?.idToken;
      const accessToken = res.credential?.accessToken;

      if (idToken || accessToken) {
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      }
    } catch (err) {
      console.warn('Native One-Tap returned error, falling back to Account Selector:', err);
      // Fallback: If "No credentials available" or One-Tap is not cached, open standard Google Account chooser
      try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      } catch (fallbackErr) {
        console.error('Google Auth Fallback Error:', fallbackErr);
        const errMsg = fallbackErr?.message || err?.message || 'Login failed';
        alert(
          navigator.language === 'bn'
            ? `⚠️ গুগল সাইন-ইন সমস্যা: ${errMsg}`
            : `⚠️ Google Sign-in error: ${errMsg}`
        );
        throw fallbackErr;
      }
    }
    return;
  }

  // Web Browser ONLY
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// Sign out
export async function signOutUser() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    } catch (e) {
      console.warn('Native sign out error:', e);
    }
  }
  await signOut(auth);
}

// Listen to auth state changes
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
