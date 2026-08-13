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

import { 
  loadBikeProfile, 
  saveBikeProfile, 
  loadFuelLogs, 
  saveFuelLogs, 
  loadServiceLogs, 
  saveServiceLogs, 
  loadSettings, 
  saveSettings,
  exportBackupData,
  clearAllData
} from './utils/storage';

import { 
  calculateFuelLogStats, 
  calculateServiceStats 
} from './utils/calculations';

import { translations } from './utils/translations';
import { LayoutDashboard, Fuel, Wrench, BarChart3 } from 'lucide-react';

export default function App() {
  const initialSettings = loadSettings();
  const [lang, setLang] = useState(initialSettings?.lang || 'bn');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Core Data States
  const [bikeProfile, setBikeProfile] = useState(loadBikeProfile());
  const [fuelLogs, setFuelLogs] = useState(loadFuelLogs());
  const [serviceLogs, setServiceLogs] = useState(loadServiceLogs());

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
    saveBikeProfile(bikeProfile);
  }, [bikeProfile]);

  useEffect(() => {
    saveFuelLogs(fuelLogs);
  }, [fuelLogs]);

  useEffect(() => {
    saveServiceLogs(serviceLogs);
  }, [serviceLogs]);

  // Derived Stats Calculations
  const fuelStats = calculateFuelLogStats(fuelLogs);
  const currentOdometer = Math.max(
    bikeProfile.initialOdometer || 0,
    ...(fuelLogs.map(l => l.odometer || 0)),
    ...(serviceLogs.map(s => s.odometer || 0))
  );

  // Auto-sync current odometer to bikeProfile if higher
  useEffect(() => {
    if (currentOdometer > (bikeProfile.currentOdometer || 0)) {
      setBikeProfile(prev => ({ ...prev, currentOdometer }));
    }
  }, [currentOdometer]);

  const serviceStats = calculateServiceStats(serviceLogs, currentOdometer, bikeProfile.targetOilKm || 1000);

  // Combine Recent Activity
  const recentLogs = [
    ...fuelLogs.map(f => ({ ...f, isFuel: true })),
    ...serviceLogs.map(s => ({ ...s, isFuel: false }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.odometer || 0) - (a.odometer || 0));

  const t = translations[lang];

  // Handlers
  const handleToggleLang = () => {
    const nextLang = lang === 'bn' ? 'en' : 'bn';
    setLang(nextLang);
    saveSettings({ lang: nextLang });
  };

  const handleSaveFuel = (entry) => {
    if (editingFuelData) {
      setFuelLogs(prev => prev.map(item => item.id === entry.id ? entry : item));
    } else {
      setFuelLogs(prev => [...prev, entry]);
    }
    setEditingFuelData(null);
  };

  const handleDeleteFuel = (id) => {
    if (window.confirm(t.confirmDeleteFuel)) {
      setFuelLogs(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleSaveService = (entry) => {
    if (editingServiceData) {
      setServiceLogs(prev => prev.map(item => item.id === entry.id ? entry : item));
    } else {
      setServiceLogs(prev => [...prev, entry]);
    }
    setEditingServiceData(null);
  };

  const handleDeleteService = (id) => {
    if (window.confirm(t.confirmDeleteService)) {
      setServiceLogs(prev => prev.filter(item => item.id !== id));
    }
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
      {/* Header Bar */}
      <Header 
        lang={lang}
        onToggleLang={handleToggleLang}
        bikeProfile={bikeProfile}
        onEditBike={() => setIsBikeModalOpen(true)}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        onExportData={exportBackupData}
      />

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
            bikeProfile={bikeProfile}
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
            serviceLogs={serviceLogs}
            serviceStats={serviceStats}
            onOpenAddService={() => { setEditingServiceData(null); setIsServiceModalOpen(true); }}
            onEditService={(data) => { setEditingServiceData(data); setIsServiceModalOpen(true); }}
            onDeleteService={handleDeleteService}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab 
            lang={lang}
            fuelLogs={fuelLogs}
            serviceLogs={serviceLogs}
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
        onSave={(updated) => setBikeProfile(updated)}
        bikeProfile={bikeProfile}
        onClearAllData={() => {
          if (window.confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত যে সমস্ত ডাটা মুছে ফেলতে চান?' : 'Are you sure you want to clear all data?')) {
            clearAllData();
            setBikeProfile({ id: 'bike_1', name: 'My Bike', regNumber: '', initialOdometer: 0, currentOdometer: 0, targetOilKm: 1000 });
            setFuelLogs([]);
            setServiceLogs([]);
            setIsBikeModalOpen(false);
          }
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
