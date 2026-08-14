import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, getFirestore } from 'firebase/firestore';
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

// Initialize Firestore with persistent offline local cache
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache()
  });
} catch (e) {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

const provider = new GoogleAuthProvider();

/**
 * Sign in with Google.
 * On Native Mobile App (Android/iOS): STRICTLY uses native Google Sign-In bottom sheet inside the app.
 * ABSOLUTELY NO Chrome browser redirects or popups on mobile.
 * On Web Browser: Uses standard Firebase popup window.
 */
export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
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
    } else if (res.user) {
      return res.user;
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
