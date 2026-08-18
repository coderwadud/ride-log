import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const BASE_APP_VERSION = '1.3.2';

/**
 * Dynamically gets the actual installed APK version from Android OS,
 * with fallback to base version for web browser.
 */
export async function getCurrentAppVersion() {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      return info.version ? `${info.version}` : BASE_APP_VERSION;
    } catch (e) {
      console.debug('Native app version lookup skipped:', e);
    }
  }
  return BASE_APP_VERSION;
}
