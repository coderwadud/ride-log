import React from 'react';
import { Languages, Sun, Moon, Settings, LogOut, User } from 'lucide-react';
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
  onLogout,
  onOpenProfile
}) {
  const t = translations[lang];
  const isLight = theme === 'light';

  return (
    <header className="header-bar">
      <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', }}>
          <img
            src={isLight ? lightLogo : darkLogo}
            alt="RideLog BD"
            style={{ height: '34px', width: '80px', objectFit: 'contain', marginTop: '-12px' }}
          />
          <span className="brand-sub" style={{ fontSize: '0.75rem', lineHeight: '1', position: 'relative', left: '6px', marginTop: '-2px', color: 'var(--text-muted)' }}>
            {bikeProfile?.name || 'My Bike'} <br /> {bikeProfile?.regNumber ? `${bikeProfile.regNumber}` : ''}
          </span>
        </div>
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

        {/* User Profile Avatar / Icon (Click to open Profile & Documents Page) */}
        <button
          className="btn btn-icon"
          onClick={onOpenProfile}
          title={lang === 'bn' ? 'মাই প্রোফাইল ও ডকুমেন্টস' : 'My Profile & Documents'}
          style={{ padding: '3px', cursor: 'pointer', border: 'none', background: 'transparent' }}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              referrerPolicy="no-referrer"
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #38bdf8' }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #38bdf8, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.82rem', fontWeight: 700, color: '#fff',
              border: '2px solid rgba(56, 189, 248, 0.4)'
            }}>
              {user ? (user.displayName || user.email || 'U')[0].toUpperCase() : <User size={18} />}
            </div>
          )}
        </button>
      </div>
    </header>
  );
}

