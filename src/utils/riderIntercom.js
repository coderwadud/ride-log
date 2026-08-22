/**
 * RideLog Rider Intercom & Group Voice Engine
 * Zero-Database Storage Cost WebRTC Full-Mesh Voice Engine.
 * 
 * Features:
 * - WebRTC P2P Audio Streaming with Google Free STUN servers
 * - Web Audio API Sound Synthesizer (Chimes, Ringtone, PTT Chirp)
 * - Real-time Speaking Detection (Decibel Analyser)
 * - Push-To-Talk (PTT) & Open Mic Modes
 * - Road & Wind Noise Suppression + Acoustic Echo Cancellation
 * - Ephemeral Signaling via Firestore (auto-cleaned on session end)
 */

import { db } from './firebase';
import {
  doc, collection, setDoc, getDoc, getDocs, deleteDoc,
  updateDoc, onSnapshot, writeBatch
} from 'firebase/firestore';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' }
  ],
  iceCandidatePoolSize: 10
};

// ─── AUDIO SYNTHESIZER (No external assets required) ──────────────────────────

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
  }

  getAudioContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playPttBeep(isStart = true) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (isStart) {
        // Walkie-talkie chirp (high frequency chirp)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.08);
      } else {
        // PTT Release tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch {
      // Ignore audio synthesis errors
    }
  }

  playJoinChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.08, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.16);
      });
    } catch {}
  }

  playLeaveChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [783.99, 659.25, 523.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.08, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.16);
      });
    } catch {}
  }

  playIncomingRing() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(480, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {}
  }
}

export const soundEffects = new SoundSynthesizer();

// ─── FIRESTORE SIGNALING HELPERS ──────────────────────────────────────────────

export function getIntercomSessionRef(tourId) {
  return doc(db, 'tours', tourId, 'intercom', 'session');
}

export function getIntercomSignalsCol(tourId) {
  return collection(db, 'tours', tourId, 'intercom_signals');
}

/**
 * Listen to Tour Intercom Session status (e.g. for active calls and participant list)
 */
export function listenToIntercomSession(tourId, callback) {
  if (!tourId) return () => {};
  const sessionRef = getIntercomSessionRef(tourId);
  return onSnapshot(sessionRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      callback(null);
    }
  }, (err) => {
    console.debug('Intercom session snapshot listener:', err.message);
  });
}

/**
 * Clean up ephemeral signaling messages for a tour
 */
export async function clearIntercomSignals(tourId) {
  try {
    const colRef = getIntercomSignalsCol(tourId);
    const snap = await getDocs(colRef);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.debug('Clear intercom signals error:', err.message);
  }
}

// ─── RIDER INTERCOM CLIENT ENGINE ─────────────────────────────────────────────

export class RiderIntercomEngine {
  constructor(tourId, currentUser, options = {}) {
    this.tourId = tourId;
    this.user = currentUser;
    this.options = {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      pttMode: false,
      ...options
    };

    this.localStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.meterInterval = null;

    this.peerConnections = new Map(); // peerUid -> RTCPeerConnection
    this.remoteStreams = new Map();   // peerUid -> MediaStream
    this.remoteAudioElements = new Map(); // peerUid -> HTMLAudioElement

    this.isMuted = this.options.pttMode; // Default muted if in PTT mode
    this.isSpeaking = false;
    this.pttActive = false;
    this.isConnected = false;
    this.participants = {};

    this.unsubSession = null;
    this.unsubSignals = null;

    this.onStateChange = options.onStateChange || (() => {});
    this.onSpeakingChange = options.onSpeakingChange || (() => {});
  }

  /**
   * Initialize Local Audio Stream with Motorcycle Wind / Noise Suppression
   */
  async setupLocalAudio() {
    if (this.localStream) return this.localStream;

    const constraints = {
      audio: {
        echoCancellation: this.options.echoCancellation,
        noiseSuppression: this.options.noiseSuppression,
        autoGainControl: this.options.autoGainControl,
        channelCount: 1,
        sampleRate: 48000
      },
      video: false
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.applyMuteState();
      this.setupAudioMeter(this.localStream);
      return this.localStream;
    } catch (err) {
      console.error('Microphone access error:', err);
      throw new Error(err.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not access microphone');
    }
  }

  /**
   * Real-time Voice Decibel Analyser for Speaking State
   */
  setupAudioMeter(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.meterInterval = setInterval(() => {
        if (!this.localStream || this.isMuted) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.onSpeakingChange(false);
            this.broadcastSpeakingState(false);
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Threshold for motorcycle speech
        const speakingNow = average > 14;
        if (speakingNow !== this.isSpeaking) {
          this.isSpeaking = speakingNow;
          this.onSpeakingChange(speakingNow);
          this.broadcastSpeakingState(speakingNow);
        }
      }, 150);
    } catch (err) {
      console.debug('Audio meter setup warning:', err);
    }
  }

  broadcastSpeakingState(speaking) {
    if (!this.isConnected || !this.tourId || !this.user?.uid) return;
    const sessionRef = getIntercomSessionRef(this.tourId);
    updateDoc(sessionRef, {
      [`participants.${this.user.uid}.isSpeaking`]: speaking
    }).catch(() => {});
  }

  /**
   * Start or Join Tour Intercom Call
   */
  async join() {
    await this.setupLocalAudio();

    const sessionRef = getIntercomSessionRef(this.tourId);
    const sessionSnap = await getDoc(sessionRef);

    const myProfile = {
      uid: this.user.uid,
      name: this.user.displayName || this.user.email?.split('@')[0] || 'Rider',
      photoURL: this.user.photoURL || '',
      isMuted: this.isMuted,
      isSpeaking: false,
      joinedAt: new Date().toISOString()
    };

    if (!sessionSnap.exists() || !sessionSnap.data()?.active) {
      // 1. Start new session as Host
      await setDoc(sessionRef, {
        active: true,
        startedBy: this.user.uid,
        startedByName: myProfile.name,
        startedAt: new Date().toISOString(),
        participants: {
          [this.user.uid]: { ...myProfile, role: 'host' }
        }
      });
      soundEffects.playJoinChime();
    } else {
      // 2. Join existing session
      await updateDoc(sessionRef, {
        [`participants.${this.user.uid}`]: { ...myProfile, role: 'member' }
      });
      soundEffects.playJoinChime();
    }

    this.isConnected = true;
    this.listenToSession();
    this.listenToSignals();
    this.notifyState();
  }

  /**
   * Monitor Active Session & Manage Peer Mesh
   */
  listenToSession() {
    const sessionRef = getIntercomSessionRef(this.tourId);
    this.unsubSession = onSnapshot(sessionRef, async (snap) => {
      if (!snap.exists() || !snap.data()?.active) {
        // Session ended by host or empty
        this.leave(false);
        return;
      }

      const data = snap.data();
      this.participants = data.participants || {};

      // Connect to other participants in the mesh
      const participantUids = Object.keys(this.participants).filter(id => id !== this.user.uid);

      for (const peerUid of participantUids) {
        // If peer joined and no connection exists yet
        if (!this.peerConnections.has(peerUid)) {
          // The peer with alphabetically lower UID initiates the WebRTC offer
          if (this.user.uid < peerUid) {
            await this.createPeerConnection(peerUid, true);
          } else {
            await this.createPeerConnection(peerUid, false);
          }
        }
      }

      // Cleanup peers who left
      for (const [peerUid] of this.peerConnections) {
        if (!this.participants[peerUid]) {
          this.closePeer(peerUid);
        }
      }

      this.notifyState();
    });
  }

  /**
   * Create WebRTC Peer Connection with a Fellow Rider
   */
  async createPeerConnection(peerUid, isInitiator) {
    if (this.peerConnections.has(peerUid)) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(peerUid, pc);

    // Add local microphone tracks to peer
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle remote audio stream arrival
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.remoteStreams.set(peerUid, remoteStream);
        this.attachRemoteAudio(peerUid, remoteStream);
        this.notifyState();
      }
    };

    // Send ICE candidates to peer via Firestore signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerUid, {
          type: 'candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(peerUid);
      }
    };

    // If initiator, create and send WebRTC Offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);
        await this.sendSignal(peerUid, {
          type: 'offer',
          sdp: offer.sdp
        });
      } catch (err) {
        console.error(`Error creating offer for ${peerUid}:`, err);
      }
    }
  }

  /**
   * Attach Remote Audio Stream to hidden HTMLAudioElement
   */
  attachRemoteAudio(peerUid, stream) {
    let audioEl = this.remoteAudioElements.get(peerUid);
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      this.remoteAudioElements.set(peerUid, audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play().catch((e) => console.debug('Audio play autoplay handled:', e));
  }

  /**
   * Send Ephemeral Signaling Message (Offer / Answer / ICE Candidate)
   */
  async sendSignal(toUid, data) {
    try {
      const signalsCol = getIntercomSignalsCol(this.tourId);
      const signalDoc = doc(signalsCol);
      await setDoc(signalDoc, {
        from: this.user.uid,
        to: toUid,
        data,
        createdAt: Date.now()
      });
    } catch (err) {
      console.debug('Signaling error:', err.message);
    }
  }

  /**
   * Listen for Incoming WebRTC Signals
   */
  listenToSignals() {
    const signalsCol = getIntercomSignalsCol(this.tourId);
    this.unsubSignals = onSnapshot(signalsCol, async (snap) => {
      const docs = snap.docChanges();
      for (const change of docs) {
        if (change.type === 'added') {
          const signal = change.doc.data();
          if (signal.to === this.user.uid) {
            // Delete signal doc immediately to keep database at 0 storage
            deleteDoc(change.doc.ref).catch(() => {});
            await this.handleIncomingSignal(signal.from, signal.data);
          }
        }
      }
    });
  }

  /**
   * Handle WebRTC SDP Offer/Answer and ICE Candidates
   */
  async handleIncomingSignal(fromUid, payload) {
    let pc = this.peerConnections.get(fromUid);

    if (payload.type === 'offer') {
      if (!pc) {
        await this.createPeerConnection(fromUid, false);
        pc = this.peerConnections.get(fromUid);
      }
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await this.sendSignal(fromUid, {
            type: 'answer',
            sdp: answer.sdp
          });
        } catch (err) {
          console.error(`Failed handling offer from ${fromUid}:`, err);
        }
      }
    } else if (payload.type === 'answer') {
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
        } catch (err) {
          console.error(`Failed setting answer from ${fromUid}:`, err);
        }
      }
    } else if (payload.type === 'candidate' && payload.candidate) {
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.debug(`Candidate addition error:`, err);
        }
      }
    }
  }

  closePeer(peerUid) {
    const pc = this.peerConnections.get(peerUid);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerUid);
    }
    const audioEl = this.remoteAudioElements.get(peerUid);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      this.remoteAudioElements.delete(peerUid);
    }
    this.remoteStreams.delete(peerUid);
  }

  /**
   * Mute / Unmute Control
   */
  setMuted(muted) {
    this.isMuted = muted;
    this.applyMuteState();
    if (!muted) {
      soundEffects.playPttBeep(true);
    }
    if (this.tourId && this.user?.uid) {
      const sessionRef = getIntercomSessionRef(this.tourId);
      updateDoc(sessionRef, {
        [`participants.${this.user.uid}.isMuted`]: muted
      }).catch(() => {});
    }
    this.notifyState();
  }

  applyMuteState() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !this.isMuted;
      });
    }
  }

  /**
   * Push-To-Talk (PTT) Hold / Release
   */
  setPttPress(pressed) {
    if (!this.options.pttMode) return;
    this.pttActive = pressed;
    if (pressed) {
      soundEffects.playPttBeep(true);
      this.setMuted(false);
    } else {
      soundEffects.playPttBeep(false);
      this.setMuted(true);
    }
  }

  setMode(isPtt) {
    this.options.pttMode = isPtt;
    if (isPtt) {
      this.setMuted(true);
    } else {
      this.setMuted(false);
    }
  }

  /**
   * Leave Call and Cleanly Reset
   */
  async leave(notifyServer = true) {
    soundEffects.playLeaveChime();

    if (this.unsubSession) this.unsubSession();
    if (this.unsubSignals) this.unsubSignals();
    if (this.meterInterval) clearInterval(this.meterInterval);

    // Close all WebRTC peer connections
    for (const [peerUid] of this.peerConnections) {
      this.closePeer(peerUid);
    }

    // Stop local microphone tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }

    // Remove self from Firestore session
    if (notifyServer && this.tourId && this.user?.uid) {
      try {
        const sessionRef = getIntercomSessionRef(this.tourId);
        const snap = await getDoc(sessionRef);
        if (snap.exists()) {
          const currentParts = snap.data()?.participants || {};
          delete currentParts[this.user.uid];

          const remainingCount = Object.keys(currentParts).length;
          if (remainingCount === 0) {
            // No one left in call -> Reset session to inactive & clear signals
            await setDoc(sessionRef, { active: false, participants: {} });
            clearIntercomSignals(this.tourId);
          } else {
            await updateDoc(sessionRef, {
              participants: currentParts
            });
          }
        }
      } catch (err) {
        console.debug('Leave session cleanup error:', err.message);
      }
    }

    this.isConnected = false;
    this.isSpeaking = false;
    this.participants = {};
    this.notifyState();
  }

  notifyState() {
    this.onStateChange({
      isConnected: this.isConnected,
      isMuted: this.isMuted,
      isSpeaking: this.isSpeaking,
      pttActive: this.pttActive,
      pttMode: this.options.pttMode,
      participants: this.participants,
      peerCount: this.peerConnections.size
    });
  }
}
