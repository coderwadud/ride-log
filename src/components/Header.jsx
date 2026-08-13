import React from 'react';
import { Bike, Languages, Download, Smartphone, Settings } from 'lucide-react';
import { translations } from '../utils/translations';

export default function Header({ 
  lang, 
  onToggleLang, 
  bikeProfile, 
  onEditBike, 
  onOpenInstall,
  onExportData
}) {
  const t = translations[lang];

  return (
    <header className="header-bar">
      <div className="brand-title">
        <div className="brand-logo">
          <Bike size={22} />
        </div>
        <div>
          <h1 className="brand-name">{t.appName}</h1>
          <span className="brand-sub">
            {bikeProfile?.name || 'My Bike'} • {bikeProfile?.regNumber || ''}
          </span>
        </div>
      </div>

      <div className="top-actions">
        {/* Bike Edit Button */}
        <button 
          className="btn btn-icon" 
          onClick={onEditBike} 
          title={t.editBike}
        >
          <Settings size={18} />
        </button>

        {/* Language Switcher */}
        <button 
          className="btn btn-icon" 
          onClick={onToggleLang}
          title="Switch Language / ভাষা পরিবর্তন"
          style={{ gap: '4px', fontSize: '0.78rem', fontWeight: 700, padding: '6px 10px' }}
        >
          <Languages size={16} />
          <span>{lang === 'bn' ? 'ENG' : 'বাংলা'}</span>
        </button>

        {/* Export Data */}
        <button 
          className="btn btn-icon" 
          onClick={onExportData}
          title={t.exportData}
        >
          <Download size={16} />
        </button>

        {/* Install Android PWA Button */}
        <button 
          className="btn btn-primary" 
          onClick={onOpenInstall}
          style={{ padding: '6px 10px', fontSize: '0.78rem' }}
          title={t.installApp}
        >
          <Smartphone size={16} />
          <span className="hide-mobile">{t.installApp}</span>
        </button>
      </div>
    </header>
  );
}
