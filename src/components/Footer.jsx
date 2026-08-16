import React from 'react';
import { Globe, Heart, ShieldCheck, Sparkles, ExternalLink, Code2 } from 'lucide-react';
import darkLogo from '../assets/dark-mode-logo.png';
import lightLogo from '../assets/light-mode-logo.png';

export default function Footer({ lang, theme }) {
  const isBn = lang === 'bn';
  const isLight = theme === 'light';

  return (
    <footer 
      style={{
        marginTop: '40px',
        marginBottom: '24px',
        position: 'relative',
        borderRadius: '20px',
        background: isLight 
          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.95))' 
          : 'linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.85))',
        border: isLight 
          ? '1px solid rgba(0, 0, 0, 0.08)' 
          : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isLight
          ? '0 10px 30px rgba(0, 0, 0, 0.04)'
          : '0 12px 36px rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '24px 20px 18px',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Top Ambient Gradient Accent Line */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #38bdf8, #10b981, #8b5cf6, transparent)',
          opacity: 0.85
        }} 
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        
        {/* App Logo & Tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <img
            src={isLight ? lightLogo : darkLogo}
            alt="RideLog BD"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
          <p style={{ 
            fontSize: '0.78rem', 
            color: 'var(--text-muted)', 
            margin: 0, 
            textAlign: 'center',
            letterSpacing: '0.01em',
            fontWeight: 500
          }}>
            {isBn 
              ? 'বাইক রাইডারদের জন্য স্মার্ট ফুয়েল ট্র্যাকার ও সার্ভিস ম্যানেজার' 
              : 'Smart Fuel Tracking & Service Companion for Bikers'}
          </p>
        </div>

        {/* Action Links Row */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '10px',
          width: '100%',
          maxWidth: '420px'
        }}>
          {/* Live Web App */}
          <a
            href="https://ride-log-two.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: '1 1 160px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#38bdf8',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: '12px',
              background: isLight ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              transition: 'all 0.25s ease',
              boxShadow: '0 2px 8px rgba(56, 189, 248, 0.1)'
            }}
          >
            <Globe size={15} />
            <span>{isBn ? 'ওয়েবসাইট (Live Web App)' : 'Live Web App'}</span>
            <ExternalLink size={13} style={{ opacity: 0.7 }} />
          </a>

          {/* Facebook Page */}
          <a
            href="https://www.facebook.com/ridelogbd"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: '1 1 160px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#3b82f6',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: '12px',
              background: isLight ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              transition: 'all 0.25s ease',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span>{isBn ? 'ফেইসবুক পেজ' : 'RideLog BD Page'}</span>
            <ExternalLink size={13} style={{ opacity: 0.7 }} />
          </a>
        </div>

        {/* Developer Credit Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '20px',
          background: isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          fontSize: '0.8rem',
          color: 'var(--text-main)',
          marginTop: '2px'
        }}>
          <Code2 size={15} color="#10b981" />
          <span>{isBn ? 'ডেভেলপ করেছেন' : 'Crafted with'}</span>
          <Heart size={14} color="#ef4444" fill="#ef4444" style={{ display: 'inline' }} />
          <span>{isBn ? ':' : 'by'}</span>
          <a
            href="https://www.facebook.com/coder.wadud/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontWeight: 800,
              color: '#10b981',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>Coder Wadud</span>
            <Sparkles size={13} color="#f59e0b" />
          </a>
        </div>

        {/* Bottom Footer Metadata */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '4px',
          paddingTop: '10px',
          borderTop: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.06)',
          width: '100%'
        }}>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', margin: 0, fontWeight: 500 }}>
            © {new Date().getFullYear()} RideLog BD • {isBn ? 'সর্বস্বত্ব সংরক্ষিত' : 'All Rights Reserved'}
          </p>

          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={13} color="#10b981" />
            <span>{isBn ? 'অফলাইন মেমোরি ও রিয়েল-টাইম ক্লাউড সিঙ্ক সিকিউরড' : 'Secured Offline Memory & Real-Time Cloud Sync'}</span>
          </p>
        </div>

      </div>
    </footer>
  );
}
