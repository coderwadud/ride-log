/**
 * LocalStorage helper for RideLog BD application
 */

const STORAGE_KEYS = {
  BIKE_PROFILE: 'ridelog_bike_profile',
  FUEL_LOGS: 'ridelog_fuel_logs',
  SERVICE_LOGS: 'ridelog_service_logs',
  SETTINGS: 'ridelog_settings'
};

// Default empty initial state
const DEFAULT_BIKE = {
  id: 'bike_1',
  name: 'My Bike',
  regNumber: '',
  initialOdometer: 0,
  currentOdometer: 0,
  targetOilKm: 1000
};

const DEFAULT_FUEL_LOGS = [];

const DEFAULT_SERVICE_LOGS = [];

const DEFAULT_SETTINGS = {
  lang: 'bn',
  theme: 'dark'
};

export function loadBikeProfile() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BIKE_PROFILE);
    return data ? JSON.parse(data) : DEFAULT_BIKE;
  } catch (e) {
    console.error('Failed to load bike profile:', e);
    return DEFAULT_BIKE;
  }
}

export function saveBikeProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEYS.BIKE_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save bike profile:', e);
  }
}

export function loadFuelLogs() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FUEL_LOGS);
    return data ? JSON.parse(data) : DEFAULT_FUEL_LOGS;
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
    return data ? JSON.parse(data) : DEFAULT_SERVICE_LOGS;
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

// Backup & Restore
export function exportBackupData() {
  const backup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    bikeProfile: loadBikeProfile(),
    fuelLogs: loadFuelLogs(),
    serviceLogs: loadServiceLogs(),
    settings: loadSettings()
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ridelog_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import backup and MERGE with existing data (add entries, don't replace)
 * Duplicate entries (same id) are skipped
 */
export function mergeImportBackupData(jsonString) {
  try {
    const backup = JSON.parse(jsonString);
    
    // Merge fuel logs - skip duplicates by id
    if (backup.fuelLogs && Array.isArray(backup.fuelLogs)) {
      const existing = loadFuelLogs();
      const existingIds = new Set(existing.map(l => l.id));
      const newLogs = backup.fuelLogs.filter(l => !existingIds.has(l.id));
      saveFuelLogs([...existing, ...newLogs]);
    }
    
    // Merge service logs - skip duplicates by id
    if (backup.serviceLogs && Array.isArray(backup.serviceLogs)) {
      const existing = loadServiceLogs();
      const existingIds = new Set(existing.map(l => l.id));
      const newLogs = backup.serviceLogs.filter(l => !existingIds.has(l.id));
      saveServiceLogs([...existing, ...newLogs]);
    }

    // Bike profile: only update if current is default/empty
    if (backup.bikeProfile) {
      const current = loadBikeProfile();
      if (!current.regNumber && !current.currentOdometer) {
        saveBikeProfile(backup.bikeProfile);
      }
    }

    return { success: true, message: 'Data merged successfully' };
  } catch (e) {
    console.error('Invalid backup file:', e);
    return { success: false, message: 'Invalid backup file' };
  }
}

/** Full replace import (overwrites all existing data) */
export function importBackupData(jsonString) {
  try {
    const backup = JSON.parse(jsonString);
    if (backup.bikeProfile) saveBikeProfile(backup.bikeProfile);
    if (backup.fuelLogs) saveFuelLogs(backup.fuelLogs);
    if (backup.serviceLogs) saveServiceLogs(backup.serviceLogs);
    if (backup.settings) saveSettings(backup.settings);
    return true;
  } catch (e) {
    console.error('Invalid backup file:', e);
    return false;
  }
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.BIKE_PROFILE);
  localStorage.removeItem(STORAGE_KEYS.FUEL_LOGS);
  localStorage.removeItem(STORAGE_KEYS.SERVICE_LOGS);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
}
