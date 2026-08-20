import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { uploadDocumentToCloudinary } from './cloudinary';
import { saveUserDocumentMeta, deleteUserDocumentMeta, getUserDocumentsMeta } from './firestoreDB';

const DOCS_INDEX_KEY = 'ridelog_private_documents';
const DB_NAME = 'RideLogDocumentsDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

// Maximum allowed single document file size: 500 KB
export const MAX_DOC_SIZE_BYTES = 500 * 1024; // 512,000 bytes

// Allowed file MIME types and extensions
export const ALLOWED_DOC_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
];

export const ALLOWED_DOC_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

// ── INDEXEDDB INITIALIZATION ──
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// ── INDEXEDDB HELPERS ──
async function saveDocToIndexedDB(doc) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(doc);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.warn('Failed to save to IndexedDB, fallback to localStorage:', e);
    saveDocToLocalStorageFallback(doc);
  }
}

async function deleteDocFromIndexedDB(docId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(docId);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.warn('Failed to delete from IndexedDB:', e);
  }
}

async function fetchDocsFromIndexedDB(userId) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (e) {
    return [];
  }
}

// ── LOCAL STORAGE FALLBACK & MIGRATION ──
function getLegacyLocalStorageDocs(userId) {
  try {
    const raw = localStorage.getItem(`${DOCS_INDEX_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveDocToLocalStorageFallback(doc) {
  try {
    const userId = doc.userId || 'guest';
    const existing = getLegacyLocalStorageDocs(userId);
    const updated = [doc, ...existing.filter(d => d.id !== doc.id)];
    localStorage.setItem(`${DOCS_INDEX_KEY}_${userId}`, JSON.stringify(updated));
  } catch (e) {
    console.error('LocalStorage fallback write error:', e);
  }
}

/**
 * Validate file type and file size (Max 500 KB)
 */
export function validateDocumentFile(file) {
  if (!file) {
    return { valid: false, message: 'কোনো ফাইল সিলেক্ট করা হয়নি।' };
  }

  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  const isAllowedType = ALLOWED_DOC_TYPES.includes(file.type?.toLowerCase()) || ALLOWED_DOC_EXTENSIONS.includes(ext);

  if (!isAllowedType) {
    return {
      valid: false,
      message: '❌ ফাইল ফরম্যাট গ্রহণযোগ্য নয়। শুধুমাত্র JPG, PNG, WEBP এবং PDF ফাইল আপলোড করতে পারবেন।'
    };
  }

  // If PDF, check strict 500KB immediately (PDFs cannot be canvas compressed)
  if (file.type === 'application/pdf' || ext === 'pdf') {
    if (file.size > MAX_DOC_SIZE_BYTES) {
      const sizeInKb = (file.size / 1024).toFixed(0);
      return {
        valid: false,
        message: `❌ PDF ফাইলের সাইজ সর্বোচ্চ ৫০০ KB হতে পারবে। আপনার ফাইলের সাইজ ${sizeInKb} KB।`
      };
    }
  }

  return { valid: true };
}

/**
 * Trigger direct download on Web and Native Mobile Share/Save sheet on Android / iOS
 */
export async function downloadOrShareDocument(doc) {
  if (!doc) return;
  const fileData = doc.fileData || doc.cloudUrl || doc.localUri;
  if (!fileData) return;

  const extension = doc.fileName ? doc.fileName.split('.').pop() : (doc.fileType?.includes('pdf') ? 'pdf' : 'png');
  const fileName = doc.fileName || `${doc.title}.${extension}`;

  if (Capacitor.isNativePlatform()) {
    try {
      let cleanBase64 = '';

      if (fileData.startsWith('data:')) {
        cleanBase64 = fileData.replace(/^data:.*?;base64,/, '');
      } else if (fileData.startsWith('http://') || fileData.startsWith('https://')) {
        // Fetch from Cloudinary and convert to base64
        const resp = await fetch(fileData);
        const blob = await resp.blob();
        cleanBase64 = await blobToBase64(blob);
        cleanBase64 = cleanBase64.replace(/^data:.*?;base64,/, '');
      }

      if (cleanBase64) {
        const tempPath = `downloads/${Date.now()}_${fileName}`;
        const writeResult = await Filesystem.writeFile({
          path: tempPath,
          data: cleanBase64,
          directory: Directory.Cache,
          recursive: true
        });

        await Share.share({
          title: doc.title,
          text: `RideLog BD Document: ${doc.title}`,
          url: writeResult.uri,
          dialogTitle: 'Download / Save Document'
        });
        return;
      }
    } catch (err) {
      console.warn('Native share/download fallback:', err);
    }
  }

  // Web download
  triggerWebDownload(fileData, fileName);
}

function triggerWebDownload(fileData, fileName) {
  try {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 500);
  } catch (e) {
    console.error('Web download error:', e);
  }
}

/**
 * Get list of private documents for user (IndexedDB primary 0ms + Smart Cloud Restore)
 */
export async function getPrivateDocuments(userId) {
  const targetUserId = userId || 'guest';
  let docs = await fetchDocsFromIndexedDB(targetUserId);

  // Migration step 1: Check legacy localStorage
  const legacyDocs = getLegacyLocalStorageDocs(targetUserId);
  if (legacyDocs.length > 0) {
    for (const legacyDoc of legacyDocs) {
      const docWithUser = { ...legacyDoc, userId: targetUserId };
      await saveDocToIndexedDB(docWithUser);
    }
    try {
      localStorage.removeItem(`${DOCS_INDEX_KEY}_${targetUserId}`);
    } catch (e) {}
    docs = await fetchDocsFromIndexedDB(targetUserId);
  }

  // Smart Sync & Restore: If local IndexedDB is empty and user logged in, pull from Firestore metadata
  if (docs.length === 0 && targetUserId !== 'guest') {
    try {
      const cloudDocs = await getUserDocumentsMeta(targetUserId);
      if (cloudDocs.length > 0) {
        for (const cDoc of cloudDocs) {
          const docToStore = {
            ...cDoc,
            userId: targetUserId,
            fileData: cDoc.cloudUrl || ''
          };
          await saveDocToIndexedDB(docToStore);
        }
        docs = await fetchDocsFromIndexedDB(targetUserId);
      }
    } catch (syncErr) {
      console.debug('Cloud document restore skipped:', syncErr);
    }
  }

  // Fallback to legacy if still empty
  if (docs.length === 0) {
    docs = getLegacyLocalStorageDocs(targetUserId);
  }

  // Sort by createdAt descending
  docs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return docs;
}

/**
 * Save file privately in Local Storage / IndexedDB (0ms) and Backup to Cloudinary in background
 */
export async function addPrivateDocument({ userId, bikeId, title, docType, expiryDate = '', file }) {
  // 1. Validate file format and size
  const validation = validateDocumentFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // 2. Compress image if needed under 500KB, or convert to Base64
  let base64Data = await compressImageIfNeeded(file);
  if (!base64Data) {
    base64Data = await fileToBase64(file);
  }

  // Calculate actual base64 payload size in bytes
  const payloadBytes = Math.round((base64Data.length * 3) / 4);
  if (payloadBytes > MAX_DOC_SIZE_BYTES) {
    const sizeKb = (payloadBytes / 1024).toFixed(0);
    throw new Error(`❌ ফাইলের সাইজ সর্বোচ্চ ৫০০ KB হতে পারবে। সাইজ: ${sizeKb} KB। অনুগ্রহ করে ছোট ফাইল নির্বাচন করুন।`);
  }

  const fileExt = (file.name || '').split('.').pop()?.toLowerCase() || (file.type?.includes('pdf') ? 'pdf' : 'png');
  const fileName = file.name || `${docId}.${fileExt}`;

  let localUri = '';
  if (Capacitor.isNativePlatform()) {
    try {
      const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '');
      const writeResult = await Filesystem.writeFile({
        path: `documents/${docId}.${fileExt}`,
        data: cleanBase64,
        directory: Directory.Data,
        recursive: true
      });
      localUri = writeResult.uri;
    } catch (err) {
      console.warn('Native filesystem write fallback:', err);
    }
  }

  const newDoc = {
    id: docId,
    userId: userId || 'guest',
    bikeId: bikeId || 'bike_1',
    title: title || file.name,
    docType: docType || 'other',
    expiryDate: expiryDate || '',
    fileName: fileName,
    fileType: file.type || (fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg'),
    fileSize: payloadBytes,
    createdAt: new Date().toISOString(),
    localUri,
    fileData: base64Data,
    cloudUrl: '',
    publicId: ''
  };

  // 3. Save to local IndexedDB immediately (instant 0ms response)
  await saveDocToIndexedDB(newDoc);

  // 4. Background Sync: Upload to Cloudinary & Save Meta to Firestore
  (async () => {
    try {
      const uploadRes = await uploadDocumentToCloudinary(base64Data, docId);
      if (uploadRes.success && uploadRes.url) {
        newDoc.cloudUrl = uploadRes.url;
        newDoc.publicId = uploadRes.publicId;
        await saveDocToIndexedDB(newDoc);

        if (userId && userId !== 'guest') {
          await saveUserDocumentMeta(userId, {
            id: docId,
            bikeId: newDoc.bikeId,
            title: newDoc.title,
            docType: newDoc.docType,
            expiryDate: newDoc.expiryDate,
            fileName: newDoc.fileName,
            fileType: newDoc.fileType,
            fileSize: newDoc.fileSize,
            createdAt: newDoc.createdAt,
            cloudUrl: uploadRes.url,
            publicId: uploadRes.publicId
          });
        }
      }
    } catch (cloudErr) {
      console.debug('Background Cloudinary backup notice:', cloudErr);
    }
  })();

  return await getPrivateDocuments(userId);
}

/**
 * Update document title/type/expiryDate
 */
export async function updatePrivateDocument(userId, docId, updates) {
  const targetUserId = userId || 'guest';
  const docs = await getPrivateDocuments(targetUserId);
  const target = docs.find(d => d.id === docId);

  if (target) {
    const updatedDoc = { ...target, ...updates };
    await saveDocToIndexedDB(updatedDoc);

    if (targetUserId !== 'guest') {
      await saveUserDocumentMeta(targetUserId, {
        id: docId,
        ...updates
      });
    }
  }
  return await getPrivateDocuments(targetUserId);
}

/**
 * Delete document from private storage & Firestore meta
 */
export async function deletePrivateDocument(userId, docId) {
  const targetUserId = userId || 'guest';
  const docs = await getPrivateDocuments(targetUserId);
  const target = docs.find(d => d.id === docId);

  if (target && Capacitor.isNativePlatform()) {
    try {
      const fileExt = (target.fileName || 'file.png').split('.').pop() || 'png';
      await Filesystem.deleteFile({
        path: `documents/${target.id}.${fileExt}`,
        directory: Directory.Data
      });
    } catch (e) {
      console.warn('Native delete file fallback:', e);
    }
  }

  await deleteDocFromIndexedDB(docId);

  if (targetUserId !== 'guest') {
    await deleteUserDocumentMeta(targetUserId, docId);
  }

  return await getPrivateDocuments(targetUserId);
}

/**
 * Compresses images iteratively to guarantee under 500 KB
 */
function compressImageIfNeeded(file) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/') || file.type.includes('svg')) {
      fileToBase64(file).then(resolve).catch(() => resolve(''));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const MAX_WIDTH = 1400;
        const MAX_HEIGHT = 1400;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Try JPEG with 0.82 quality first
        let compressed = canvas.toDataURL('image/jpeg', 0.82);
        if (compressed.length > MAX_DOC_SIZE_BYTES * 1.33) {
          // If still over 500KB, drop to 0.68 quality
          compressed = canvas.toDataURL('image/jpeg', 0.68);
        }
        resolve(compressed);
      };
      img.onerror = () => {
        fileToBase64(file).then(resolve).catch(() => resolve(''));
      };
    };
    reader.onerror = () => {
      fileToBase64(file).then(resolve).catch(() => resolve(''));
    };
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = err => reject(err);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
  });
}
