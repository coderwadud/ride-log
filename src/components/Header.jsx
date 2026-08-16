import React from 'react';
import { Languages, Sun, Moon, Settings, LogOut } from 'lucide-react';
import { translations } from '../utils/translations';
import lightLogo from '../assets/light-mode-logo.png';
import darkLogo from '../assets/dark-mode-logo.png';

export default function Header({ 
  lang, 
  onToggleLang, 
  bikeProfile, 
  onEditBike, 
  theme,
  onToggleTheme,
  user,
  onLogout
}) {
  const t = translations[lang];
  const isLight = theme === 'light';

  return (
    <header className="header-bar">
      <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img
          src={isLight ? lightLogo : darkLogo}
          alt="RideLog BD"
          style={{ height: '34px', width: 'auto', objectFit: 'contain' }}
        />
        <span className="brand-sub" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {bikeProfile?.name || 'My Bike'} {bikeProfile?.regNumber ? `• ${bikeProfile.regNumber}` : ''}
        </span>
      </div>

      <div className="top-actions flex items-center gap-1.5">
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

        {/* User Avatar + Logout */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '2px' }}>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                title={user.displayName || user.email}
                referrerPolicy="no-referrer"
                style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(56,189,248,0.4)' }}
              />
            ) : (
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, #38bdf8, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, color: '#fff'
              }}>
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <button
              className="btn btn-icon"
              onClick={onLogout}
              title={lang === 'bn' ? 'লগআউট' : 'Logout'}
              style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.2)', padding: '6px' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

