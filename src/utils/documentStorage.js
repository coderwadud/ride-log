import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const DOCS_INDEX_KEY = 'ridelog_private_documents';
const DB_NAME = 'RideLogDocumentsDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

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
 * Trigger direct download on Web and Native Mobile Share/Save sheet on Android
 */
export async function downloadOrShareDocument(doc) {
  if (!doc) return;
  const fileData = doc.fileData || doc.localUri;
  if (!fileData) return;

  const extension = doc.fileName ? doc.fileName.split('.').pop() : (doc.fileType?.includes('pdf') ? 'pdf' : 'png');
  const fileName = doc.fileName || `${doc.title}.${extension}`;

  if (Capacitor.isNativePlatform()) {
    try {
      const cleanBase64 = fileData.replace(/^data:.*?;base64,/, '');
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
    } catch (err) {
      console.warn('Native share/download fallback:', err);
      triggerWebDownload(fileData, fileName);
    }
  } else {
    triggerWebDownload(fileData, fileName);
  }
}

function triggerWebDownload(fileData, fileName) {
  try {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error('Web download error:', e);
  }
}

/**
 * Get list of private documents for user (IndexedDB primary + automatic migration)
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
    // Clean legacy localStorage heavy data to prevent localStorage quota errors
    try {
      localStorage.removeItem(`${DOCS_INDEX_KEY}_${targetUserId}`);
    } catch (e) {}

    // Re-fetch from IndexedDB after migration
    docs = await fetchDocsFromIndexedDB(targetUserId);
  }

  // Migration step 2: If user logged in (targetUserId !== 'guest'), check if any guest docs exist to migrate
  if (targetUserId !== 'guest') {
    const guestDocs = await fetchDocsFromIndexedDB('guest');
    if (guestDocs.length > 0) {
      for (const guestDoc of guestDocs) {
        const migratedDoc = { ...guestDoc, userId: targetUserId };
        await saveDocToIndexedDB(migratedDoc);
        await deleteDocFromIndexedDB(guestDoc.id);
      }
      docs = await fetchDocsFromIndexedDB(targetUserId);
    }
  }

  // Fallback to legacy if IndexedDB returns empty and there's something in fallback
  if (docs.length === 0) {
    docs = getLegacyLocalStorageDocs(targetUserId);
  }

  // Sort by createdAt descending
  docs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return docs;
}

/**
 * Save file privately in App Internal Sandboxed Storage / IndexedDB
 */
export async function addPrivateDocument({ userId, bikeId, title, docType, file }) {
  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const base64Data = await compressImageIfNeeded(file);
  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `${docId}.${fileExt}`;

  let localUri = '';

  if (Capacitor.isNativePlatform()) {
    try {
      const writeResult = await Filesystem.writeFile({
        path: `documents/${fileName}`,
        data: base64Data.replace(/^data:.*?;base64,/, ''),
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
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    createdAt: new Date().toISOString(),
    localUri,
    fileData: base64Data
  };

  await saveDocToIndexedDB(newDoc);
  return await getPrivateDocuments(userId);
}

/**
 * Update document title/type
 */
export async function updatePrivateDocument(userId, docId, updates) {
  const targetUserId = userId || 'guest';
  const docs = await getPrivateDocuments(targetUserId);
  const target = docs.find(d => d.id === docId);

  if (target) {
    const updatedDoc = { ...target, ...updates };
    await saveDocToIndexedDB(updatedDoc);
  }
  return await getPrivateDocuments(targetUserId);
}

/**
 * Delete document from private storage
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
  return await getPrivateDocuments(targetUserId);
}

/**
 * Helper to compress images before converting to Base64 (reduces 15MB camera photos to crisp ~300KB)
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
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
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

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        resolve(compressedBase64);
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
