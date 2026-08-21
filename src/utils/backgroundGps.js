import { registerPlugin, Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Native Android Background GPS Plugin Interface
 */
const BackgroundGpsNative = registerPlugin('BackgroundGps');

let activeListener = null;
let webWatchId = null;

/**
 * Start Background GPS Tracking
 * On Android: Uses Native Foreground Service with FusedLocationProviderClient + WakeLock
 * On Web/iOS: Uses Geolocation.watchPosition with Screen WakeLock fallback
 */
export async function startBackgroundGps(onLocationUpdate) {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      // 1. Remove previous listener if any
      if (activeListener) {
        await activeListener.remove();
        activeListener = null;
      }

      // 2. Attach real-time location update listener
      activeListener = await BackgroundGpsNative.addListener('onLocationUpdate', (data) => {
        if (onLocationUpdate && data) {
          onLocationUpdate({
            lat: data.latitude,
            lng: data.longitude,
            speed: data.speed || 0,
            accuracy: data.accuracy || 10,
            altitude: data.altitude || 0,
            bearing: data.bearing || 0,
            timestamp: data.timestamp || Date.now(),
            distanceKm: data.distanceKm || 0,
            maxSpeedKmH: data.maxSpeedKmH || 0,
            pointsCount: data.pointsCount || 0
          });
        }
      });

      // 3. Start Native Android Foreground Service
      const res = await BackgroundGpsNative.startTracking();
      return { success: true, native: true, message: res?.message };
    } catch (err) {
      console.warn('Native BackgroundGps start fallback to standard Geolocation:', err);
    }
  }

  // Fallback for Web / iOS / emulator
  try {
    if (Capacitor.isNativePlatform()) {
      webWatchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
        (pos, err) => {
          if (err || !pos?.coords) return;
          const { latitude, longitude, speed, accuracy, altitude, heading } = pos.coords;
          onLocationUpdate({
            lat: latitude,
            lng: longitude,
            speed: speed ? Math.max(0, Math.round(speed * 3.6)) : 0,
            accuracy: Math.round(accuracy || 0),
            altitude: altitude || 0,
            bearing: heading || 0,
            timestamp: pos.timestamp || Date.now()
          });
        }
      );
    } else if (navigator.geolocation) {
      webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, speed, accuracy, altitude, heading } = pos.coords;
          onLocationUpdate({
            lat: latitude,
            lng: longitude,
            speed: speed ? Math.max(0, Math.round(speed * 3.6)) : 0,
            accuracy: Math.round(accuracy || 0),
            altitude: altitude || 0,
            bearing: heading || 0,
            timestamp: pos.timestamp || Date.now()
          });
        },
        (err) => console.warn('Web watchPosition warning:', err),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
      );
    }
    return { success: true, native: false };
  } catch (err) {
    console.error('Failed to start GPS tracker:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Stop Background GPS Tracking
 * On Android: Stops Foreground Service and returns ALL native recorded points (even during screen off)
 */
export async function stopBackgroundGps() {
  let nativePoints = null;
  let nativeSummary = null;

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      if (activeListener) {
        await activeListener.remove();
        activeListener = null;
      }

      const res = await BackgroundGpsNative.stopTracking();
      if (res && res.points) {
        nativePoints = res.points;
        nativeSummary = res.summary;
      }
    } catch (err) {
      console.warn('Native BackgroundGps stop error:', err);
    }
  }

  // Clear web watch if active
  if (webWatchId !== null) {
    try {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: webWatchId });
      } else if (navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchId);
      }
    } catch (e) {}
    webWatchId = null;
  }

  return {
    success: true,
    points: nativePoints,
    summary: nativeSummary
  };
}

/**
 * Fetch current recorded points from native service buffer (ensures zero data loss)
 */
export async function getNativeRecordedPoints() {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      const res = await BackgroundGpsNative.getRecordedPoints();
      return res?.points || [];
    } catch (e) {
      console.debug('Native getRecordedPoints error:', e);
    }
  }
  return null;
}

/**
 * Request device to exclude RideLog from Battery Optimization (Doze mode)
 */
export async function requestBatteryOptimizationExemption() {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      return await BackgroundGpsNative.requestIgnoreBatteryOptimization();
    } catch (e) {
      console.debug('Battery optimization request error:', e);
    }
  }
  return { requested: false };
}
