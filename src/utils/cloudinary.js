/**
 * Cloudinary Storage Integration for RideLog BD
 * Handles authenticated secure uploads for documents (images & PDFs)
 * Reads credentials dynamically from environment variables
 */

const CLOUDINARY_CONFIG = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'cggnxq8s',
  apiKey: import.meta.env.VITE_CLOUDINARY_API_KEY || '446334917111551',
  apiSecret: import.meta.env.VITE_CLOUDINARY_API_SECRET || 'AnlFE67JHMR4iceIbim_bD9j-1c',
  folder: import.meta.env.VITE_CLOUDINARY_FOLDER || 'ridelog_documents'
};

/**
 * Generate SHA-1 hex hash using browser Web Crypto API
 */
async function generateSHA1(str) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.error('SHA-1 hash error:', e);
    return '';
  }
}

/**
 * Upload an image or PDF file to Cloudinary with secure signature
 * @param {string|File} fileOrBase64 - Base64 Data URI or File object
 * @param {string} customPublicId - Optional public ID
 * @returns {Promise<{success: boolean, url?: string, publicId?: string, error?: string}>}
 */
export async function uploadDocumentToCloudinary(fileOrBase64, customPublicId = '') {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = CLOUDINARY_CONFIG.folder;

    let strToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
    if (customPublicId) {
      strToSign = `folder=${folder}&public_id=${customPublicId}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
    }

    const signature = await generateSHA1(strToSign);

    const formData = new FormData();
    formData.append('file', fileOrBase64);
    formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    if (customPublicId) formData.append('public_id', customPublicId);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      url: result.secure_url || result.url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes
    };
  } catch (err) {
    console.warn('Cloudinary upload warning:', err);
    return { success: false, error: err.message };
  }
}
