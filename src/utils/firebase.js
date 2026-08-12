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
 * On Native Mobile App (Android/iOS): Uses native Google Sign-In bottom sheet with scopes and idToken/accessToken mapping.
 * On Web Browser: Uses standard Firebase popup window.
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
      console.error('Native Google Auth Error:', err);
      const errMsg = err?.message || err?.code || 'Sign in failed';
      alert(
        navigator.language === 'bn'
          ? `⚠️ গুগল সাইন-ইন ত্রুটি: ${errMsg}`
          : `⚠️ Google Sign-in error: ${errMsg}`
      );
      throw err;
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
