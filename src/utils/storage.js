/**
 * LocalStorage helper for RideLog BD application
 */

const STORAGE_KEYS = {
  BIKES: 'ridelog_bikes',
  ACTIVE_BIKE_ID: 'ridelog_active_bike_id',
  BIKE_PROFILE: 'ridelog_bike_profile', // Legacy fallback
  FUEL_LOGS: 'ridelog_fuel_logs',
  SERVICE_LOGS: 'ridelog_service_logs',
  SETTINGS: 'ridelog_settings',
  GDRIVE_USER: 'ridelog_gdrive_user'
};

// Default empty initial bike
const DEFAULT_BIKE = {
  id: 'bike_1',
  name: 'My Bike',
  regNumber: '',
  initialOdometer: 0,
  currentOdometer: 0,
  targetOilKm: 1000
};

const DEFAULT_BIKES = [DEFAULT_BIKE];
const DEFAULT_FUEL_LOGS = [];
const DEFAULT_SERVICE_LOGS = [];

const DEFAULT_SETTINGS = {
  lang: 'en',
  theme: 'dark'
};

/** Load all bikes array with automatic legacy migration */
export function loadBikes() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BIKES);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // Legacy migration check: load old single BIKE_PROFILE if present
    const oldSingle = localStorage.getItem(STORAGE_KEYS.BIKE_PROFILE);
    if (oldSingle) {
      const parsedOld = JSON.parse(oldSingle);
      const migratedBikes = [{
        id: parsedOld.id || 'bike_1',
        name: parsedOld.name || 'My Bike',
        regNumber: parsedOld.regNumber || '',
        initialOdometer: Number(parsedOld.initialOdometer || 0),
        currentOdometer: Number(parsedOld.currentOdometer || 0),
        targetOilKm: Number(parsedOld.targetOilKm || 1000)
      }];
      saveBikes(migratedBikes);
      return migratedBikes;
    }

    return DEFAULT_BIKES;
  } catch (e) {
    console.error('Failed to load bikes list:', e);
    return DEFAULT_BIKES;
  }
}

export function saveBikes(bikes) {
  try {
    const list = Array.isArray(bikes) && bikes.length > 0 ? bikes : DEFAULT_BIKES;
    localStorage.setItem(STORAGE_KEYS.BIKES, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save bikes list:', e);
  }
}

export function loadActiveBikeId() {
  try {
    const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_BIKE_ID);
    if (activeId) return activeId;
    const bikes = loadBikes();
    return bikes[0]?.id || 'bike_1';
  } catch (e) {
    return 'bike_1';
  }
}

export function saveActiveBikeId(bikeId) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_BIKE_ID, bikeId);
  } catch (e) {
    console.error('Failed to save active bike id:', e);
  }
}

export function loadBikeProfile() {
  const bikes = loadBikes();
  const activeId = loadActiveBikeId();
  return bikes.find(b => b.id === activeId) || bikes[0] || DEFAULT_BIKE;
}

export function saveBikeProfile(profile) {
  try {
    const bikes = loadBikes();
    const activeId = loadActiveBikeId();
    const index = bikes.findIndex(b => b.id === activeId);
    let updatedBikes = [];
    if (index >= 0) {
      updatedBikes = [...bikes];
      updatedBikes[index] = { ...updatedBikes[index], ...profile };
    } else {
      updatedBikes = [...bikes, { ...DEFAULT_BIKE, ...profile, id: activeId }];
    }
    saveBikes(updatedBikes);
  } catch (e) {
    console.error('Failed to save bike profile:', e);
  }
}

export function loadFuelLogs() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FUEL_LOGS);
    if (!data) return DEFAULT_FUEL_LOGS;
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return DEFAULT_FUEL_LOGS;
    // Ensure every log has a bikeId
    return parsed.map(log => ({
      ...log,
      bikeId: log.bikeId || 'bike_1'
    }));
  } catch (e) {
    console.error('Failed to load fuel logs:', e);
    return DEFAULT_FUEL_LOGS;
  }
}

export function saveFuelLogs(logs) {
  try {
    localStorage.setItem(STORAGE_KEYS.FUEL_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save fuel logs:', e);
  }
}

export function loadServiceLogs() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SERVICE_LOGS);
    if (!data) return DEFAULT_SERVICE_LOGS;
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return DEFAULT_SERVICE_LOGS;
    // Ensure every log has a bikeId
    return parsed.map(log => ({
      ...log,
      bikeId: log.bikeId || 'bike_1'
    }));
  } catch (e) {
    console.error('Failed to load service logs:', e);
    return DEFAULT_SERVICE_LOGS;
  }
}

export function saveServiceLogs(logs) {
  try {
    localStorage.setItem(STORAGE_KEYS.SERVICE_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save service logs:', e);
  }
}

export function loadSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function loadGDriveUser() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GDRIVE_USER);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

export function saveGDriveUser(user) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.GDRIVE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.GDRIVE_USER);
    }
  } catch (e) {
    console.error('Failed to save GDrive user:', e);
  }
}

// Get raw backup JSON object/string
export function getBackupJsonObject(customData) {
  if (customData && typeof customData === 'object') {
    return {
      version: '3.0',
      exportDate: new Date().toISOString(),
      bikes: customData.bikes || loadBikes(),
      activeBikeId: customData.activeBikeId || loadActiveBikeId(),
      bikeProfile: customData.bikeProfile || (customData.bikes ? customData.bikes.find(b => b.id === (customData.activeBikeId || loadActiveBikeId())) : loadBikeProfile()),
      fuelLogs: customData.fuelLogs || loadFuelLogs(),
      serviceLogs: customData.serviceLogs || loadServiceLogs(),
      settings: customData.settings || loadSettings()
    };
  }
  return {
    version: '3.0',
    exportDate: new Date().toISOString(),
    bikes: loadBikes(),
    activeBikeId: loadActiveBikeId(),
    bikeProfile: loadBikeProfile(),
    fuelLogs: loadFuelLogs(),
    serviceLogs: loadServiceLogs(),
    settings: loadSettings()
  };
}

export function getBackupJsonString(customData) {
  return JSON.stringify(getBackupJsonObject(customData), null, 2);
}

// Backup & Restore (Android App Native Share + Filesystem Compatible)
export async function exportBackupData(customData) {
  const jsonStr = getBackupJsonString(customData);
  const fileName = `ridelog_backup_${new Date().toISOString().slice(0, 10)}.json`;

  // Also sync to localStorage so local fallback stays fresh
  if (customData) {
    if (customData.bikes) saveBikes(customData.bikes);
    if (customData.activeBikeId) saveActiveBikeId(customData.activeBikeId);
    if (customData.fuelLogs) saveFuelLogs(customData.fuelLogs);
    if (customData.serviceLogs) saveServiceLogs(customData.serviceLogs);
    if (customData.settings) saveSettings(customData.settings);
  }

  // 1. Try Capacitor Native Filesystem + Share (100% works on Android APK!)
  try {
    const { Share } = await import('@capacitor/share');
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');

    const writeResult = await Filesystem.writeFile({
      path: fileName,
      data: jsonStr,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });

    if (writeResult && writeResult.uri) {
      await Share.share({
        title: 'RideLog BD Backup',
        text: 'RideLog BD Backup File',
        url: writeResult.uri,
        dialogTitle: 'Save / Share Backup File'
      });
      return { success: true, method: 'native-share', jsonStr };
    }
  } catch (e) {
    console.log('Capacitor native share/filesystem attempt:', e);
  }

  // 2. Try Web Share API (Android browser share sheet)
  if (navigator.share) {
    try {
      const file = new File([jsonStr], fileName, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'RideLog BD Backup',
          files: [file]
        });
        return { success: true, method: 'web-share', jsonStr };
      }
    } catch (e) {
      console.log('Web share file failed:', e);
    }
  }

  // 3. Data URL download fallback (for desktop / browsers)
  try {
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);
    return { success: true, method: 'download', jsonStr };
  } catch (e) {
    console.error('Data URL download failed:', e);
  }

  // 4. Last fallback: Copy JSON to clipboard
  try {
    await navigator.clipboard.writeText(jsonStr);
    return { success: true, method: 'clipboard', jsonStr };
  } catch (e) {
    return { success: false, jsonStr };
  }
}

/**
 * Import backup and MERGE with existing data (add entries & update profile info)
 */
export function mergeImportBackupData(jsonString, currentData) {
  try {
    const backup = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!backup || typeof backup !== 'object') {
      return { success: false, message: 'Invalid backup file' };
    }

    const existingBikes = (currentData && Array.isArray(currentData.bikes)) ? currentData.bikes : loadBikes();
    const existingFuel = (currentData && Array.isArray(currentData.fuelLogs)) ? currentData.fuelLogs : loadFuelLogs();
    const existingService = (currentData && Array.isArray(currentData.serviceLogs)) ? currentData.serviceLogs : loadServiceLogs();

    // 1. Merge & Update Bikes (Update existing bike properties like name, regNumber, initialOdometer + add new bikes)
    const bikeMap = new Map();
    existingBikes.forEach(b => { if (b && b.id) bikeMap.set(b.id, { ...b }); });

    if (backup.bikes && Array.isArray(backup.bikes)) {
      backup.bikes.forEach(b => {
        if (b && b.id) {
          const existing = bikeMap.get(b.id) || {};
          bikeMap.set(b.id, { ...existing, ...b });
        }
      });
    } else if (backup.bikeProfile && backup.bikeProfile.id) {
      const existing = bikeMap.get(backup.bikeProfile.id) || {};
      bikeMap.set(backup.bikeProfile.id, { ...existing, ...backup.bikeProfile });
    }

    let mergedBikes = Array.from(bikeMap.values());
    if (mergedBikes.length === 0) mergedBikes = DEFAULT_BIKES;

    let mergedActiveBikeId = backup.activeBikeId || (currentData && currentData.activeBikeId) || loadActiveBikeId();
    if (!mergedBikes.some(b => b.id === mergedActiveBikeId)) {
      mergedActiveBikeId = mergedBikes[0].id;
    }

    // 2. Merge Fuel Logs (by ID)
    let mergedFuelLogs = [...existingFuel];
    if (backup.fuelLogs && Array.isArray(backup.fuelLogs)) {
      const existingIds = new Set(mergedFuelLogs.map(l => l.id));
      const newLogs = backup.fuelLogs
        .filter(l => l && l.id && !existingIds.has(l.id))
        .map(l => ({ ...l, bikeId: l.bikeId || 'bike_1' }));
      mergedFuelLogs = [...mergedFuelLogs, ...newLogs];
    }
    
    // 3. Merge Service Logs (by ID)
    let mergedServiceLogs = [...existingService];
    if (backup.serviceLogs && Array.isArray(backup.serviceLogs)) {
      const existingIds = new Set(mergedServiceLogs.map(l => l.id));
      const newLogs = backup.serviceLogs
        .filter(l => l && l.id && !existingIds.has(l.id))
        .map(l => ({ ...l, bikeId: l.bikeId || 'bike_1' }));
      mergedServiceLogs = [...mergedServiceLogs, ...newLogs];
    }

    // 4. Settings & Language/Theme
    const mergedSettings = {
      ...loadSettings(),
      ...(backup.settings || {})
    };

    // Save to LocalStorage
    saveBikes(mergedBikes);
    saveActiveBikeId(mergedActiveBikeId);
    saveFuelLogs(mergedFuelLogs);
    saveServiceLogs(mergedServiceLogs);
    saveSettings(mergedSettings);

    return {
      success: true,
      message: 'Data merged successfully',
      data: {
        bikes: mergedBikes,
        activeBikeId: mergedActiveBikeId,
        fuelLogs: mergedFuelLogs,
        serviceLogs: mergedServiceLogs,
        settings: mergedSettings
      }
    };
  } catch (e) {
    console.error('Invalid backup file:', e);
    return { success: false, message: 'Invalid backup file' };
  }
}

/** Full replace import (overwrites all existing data) */
export function importBackupData(jsonString) {
  try {
    const backup = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!backup || typeof backup !== 'object') return { success: false };

    const newBikes = backup.bikes && Array.isArray(backup.bikes) ? backup.bikes : (backup.bikeProfile ? [backup.bikeProfile] : DEFAULT_BIKES);
    const newActiveId = backup.activeBikeId || newBikes[0]?.id || 'bike_1';
    const newFuel = backup.fuelLogs && Array.isArray(backup.fuelLogs) ? backup.fuelLogs : [];
    const newService = backup.serviceLogs && Array.isArray(backup.serviceLogs) ? backup.serviceLogs : [];
    const newSettings = backup.settings || loadSettings();

    saveBikes(newBikes);
    saveActiveBikeId(newActiveId);
    saveFuelLogs(newFuel);
    saveServiceLogs(newService);
    saveSettings(newSettings);

    return {
      success: true,
      data: {
        bikes: newBikes,
        activeBikeId: newActiveId,
        fuelLogs: newFuel,
        serviceLogs: newService,
        settings: newSettings
      }
    };
  } catch (e) {
    console.error('Invalid backup file:', e);
    return { success: false };
  }
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.BIKES);
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_BIKE_ID);
  localStorage.removeItem(STORAGE_KEYS.BIKE_PROFILE);
  localStorage.removeItem(STORAGE_KEYS.FUEL_LOGS);
  localStorage.removeItem(STORAGE_KEYS.SERVICE_LOGS);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.GDRIVE_USER);
}
