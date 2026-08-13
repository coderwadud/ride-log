/**
 * Google Drive Cloud Sync Module for RideLog BD (Offline-First Engine)
 */

import { getBackupJsonObject, mergeImportBackupData, saveGDriveUser, loadGDriveUser } from './storage';

const GDRIVE_FILE_NAME = 'ridelog_backup.json';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// Token and sync state in memory
let accessToken = localStorage.getItem('ridelog_gdrive_token') || null;
let tokenExpiresAt = localStorage.getItem('ridelog_gdrive_token_expires') || 0;

export function isGDriveTokenValid() {
  return accessToken && Date.now() < Number(tokenExpiresAt);
}

export function setGDriveToken(token, expiresInSeconds = 3600) {
  accessToken = token;
  tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);
  localStorage.setItem('ridelog_gdrive_token', token);
  localStorage.setItem('ridelog_gdrive_token_expires', String(tokenExpiresAt));
}

export function clearGDriveToken() {
  accessToken = null;
  tokenExpiresAt = 0;
  localStorage.removeItem('ridelog_gdrive_token');
  localStorage.removeItem('ridelog_gdrive_token_expires');
  saveGDriveUser(null);
}

/** Get Google Account user details via Google OAuth UserInfo API */
export async function fetchGoogleUserProfile(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      const user = {
        email: data.email,
        name: data.name,
        picture: data.picture
      };
      saveGDriveUser(user);
      return user;
    }
  } catch (e) {
    console.error('Failed to fetch Google user profile:', e);
  }
  return null;
}

/** Search for existing ridelog_backup.json file in appDataFolder */
async function findGDriveBackupFile() {
  if (!accessToken) return null;

  try {
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${GDRIVE_FILE_NAME}' and trashed=false&fields=files(id, name, modifiedTime)`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0];
      }
    }
  } catch (e) {
    console.error('Failed to search GDrive backup file:', e);
  }
  return null;
}

/** Upload local JSON payload to Google Drive appDataFolder */
export async function uploadToGDrive(payload) {
  if (!accessToken) return { success: false, reason: 'unauthenticated' };

  try {
    const file = await findGDriveBackupFile();
    const dataStr = JSON.stringify(payload || getBackupJsonObject(), null, 2);

    const metadata = {
      name: GDRIVE_FILE_NAME,
      mimeType: 'application/json',
      ...(file ? {} : { parents: ['appDataFolder'] })
    };

    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      dataStr +
      closeDelimiter;

    const method = file ? 'PATCH' : 'POST';
    const uploadUrl = file
      ? `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const res = await fetch(uploadUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (res.ok) {
      const result = await res.json();
      const nowStr = new Date().toISOString();
      localStorage.setItem('ridelog_last_sync_time', nowStr);
      return { success: true, fileId: result.id, lastSync: nowStr };
    } else {
      const errText = await res.text();
      console.error('GDrive upload failed:', res.status, errText);
      if (res.status === 401) clearGDriveToken();
      return { success: false, status: res.status };
    }
  } catch (e) {
    console.error('Error uploading to GDrive:', e);
    return { success: false, error: e.message };
  }
}

/** Download remote backup file content from Google Drive */
export async function downloadFromGDrive() {
  if (!accessToken) return { success: false, reason: 'unauthenticated' };

  try {
    const file = await findGDriveBackupFile();
    if (!file) return { success: false, reason: 'not_found' };

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data, modifiedTime: file.modifiedTime };
    } else if (res.status === 401) {
      clearGDriveToken();
    }
  } catch (e) {
    console.error('Error downloading from GDrive:', e);
  }
  return { success: false };
}

/** Perform bidirectional 2-way sync (Merge local + remote, then upload) */
export async function syncWithGDrive() {
  if (!navigator.onLine) {
    return { success: false, offline: true, message: 'Offline mode' };
  }

  if (!isGDriveTokenValid()) {
    return { success: false, authenticated: false, message: 'Not logged in to Google Drive' };
  }

  try {
    // 1. Download remote data
    const remote = await downloadFromGDrive();
    if (remote.success && remote.data) {
      // Merge remote data into local storage
      mergeImportBackupData(remote.data);
    }

    // 2. Upload combined local state back to Google Drive
    const updatedLocalPayload = getBackupJsonObject();
    const uploadRes = await uploadToGDrive(updatedLocalPayload);

    if (uploadRes.success) {
      return { success: true, lastSync: uploadRes.lastSync };
    } else {
      return { success: false, message: 'Upload failed' };
    }
  } catch (e) {
    console.error('Sync failed:', e);
    return { success: false, error: e.message };
  }
}

/** Prompt Google Identity Services (GIS) Token Client flow */
export function requestGoogleDriveLogin(onSuccess, onError) {
  if (typeof window.google !== 'undefined' && window.google.accounts && window.google.accounts.oauth2) {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: '1088491039832-demo.apps.googleusercontent.com',
      scope: GDRIVE_SCOPE,
      callback: async (response) => {
        if (response && response.access_token) {
          setGDriveToken(response.access_token, response.expires_in || 3600);
          const user = await fetchGoogleUserProfile(response.access_token);
          if (onSuccess) onSuccess({ token: response.access_token, user });
        } else if (onError) {
          onError(response);
        }
      }
    });
    client.requestAccessToken();
  } else {
    // Fallback: Prompt manual Access Token or OAuth Login
    const manualToken = prompt(
      navigator.language === 'bn' 
        ? 'গুগল ক্লাউড ড্রাইভে সিঙ্ক করতে Access Token প্রদান করুন:'
        : 'Enter Google OAuth Access Token for Drive Sync:'
    );
    if (manualToken) {
      setGDriveToken(manualToken);
      fetchGoogleUserProfile(manualToken).then((user) => {
        if (onSuccess) onSuccess({ token: manualToken, user });
      });
    } else if (onError) {
      onError({ error: 'gis_unavailable' });
    }
  }
}
