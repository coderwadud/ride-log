import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDw1fKp9qDmicU_--gY-ohPvg3QHvfXPmg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ridelogbd1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ridelogbd1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ridelogbd1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "4274608297",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:4274608297:web:6eff7fd5886eb238f1f1b8",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-7Z8T060VYV"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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

// Sign in with Email and Password
export async function signInWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Sign up with Email and Password
export async function signUpWithEmail(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Reset Password
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Permanently delete the current user's Firebase Auth account.
 * Also signs out from native platform (Android/iOS) if applicable.
 * Note: Firebase requires recent login for account deletion.
 * If it fails with 'auth/requires-recent-login', user must re-authenticate.
 */
export async function deleteUserAccount() {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No authenticated user found');

  // Sign out from native platform first
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    } catch (e) {
      console.warn('Native sign out before delete error:', e);
    }
  }

  // Delete the Firebase Auth account permanently
  await deleteUser(currentUser);
}
