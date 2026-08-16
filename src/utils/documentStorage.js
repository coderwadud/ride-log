import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const DOCS_INDEX_KEY = 'ridelog_private_documents';

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
 * Get list of private documents for user
 */
export async function getPrivateDocuments(userId) {
  try {
    const raw = localStorage.getItem(`${DOCS_INDEX_KEY}_${userId || 'guest'}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to get private documents:', e);
    return [];
  }
}

/**
 * Save documents metadata index
 */
async function saveDocumentsIndex(userId, docs) {
  try {
    localStorage.setItem(`${DOCS_INDEX_KEY}_${userId || 'guest'}`, JSON.stringify(docs));
  } catch (e) {
    console.error('Failed to save documents index:', e);
  }
}

/**
 * Save file privately in App Internal Sandboxed Storage (Directory.Data)
 * Hidden from phone gallery and file manager.
 */
export async function addPrivateDocument({ userId, bikeId, title, docType, file }) {
  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const base64Data = await fileToBase64(file);
  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `${docId}.${fileExt}`;

  let localUri = '';

  if (Capacitor.isNativePlatform()) {
    try {
      // Save inside App's private internal storage (/data/user/0/com.ridelog.app/files/documents)
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
    bikeId: bikeId || 'bike_1',
    title: title || file.name,
    docType: docType || 'other',
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    createdAt: new Date().toISOString(),
    localUri,
    fileData: base64Data // Private in-app Base64 string for instant preview
  };

  const existing = await getPrivateDocuments(userId);
  const updated = [newDoc, ...existing];
  await saveDocumentsIndex(userId, updated);

  return updated;
}

/**
 * Update document title/type
 */
export async function updatePrivateDocument(userId, docId, updates) {
  const existing = await getPrivateDocuments(userId);
  const updated = existing.map(d => (d.id === docId ? { ...d, ...updates } : d));
  await saveDocumentsIndex(userId, updated);
  return updated;
}

/**
 * Delete document from private storage
 */
export async function deletePrivateDocument(userId, docId) {
  const existing = await getPrivateDocuments(userId);
  const target = existing.find(d => d.id === docId);

  if (target && Capacitor.isNativePlatform()) {
    try {
      const fileExt = target.fileName.split('.').pop() || 'png';
      await Filesystem.deleteFile({
        path: `documents/${target.id}.${fileExt}`,
        directory: Directory.Data
      });
    } catch (e) {
      console.warn('Native delete file fallback:', e);
    }
  }

  const updated = existing.filter(d => d.id !== docId);
  await saveDocumentsIndex(userId, updated);
  return updated;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = err => reject(err);
  });
}
