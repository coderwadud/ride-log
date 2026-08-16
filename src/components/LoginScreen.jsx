import React, { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from '../utils/firebase';
import { Fuel, Wrench, BarChart3, Cloud, Eye, EyeOff, Bike, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

import darkLogo from '../assets/dark-mode-logo.png';

const getFriendlyErrorMessage = (code, isSignUp) => {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return isSignUp
        ? 'Failed to create account.'
        : 'Login failed. Please try again.';
  }
};

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await signInWithGoogle();
      // onAuthStateChanged in App.jsx will handle state update
    } catch (err) {
      console.error('Google login error:', err);
      setError('Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (isSignUp && password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      console.error('Email auth error:', err);
      setError(getFriendlyErrorMessage(err?.code, isSignUp));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await resetPassword(email);
      setSuccessMsg('Password reset link sent! Check your email inbox.');
    } catch (err) {
      console.error('Reset password error:', err);
      if (err?.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err?.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to send reset link. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <Fuel size={16} color="#10b981" />, text: 'Fuel log tracking' },
    { icon: <Wrench size={16} color="#8b5cf6" />, text: 'Service reminders' },
    { icon: <BarChart3 size={16} color="#38bdf8" />, text: 'Mileage analytics' },
    { icon: <Cloud size={16} color="#f59e0b" />, text: 'Cloud sync' },
  ];

  return (
    <div style={styles.overlay}>
      {/* Animated background blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.blob3} />

      <div style={styles.card}>
        {/* App Logo / Image */}
        <div style={styles.logoWrap}>
          <img
            src={darkLogo}
            alt="RideLog BD"
            style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
          />
        </div>
        <p style={styles.subtitle}>Track your bike fuel & service effortlessly</p>

        {isForgotPassword ? (
          <div>
            <div style={{ textAlign: 'left' }}>
              <button
                type="button"
                style={styles.backBtn}
                onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </div>

            <h2 style={styles.resetTitle}>Reset Password</h2>
            <p style={styles.resetDesc}>
              Enter your email address and we'll send you a password reset link.
            </p>

            <form onSubmit={handleResetPassword} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? <div style={styles.spinner} /> : 'Send Reset Link'}
              </button>
            </form>

            {successMsg && (
              <div style={styles.success}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div style={styles.error}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Features */}
            <div style={styles.features}>
              {features.map((f, i) => (
                <div key={i} style={styles.featureItem}>
                  <span style={styles.featureIcon}>{f.icon}</span>
                  <span style={styles.featureText}>{f.text}</span>
                </div>
              ))}
            </div>

            {/* Tab Toggle: Sign In / Sign Up */}
            <div style={styles.tabWrap}>
              <button
                type="button"
                style={{
                  ...styles.tabBtn,
                  ...( !isSignUp ? styles.tabBtnActive : {} )
                }}
                onClick={() => { setIsSignUp(false); setError(''); setSuccessMsg(''); }}
              >
                Sign In
              </button>
              <button
                type="button"
                style={{
                  ...styles.tabBtn,
                  ...( isSignUp ? styles.tabBtnActive : {} )
                }}
                onClick={() => { setIsSignUp(true); setError(''); setSuccessMsg(''); }}
              >
                Sign Up
              </button>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailAuth} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <div style={styles.labelRow}>
                  <label style={styles.inputLabel}>Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      style={styles.forgotBtn}
                      onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMsg(''); }}
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div style={styles.passwordWrap}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={styles.input}
                  />
                  <button
                    type="button"
                    style={styles.eyeBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="var(--text-muted, #94a3b8)" />
                    ) : (
                      <Eye size={18} color="var(--text-muted, #94a3b8)" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <div style={styles.spinner} />
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={styles.divider}>
              <div style={styles.dividerLine} />
              <span style={styles.dividerText}>OR with Google</span>
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
              type="button"
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
                {loading ? 'Please wait...' : 'Continue with Google'}
              </span>
            </button>

            {/* Error */}
            {error && (
              <div style={styles.error}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </>
        )}

        {/* Footer note */}
        <p style={styles.footerNote}>
          Sign in to keep your data safe and synced across devices.
        </p>

        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
          Developed with ❤️ by <a href="https://www.facebook.com/coder.wadud/" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', fontWeight: 'bold', textDecoration: 'none' }}>Coder Wadud</a>
          <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '0.75rem' }}>
            <a href="https://www.facebook.com/ridelogbd" target="_blank" rel="noopener noreferrer" style={{ color: '#1877f2', textDecoration: 'none' }}>RideLog BD Facebook Page</a>
            •
            <a href="https://ride-log-two.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>Live Web App</a>
          </div>
        </div>
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
    padding: '32px 24px 24px',
    maxWidth: '390px',
    width: '100%',
    boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(12px)',
    textAlign: 'center',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  logoIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(16,185,129,0.2) 100%)',
    border: '1px solid rgba(56,189,248,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#38bdf8',
    boxShadow: '0 8px 24px rgba(56,189,248,0.15)',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #38bdf8 0%, #10b981 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: '0 0 6px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted, #94a3b8)',
    margin: '0 0 20px',
    lineHeight: 1.4,
  },
  features: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '20px',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #94a3b8)',
    fontWeight: 500,
  },
  tabWrap: {
    display: 'flex',
    background: 'rgba(0, 0, 0, 0.25)',
    borderRadius: '12px',
    padding: '4px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  tabBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted, #94a3b8)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabBtnActive: {
    background: 'linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(16,185,129,0.2) 100%)',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,0.3)',
    boxShadow: '0 2px 8px rgba(56,189,248,0.15)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    textAlign: 'left',
    marginBottom: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted, #94a3b8)',
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    color: '#38bdf8',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'none',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #94a3b8)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 0',
    marginBottom: '14px',
  },
  resetTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-main, #f1f5f9)',
    margin: '0 0 6px',
  },
  resetDesc: {
    fontSize: '0.82rem',
    color: 'var(--text-muted, #94a3b8)',
    margin: '0 0 16px',
    lineHeight: 1.4,
  },
  passwordWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(15, 23, 42, 0.6)',
    color: 'var(--text-main, #f1f5f9)',
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
  eyeBtn: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    opacity: 0.7,
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #38bdf8 0%, #10b981 100%)',
    color: '#0f172a',
    fontSize: '0.92rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '4px',
    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)',
    transition: 'all 0.2s ease',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
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
    padding: '12px 20px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--text-main, #f1f5f9)',
    fontSize: '0.92rem',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '0.82rem',
    color: '#f87171',
    margin: '0 0 12px',
    padding: '8px 12px',
    background: 'rgba(239,68,68,0.08)',
    borderRadius: '8px',
    border: '1px solid rgba(239,68,68,0.2)',
  },
  success: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '0.82rem',
    color: '#10b981',
    margin: '0 0 12px',
    padding: '8px 12px',
    background: 'rgba(16,185,129,0.08)',
    borderRadius: '8px',
    border: '1px solid rgba(16,185,129,0.2)',
    textAlign: 'left',
  },
  footerNote: {
    fontSize: '0.75rem',
    color: 'var(--text-dim, #64748b)',
    lineHeight: 1.5,
    margin: 0,
  },
};



