import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import FuelLogsTab from './components/FuelLogsTab';
import ServiceLogsTab from './components/ServiceLogsTab';
import AnalyticsTab from './components/AnalyticsTab';
import FuelModal from './components/FuelModal';
import ServiceModal from './components/ServiceModal';
import BikeModal from './components/BikeModal';
import PWAInstallModal from './components/PWAInstallModal';
import BikeSelector from './components/BikeSelector';

import { 
  loadBikes,
  saveBikes,
  loadActiveBikeId,
  saveActiveBikeId,
  loadBikeProfile, 
  saveBikeProfile, 
  loadFuelLogs, 
  saveFuelLogs, 
  loadServiceLogs, 
  saveServiceLogs, 
  loadSettings, 
  saveSettings,
  loadGDriveUser,
  exportBackupData,
  mergeImportBackupData,
  loadFuelLogs as reloadFuelLogs,
  loadServiceLogs as reloadServiceLogs,
  clearAllData
} from './utils/storage';

import { 
  syncWithGDrive, 
  requestGoogleDriveLogin, 
  clearGDriveToken, 
  isGDriveTokenValid 
} from './utils/gdrive';

import { 
  calculateFuelLogStats, 
  calculateServiceStats 
} from './utils/calculations';

import { translations } from './utils/translations';
import { LayoutDashboard, Fuel, Wrench, BarChart3 } from 'lucide-react';

export default function App() {
  const initialSettings = loadSettings();
  const [lang, setLang] = useState(initialSettings?.lang || 'bn');
  const [theme, setTheme] = useState(initialSettings?.theme || 'dark');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Multi-Bike Core States
  const [bikes, setBikes] = useState(loadBikes());
  const [activeBikeId, setActiveBikeId] = useState(loadActiveBikeId());

  // Core Data States
  const [fuelLogs, setFuelLogs] = useState(loadFuelLogs());
  const [serviceLogs, setServiceLogs] = useState(loadServiceLogs());

  // Google Drive Cloud Sync State
  const [gdriveUser, setGDriveUser] = useState(loadGDriveUser());
  const [gdriveSyncing, setGDriveSyncing] = useState(false);

  // Active Bike Profile
  const activeBike = bikes.find(b => b.id === activeBikeId) || bikes[0] || {
    id: 'bike_1',
    name: 'My Bike',
    regNumber: '',
    initialOdometer: 0,
    currentOdometer: 0,
    targetOilKm: 1000
  };

  // Modal States
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [editingFuelData, setEditingFuelData] = useState(null);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingServiceData, setEditingServiceData] = useState(null);

  const [isBikeModalOpen, setIsBikeModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // PWA Install Event
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Save to LocalStorage whenever data changes
  useEffect(() => {
    saveBikes(bikes);
  }, [bikes]);

  useEffect(() => {
    saveActiveBikeId(activeBikeId);
  }, [activeBikeId]);

  useEffect(() => {
    saveFuelLogs(fuelLogs);
  }, [fuelLogs]);

  useEffect(() => {
    saveServiceLogs(serviceLogs);
  }, [serviceLogs]);

  // Background Google Drive Auto-Sync Trigger
  const triggerAutoGDriveSync = async () => {
    if (isGDriveTokenValid() && navigator.onLine) {
      setGDriveSyncing(true);
      try {
        const res = await syncWithGDrive();
        if (res.success) {
          // Reload merged data from localStorage
          setBikes(loadBikes());
          setActiveBikeId(loadActiveBikeId());
          setFuelLogs(reloadFuelLogs());
          setServiceLogs(reloadServiceLogs());
        }
      } catch (e) {
        console.error('Auto sync error:', e);
      } finally {
        setGDriveSyncing(false);
      }
    }
  };

  // Auto-sync on boot and when internet restores
  useEffect(() => {
    triggerAutoGDriveSync();
    const handleOnline = () => triggerAutoGDriveSync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Filter fuel and service logs for active bike
  const activeFuelLogs = fuelLogs.filter(l => (l.bikeId || 'bike_1') === activeBikeId);
  const activeServiceLogs = serviceLogs.filter(s => (s.bikeId || 'bike_1') === activeBikeId);

  // Derived Stats Calculations for active bike
  const fuelStats = calculateFuelLogStats(activeFuelLogs);
  const currentOdometer = Math.max(
    activeBike.initialOdometer || 0,
    ...(activeFuelLogs.map(l => l.odometer || 0)),
    ...(activeServiceLogs.map(s => s.odometer || 0))
  );

  // Auto-sync current odometer to activeBike if higher
  useEffect(() => {
    if (currentOdometer > (activeBike.currentOdometer || 0)) {
      setBikes(prev => prev.map(b => b.id === activeBikeId ? { ...b, currentOdometer } : b));
    }
  }, [currentOdometer, activeBikeId]);

  const serviceStats = calculateServiceStats(activeServiceLogs, currentOdometer, activeBike.targetOilKm || 1000);

  // Combine Recent Activity for active bike
  const recentLogs = [
    ...activeFuelLogs.map(f => ({ ...f, isFuel: true })),
    ...activeServiceLogs.map(s => ({ ...s, isFuel: false }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.odometer || 0) - (a.odometer || 0));

  const t = translations[lang];

  // Multi-Bike Handlers
  const handleSelectBike = (bikeId) => {
    setActiveBikeId(bikeId);
    saveActiveBikeId(bikeId);
  };

  const handleAddBike = (newBikeData) => {
    const newBike = {
      ...newBikeData,
      id: `bike_${Date.now()}`
    };
    const updated = [...bikes, newBike];
    setBikes(updated);
    setActiveBikeId(newBike.id);
    triggerAutoGDriveSync();
  };

  const handleDeleteBike = (bikeId) => {
    if (bikes.length <= 1) return;
    const updated = bikes.filter(b => b.id !== bikeId);
    setBikes(updated);
    if (activeBikeId === bikeId) {
      setActiveBikeId(updated[0].id);
    }
    triggerAutoGDriveSync();
  };

  const handleSaveBikeProfile = (updatedProfile) => {
    setBikes(prev => prev.map(b => b.id === activeBikeId ? { ...b, ...updatedProfile } : b));
    triggerAutoGDriveSync();
  };

  // Language & Theme Handlers
  const handleToggleLang = () => {
    const nextLang = lang === 'bn' ? 'en' : 'bn';
    setLang(nextLang);
    saveSettings({ lang: nextLang, theme });
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    saveSettings({ lang, theme: nextTheme });
  };

  // Fuel & Service Handlers
  const handleSaveFuel = (entry) => {
    const entryWithBike = { ...entry, bikeId: activeBikeId };
    if (editingFuelData) {
      setFuelLogs(prev => prev.map(item => item.id === entryWithBike.id ? entryWithBike : item));
    } else {
      setFuelLogs(prev => [...prev, entryWithBike]);
    }
    setEditingFuelData(null);
    triggerAutoGDriveSync();
  };

  const handleDeleteFuel = (id) => {
    if (window.confirm(t.confirmDeleteFuel)) {
      setFuelLogs(prev => prev.filter(item => item.id !== id));
      triggerAutoGDriveSync();
    }
  };

  const handleSaveService = (entry) => {
    const entryWithBike = { ...entry, bikeId: activeBikeId };
    if (editingServiceData) {
      setServiceLogs(prev => prev.map(item => item.id === entryWithBike.id ? entryWithBike : item));
    } else {
      setServiceLogs(prev => [...prev, entryWithBike]);
    }
    setEditingServiceData(null);
    triggerAutoGDriveSync();
  };

  const handleDeleteService = (id) => {
    if (window.confirm(t.confirmDeleteService)) {
      setServiceLogs(prev => prev.filter(item => item.id !== id));
      triggerAutoGDriveSync();
    }
  };

  // Google Drive Handlers
  const handleGoogleLogin = () => {
    requestGoogleDriveLogin(
      async ({ token, user }) => {
        setGDriveUser(user);
        alert(lang === 'bn' ? '✅ গুগল অ্যাকাউন্ট সফলভাবে কানেক্ট হয়েছে!' : '✅ Google account connected successfully!');
        triggerAutoGDriveSync();
      },
      (err) => {
        console.error('Google login failed:', err);
        alert(lang === 'bn' ? '⚠️ গুগল ক্লাউড সাইন-ইন ব্যাহত হয়েছে।' : '⚠️ Google login interrupted.');
      }
    );
  };

  const handleGoogleLogout = () => {
    clearGDriveToken();
    setGDriveUser(null);
    alert(lang === 'bn' ? '🚪 গুগল ক্লাউড থেকে সাইন-আউট করা হয়েছে।' : '🚪 Signed out from Google Drive.');
  };

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  return (
    <div className="app-container">
      {/* Header Bar (Desktop Bike Selector inside) */}
      <Header 
        lang={lang}
        onToggleLang={handleToggleLang}
        bikes={bikes}
        activeBikeId={activeBikeId}
        onSelectBike={handleSelectBike}
        bikeProfile={activeBike}
        onEditBike={() => setIsBikeModalOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        gdriveUser={gdriveUser}
        gdriveSyncing={gdriveSyncing}
        onTriggerSync={triggerAutoGDriveSync}
      />

      {/* Mobile-Only Custom Bike Selector Bar below Header */}
      <div className="mobile-bike-selector">
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{lang === 'bn' ? 'বর্তমান বাইক:' : 'Active Bike:'}</span>
        </span>
        <BikeSelector
          bikes={bikes}
          activeBikeId={activeBikeId}
          onSelectBike={handleSelectBike}
          onOpenBikeModal={() => setIsBikeModalOpen(true)}
          lang={lang}
          align="right"
        />
      </div>

      {/* Main Tab Navigation for Desktop */}
      <nav className="nav-tabs">
        <button 
          className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>{t.dashboard}</span>
        </button>

        <button 
          className={`nav-tab-btn ${activeTab === 'fuel' ? 'active' : ''}`}
          onClick={() => setActiveTab('fuel')}
        >
          <Fuel size={18} />
          <span>{t.fuelLogs}</span>
        </button>

        <button 
          className={`nav-tab-btn ${activeTab === 'service' ? 'active' : ''}`}
          onClick={() => setActiveTab('service')}
        >
          <Wrench size={18} />
          <span>{t.serviceLogs}</span>
        </button>

        <button 
          className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={18} />
          <span>{t.analytics}</span>
        </button>
      </nav>

      {/* Tab View Contents */}
      <main>
        {activeTab === 'dashboard' && (
          <Dashboard 
            lang={lang}
            fuelStats={fuelStats}
            serviceStats={serviceStats}
            bikeProfile={activeBike}
            onOpenAddFuel={() => { setEditingFuelData(null); setIsFuelModalOpen(true); }}
            onOpenAddService={() => { setEditingServiceData(null); setIsServiceModalOpen(true); }}
            recentLogs={recentLogs}
          />
        )}

        {activeTab === 'fuel' && (
          <FuelLogsTab 
            lang={lang}
            fuelLogsStats={fuelStats}
            onOpenAddFuel={() => { setEditingFuelData(null); setIsFuelModalOpen(true); }}
            onEditFuel={(data) => { setEditingFuelData(data); setIsFuelModalOpen(true); }}
            onDeleteFuel={handleDeleteFuel}
          />
        )}

        {activeTab === 'service' && (
          <ServiceLogsTab 
            lang={lang}
            serviceLogs={activeServiceLogs}
            serviceStats={serviceStats}
            onOpenAddService={() => { setEditingServiceData(null); setIsServiceModalOpen(true); }}
            onEditService={(data) => { setEditingServiceData(data); setIsServiceModalOpen(true); }}
            onDeleteService={handleDeleteService}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab 
            lang={lang}
            fuelLogs={activeFuelLogs}
            serviceLogs={activeServiceLogs}
            fuelStats={fuelStats}
          />
        )}
      </main>

      {/* Native Mobile Floating Action Buttons (FAB) */}
      <div className="fab-container">
        <button 
          className="fab-btn fab-fuel" 
          onClick={() => { setEditingFuelData(null); setIsFuelModalOpen(true); }}
          title={t.addFuel}
        >
          <Fuel size={22} />
        </button>
      </div>

      {/* Mobile Bottom Navigation (Native Android App Navigation Bar) */}
      <nav className="mobile-nav-bar">
        <button 
          className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>{t.dashboard}</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'fuel' ? 'active' : ''}`}
          onClick={() => setActiveTab('fuel')}
        >
          <Fuel size={20} />
          <span>{t.fuelLogs}</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'service' ? 'active' : ''}`}
          onClick={() => setActiveTab('service')}
        >
          <Wrench size={20} />
          <span>{t.serviceLogs}</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={20} />
          <span>{t.analytics}</span>
        </button>
      </nav>

      {/* Modals */}
      <FuelModal 
        lang={lang}
        isOpen={isFuelModalOpen}
        onClose={() => { setIsFuelModalOpen(false); setEditingFuelData(null); }}
        onSave={handleSaveFuel}
        initialData={editingFuelData}
        currentOdometer={currentOdometer}
      />

      <ServiceModal 
        lang={lang}
        isOpen={isServiceModalOpen}
        onClose={() => { setIsServiceModalOpen(false); setEditingServiceData(null); }}
        onSave={handleSaveService}
        initialData={editingServiceData}
        currentOdometer={currentOdometer}
      />

      <BikeModal 
        lang={lang}
        isOpen={isBikeModalOpen}
        onClose={() => setIsBikeModalOpen(false)}
        bikes={bikes}
        activeBikeId={activeBikeId}
        onSelectBike={handleSelectBike}
        onAddBike={handleAddBike}
        onDeleteBike={handleDeleteBike}
        bikeProfile={activeBike}
        onSave={handleSaveBikeProfile}
        onExportData={exportBackupData}
        onImportData={(jsonStr) => {
          const result = mergeImportBackupData(jsonStr);
          if (result.success) {
            setBikes(loadBikes());
            setActiveBikeId(loadActiveBikeId());
            setFuelLogs(reloadFuelLogs());
            setServiceLogs(reloadServiceLogs());
          }
          return result;
        }}
        gdriveUser={gdriveUser}
        gdriveSyncing={gdriveSyncing}
        onGoogleLogin={handleGoogleLogin}
        onGoogleLogout={handleGoogleLogout}
        onTriggerSync={triggerAutoGDriveSync}
        onClearAllData={() => {
          clearAllData();
          const defaultBike = { id: 'bike_1', name: 'My Bike', regNumber: '', initialOdometer: 0, currentOdometer: 0, targetOilKm: 1000 };
          setBikes([defaultBike]);
          setActiveBikeId('bike_1');
          setFuelLogs([]);
          setServiceLogs([]);
          setGDriveUser(null);
          setIsBikeModalOpen(false);
          alert(lang === 'bn' ? '✅ সমস্ত ডাটা সফলভাবে মুছে ফেলা হয়েছে!' : '✅ All data reset successfully!');
        }}
      />

      <PWAInstallModal 
        lang={lang}
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onTriggerInstall={handleTriggerInstall}
      />
    </div>
  );
}

