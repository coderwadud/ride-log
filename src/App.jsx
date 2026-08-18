import { trackUserIpAndActivity } from './utils/ipTracker';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoginScreen from './components/LoginScreen';
import { onAuthChange, signOutUser } from './utils/firebase';
import { loadUserData, saveUserData, resetUserDataInFirestore } from './utils/firestoreDB';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import FuelLogsTab from './components/FuelLogsTab';
import ServiceLogsTab from './components/ServiceLogsTab';
import AnalyticsTab from './components/AnalyticsTab';
import GpsTrackerTab from './components/GpsTrackerTab';
import FuelModal from './components/FuelModal';
import ServiceModal from './components/ServiceModal';
import BikeModal from './components/BikeModal';
import ProfileModal from './components/ProfileModal';
import PWAInstallModal from './components/PWAInstallModal';
import UpdateModal from './components/UpdateModal';
import CampaignModal from './components/CampaignModal';
import TicketUpdateModal from './components/TicketUpdateModal';
import FeedbackPage from './components/FeedbackPage';
import Footer from './components/Footer';
import BikeSelector from './components/BikeSelector';

import {
  exportBackupData, mergeImportBackupData, loadSettings, saveSettings,
  saveBikes, saveFuelLogs, saveServiceLogs, saveActiveBikeId,
  loadBikes, loadFuelLogs, loadServiceLogs, loadActiveBikeId
} from './utils/storage';
import { calculateFuelLogStats, calculateServiceStats } from './utils/calculations';
import { translations } from './utils/translations';
import { LayoutDashboard, Fuel, Wrench, BarChart3, Navigation } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  updateLastActiveAt,
  trackUserLogin,
  trackFuelLogAdded,
  trackServiceLogAdded,
  trackBikeAdded,
  trackLanguageChanged
} from './utils/analytics';
import { initPushNotifications, syncFCMTokenWithUser } from './utils/pushNotifications';
import { checkAppUpdate, listenToAppUpdates, listenToActiveCampaign, listenToUserTickets } from './utils/firestoreDB';
import { getCurrentAppVersion } from './utils/appVersion';

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

  // Core App Data States (Loaded immediately from localStorage on startup)
  const [bikes, setBikes] = useState(() => loadBikes());
  const [activeBikeId, setActiveBikeId] = useState(() => loadActiveBikeId());
  const [fuelLogs, setFuelLogs] = useState(() => loadFuelLogs());
  const [serviceLogs, setServiceLogs] = useState(() => loadServiceLogs());

  // Flag to avoid saving initial empty state over Firestore before loading finishes
  const isLoadedRef = useRef(false);
  const saveTimerRef = useRef(null);

  // Apply theme to document root and persist settings for instant initial render
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveSettings({ lang, theme });
  }, [lang, theme]);

  // Initialize push notifications on native device
  useEffect(() => {
    initPushNotifications();
  }, []);

  // Modal States
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [editingFuelData, setEditingFuelData] = useState(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingServiceData, setEditingServiceData] = useState(null);
  const [isBikeModalOpen, setIsBikeModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // App Update State
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Listen for real-time app updates from Firestore (with 24h snooze memory on dismiss)
  useEffect(() => {
    let unsubscribe = () => {};

    getCurrentAppVersion().then((currentVer) => {
      unsubscribe = listenToAppUpdates(currentVer, (update) => {
        if (update?.isUpdateAvailable) {
          // If update is mandatory, show every time without snooze
          if (update.isMandatory) {
            setUpdateInfo(update);
            setIsUpdateModalOpen(true);
            return;
          }

          // Check if user dismissed this version within the last 24 hours
          try {
            const dismissedTimestamp = localStorage.getItem(`ridelog_dismissed_update_${update.latestVersion}`);
            if (dismissedTimestamp) {
              const hoursPassed = (Date.now() - parseInt(dismissedTimestamp, 10)) / (1000 * 60 * 60);
              if (hoursPassed < 24) {
                // Snooze active: user already dismissed this version recently
                return;
              }
            }
          } catch (e) {}

          setUpdateInfo(update);
          setIsUpdateModalOpen(true);
        } else {
          setIsUpdateModalOpen(false);
        }
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleDismissUpdateModal = () => {
    if (updateInfo?.latestVersion && !updateInfo.isMandatory) {
      try {
        localStorage.setItem(`ridelog_dismissed_update_${updateInfo.latestVersion}`, Date.now().toString());
      } catch (e) {}
    }
    setIsUpdateModalOpen(false);
  };

  // Campaign & In-App Announcement State
  const [campaignInfo, setCampaignInfo] = useState(null);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);

  // Listen for real-time in-app campaign & announcements from Firestore
  useEffect(() => {
    const unsubscribe = listenToActiveCampaign((camp) => {
      if (camp?.isActive && camp.campaignId) {
        // If showEveryTime is TRUE, always show on every app launch/reload
        if (camp.showEveryTime) {
          setCampaignInfo(camp);
          setIsCampaignModalOpen(true);
          return;
        }

        // If showEveryTime is FALSE (default), check if user already dismissed this specific campaignId
        try {
          const isDismissed = localStorage.getItem(`ridelog_dismissed_camp_${camp.campaignId}`);
          if (isDismissed === 'true') {
            setIsCampaignModalOpen(false);
            return;
          }
        } catch (e) {}

        setCampaignInfo(camp);
        setIsCampaignModalOpen(true);
      } else {
        setIsCampaignModalOpen(false);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleDismissCampaign = () => {
    if (campaignInfo?.campaignId && !campaignInfo.showEveryTime) {
      try {
        localStorage.setItem(`ridelog_dismissed_camp_${campaignInfo.campaignId}`, 'true');
      } catch (e) {}
    }
    setIsCampaignModalOpen(false);
  };

  // Ticket Update Notification Alert State
  const [ticketUpdateModalInfo, setTicketUpdateModalInfo] = useState({ isOpen: false, ticket: null, updateKey: '' });
  const [isFeedbackPageOpen, setIsFeedbackPageOpen] = useState(false);
  const [feedbackPageInitialTicketId, setFeedbackPageInitialTicketId] = useState(null);
  const [feedbackPageInitialViewMode, setFeedbackPageInitialViewMode] = useState('list');

  // Real-time listener for user support ticket updates / admin replies
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = listenToUserTickets(user.uid, (tickets) => {
      if (!tickets || tickets.length === 0) return;

      // Find the most recent updated ticket that user hasn't seen yet
      for (const tkt of tickets) {
        const s = (tkt.status || 'pending').toLowerCase().trim();
        const hasReply = Boolean(tkt.adminReply || tkt.adminNote || tkt.reply || tkt.note);
        const isNotPending = s !== 'pending' && s !== 'new' && s !== 'open';

        if (hasReply || isNotPending) {
          const updateKey = `ridelog_seen_tkt_${tkt.ticketId || tkt.id}_${s}_${tkt.adminReply || tkt.adminNote || tkt.reply || ''}`;
          try {
            const seen = localStorage.getItem(updateKey);
            if (!seen) {
              setTicketUpdateModalInfo({ isOpen: true, ticket: tkt, updateKey });
              break;
            }
          } catch (e) {}
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user?.uid]);

  const handleDismissTicketUpdate = () => {
    if (ticketUpdateModalInfo.updateKey) {
      try {
        localStorage.setItem(ticketUpdateModalInfo.updateKey, 'true');
      } catch (e) {}
    }
    setTicketUpdateModalInfo({ isOpen: false, ticket: null, updateKey: '' });
  };

  const handleViewTicketDetails = () => {
    const tkt = ticketUpdateModalInfo.ticket;
    handleDismissTicketUpdate();
    if (tkt) {
      setFeedbackPageInitialTicketId(tkt.ticketId || tkt.id);
      setFeedbackPageInitialViewMode('details');
      setIsFeedbackPageOpen(true);
    }
  };

  // PWA Install Event
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    const handleBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // ── FIREBASE AUTH & HYBRID DATA SYNC (Web: Server-Direct | Android: 0ms Local-First + 1hr Auto-Sync) ──
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (firebaseUser) {
        isLoadedRef.current = false;
        const isNative = Capacitor.isNativePlatform();

        try {
          // Fetch user data from Firestore server
          const data = await loadUserData(firebaseUser.uid);

          if (!isNative) {
            // 🌐 WEB PLATFORM: Direct Server Sync (Always load live server data)
            const serverBikes = (Array.isArray(data.bikes) && data.bikes.length > 0) ? data.bikes : [DEFAULT_BIKE];
            const serverFuel = Array.isArray(data.fuelLogs) ? data.fuelLogs : [];
            const serverService = Array.isArray(data.serviceLogs) ? data.serviceLogs : [];
            const serverActiveId = data.activeBikeId || serverBikes[0]?.id || 'bike_1';

            setBikes(serverBikes);
            setActiveBikeId(serverActiveId);
            setFuelLogs(serverFuel);
            setServiceLogs(serverService);
            if (data.settings?.lang) setLang(data.settings.lang);
            if (data.settings?.theme) setTheme(data.settings.theme);
          } else {
            // 📱 ANDROID APP: Local-First 0ms Speed with Cloud Self-Healing
            const localFuel = loadFuelLogs() || [];
            const localService = loadServiceLogs() || [];
            const localBikes = loadBikes() || [DEFAULT_BIKE];

            const finalBikes = (Array.isArray(data.bikes) && data.bikes.length > 0 && (data.bikes.length > 1 || data.bikes[0]?.name !== 'My Bike'))
              ? data.bikes
              : (localBikes.length > 0 && (localBikes.length > 1 || localBikes[0]?.name !== 'My Bike') ? localBikes : data.bikes || [DEFAULT_BIKE]);

            const finalFuel = (Array.isArray(data.fuelLogs) && data.fuelLogs.length > 0) ? data.fuelLogs : localFuel;
            const finalService = (Array.isArray(data.serviceLogs) && data.serviceLogs.length > 0) ? data.serviceLogs : localService;

            setBikes(finalBikes);
            setActiveBikeId(data.activeBikeId || loadActiveBikeId() || 'bike_1');
            setFuelLogs(finalFuel);
            setServiceLogs(finalService);
            if (data.settings?.lang) setLang(data.settings.lang);
            if (data.settings?.theme) setTheme(data.settings.theme);

            // Save to Android local storage
            saveBikes(finalBikes);
            saveFuelLogs(finalFuel);
            saveServiceLogs(finalService);
            saveActiveBikeId(data.activeBikeId || loadActiveBikeId() || 'bike_1');
          }
        } catch (e) {
          console.error('Error loading user data from cloud:', e);
        } finally {
          isLoadedRef.current = true;
        }

        // ── Analytics: track login & update lastActiveAt ──
        trackUserLogin(firebaseUser.providerData?.[0]?.providerId || 'unknown');
        updateLastActiveAt(firebaseUser.uid, firebaseUser);

        // ── FCM Token sync with user ID ──
        syncFCMTokenWithUser(firebaseUser.uid);
      } else {
        // Logged out — clear user data from memory
        setBikes([DEFAULT_BIKE]);
        setActiveBikeId('bike_1');
        setFuelLogs([]);
        setServiceLogs([]);
        isLoadedRef.current = false;
      }
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
        serviceLogs,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || ''
      });
    }, 600);
  }, [user, lang, theme, activeBikeId, bikes, fuelLogs, serviceLogs]);

  // Persist mutations to local storage (Android) and trigger auto-save (Cloud)
  useEffect(() => {
    if (isLoadedRef.current) {
      if (Capacitor.isNativePlatform()) {
        saveBikes(bikes);
        saveFuelLogs(fuelLogs);
        saveServiceLogs(serviceLogs);
        saveActiveBikeId(activeBikeId);
        saveSettings({ lang, theme });
      }
    }
    scheduleSave();
  }, [bikes, fuelLogs, serviceLogs, activeBikeId, lang, theme, scheduleSave]);

  // ── 1-HOUR PERIODIC AUTO-SYNC & ONLINE RECONNECT SYNC ──
  useEffect(() => {
    if (!user) return;
    const ONE_HOUR = 60 * 60 * 1000;

    const performBackgroundSync = () => {
      if (navigator.onLine && isLoadedRef.current) {
        saveUserData(user.uid, {
          settings: { lang, theme },
          activeBikeId,
          bikes,
          fuelLogs,
          serviceLogs,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || ''
        });
      }
    };

    // Auto-sync every 1 hour
    const syncInterval = setInterval(performBackgroundSync, ONE_HOUR);

    // Auto-sync as soon as internet connection is restored
    window.addEventListener('online', performBackgroundSync);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('online', performBackgroundSync);
    };
  }, [user, lang, theme, activeBikeId, bikes, fuelLogs, serviceLogs]);

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
  if (authLoading) {
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
        <button className={`nav-tab-btn ${!isFeedbackPageOpen && activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('dashboard'); }}>
          <LayoutDashboard size={18} />
          <span>{t.dashboard}</span>
        </button>
        <button className={`nav-tab-btn ${!isFeedbackPageOpen && activeTab === 'fuel' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('fuel'); }}>
          <Fuel size={18} />
          <span>{t.fuelLogs}</span>
        </button>
        <button className={`nav-tab-btn ${!isFeedbackPageOpen && activeTab === 'gps' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('gps'); }}>
          <Navigation size={18} />
          <span>{t.gpsTrack || 'GPS ট্র্যাক'}</span>
        </button>
        <button className={`nav-tab-btn ${!isFeedbackPageOpen && activeTab === 'service' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('service'); }}>
          <Wrench size={18} />
          <span>{t.serviceLogs}</span>
        </button>
        <button className={`nav-tab-btn ${!isFeedbackPageOpen && activeTab === 'analytics' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('analytics'); }}>
          <BarChart3 size={18} />
          <span>{t.analytics}</span>
        </button>
      </nav>

      {/* Tab View Contents */}
      <main>
        {isFeedbackPageOpen ? (
          <FeedbackPage
            lang={lang}
            theme={theme}
            user={user}
            initialTicketId={feedbackPageInitialTicketId}
            initialViewMode={feedbackPageInitialViewMode}
            onBack={() => setIsFeedbackPageOpen(false)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                lang={lang}
                fuelStats={fuelStats}
                serviceStats={serviceStats}
                bikeProfile={activeBike}
                onOpenAddFuel={() => { setEditingFuelData(null); setIsFuelModalOpen(true); }}
                onOpenAddService={() => { setEditingServiceData(null); setIsServiceModalOpen(true); }}
                recentLogs={recentLogs}
                onNavigateTab={(tab) => { setIsFeedbackPageOpen(false); setActiveTab(tab); }}
              />
            )}
            {activeTab === 'fuel' && (
              <FuelLogsTab
                lang={lang}
                fuelLogs={activeFuelLogs}
                fuelLogsStats={fuelStats}
                onOpenAddFuel={() => { setEditingFuelData(null); setIsFuelModalOpen(true); }}
                onEditFuel={(data) => { setEditingFuelData(data); setIsFuelModalOpen(true); }}
                onDeleteFuel={handleDeleteFuel}
              />
            )}
            {activeTab === 'gps' && (
              <GpsTrackerTab
                lang={lang}
                theme={theme}
                user={user}
                activeBike={activeBike}
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
          </>
        )}
      </main>

      {/* Native Mobile Floating Action Button */}
      {!isFeedbackPageOpen && (
        <div className="fab-container">
          <button className="fab-btn fab-fuel" onClick={() => { setEditingFuelData(null); setIsFuelModalOpen(true); }} title={t.addFuel}>
            <Fuel size={22} />
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Always Visible & Interactive) */}
      <nav className="mobile-nav-bar">
        <button className={`mobile-nav-item ${!isFeedbackPageOpen && activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('dashboard'); }}>
          <LayoutDashboard size={19} />
          <span>{t.dashboard}</span>
        </button>
        <button className={`mobile-nav-item ${!isFeedbackPageOpen && activeTab === 'fuel' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('fuel'); }}>
          <Fuel size={19} />
          <span>{t.fuelLogs}</span>
        </button>
        <button className={`mobile-nav-item ${!isFeedbackPageOpen && activeTab === 'gps' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('gps'); }}>
          <Navigation size={19} />
          <span>{t.gpsTrack || 'GPS'}</span>
        </button>
        <button className={`mobile-nav-item ${!isFeedbackPageOpen && activeTab === 'service' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('service'); }}>
          <Wrench size={19} />
          <span>{t.serviceLogs}</span>
        </button>
        <button className={`mobile-nav-item ${!isFeedbackPageOpen && activeTab === 'analytics' ? 'active' : ''}`} onClick={() => { setIsFeedbackPageOpen(false); setActiveTab('analytics'); }}>
          <BarChart3 size={19} />
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
        onOpenFeedbackPage={(mode) => {
          setIsProfileModalOpen(false);
          setFeedbackPageInitialTicketId(null);
          setFeedbackPageInitialViewMode(mode || 'list');
          setIsFeedbackPageOpen(true);
        }}
      />
      <PWAInstallModal
        lang={lang}
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onTriggerInstall={handleTriggerInstall}
      />
      <UpdateModal
        lang={lang}
        isOpen={isUpdateModalOpen}
        updateInfo={updateInfo}
        onClose={handleDismissUpdateModal}
      />
      <CampaignModal
        lang={lang}
        isOpen={isCampaignModalOpen}
        campaign={campaignInfo}
        onClose={handleDismissCampaign}
      />
      <TicketUpdateModal
        lang={lang}
        isOpen={ticketUpdateModalInfo.isOpen}
        ticket={ticketUpdateModalInfo.ticket}
        onViewDetails={handleViewTicketDetails}
        onClose={handleDismissTicketUpdate}
      />
    </div>
  );
}
