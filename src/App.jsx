import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoginScreen from './components/LoginScreen';
import { onAuthChange, signOutUser } from './utils/firebase';
import { loadUserData, saveUserData, resetUserDataInFirestore } from './utils/firestoreDB';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import FuelLogsTab from './components/FuelLogsTab';
import ServiceLogsTab from './components/ServiceLogsTab';
import AnalyticsTab from './components/AnalyticsTab';
import FuelModal from './components/FuelModal';
import ServiceModal from './components/ServiceModal';
import BikeModal from './components/BikeModal';
import ProfileModal from './components/ProfileModal';
import PWAInstallModal from './components/PWAInstallModal';
import Footer from './components/Footer';
import BikeSelector from './components/BikeSelector';

import { exportBackupData, mergeImportBackupData, loadSettings, saveSettings } from './utils/storage';
import { calculateFuelLogStats, calculateServiceStats } from './utils/calculations';
import { translations } from './utils/translations';
import { LayoutDashboard, Fuel, Wrench, BarChart3 } from 'lucide-react';
import {
  updateLastActiveAt,
  trackUserLogin,
  trackFuelLogAdded,
  trackServiceLogAdded,
  trackBikeAdded,
  trackLanguageChanged
} from './utils/analytics';

const DEFAULT_BIKE = {
  id: 'bike_1',
  name: 'My Bike',
  regNumber: '',
  initialOdometer: 0,
  currentOdometer: 0,
  targetOilKm: 1000
};

export default function App() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = loadSettings();
      return saved?.lang || 'bn';
    } catch (e) {
      return 'bn';
    }
  });

  const [theme, setTheme] = useState(() => {
    try {
      const saved = loadSettings();
      return saved?.theme || 'dark';
    } catch (e) {
      return 'dark';
    }
  });
  const [activeTab, setActiveTab] = useState('dashboard');

  // Firebase Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Core App Data States (User-isolated via Firestore)
  const [bikes, setBikes] = useState([DEFAULT_BIKE]);
  const [activeBikeId, setActiveBikeId] = useState('bike_1');
  const [fuelLogs, setFuelLogs] = useState([]);
  const [serviceLogs, setServiceLogs] = useState([]);

  // Flag to avoid saving initial empty state over Firestore before loading finishes
  const isLoadedRef = useRef(false);
  const saveTimerRef = useRef(null);

  // Apply theme to document root and persist settings for instant initial render
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveSettings({ lang, theme });
  }, [lang, theme]);

  // Modal States
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [editingFuelData, setEditingFuelData] = useState(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingServiceData, setEditingServiceData] = useState(null);
  const [isBikeModalOpen, setIsBikeModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // PWA Install Event
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    const handleBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // ── FIREBASE AUTH & FIRESTORE DATA SYNC ──
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setDataLoading(true);
        isLoadedRef.current = false;

        // Fetch user data from Firestore document users/{uid}
        const data = await loadUserData(firebaseUser.uid);

        setBikes(data.bikes);
        setActiveBikeId(data.activeBikeId);
        setFuelLogs(data.fuelLogs);
        setServiceLogs(data.serviceLogs);
        if (data.settings?.lang) setLang(data.settings.lang);
        if (data.settings?.theme) setTheme(data.settings.theme);

        setDataLoading(false);
        isLoadedRef.current = true;

        // ── Analytics: track login & update lastActiveAt ──
        trackUserLogin(firebaseUser.providerData?.[0]?.providerId || 'unknown');
        updateLastActiveAt(firebaseUser.uid);
      } else {
        // Logged out — clear user data from memory
        setBikes([DEFAULT_BIKE]);
        setActiveBikeId('bike_1');
        setFuelLogs([]);
        setServiceLogs([]);
        isLoadedRef.current = false;
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── AUTO-SAVE TO FIRESTORE (Debounced) ──
  const scheduleSave = useCallback(() => {
    if (!user || !isLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      saveUserData(user.uid, {
        settings: { lang, theme },
        activeBikeId,
        bikes,
        fuelLogs,
        serviceLogs
      });
    }, 600);
  }, [user, lang, theme, activeBikeId, bikes, fuelLogs, serviceLogs]);

  useEffect(() => {
    scheduleSave();
  }, [bikes, fuelLogs, serviceLogs, activeBikeId, lang, theme, scheduleSave]);

  // Active Bike Profile
  const activeBike = bikes.find(b => b.id === activeBikeId) || bikes[0] || DEFAULT_BIKE;

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

  // Auto-update current odometer to activeBike if higher
  useEffect(() => {
    if (currentOdometer > (activeBike.currentOdometer || 0)) {
      setBikes(prev => prev.map(b => b.id === activeBikeId ? { ...b, currentOdometer } : b));
    }
  }, [currentOdometer, activeBikeId, activeBike.currentOdometer]);

  const serviceStats = calculateServiceStats(activeServiceLogs, currentOdometer, activeBike.targetOilKm || 1000);

  // Combine Recent Activity for active bike
  const recentLogs = [
    ...activeFuelLogs.map(f => ({ ...f, isFuel: true })),
    ...activeServiceLogs.map(s => ({ ...s, isFuel: false }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.odometer || 0) - (a.odometer || 0));

  const t = translations[lang] || translations.bn;

  // Handlers
  const handleSelectBike = (bikeId) => {
    setActiveBikeId(bikeId);
  };

  const handleAddBike = (newBikeData) => {
    const newBike = { ...newBikeData, id: `bike_${Date.now()}` };
    setBikes(prev => [...prev, newBike]);
    setActiveBikeId(newBike.id);
    // Analytics: track new bike added
    trackBikeAdded();
    if (user) updateLastActiveAt(user.uid);
  };

  const handleDeleteBike = (bikeId) => {
    if (bikes.length <= 1) return;
    setBikes(prev => {
      const updated = prev.filter(b => b.id !== bikeId);
      if (activeBikeId === bikeId) setActiveBikeId(updated[0].id);
      return updated;
    });
  };

  const handleSaveBikeProfile = (updatedProfile) => {
    const targetId = updatedProfile?.id || activeBikeId;
    setBikes(prev => prev.map(b => b.id === targetId ? { ...b, ...updatedProfile } : b));
  };

  const handleToggleLang = () => {
    setLang(prev => {
      const next = prev === 'bn' ? 'en' : 'bn';
      trackLanguageChanged(next);
      return next;
    });
  };

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSaveFuel = (entry) => {
    const entryWithBike = { ...entry, bikeId: activeBikeId };
    if (editingFuelData) {
      setFuelLogs(prev => prev.map(item => item.id === entryWithBike.id ? entryWithBike : item));
    } else {
      setFuelLogs(prev => [...prev, entryWithBike]);
      // Analytics: only track new entries, not edits
      trackFuelLogAdded(activeBikeId);
      if (user) updateLastActiveAt(user.uid);
    }
    setEditingFuelData(null);
  };

  const handleDeleteFuel = (id) => {
    if (window.confirm(t.confirmDeleteFuel)) {
      setFuelLogs(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleSaveService = (entry) => {
    const entryWithBike = { ...entry, bikeId: activeBikeId };
    if (editingServiceData) {
      setServiceLogs(prev => prev.map(item => item.id === entryWithBike.id ? entryWithBike : item));
    } else {
      setServiceLogs(prev => [...prev, entryWithBike]);
      // Analytics: only track new entries, not edits
      trackServiceLogAdded(activeBikeId);
      if (user) updateLastActiveAt(user.uid);
    }
    setEditingServiceData(null);
  };

  const handleDeleteService = (id) => {
    if (window.confirm(t.confirmDeleteService)) {
      setServiceLogs(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleLogout = async () => {
    const confirmed = window.confirm(
      lang === 'bn' ? 'আপনি কি সত্যিই লগআউট করতে চান?' : 'Are you sure you want to logout?'
    );
    if (!confirmed) return;
    await signOutUser();
  };

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  // ── Auth & Loading Guard ──
  if (authLoading || dataLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', gap: '16px' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          {lang === 'bn' ? 'ডাটা লোড হচ্ছে...' : 'Loading user data...'}
        </span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen lang={lang} />;
  }

  return (
    <div className="app-container">
      {/* Header Bar */}
      <Header
        lang={lang}
        onToggleLang={handleToggleLang}
        bikeProfile={activeBike}
        onEditBike={() => setIsBikeModalOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        user={user}
        onLogout={handleLogout}
        onOpenProfile={() => setIsProfileModalOpen(true)}
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
        <button className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard size={18} />
          <span>{t.dashboard}</span>
        </button>
        <button className={`nav-tab-btn ${activeTab === 'fuel' ? 'active' : ''}`} onClick={() => setActiveTab('fuel')}>
          <Fuel size={18} />
          <span>{t.fuelLogs}</span>
        </button>
        <button className={`nav-tab-btn ${activeTab === 'service' ? 'active' : ''}`} onClick={() => setActiveTab('service')}>
          <Wrench size={18} />
          <span>{t.serviceLogs}</span>
        </button>
        <button className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
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

        {/* Footer */}
        <Footer lang={lang} theme={theme} />
      </main>

      {/* Native Mobile Floating Action Button */}
      <div className="fab-container">
        <button className="fab-btn fab-fuel" onClick={() => { setEditingFuelData(null); setIsFuelModalOpen(true); }} title={t.addFuel}>
          <Fuel size={22} />
        </button>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav-bar">
        <button className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard size={20} />
          <span>{t.dashboard}</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'fuel' ? 'active' : ''}`} onClick={() => setActiveTab('fuel')}>
          <Fuel size={20} />
          <span>{t.fuelLogs}</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'service' ? 'active' : ''}`} onClick={() => setActiveTab('service')}>
          <Wrench size={20} />
          <span>{t.serviceLogs}</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
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
        onSave={handleSaveBikeProfile}
        bikes={bikes}
        activeBikeId={activeBikeId}
        onSelectBike={handleSelectBike}
        onAddBike={handleAddBike}
        onDeleteBike={handleDeleteBike}
        bikeProfile={activeBike}
        onExportData={() => exportBackupData({ bikes, activeBikeId, fuelLogs, serviceLogs, settings: { lang, theme } })}
        onImportData={(jsonStr) => {
          const result = mergeImportBackupData(jsonStr, { bikes, activeBikeId, fuelLogs, serviceLogs });
          if (result.success && result.data) {
            // Update React state directly
            if (result.data.bikes) setBikes(result.data.bikes);
            if (result.data.activeBikeId) setActiveBikeId(result.data.activeBikeId);
            if (result.data.fuelLogs) setFuelLogs(result.data.fuelLogs);
            if (result.data.serviceLogs) setServiceLogs(result.data.serviceLogs);

            // Persist imported data immediately to Firestore Database
            if (user) {
              saveUserData(user.uid, {
                settings: { lang, theme },
                activeBikeId: result.data.activeBikeId || activeBikeId,
                bikes: result.data.bikes || bikes,
                fuelLogs: result.data.fuelLogs || fuelLogs,
                serviceLogs: result.data.serviceLogs || serviceLogs
              });
            }
          }
          return result;
        }}
        onClearAllData={async () => {
          if (!user) return;
          // 1. Reset user data in Firestore for THIS USER only
          await resetUserDataInFirestore(user.uid);

          // 2. Reset React local state
          setBikes([DEFAULT_BIKE]);
          setActiveBikeId('bike_1');
          setFuelLogs([]);
          setServiceLogs([]);
          setIsBikeModalOpen(false);

          alert(lang === 'bn' ? '✅ শুধু আপনার ডাটা সফলভাবে মুছে ফেলা হয়েছে!' : '✅ Your data has been reset successfully!');
        }}
        onLogout={handleLogout}
      />
      <ProfileModal
        lang={lang}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        bikes={bikes}
        activeBikeId={activeBikeId}
        onLogout={handleLogout}
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
