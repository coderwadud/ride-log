import React, { useState } from 'react';
import { signInWithGoogle } from '../utils/firebase';

export default function LoginScreen({ lang = 'bn' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      // onAuthStateChanged in App.jsx will handle state update
    } catch (err) {
      console.error('Login error:', err);
      setError(
        lang === 'bn'
          ? '⚠️ লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'
          : '⚠️ Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      {/* Animated background blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.blob3} />

      <div style={styles.card}>
        {/* App Logo / Icon */}
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
              <rect x="9" y="11" width="14" height="10" rx="2" />
              <circle cx="12" cy="16" r="1" />
              <circle cx="20" cy="16" r="1" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 style={styles.title}>
          {lang === 'bn' ? 'রাইড লগ' : 'Ride Log'}
        </h1>
        <p style={styles.subtitle}>
          {lang === 'bn'
            ? 'আপনার বাইকের জ্বালানি ও সার্ভিস ট্র্যাক করুন'
            : 'Track your bike fuel & service effortlessly'}
        </p>

        {/* Features */}
        <div style={styles.features}>
          {[
            { icon: '⛽', text: lang === 'bn' ? 'জ্বালানি লগ ট্র্যাক' : 'Fuel log tracking' },
            { icon: '🔧', text: lang === 'bn' ? 'সার্ভিস রিমাইন্ডার' : 'Service reminders' },
            { icon: '📊', text: lang === 'bn' ? 'মাইলেজ বিশ্লেষণ' : 'Mileage analytics' },
            { icon: '☁️', text: lang === 'bn' ? 'ক্লাউড সিঙ্ক' : 'Cloud sync' },
          ].map((f, i) => (
            <div key={i} style={styles.featureItem}>
              <span style={styles.featureIcon}>{f.icon}</span>
              <span style={styles.featureText}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>
            {lang === 'bn' ? 'শুরু করুন' : 'Get started'}
          </span>
          <div style={styles.dividerLine} />
        </div>

        {/* Google Sign In Button */}
        <button
          style={{
            ...styles.googleBtn,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <div style={styles.spinner} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span style={styles.googleBtnText}>
            {loading
              ? (lang === 'bn' ? 'লগইন হচ্ছে...' : 'Signing in...')
              : (lang === 'bn' ? 'Google দিয়ে লগইন করুন' : 'Continue with Google')}
          </span>
        </button>

        {/* Error */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Footer note */}
        <p style={styles.footerNote}>
          {lang === 'bn'
            ? 'লগইন করলে আপনার ডাটা সুরক্ষিত থাকবে এবং ক্লাউডে সিঙ্ক হবে।'
            : 'Sign in to keep your data safe and synced across devices.'}
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base, #0f172a)',
    position: 'relative',
    overflow: 'hidden',
    padding: '16px',
  },
  blob1: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)',
    top: '-100px',
    left: '-100px',
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute',
    width: '350px',
    height: '350px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)',
    bottom: '-80px',
    right: '-80px',
    pointerEvents: 'none',
  },
  blob3: {
    position: 'absolute',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    background: 'var(--bg-card, rgba(30,41,59,0.95))',
    border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
    borderRadius: '24px',
    padding: '36px 28px 28px',
    maxWidth: '380px',
    width: '100%',
    boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(12px)',
    textAlign: 'center',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  logoIcon: {
    width: '72px',
    height: '72px',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(16,185,129,0.2) 100%)',
    border: '1px solid rgba(56,189,248,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#38bdf8',
    boxShadow: '0 8px 24px rgba(56,189,248,0.15)',
  },
  title: {
    fontSize: '1.9rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #38bdf8 0%, #10b981 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: '0 0 8px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '0.88rem',
    color: 'var(--text-muted, #94a3b8)',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  features: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '24px',
    textAlign: 'left',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  featureIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  featureText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #94a3b8)',
    fontWeight: 500,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '18px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontSize: '0.75rem',
    color: 'var(--text-dim, #64748b)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '14px 20px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--text-main, #f1f5f9)',
    fontSize: '0.95rem',
    fontWeight: 600,
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(8px)',
    marginBottom: '14px',
  },
  googleBtnText: {
    fontFamily: 'inherit',
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  error: {
    fontSize: '0.82rem',
    color: '#f87171',
    margin: '0 0 12px',
    padding: '8px 12px',
    background: 'rgba(239,68,68,0.08)',
    borderRadius: '8px',
    border: '1px solid rgba(239,68,68,0.2)',
  },
  footerNote: {
    fontSize: '0.75rem',
    color: 'var(--text-dim, #64748b)',
    lineHeight: 1.5,
    margin: 0,
  },
};
