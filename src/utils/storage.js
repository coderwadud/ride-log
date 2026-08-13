/**
 * LocalStorage helper for RideLog BD application
 */

const STORAGE_KEYS = {
  BIKE_PROFILE: 'ridelog_bike_profile',
  FUEL_LOGS: 'ridelog_fuel_logs',
  SERVICE_LOGS: 'ridelog_service_logs',
  SETTINGS: 'ridelog_settings'
};

// Initial realistic default data (Bangladeshi bike example)
const DEFAULT_BIKE = {
  id: 'bike_1',
  name: 'Yamaha FZS V3 Deluxe',
  regNumber: 'ঢাকা মেট্রো ল-৩৫-৯৮১২',
  initialOdometer: 12000,
  currentOdometer: 14250,
  targetOilKm: 1000
};

const DEFAULT_FUEL_LOGS = [
  {
    id: 'f1',
    date: '2026-07-05',
    odometer: 12400,
    liters: 9.5,
    totalAmount: 1235,
    pricePerLiter: 130,
    isFullTank: true,
    stationName: 'মেসার্স মেঘনা ফিলিং স্টেশন, মহাখালী',
    notes: 'অক্টেন ফুল ট্যাংক'
  },
  {
    id: 'f2',
    date: '2026-07-18',
    odometer: 12820,
    liters: 9.8,
    totalAmount: 1274,
    pricePerLiter: 130,
    isFullTank: true,
    stationName: 'পদ্মা ওয়েল পাম্প, ফার্মগেট',
    notes: 'অক্টেন রিফিল'
  },
  {
    id: 'f3',
    date: '2026-08-01',
    odometer: 13240,
    liters: 9.6,
    totalAmount: 1248,
    pricePerLiter: 130,
    isFullTank: true,
    stationName: 'মেঘনা ফিলিং স্টেশন',
    notes: 'লং রাইডের পর তেলের রিফিল'
  },
  {
    id: 'f4',
    date: '2026-08-12',
    odometer: 13680,
    liters: 10.0,
    totalAmount: 1300,
    pricePerLiter: 130,
    isFullTank: true,
    stationName: 'যমুনা পেট্রোলিয়াম, উত্তরা',
    notes: 'ফুল ট্যাংক অক্টেন'
  }
];

const DEFAULT_SERVICE_LOGS = [
  {
    id: 's1',
    date: '2026-07-05',
    odometer: 12400,
    types: ['catEngineOil', 'catOilFilter', 'catChainLube'],
    serviceCost: 200,
    partsCost: 750,
    garageName: 'ইয়ামাহা ফ্ল্যাগশিপ সার্ভিস সেন্টার, তেজগাঁও',
    isEngineOilChange: true,
    notes: 'Yamalube Fully Synthetic 10W40'
  },
  {
    id: 's2',
    date: '2026-08-01',
    odometer: 13240,
    types: ['catEngineOil', 'catAirFilter', 'catBrakePad'],
    serviceCost: 350,
    partsCost: 1100,
    garageName: 'বিসমিল্লাহ বাইক কেয়ার, মিরপুর',
    isEngineOilChange: true,
    notes: 'ইঞ্জিন অয়েল ও ফন্ট ব্রেইক প্যাড চেঞ্জ'
  }
];

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
    version: '1.0',
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
