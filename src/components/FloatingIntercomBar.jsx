import React from 'react';
import { Mic, MicOff, Radio, PhoneOff, Maximize2, Users } from 'lucide-react';

export default function FloatingIntercomBar({
  intercomState,
  intercomEngine,
  onOpenIntercomTab,
  onLeaveCall,
  lang = 'bn'
}) {
  if (!intercomState?.isConnected) return null;

  const participantsList = Object.values(intercomState?.participants || {});
  const activeSpeaker = participantsList.find((p) => p.isSpeaking);

  const handleToggleMute = (e) => {
    e.stopPropagation();
    if (!intercomEngine) return;
    intercomEngine.setMuted(!intercomState.isMuted);
  };

  return (
    <div className="floating-intercom-bar" onClick={onOpenIntercomTab}>
      <div className="floating-intercom-left">
        <div className="floating-live-dot-wrap">
          <span className="floating-live-pulse" />
          <Radio size={15} className="text-emerald-400" />
        </div>

        <div className="floating-intercom-info">
          <div className="floating-intercom-title">
            <span className="font-semibold text-white">
              {lang === 'bn' ? 'ইন্টারকম লাইভ' : 'Rider Intercom'}
            </span>
            <span className="floating-participant-count">
              <Users size={11} /> {participantsList.length}
            </span>
          </div>

          <div className="floating-speaker-status">
            {activeSpeaker ? (
              <span className="text-emerald-400 font-medium truncate">
                🎤 {activeSpeaker.name} {lang === 'bn' ? 'কথা বলছেন...' : 'is talking...'}
              </span>
            ) : intercomState.isMuted ? (
              <span className="text-gray-400">
                {lang === 'bn' ? 'মাইক বন্ধ' : 'Muted'}
              </span>
            ) : (
              <span className="text-indigo-300">
                {lang === 'bn' ? 'সবাই শুনছেন' : 'Listening...'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="floating-intercom-actions">
        {/* Quick Mute Toggle */}
        <button
          className={`floating-quick-mute-btn ${intercomState.isMuted ? 'muted' : 'active'}`}
          onClick={handleToggleMute}
          title={intercomState.isMuted ? 'Unmute' : 'Mute'}
        >
          {intercomState.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
        </button>

        {/* Maximize to Intercom Tab */}
        <button
          className="floating-maximize-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenIntercomTab();
          }}
          title="Open Intercom Tab"
        >
          <Maximize2 size={13} />
        </button>

        {/* Hangup */}
        <button
          className="floating-hangup-btn"
          onClick={(e) => {
            e.stopPropagation();
            onLeaveCall();
          }}
          title="Leave Intercom"
        >
          <PhoneOff size={14} />
        </button>
      </div>
    </div>
  );
}
