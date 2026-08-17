import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { saveUserFCMToken } from './firestoreDB';

let cachedToken = null;
let currentUserId = null;

export const initPushNotifications = async (userId = null) => {
  if (userId) currentUserId = userId;

  // Only execute on native Android/iOS devices
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    // Create default high-importance notification channel on Android
    try {
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Ride Log Notifications',
        description: 'General reminders and updates from Ride Log',
        importance: 5,
        visibility: 1,
        vibration: true,
      });
    } catch (e) {
      console.warn('Channel creation notice:', e);
    }

    // Register with Apple / Google to receive push notifications
    await PushNotifications.register();

    // Listener when registered successfully (gets FCM token)
    await PushNotifications.addListener('registration', async (token) => {
      console.log('✅ FCM Registration Token:', token.value);
      cachedToken = token.value;
      if (currentUserId) {
        await saveUserFCMToken(currentUserId, token.value);
      }
    });

    // Listener on registration error
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Error on push registration:', error);
    });

    // Listener when notification is received while app is open
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('🔔 Push Notification Received:', notification);
    });

    // Listener when user taps on the notification
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👉 Push Notification Action Performed:', action);
    });
  } catch (err) {
    console.error('Error initializing push notifications:', err);
  }
};

/**
 * Called when a user logs in to link their cached FCM token with their Firestore user document
 */
export async function syncFCMTokenWithUser(userId) {
  currentUserId = userId;
  if (userId && cachedToken) {
    await saveUserFCMToken(userId, cachedToken);
  }
}

