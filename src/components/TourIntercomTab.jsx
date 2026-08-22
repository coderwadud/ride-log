import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Radio, Users, Volume2, VolumeX, ShieldCheck,
  PhoneOff, PhoneCall, Sparkles, Wifi, WifiOff, Loader, Headphones,
  CheckCircle2, AlertCircle, Info, Wind
} from 'lucide-react';
import { translations } from '../utils/translations';
import { RiderIntercomEngine, listenToIntercomSession, soundEffects } from '../utils/riderIntercom';

export default function TourIntercomTab({
  tourId,
  tour,
  lang = 'bn',
  user,
  isOrganizer,
  intercomEngine,
  setIntercomEngine,
  intercomState,
  setIntercomState
}) {
  const t = translations[lang] || translations['bn'];
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [pttPressed, setPttPressed] = useState(false);
  const [noiseFilter, setNoiseFilter] = useState(true);

  const pttButtonRef = useRef(null);

  // Listen to remote intercom session state in Firestore
  useEffect(() => {
    if (!tourId) return;
    const unsub = listenToIntercomSession(tourId, (session) => {
      setActiveSession(session);
    });
    return unsub;
  }, [tourId]);

  // Handle Spacebar for Push-To-Talk on desktop keyboard
  useEffect(() => {
    if (!intercomState?.isConnected || !intercomState?.pttMode) return;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handlePttStart();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handlePttEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [intercomState?.isConnected, intercomState?.pttMode]);

  // Start or Join Call
  const handleJoinCall = async () => {
    if (!user?.uid) {
      setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে প্রথমে লগইন করুন' : 'Please sign in first');
      return;
    }

    setConnecting(true);
    setErrorMsg('');

    try {
      let engine = intercomEngine;
      if (!engine) {
        engine = new RiderIntercomEngine(tourId, user, {
          pttMode: false,
          noiseSuppression: noiseFilter,
          onStateChange: (state) => {
            setIntercomState(state);
          },
          onSpeakingChange: (speaking) => {
            setIntercomState((prev) => ({ ...prev, isSpeaking: speaking }));
          }
        });
        setIntercomEngine(engine);
      }

      await engine.join();
    } catch (err) {
      console.error('Intercom join error:', err);
      setErrorMsg(err.message || (lang === 'bn' ? 'মাইক্রোফোন এক্সেস করা যায়নি' : 'Could not access microphone'));
    } finally {
      setConnecting(false);
    }
  };

  // Leave Call
  const handleLeaveCall = async () => {
    if (intercomEngine) {
      await intercomEngine.leave(true);
      setIntercomEngine(null);
      setIntercomState({
        isConnected: false,
        isMuted: false,
        isSpeaking: false,
        pttActive: false,
        pttMode: false,
        participants: {},
        peerCount: 0
      });
    }
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (!intercomEngine) return;
    const nextMute = !intercomState.isMuted;
    intercomEngine.setMuted(nextMute);
  };

  // Switch PTT Mode vs Open Mic
  const handleTogglePttMode = () => {
    if (!intercomEngine) return;
    const nextPtt = !intercomState.pttMode;
    intercomEngine.setMode(nextPtt);
  };

  // PTT Press / Release
  const handlePttStart = () => {
    if (!intercomEngine || !intercomState.pttMode) return;
    setPttPressed(true);
    intercomEngine.setPttPress(true);
  };

  const handlePttEnd = () => {
    if (!intercomEngine || !intercomState.pttMode) return;
    setPttPressed(false);
    intercomEngine.setPttPress(false);
  };

  const isConnected = !!intercomState?.isConnected;
  const isCallActive = !!activeSession?.active;
  const participantsList = Object.values(intercomState?.participants || activeSession?.participants || {});

  return (
    <div className="tour-intercom-tab">
      {/* Header Info Banner */}
      <div className="tour-intercom-header">
        <div className="tour-intercom-title-row">
          <div className="tour-intercom-badge">
            <Radio size={16} className="text-emerald-400" />
            <span>{lang === 'bn' ? 'রাইডার ভয়েস ইন্টারকম' : 'Rider Voice Intercom'}</span>
          </div>
          {isConnected && (
            <div className="tour-intercom-live-tag">
              <span className="live-dot" />
              <span>LIVE ({participantsList.length})</span>
            </div>
          )}
        </div>
        <p className="tour-intercom-subtitle">
          {lang === 'bn'
            ? 'ট্যুর চলাকালীন সকল বাইকারদের সাথে আনলিমিটেড লাইভ গ্রুপ ভয়েস কথা বলুন। কোনো ডেটাবেজ স্টোরেজ খরচ নেই।'
            : 'Crystal clear unlimited group voice communication for your ride. 0 Database storage cost.'}
        </p>
      </div>

      {errorMsg && (
        <div className="tour-intercom-error">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Intercom Stage */}
      {!isConnected ? (
        <div className="tour-intercom-idle-box">
          <div className="tour-intercom-idle-radar">
            <div className="radar-circle circle-1" />
            <div className="radar-circle circle-2" />
            <div className="radar-center-icon">
              <Radio size={36} className="text-emerald-400" />
            </div>
          </div>

          <div className="tour-intercom-idle-info">
            {isCallActive ? (
              <>
                <h3 style={{ color: '#10b981', margin: '0 0 6px' }}>
                  {lang === 'bn' ? 'গ্রুপ কল চলছে!' : 'Group Call in Progress!'}
                </h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: 0 }}>
                  {activeSession?.startedByName} {lang === 'bn' ? 'কল শুরু করেছেন' : 'started the call'} • {participantsList.length} {lang === 'bn' ? 'জন যুক্ত আছেন' : 'riders in call'}
                </p>
              </>
            ) : (
              <>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 6px' }}>
                  {lang === 'bn' ? 'ইন্টারকম কল শুরু করুন' : 'Start Group Intercom'}
                </h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: 0 }}>
                  {lang === 'bn' ? 'গ্রুপের সকল মেম্বারের কাছে রিং যাবে এবং সবাই যুক্ত হতে পারবে' : 'All tour members will receive a ring and can join instantly'}
                </p>
              </>
            )}
          </div>

          <button
            className="tour-btn-primary large intercom-join-btn"
            onClick={handleJoinCall}
            disabled={connecting}
            style={{
              background: isCallActive ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: isCallActive ? '0 8px 24px rgba(16,185,129,0.3)' : '0 8px 24px rgba(99,102,241,0.3)'
            }}
          >
            {connecting ? (
              <>
                <Loader size={18} className="spin" />
                <span>{lang === 'bn' ? 'কানেক্ট হচ্ছে...' : 'Connecting...'}</span>
              </>
            ) : (
              <>
                <PhoneCall size={18} />
                <span>{isCallActive ? (lang === 'bn' ? 'গ্রুপ কলে যোগ দিন' : 'Join Group Call') : (lang === 'bn' ? 'ইন্টারকম কল শুরু করুন' : 'Start Group Call')}</span>
              </>
            )}
          </button>

          {/* Feature Badges */}
          <div className="tour-intercom-feature-row">
            <div className="feature-pill">
              <Sparkles size={13} className="text-amber-400" />
              <span>{lang === 'bn' ? '১০০% ফ্রি WebRTC P2P' : '100% Free WebRTC P2P'}</span>
            </div>
            <div className="feature-pill">
              <Headphones size={13} className="text-indigo-400" />
              <span>{lang === 'bn' ? 'হেলমেট হেডসেট সাপোর্ট' : 'Helmet Headset Ready'}</span>
            </div>
            <div className="feature-pill">
              <Wind size={13} className="text-teal-400" />
              <span>{lang === 'bn' ? 'উইন্ড নয়েজ ফিল্টার' : 'Wind Noise Filter'}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Active Connected Intercom View */
        <div className="tour-intercom-active-box">
          {/* Riders Mesh Grid */}
          <div className="tour-intercom-riders-grid">
            {participantsList.map((rider) => {
              const isMe = rider.uid === user?.uid;
              const isSpeaking = isMe ? intercomState?.isSpeaking : rider.isSpeaking;
              const isMuted = isMe ? intercomState?.isMuted : rider.isMuted;

              return (
                <div
                  key={rider.uid}
                  className={`intercom-rider-card ${isSpeaking ? 'speaking' : ''} ${isMuted ? 'muted' : ''}`}
                >
                  <div className="intercom-avatar-wrap">
                    {rider.photoURL ? (
                      <img src={rider.photoURL} alt={rider.name} className="intercom-avatar" />
                    ) : (
                      <div className="intercom-avatar-placeholder">
                        {rider.name?.charAt(0)?.toUpperCase() || 'R'}
                      </div>
                    )}
                    {isSpeaking && <div className="speaking-pulse-ring" />}
                    <div className={`intercom-status-icon ${isMuted ? 'muted' : 'active'}`}>
                      {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                    </div>
                  </div>

                  <div className="intercom-rider-info">
                    <span className="intercom-rider-name">
                      {rider.name} {isMe && `(${lang === 'bn' ? 'আপনি' : 'You'})`}
                    </span>
                    <span className="intercom-rider-state">
                      {isSpeaking ? (
                        <span className="text-emerald-400 font-bold">{lang === 'bn' ? 'কথা বলছেন...' : 'Speaking...'}</span>
                      ) : isMuted ? (
                        <span className="text-gray-400">{lang === 'bn' ? 'মাইক বন্ধ' : 'Muted'}</span>
                      ) : (
                        <span className="text-indigo-300">{lang === 'bn' ? 'শুনছেন' : 'Listening'}</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Push-To-Talk (PTT) / Open Mic Control Stage */}
          <div className="tour-intercom-controls-stage">
            {intercomState?.pttMode ? (
              <div className="ptt-mode-container">
                <button
                  ref={pttButtonRef}
                  className={`ptt-big-button ${pttPressed ? 'active' : ''}`}
                  onMouseDown={handlePttStart}
                  onMouseUp={handlePttEnd}
                  onTouchStart={handlePttStart}
                  onTouchEnd={handlePttEnd}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <Mic size={38} className={pttPressed ? 'text-white' : 'text-emerald-400'} />
                  <span className="ptt-btn-text">
                    {pttPressed ? (lang === 'bn' ? 'কথা বলুন...' : 'TRANSMITTING...') : (lang === 'bn' ? 'চেপে ধরে কথা বলুন (PTT)' : 'HOLD TO TALK')}
                  </span>
                  <span className="ptt-btn-subtext">
                    {lang === 'bn' ? 'কীবোর্ডে [Spacebar] চাপতে পারেন' : 'or press Spacebar'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="open-mic-container">
                <button
                  className={`intercom-round-btn ${intercomState?.isMuted ? 'muted' : 'active'}`}
                  onClick={handleToggleMute}
                  title={intercomState?.isMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {intercomState?.isMuted ? <MicOff size={28} /> : <Mic size={28} />}
                </button>
                <span className="control-label">
                  {intercomState?.isMuted ? (lang === 'bn' ? 'মাইক অন করুন' : 'Unmute Mic') : (lang === 'bn' ? 'মাইক চালু আছে' : 'Mic Live (Open Mic)')}
                </span>
              </div>
            )}

            {/* Bottom Floating Mode Toggles */}
            <div className="intercom-mode-toggle-row">
              <button
                className={`intercom-mode-btn ${intercomState?.pttMode ? 'selected' : ''}`}
                onClick={handleTogglePttMode}
              >
                <Radio size={14} />
                <span>{intercomState?.pttMode ? 'Push-To-Talk (PTT)' : 'Open Mic (খোলা মাইক)'}</span>
              </button>

              <button
                className="intercom-hangup-btn"
                onClick={handleLeaveCall}
                title="Leave Intercom"
              >
                <PhoneOff size={16} />
                <span>{lang === 'bn' ? 'কল ত্যাগ করুন' : 'Leave'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rider Tips Box */}
      <div className="tour-intercom-tips">
        <div className="tips-title">
          <Info size={14} className="text-indigo-400" />
          <span>{lang === 'bn' ? 'রাইডারদের জন্য টিপস' : 'Rider Tips'}</span>
        </div>
        <ul className="tips-list">
          <li>{lang === 'bn' ? 'বাইক চালানোর সময় আপনি ম্যাপ বা GPS Tracker চালু করলেও ইন্টারকম চালু থাকবে।' : 'Voice will stay connected even when browsing the live Map or GPS Tracker.'}</li>
          <li>{lang === 'bn' ? 'উইন্ড নয়েজ কমাতে হেলমেট হেডসেট বা এয়ারপডস ব্যবহার করুন।' : 'Use a Bluetooth helmet headset for automatic road & wind noise suppression.'}</li>
        </ul>
      </div>
    </div>
  );
}
