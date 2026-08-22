import React, { useEffect, useState, useRef } from 'react';
import { PhoneCall, PhoneOff, Radio, X, Users } from 'lucide-react';
import { soundEffects } from '../utils/riderIntercom';

export default function IncomingCallBanner({
  activeSession,
  currentUser,
  isConnected,
  onJoinCall,
  lang = 'bn'
}) {
  const [dismissedSessionId, setDismissedSessionId] = useState(null);
  const ringIntervalRef = useRef(null);

  const isCallActive = !!activeSession?.active;
  const isMeInCall = !!(currentUser?.uid && activeSession?.participants?.[currentUser.uid]);
  const isCallerMe = activeSession?.startedBy === currentUser?.uid;

  // Unique session identifier to reset dismissal on new calls
  const sessionId = activeSession?.startedAt || null;
  const isDismissed = dismissedSessionId === sessionId;

  const showBanner = isCallActive && !isConnected && !isMeInCall && !isCallerMe && !isDismissed;

  // Sound Ringer Effect
  useEffect(() => {
    if (showBanner) {
      soundEffects.playIncomingRing();
      ringIntervalRef.current = setInterval(() => {
        soundEffects.playIncomingRing();
      }, 4000);
    } else {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
    }

    return () => {
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    };
  }, [showBanner]);

  if (!showBanner) return null;

  const participantsCount = Object.keys(activeSession?.participants || {}).length;

  return (
    <div className="incoming-intercom-banner">
      <div className="incoming-intercom-pulse-icon">
        <Radio size={20} className="text-white animate-pulse" />
      </div>

      <div className="incoming-intercom-text">
        <strong>
          {activeSession?.startedByName || 'A rider'} {lang === 'bn' ? 'গ্রুপ কল শুরু করেছেন!' : 'started a group call!'}
        </strong>
        <span>
          {participantsCount} {lang === 'bn' ? 'জন বাইকার লাইভ আছেন' : 'riders in call'} • {lang === 'bn' ? 'যোগ দিতে ক্লিক করুন' : 'Tap to join'}
        </span>
      </div>

      <div className="incoming-intercom-actions">
        <button
          className="incoming-dismiss-btn"
          onClick={() => setDismissedSessionId(sessionId)}
          title="Dismiss"
        >
          <X size={16} />
        </button>

        <button
          className="incoming-join-btn"
          onClick={() => onJoinCall()}
          title="Join Voice Intercom"
        >
          <PhoneCall size={16} />
          <span>{lang === 'bn' ? 'যোগ দিন' : 'Join'}</span>
        </button>
      </div>
    </div>
  );
}
