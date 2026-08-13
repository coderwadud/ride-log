import React from 'react';
import { Bike, Languages, Sun, Moon, Settings, CloudCheck, CloudOff, RefreshCw } from 'lucide-react';
import { translations } from '../utils/translations';

export default function Header({ 
  lang, 
  onToggleLang, 
  bikeProfile, 
  onEditBike, 
  theme,
  onToggleTheme,
  gdriveUser,
  gdriveSyncing,
  onTriggerSync
}) {
  const t = translations[lang];
  const isLight = theme === 'light';

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

      <div className="top-actions flex items-center gap-1.5">
        {/* Google Drive Cloud Sync Status Pill */}
        {gdriveUser ? (
          <button
            type="button"
            onClick={onTriggerSync}
            disabled={gdriveSyncing}
            className="btn btn-icon text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
            title={gdriveSyncing ? 'Syncing with Google Drive...' : 'Google Drive Synced (Click to sync now)'}
            style={{ padding: '6px 8px', fontSize: '0.75rem', gap: '4px' }}
          >
            {gdriveSyncing ? (
              <RefreshCw size={15} className="animate-spin text-emerald-400" />
            ) : (
              <CloudCheck size={15} className="text-emerald-400" />
            )}
            <span className="hide-mobile font-semibold">☁️ {gdriveSyncing ? 'Syncing' : 'Synced'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onEditBike}
            className="btn btn-icon text-slate-400"
            title="Google Drive Sync Not Connected (Open Settings)"
            style={{ padding: '6px 8px' }}
          >
            <CloudOff size={15} />
          </button>
        )}

        {/* Settings Modal Button */}
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

        {/* Light / Dark Mode Toggle */}
        <button 
          className="btn btn-icon theme-toggle-btn" 
          onClick={onToggleTheme}
          title={isLight ? 'Dark Mode' : 'Light Mode'}
          style={{
            background: isLight 
              ? 'rgba(245, 158, 11, 0.15)' 
              : 'rgba(148, 163, 184, 0.1)',
            color: isLight ? '#d97706' : '#94a3b8',
            border: isLight 
              ? '1px solid rgba(245, 158, 11, 0.3)' 
              : '1px solid rgba(148, 163, 184, 0.15)',
            transition: 'all 0.3s ease'
          }}
        >
          {isLight ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </div>
    </header>
  );
}

