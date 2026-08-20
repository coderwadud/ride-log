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
  lang: 'bn',
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
 * Helper to parse a CSV line properly handling double quotes and commas
 */
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Parses CSV format (e.g. from fuel logs / excel export) to RideLog standard structure
 * CSV columns supported: type, odo/odometer, date, total cost/amount, volume/liters, unit price/price, notes/station
 */
export function parseCSVToRideLogData(csvString, bikeId = 'bike_1') {
  if (!csvString || typeof csvString !== 'string') return null;

  const lines = csvString
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return null;

  const headerLine = lines[0].toLowerCase();
  const isCSVHeader = headerLine.includes('type') && (headerLine.includes('odo') || headerLine.includes('date') || headerLine.includes('cost'));
  const dataLines = isCSVHeader ? lines.slice(1) : lines;

  let colIndex = {
    type: 0,
    odo: 1,
    date: 2,
    totalCost: 3,
    volume: 4,
    unitPrice: 5,
    notes: 6
  };

  if (isCSVHeader) {
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));
    headers.forEach((h, idx) => {
      if (h === 'type') colIndex.type = idx;
      else if (h === 'odo' || h === 'odometer') colIndex.odo = idx;
      else if (h === 'date') colIndex.date = idx;
      else if (h === 'totalcost' || h === 'total' || h === 'amount' || h === 'cost') colIndex.totalCost = idx;
      else if (h === 'volume' || h === 'liters' || h === 'litre' || h === 'litres' || h === 'quantity') colIndex.volume = idx;
      else if (h === 'unitprice' || h === 'price' || h === 'priceperliter' || h === 'rate') colIndex.unitPrice = idx;
      else if (h === 'notes' || h === 'note' || h === 'station' || h === 'stationname' || h === 'comment') colIndex.notes = idx;
    });
  }

  const fuelLogs = [];
  const serviceLogs = [];
  const baseTimestamp = Date.now();

  dataLines.forEach((line, index) => {
    const cols = parseCSVLine(line);
    if (!cols || cols.length === 0) return;

    const rowType = (cols[colIndex.type] || 'fuel').toLowerCase().trim();
    const rawOdo = parseFloat(cols[colIndex.odo]) || 0;
    const rawDate = (cols[colIndex.date] || new Date().toISOString().slice(0, 10)).trim();
    const rawTotalCost = parseFloat(cols[colIndex.totalCost]) || 0;
    const rawVolume = parseFloat(cols[colIndex.volume]) || 0;
    const rawUnitPrice = parseFloat(cols[colIndex.unitPrice]) || 0;
    const rawNotes = (cols[colIndex.notes] || '').trim();

    const uniqueIdSuffix = `${baseTimestamp - (index * 1000)}`;

    if (rowType === 'fuel') {
      let liters = rawVolume;
      let unitPrice = rawUnitPrice;
      let total = rawTotalCost;

      if (!unitPrice && liters && total) {
        unitPrice = parseFloat((total / liters).toFixed(2));
      }
      if (!total && liters && unitPrice) {
        total = parseFloat((liters * unitPrice).toFixed(2));
      }
      if (!liters && total && unitPrice) {
        liters = parseFloat((total / unitPrice).toFixed(2));
      }

      fuelLogs.push({
        id: `fuel_${uniqueIdSuffix}`,
        bikeId: bikeId || 'bike_1',
        date: rawDate,
        odometer: rawOdo,
        liters: liters || 0,
        pricePerLiter: unitPrice || 145,
        totalAmount: total || 0,
        isFullTank: true,
        stationName: rawNotes,
        notes: rawNotes
      });
    } else if (rowType === 'service') {
      const isOil = /oil|10w|20w|mobil|lubricant/i.test(rawNotes);
      serviceLogs.push({
        id: `service_${uniqueIdSuffix}`,
        bikeId: bikeId || 'bike_1',
        date: rawDate,
        odometer: rawOdo,
        serviceCost: rawTotalCost || 0,
        partsCost: 0,
        garageName: rawNotes,
        types: isOil ? ['catEngineOil'] : ['catOther'],
        isEngineOilChange: isOil,
        notes: rawNotes
      });
    }
  });

  return { fuelLogs, serviceLogs };
}

/**
 * Import backup (JSON or CSV) and MERGE with existing data (add entries, don't replace)
 * Duplicate entries (same id or same date + odometer + totalAmount + bikeId) are skipped
 */
export function mergeImportBackupData(fileContent, currentData) {
  try {
    let backup = null;
    const activeBikeId = (currentData && currentData.activeBikeId) || loadActiveBikeId();

    if (typeof fileContent === 'object' && fileContent !== null) {
      backup = fileContent;
    } else if (typeof fileContent === 'string') {
      const trimmed = fileContent.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        backup = JSON.parse(trimmed);
      } else {
        // Parse as CSV
        const csvData = parseCSVToRideLogData(trimmed, activeBikeId);
        if (csvData && (csvData.fuelLogs?.length > 0 || csvData.serviceLogs?.length > 0)) {
          backup = {
            fuelLogs: csvData.fuelLogs,
            serviceLogs: csvData.serviceLogs
          };
        } else {
          return { success: false, message: 'Invalid CSV or JSON backup file' };
        }
      }
    }

    if (!backup || typeof backup !== 'object') {
      return { success: false, message: 'Invalid backup file' };
    }

    const existingBikes = (currentData && Array.isArray(currentData.bikes)) ? currentData.bikes : loadBikes();
    const existingFuel = (currentData && Array.isArray(currentData.fuelLogs)) ? currentData.fuelLogs : loadFuelLogs();
    const existingService = (currentData && Array.isArray(currentData.serviceLogs)) ? currentData.serviceLogs : loadServiceLogs();

    let mergedBikes = [...existingBikes];
    let mergedActiveBikeId = (currentData && currentData.activeBikeId) || loadActiveBikeId();
    let mergedFuelLogs = [...existingFuel];
    let mergedServiceLogs = [...existingService];

    // Merge bikes list - skip duplicates by id
    if (backup.bikes && Array.isArray(backup.bikes)) {
      const existingBikeIds = new Set(mergedBikes.map(b => b.id));
      const newBikes = backup.bikes.filter(b => b && b.id && !existingBikeIds.has(b.id));
      if (newBikes.length > 0) {
        mergedBikes = [...mergedBikes, ...newBikes];
      }
    } else if (backup.bikeProfile && backup.bikeProfile.id) {
      // Legacy single bike merge
      if (!mergedBikes.some(b => b.id === backup.bikeProfile.id)) {
        mergedBikes.push(backup.bikeProfile);
      }
    }

    if (backup.activeBikeId) {
      mergedActiveBikeId = backup.activeBikeId;
    }

    // Merge fuel logs - skip duplicates by id or exact match (date + odometer + totalAmount + bikeId)
    if (backup.fuelLogs && Array.isArray(backup.fuelLogs)) {
      const existingIds = new Set(mergedFuelLogs.map(l => l.id));
      const newLogs = backup.fuelLogs
        .filter(l => {
          if (!l) return false;
          if (l.id && existingIds.has(l.id)) return false;
          const targetBikeId = l.bikeId || mergedActiveBikeId;
          const isDuplicate = mergedFuelLogs.some(ef => 
            (ef.bikeId || 'bike_1') === targetBikeId &&
            ef.date === l.date &&
            Number(ef.odometer) === Number(l.odometer) &&
            Math.abs(Number(ef.totalAmount) - Number(l.totalAmount)) < 0.01
          );
          return !isDuplicate;
        })
        .map(l => ({ ...l, bikeId: l.bikeId || mergedActiveBikeId }));

      mergedFuelLogs = [...mergedFuelLogs, ...newLogs];
    }
    
    // Merge service logs - skip duplicates by id or exact match (date + odometer + serviceCost + bikeId)
    if (backup.serviceLogs && Array.isArray(backup.serviceLogs)) {
      const existingIds = new Set(mergedServiceLogs.map(l => l.id));
      const newLogs = backup.serviceLogs
        .filter(l => {
          if (!l) return false;
          if (l.id && existingIds.has(l.id)) return false;
          const targetBikeId = l.bikeId || mergedActiveBikeId;
          const isDuplicate = mergedServiceLogs.some(es => 
            (es.bikeId || 'bike_1') === targetBikeId &&
            es.date === l.date &&
            Number(es.odometer) === Number(l.odometer) &&
            Math.abs(Number(es.serviceCost || 0) - Number(l.serviceCost || 0)) < 0.01
          );
          return !isDuplicate;
        })
        .map(l => ({ ...l, bikeId: l.bikeId || mergedActiveBikeId }));

      mergedServiceLogs = [...mergedServiceLogs, ...newLogs];
    }

    // Sort logs newest first
    mergedFuelLogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    mergedServiceLogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // Save to LocalStorage
    saveBikes(mergedBikes);
    saveActiveBikeId(mergedActiveBikeId);
    saveFuelLogs(mergedFuelLogs);
    saveServiceLogs(mergedServiceLogs);
    if (backup.settings) saveSettings(backup.settings);

    return {
      success: true,
      message: 'Data merged successfully',
      data: {
        bikes: mergedBikes,
        activeBikeId: mergedActiveBikeId,
        fuelLogs: mergedFuelLogs,
        serviceLogs: mergedServiceLogs,
        settings: backup.settings
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

    saveBikes(newBikes);
    saveActiveBikeId(newActiveId);
    saveFuelLogs(newFuel);
    saveServiceLogs(newService);
    if (backup.settings) saveSettings(backup.settings);

    return {
      success: true,
      data: {
        bikes: newBikes,
        activeBikeId: newActiveId,
        fuelLogs: newFuel,
        serviceLogs: newService,
        settings: backup.settings
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
