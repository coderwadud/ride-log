/**
 * Google Drive API v3 Service for RideLog BD Tour Gallery
 * Uses RESTRICTED scope 'https://www.googleapis.com/auth/drive.file'
 * Only creates and reads files in 'RideLog BD/Tours/<Tour_Name>' on the user's own Drive.
 */

import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Get cached access token or request a new one with drive.file scope.
 */
export async function getDriveAccessToken() {
  // Check session storage first
  const cached = sessionStorage.getItem('rl_drive_token');
  const expiry = sessionStorage.getItem('rl_drive_token_exp');
  if (cached && expiry && Number(expiry) > Date.now()) {
    return cached;
  }

  // Request fresh token via Google Provider with drive.file scope
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (token) {
      // Cache token for 55 minutes
      sessionStorage.setItem('rl_drive_token', token);
      sessionStorage.setItem('rl_drive_token_exp', String(Date.now() + 55 * 60 * 1000));
      return token;
    }
  } catch (err) {
    console.error('Google Drive Auth Error:', err);
    throw new Error(err.message || 'Could not authenticate Google Drive');
  }

  return null;
}

/**
 * Find or create folder by name inside a parent folder.
 */
async function findOrCreateFolder(accessToken, folderName, parentId = null) {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`;

  const searchRes = await fetch(`${DRIVE_API_URL}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined
  };

  const createRes = await fetch(`${DRIVE_API_URL}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Get or create the hierarchical folder: ridelogbd-app-image -> <Tour Title> (<Date>)
 */
export async function getTourDriveFolder(accessToken, tourTitle = 'Tour', tourDate = '') {
  // 1. Root Folder: ridelogbd-app-image
  const rootFolderId = await findOrCreateFolder(accessToken, 'ridelogbd-app-image');

  // 2. Format subfolder name with Tour Title and Date
  const safeTitle = tourTitle.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Tour';
  let dateFormatted = '';
  if (tourDate) {
    try {
      const d = new Date(tourDate);
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toISOString().split('T')[0];
      }
    } catch {
      dateFormatted = '';
    }
  }
  const folderName = dateFormatted ? `${safeTitle} (${dateFormatted})` : safeTitle;

  // 3. Subfolder inside ridelogbd-app-image
  const tourFolderId = await findOrCreateFolder(accessToken, folderName, rootFolderId);
  return tourFolderId;
}

/**
 * Upload any media file (Image, Video, PDF) to the user's Google Drive.
 */
export async function uploadMediaToGoogleDrive(accessToken, file, folderId, caption = '') {
  if (!file) throw new Error('No file provided');

  // Step 1: Upload file using Multipart upload
  const metadata = {
    name: file.name || `tour_media_${Date.now()}`,
    mimeType: file.type || 'application/octet-stream',
    description: caption || 'Uploaded via RideLog BD Tour Gallery',
    parents: [folderId]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Read file arrayBuffer
  const fileArrayBuffer = await file.arrayBuffer();

  const multipartHeader = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}${delimiter}Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

  const encoder = new TextEncoder();
  const headerUint8 = encoder.encode(multipartHeader);
  const footerUint8 = encoder.encode(closeDelimiter);
  const fileUint8 = new Uint8Array(fileArrayBuffer);

  const combinedBody = new Uint8Array(headerUint8.length + fileUint8.length + footerUint8.length);
  combinedBody.set(headerUint8, 0);
  combinedBody.set(fileUint8, headerUint8.length);
  combinedBody.set(footerUint8, headerUint8.length + fileUint8.length);

  const uploadRes = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: combinedBody
  });

  const uploadData = await uploadRes.json();
  if (!uploadData.id) {
    throw new Error(uploadData.error?.message || 'Failed to upload file to Google Drive');
  }

  const fileId = uploadData.id;

  // Step 2: Make file readable to anyone with link so tour members can view it
  try {
    await fetch(`${DRIVE_API_URL}/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
  } catch (permErr) {
    console.warn('Could not set public permission:', permErr);
  }

  // Determine media category
  let fileType = 'other';
  if (file.type?.startsWith('image/')) fileType = 'image';
  else if (file.type?.startsWith('video/')) fileType = 'video';
  else if (file.type === 'application/pdf' || file.name?.endsWith('.pdf')) fileType = 'pdf';

  return {
    driveFileId: fileId,
    folderId,
    folderViewLink: `https://drive.google.com/drive/folders/${folderId}`,
    fileName: file.name,
    fileType,
    mimeType: file.type || 'image/jpeg',
    fileSizeBytes: file.size || 0,
    webViewLink: uploadData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: uploadData.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`,
    thumbnailUrl: `https://lh3.googleusercontent.com/d/${fileId}=s800`,
    previewUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
    directStreamUrl: `https://drive.google.com/uc?id=${fileId}`
  };
}

/**
 * Get the Root Drive folder ID for 'ridelogbd-app-image'
 */
export async function getRootDriveFolder(accessToken) {
  return await findOrCreateFolder(accessToken, 'ridelogbd-app-image');
}
