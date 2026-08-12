import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
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
 * On Native Mobile App (Android/iOS): Uses signInWithRedirect to handle WebView auth cleanly without popup blocking.
 * On Web Browser: Uses standard signInWithPopup.
 */
export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    return signInWithRedirect(auth, provider);
  }
  return signInWithPopup(auth, provider);
}

// Sign out
export async function signOutUser() {
  await signOut(auth);
}

// Listen to auth state changes
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
