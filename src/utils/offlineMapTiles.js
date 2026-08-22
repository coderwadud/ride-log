/**
 * Offline Map Tile Caching Engine
 * High-performance IndexedDB storage for Leaflet map tiles.
 * Caches every viewed map tile automatically for 100% offline navigation.
 */

const DB_NAME = 'ridelog_map_tiles_v1';
const STORE_NAME = 'tiles';
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Open or initialize IndexedDB for Map Tiles
 */
function getTileDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.warn('IndexedDB tile cache failed to open:', request.error);
      resolve(null);
    };
  });

  return dbPromise;
}

/**
 * Get a cached tile Blob from IndexedDB
 */
export async function getCachedTile(key) {
  try {
    const db = await getTileDb();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Save a tile Blob to IndexedDB
 */
export async function saveCachedTile(key, blob) {
  try {
    const db = await getTileDb();
    if (!db || !blob) return;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    // Ignore storage quota or offline errors
  }
}

/**
 * Get total number of cached map tiles
 */
export async function getCachedTilesCount() {
  try {
    const db = await getTileDb();
    if (!db) return 0;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();

      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Clear all cached map tiles
 */
export async function clearMapTilesCache() {
  try {
    const db = await getTileDb();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Create a Custom Leaflet Offline Cached TileLayer
 * @param {object} L - Leaflet global or imported instance
 * @param {string} urlTemplate - Tile URL template (e.g. OpenStreetMap)
 * @param {object} options - Leaflet TileLayer options
 */
export function createOfflineCachedTileLayer(L, urlTemplate, options = {}) {
  if (!L || !L.TileLayer) return null;

  const OfflineLayer = L.TileLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement('img');
      tile.alt = '';
      tile.setAttribute('role', 'presentation');

      const url = this.getTileUrl(coords);
      const cacheKey = `${coords.z}_${coords.x}_${coords.y}_${this.options.layerKey || 'def'}`;

      let isCleanedUp = false;

      // 1. First check IndexedDB cache (works 0ms offline)
      getCachedTile(cacheKey).then((cachedBlob) => {
        if (isCleanedUp) return;

        if (cachedBlob) {
          const objectUrl = URL.createObjectURL(cachedBlob);
          tile.src = objectUrl;
          tile.onload = () => {
            done(null, tile);
          };
          tile.onerror = (e) => {
            done(e, tile);
          };
          return;
        }

        // 2. Not in cache -> Try online fetch and save to cache
        if (navigator.onLine) {
          fetch(url, { mode: 'cors' })
            .then((res) => {
              if (!res.ok) throw new Error('Tile fetch failed');
              return res.blob();
            })
            .then((blob) => {
              if (isCleanedUp) return;
              saveCachedTile(cacheKey, blob);
              const objectUrl = URL.createObjectURL(blob);
              tile.src = objectUrl;
              tile.onload = () => done(null, tile);
              tile.onerror = (e) => done(e, tile);
            })
            .catch(() => {
              // Direct fallback without CORS
              tile.src = url;
              tile.onload = () => done(null, tile);
              tile.onerror = (e) => {
                // Show clean subtle fallback tile instead of broken icon
                tile.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%231e293b" opacity="0.15"/></svg>';
                done(null, tile);
              };
            });
        } else {
          // Completely offline and not in cache -> Clean placeholder
          tile.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%231e293b" opacity="0.15"/></svg>';
          done(null, tile);
        }
      });

      return tile;
    }
  });

  return new OfflineLayer(urlTemplate, {
    maxZoom: 19,
    ...options
  });
}
