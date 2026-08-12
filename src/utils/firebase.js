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
  apiKey: "AIzaSyDw1fKp9qDmicU_--gY-ohPvg3QHvfXPmg",
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
 * On Native Mobile App (Android/iOS): Uses native Google Sign-In sheet/popup inside the app.
 * On Web Browser: Uses standard Firebase popup window.
 */
export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    try {
      // Dynamic import to prevent web bundlers from breaking if native plugin is unneeded on web
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const res = await FirebaseAuthentication.signInWithGoogle();
      if (res.credential?.idToken) {
        const credential = GoogleAuthProvider.credential(res.credential.idToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      }
    } catch (err) {
      console.warn('Native Google Auth failed, falling back to Web Auth:', err);
    }
  }

  // Web Browser / Fallback Popup
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
