/**
 * Tour Management Storage — Firestore CRUD
 * All operations for Tours, Members, Expenses, Fund Contributions, and Live Locations.
 *
 * Firestore Structure:
 *   tours/{tourId}                           — tour metadata
 *   tours/{tourId}/members/{memberId}        — registered + guest member details
 *   tours/{tourId}/expenses/{expenseId}      — expense records
 *   tours/{tourId}/fund_contributions/{id}   — fund collection records
 *   tours/{tourId}/live_locations/{uid}      — ephemeral opt-in live location
 *   user_index/{uid}                         — searchable user directory
 */

import { db } from './firebase';
import {
  doc, collection, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  updateDoc, query, where, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
  orderBy, limit
} from 'firebase/firestore';

// ─── LOCAL SNAPSHOT CACHE HELPERS (OFFLINE-FIRST) ─────────────────────────────

function getLocalCache(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
}

// ─── USER INDEX ───────────────────────────────────────────────────────────────

/**
 * Write/update a user's searchable index entry.
 * Called once on every login so the entry stays fresh.
 */
export async function upsertUserIndex(uid, userData) {
  if (!uid || uid === 'guest') return;
  try {
    const ref = doc(db, 'user_index', uid);
    await setDoc(ref, {
      uid,
      email: (userData.email || '').toLowerCase(),
      displayName: userData.displayName || userData.name || '',
      photoURL: userData.photoURL || '',
      phone: userData.phone || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.debug('upsertUserIndex skipped:', err.message);
  }
}

/**
 * Find a registered user by their email address (case-insensitive).
 * Returns null if not found.
 */
export async function lookupUserByEmail(email) {
  if (!email) return null;
  try {
    const q = query(
      collection(db, 'user_index'),
      where('email', '==', email.toLowerCase().trim()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    return null;
  } catch (err) {
    console.debug('lookupUserByEmail error:', err.message);
    return null;
  }
}

/**
 * Find a registered user by their phone number.
 * Returns null if not found.
 */
export async function lookupUserByPhone(phone) {
  if (!phone) return null;
  try {
    const cleaned = phone.replace(/\s+/g, '').replace(/^(\+880|880)/, '0');
    const q = query(
      collection(db, 'user_index'),
      where('phone', '==', cleaned),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    return null;
  } catch (err) {
    console.debug('lookupUserByPhone error:', err.message);
    return null;
  }
}

// ─── TOUR CRUD ─────────────────────────────────────────────────────────────────

/**
 * Create a new tour. The creator is automatically added as 'organizer' member.
 * Returns the new tourId. Works 100% offline.
 */
export async function createTour(uid, userData, tourData) {
  if (!uid) throw new Error('uid required');

  const tourId = generateId('tour');
  const now = new Date().toISOString();

  const tourDoc = {
    id: tourId,
    title: tourData.title || 'নতুন ট্যুর',
    description: tourData.description || '',
    status: 'planned', // planned | active | completed | cancelled
    createdBy: uid,
    organizerName: userData.displayName || userData.name || 'Organizer',
    organizerPhone: userData.phone || '',
    startDate: tourData.startDate || now,
    endDate: tourData.endDate || now,
    destinations: tourData.destinations || [],
    selectedRouteIndex: tourData.selectedRouteIndex ?? 0,
    estimatedDistanceKm: tourData.estimatedDistanceKm || 0,
    estimatedDurationHours: tourData.estimatedDurationHours || 0,
    costEstimate: tourData.costEstimate || {
      fuelCost: 0, tollCost: 0, foodCost: 0, hotelCost: 0, miscCost: 0, totalCost: 0
    },
    memberIds: [uid],
    guestMembers: [],
    createdAt: now,
    updatedAt: now
  };

  // 1. Save synchronously to local snapshot cache (Instant offline availability!)
  setLocalCache(`rl_tour_${tourId}`, tourDoc);
  const myToursCache = getLocalCache(`rl_my_tours_${uid}`, []);
  const updatedMyTours = [tourDoc, ...myToursCache.filter(t => t.id !== tourId)];
  setLocalCache(`rl_my_tours_${uid}`, updatedMyTours);

  const organizerMember = {
    uid,
    name: userData.displayName || userData.name || 'Organizer',
    email: (userData.email || '').toLowerCase(),
    phone: userData.phone || '',
    photoURL: userData.photoURL || '',
    role: 'organizer',
    status: 'accepted',
    shareLocation: false,
    joinedAt: now,
    invitedAt: now
  };
  setLocalCache(`rl_tour_members_${tourId}`, [organizerMember]);

  // 2. Persist to Firestore (Cached locally in IndexedDB by SDK and queued for sync if offline)
  try {
    await setDoc(doc(db, 'tours', tourId), tourDoc);
    await setDoc(doc(db, 'tours', tourId, 'members', uid), organizerMember);
  } catch (err) {
    console.debug('Firestore write queued in offline cache:', err.message);
  }

  return tourId;
}

/**
 * Update top-level tour fields (title, status, dates, destinations, costEstimate, etc.)
 */
export async function updateTour(tourId, updates) {
  if (!tourId) return;
  const now = new Date().toISOString();
  
  // Update local cache
  const cached = getLocalCache(`rl_tour_${tourId}`);
  if (cached) {
    const updated = { ...cached, ...updates, updatedAt: now };
    setLocalCache(`rl_tour_${tourId}`, updated);
    if (cached.createdBy) {
      const myTours = getLocalCache(`rl_my_tours_${cached.createdBy}`, []);
      setLocalCache(`rl_my_tours_${cached.createdBy}`, myTours.map(t => t.id === tourId ? updated : t));
    }
  }

  try {
    const ref = doc(db, 'tours', tourId);
    await updateDoc(ref, { ...updates, updatedAt: now });
  } catch (err) {
    console.debug('updateTour queued in offline cache:', err.message);
  }
}

/**
 * Soft-delete a tour (sets status = 'cancelled').
 */
export async function cancelTour(tourId) {
  return updateTour(tourId, { status: 'cancelled' });
}

/**
 * Hard-delete a tour document.
 */
export async function deleteTour(tourId) {
  if (!tourId) return;
  
  // Clean local cache
  const cached = getLocalCache(`rl_tour_${tourId}`);
  if (cached?.createdBy) {
    const myTours = getLocalCache(`rl_my_tours_${cached.createdBy}`, []);
    setLocalCache(`rl_my_tours_${cached.createdBy}`, myTours.filter(t => t.id !== tourId));
  }
  localStorage.removeItem(`rl_tour_${tourId}`);

  try {
    await deleteDoc(doc(db, 'tours', tourId));
  } catch (err) {
    console.error('deleteTour error:', err);
  }
}

/**
 * Get a single tour document (one-time fetch with local cache fallback).
 */
export async function getTour(tourId) {
  if (!tourId) return null;
  const cached = getLocalCache(`rl_tour_${tourId}`);
  try {
    const snap = await getDoc(doc(db, 'tours', tourId));
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() };
      setLocalCache(`rl_tour_${tourId}`, data);
      return data;
    }
    return cached;
  } catch (err) {
    return cached;
  }
}

/**
 * Get all tours where the current user is a member.
 */
export async function getMyTours(uid) {
  if (!uid || uid === 'guest') return [];
  const cached = getLocalCache(`rl_my_tours_${uid}`, []);
  try {
    const q = query(
      collection(db, 'tours'),
      where('memberIds', 'array-contains', uid),
      orderBy('startDate', 'desc')
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (list.length > 0) setLocalCache(`rl_my_tours_${uid}`, list);
    return list.length > 0 ? list : cached;
  } catch (err) {
    return cached;
  }
}

/**
 * Real-time listener for a single tour document.
 * Emits cached tour immediately for 0ms offline display!
 */
export function listenToTour(tourId, callback) {
  if (!tourId) return () => {};
  
  // 1. Instant local cache emission
  const cached = getLocalCache(`rl_tour_${tourId}`);
  if (cached) callback(cached);

  const ref = doc(db, 'tours', tourId);
  return onSnapshot(ref, snap => {
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() };
      setLocalCache(`rl_tour_${tourId}`, data);
      callback(data);
    } else if (!cached) {
      callback(null);
    }
  }, err => {
    console.debug('listenToTour offline fallback:', err.message);
    if (cached) callback(cached);
  });
}

/**
 * Real-time listener for user's tour list.
 * Emits cached tours immediately for 0ms offline display!
 */
export function listenToMyTours(uid, callback) {
  if (!uid || uid === 'guest') { callback([]); return () => {}; }

  // 1. Instant local cache emission
  const cached = getLocalCache(`rl_my_tours_${uid}`, []);
  if (cached.length > 0) callback(cached);

  try {
    const q = query(collection(db, 'tours'), where('memberIds', 'array-contains', uid));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
      setLocalCache(`rl_my_tours_${uid}`, list);
      callback(list);
    }, err => {
      console.debug('listenToMyTours offline fallback:', err.message);
      if (cached.length > 0) callback(cached);
    });
  } catch (err) {
    if (cached.length > 0) callback(cached);
    return () => {};
  }
}

// ─── MEMBERS ──────────────────────────────────────────────────────────────────

/**
 * Add a registered user to a tour (by their uid, looked up from user_index).
 * Also adds uid to the tour's memberIds array.
 */
export async function addTourMember(tourId, memberData) {
  if (!tourId || !memberData?.uid) return;
  const now = new Date().toISOString();
  try {
    await setDoc(doc(db, 'tours', tourId, 'members', memberData.uid), {
      uid: memberData.uid,
      name: memberData.displayName || memberData.name || 'Member',
      email: (memberData.email || '').toLowerCase(),
      phone: memberData.phone || '',
      photoURL: memberData.photoURL || '',
      role: 'member',
      status: 'invited',
      shareLocation: false,
      invitedAt: now,
      joinedAt: null
    });
    // Atomically add uid to memberIds array
    await updateDoc(doc(db, 'tours', tourId), {
      memberIds: arrayUnion(memberData.uid),
      updatedAt: now
    });
  } catch (err) {
    console.error('addTourMember error:', err);
  }
}

/**
 * Add a guest member (non-registered). Stored in tour.guestMembers array.
 */
export async function addGuestMember(tourId, guestData) {
  if (!tourId || !guestData?.name) return;
  const guest = {
    id: generateId('guest'),
    name: guestData.name.trim(),
    phone: guestData.phone || '',
    email: guestData.email || '',
    role: 'member',
    status: 'accepted', // guests are auto-accepted
    isGuest: true,
    addedAt: new Date().toISOString()
  };
  try {
    await updateDoc(doc(db, 'tours', tourId), {
      guestMembers: arrayUnion(guest),
      updatedAt: new Date().toISOString()
    });
    return guest;
  } catch (err) {
    console.error('addGuestMember error:', err);
    return null;
  }
}

/**
 * Remove a registered member from a tour.
 */
export async function removeTourMember(tourId, memberUid) {
  if (!tourId || !memberUid) return;
  try {
    await deleteDoc(doc(db, 'tours', tourId, 'members', memberUid));
    await updateDoc(doc(db, 'tours', tourId), {
      memberIds: arrayRemove(memberUid),
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('removeTourMember error:', err);
  }
}

/**
 * Remove a guest member from the guestMembers array.
 */
export async function removeGuestMember(tourId, guest) {
  if (!tourId || !guest) return;
  try {
    await updateDoc(doc(db, 'tours', tourId), {
      guestMembers: arrayRemove(guest),
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('removeGuestMember error:', err);
  }
}

/**
 * Update a member's status (accepted | declined) or shareLocation flag.
 */
export async function updateMemberField(tourId, memberUid, updates) {
  if (!tourId || !memberUid) return;
  try {
    await updateDoc(doc(db, 'tours', tourId, 'members', memberUid), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('updateMemberField error:', err);
  }
}

/**
 * Real-time listener for all members of a tour.
 * Emits cached members immediately for 0ms offline display!
 */
export function listenToTourMembers(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }

  const cached = getLocalCache(`rl_tour_members_${tourId}`, []);
  if (cached.length > 0) callback(cached);

  const ref = collection(db, 'tours', tourId, 'members');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (list.length > 0) setLocalCache(`rl_tour_members_${tourId}`, list);
    callback(list.length > 0 ? list : cached);
  }, err => {
    console.debug('listenToTourMembers offline fallback:', err.message);
    if (cached.length > 0) callback(cached);
  });
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

/**
 * Add a new expense to a tour.
 * expenseData: { title, amount, category, paidBy, splitAmong, date, notes }
 */
export async function addExpense(tourId, expenseData) {
  if (!tourId || !expenseData) return null;
  const expenseId = generateId('exp');
  const now = new Date().toISOString();
  const expense = {
    id: expenseId,
    title: expenseData.title || 'Expense',
    amount: Number(expenseData.amount) || 0,
    category: expenseData.category || 'misc', // fuel|food|hotel|toll|misc
    paidBy: expenseData.paidBy || { name: 'Unknown' },
    splitAmong: expenseData.splitAmong || [],
    date: expenseData.date || now,
    notes: expenseData.notes || '',
    fromFund: expenseData.fromFund || false,
    createdAt: now,
    createdByUid: expenseData.createdByUid || ''
  };

  // Synchronously update local cache
  const cached = getLocalCache(`rl_tour_expenses_${tourId}`, []);
  const updated = [expense, ...cached.filter(e => e.id !== expenseId)];
  setLocalCache(`rl_tour_expenses_${tourId}`, updated);

  try {
    await setDoc(doc(db, 'tours', tourId, 'expenses', expenseId), expense);
  } catch (err) {
    console.debug('addExpense queued in offline cache:', err.message);
  }
  return expense;
}

/**
 * Update an existing expense.
 */
export async function updateExpense(tourId, expenseId, updates) {
  if (!tourId || !expenseId) return;
  const cached = getLocalCache(`rl_tour_expenses_${tourId}`, []);
  const updated = cached.map(e => e.id === expenseId ? { ...e, ...updates } : e);
  setLocalCache(`rl_tour_expenses_${tourId}`, updated);

  try {
    await updateDoc(doc(db, 'tours', tourId, 'expenses', expenseId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.debug('updateExpense queued in offline cache:', err.message);
  }
}

/**
 * Delete an expense.
 */
export async function deleteExpense(tourId, expenseId) {
  if (!tourId || !expenseId) return;
  const cached = getLocalCache(`rl_tour_expenses_${tourId}`, []);
  setLocalCache(`rl_tour_expenses_${tourId}`, cached.filter(e => e.id !== expenseId));

  try {
    await deleteDoc(doc(db, 'tours', tourId, 'expenses', expenseId));
  } catch (err) {
    console.debug('deleteExpense queued in offline cache:', err.message);
  }
}

/**
 * Real-time listener for all tour expenses.
 * Emits cached expenses immediately for 0ms offline display!
 */
export function listenToExpenses(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }
  
  const cached = getLocalCache(`rl_tour_expenses_${tourId}`, []);
  if (cached.length > 0) callback(cached);

  const ref = collection(db, 'tours', tourId, 'expenses');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    setLocalCache(`rl_tour_expenses_${tourId}`, list);
    callback(list);
  }, err => {
    console.debug('listenToExpenses offline fallback:', err.message);
    if (cached.length > 0) callback(cached);
  });
}
export const listenToTourExpenses = listenToExpenses;

// ─── FUND CONTRIBUTIONS ────────────────────────────────────────────────────────

/**
 * Record a fund contribution.
 */
export async function addFundContribution(tourId, contribData) {
  if (!tourId || !contribData) return null;
  const contribId = generateId('contrib');
  const now = new Date().toISOString();
  const contrib = {
    id: contribId,
    amount: Number(contribData.amount) || 0,
    contributedBy: contribData.contributedBy || { name: 'Unknown' },
    date: contribData.date || now,
    notes: contribData.notes || '',
    createdAt: now
  };

  const cached = getLocalCache(`rl_tour_fund_${tourId}`, []);
  const updated = [contrib, ...cached.filter(c => c.id !== contribId)];
  setLocalCache(`rl_tour_fund_${tourId}`, updated);

  try {
    await setDoc(doc(db, 'tours', tourId, 'fund_contributions', contribId), contrib);
  } catch (err) {
    console.debug('addFundContribution queued in offline cache:', err.message);
  }
  return contrib;
}

/**
 * Delete a fund contribution.
 */
export async function deleteFundContribution(tourId, contribId) {
  if (!tourId || !contribId) return;
  const cached = getLocalCache(`rl_tour_fund_${tourId}`, []);
  setLocalCache(`rl_tour_fund_${tourId}`, cached.filter(c => c.id !== contribId));

  try {
    await deleteDoc(doc(db, 'tours', tourId, 'fund_contributions', contribId));
  } catch (err) {
    console.debug('deleteFundContribution queued in offline cache:', err.message);
  }
}

/**
 * Real-time listener for fund contributions.
 */
export function listenToFundContributions(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }

  const cached = getLocalCache(`rl_tour_fund_${tourId}`, []);
  if (cached.length > 0) callback(cached);

  const ref = collection(db, 'tours', tourId, 'fund_contributions');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    setLocalCache(`rl_tour_fund_${tourId}`, list);
    callback(list);
  }, err => {
    console.debug('listenToFundContributions offline fallback:', err.message);
    if (cached.length > 0) callback(cached);
  });
}

// ─── LIVE LOCATIONS ────────────────────────────────────────────────────────────

/**
 * Write/update the current user's live location.
 * Only called when user explicitly opts in (shareLocation === true).
 */
export async function updateLiveLocation(tourId, uid, coords) {
  if (!tourId || !uid || !coords) return;
  try {
    await setDoc(doc(db, 'tours', tourId, 'live_locations', uid), {
      uid,
      lat: Number(coords.lat) || 0,
      lng: Number(coords.lng) || 0,
      speed: Number(coords.speed) || 0,
      heading: Number(coords.heading) || 0,
      accuracy: Number(coords.accuracy) || 0,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.debug('updateLiveLocation error:', err.message);
  }
}

/**
 * Remove the current user's live location (called when opting out or tour ends).
 */
export async function clearLiveLocation(tourId, uid) {
  if (!tourId || !uid) return;
  try {
    await deleteDoc(doc(db, 'tours', tourId, 'live_locations', uid));
  } catch (err) {
    console.debug('clearLiveLocation error:', err.message);
  }
}

/**
 * Real-time listener for all live locations in a tour.
 */
export function listenToLiveLocations(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }
  const ref = collection(db, 'tours', tourId, 'live_locations');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(list);
  }, err => {
    console.debug('listenToLiveLocations error:', err.message);
    callback([]);
  });
}

// ─── SETTLEMENT RECORDS ────────────────────────────────────────────────────────

/**
 * Mark a settlement transaction as settled (stores record under tour).
 */
export async function markTransactionSettled(tourId, transactionKey, settledByUid) {
  if (!tourId || !transactionKey) return;
  try {
    await setDoc(doc(db, 'tours', tourId, 'settlements', transactionKey), {
      key: transactionKey,
      settledAt: new Date().toISOString(),
      settledBy: settledByUid || ''
    });
  } catch (err) {
    console.error('markTransactionSettled error:', err);
  }
}

/**
 * Real-time listener for settled transactions.
 */
export function listenToSettlements(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }
  const ref = collection(db, 'tours', tourId, 'settlements');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(list);
  }, err => {
    callback([]);
  });
}

// ─── ITINERARY & STOPS ────────────────────────────────────────────────────────

export async function addTourStop(tourId, stopData) {
  if (!tourId || !stopData.name) return null;
  const id = generateId('stop');
  const docData = {
    id,
    name: stopData.name.trim(),
    purpose: stopData.purpose || '',
    location: stopData.location || '',
    arrivalTime: stopData.arrivalTime || '',
    departureTime: stopData.departureTime || '',
    durationMins: Number(stopData.durationMins) || 15,
    notes: stopData.notes || '',
    order: Number(stopData.order) || 0,
    status: 'upcoming', // upcoming | arrived | departed
    createdAt: new Date().toISOString()
  };

  const cached = getLocalCache(`rl_tour_stops_${tourId}`, []);
  const updated = [...cached, docData];
  updated.sort((a, b) => (a.order || 0) - (b.order || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  setLocalCache(`rl_tour_stops_${tourId}`, updated);

  try {
    await setDoc(doc(db, 'tours', tourId, 'stops', id), docData);
  } catch (err) {
    console.debug('addTourStop queued in offline cache:', err.message);
  }
  return id;
}

export async function updateTourStop(tourId, stopId, updates) {
  if (!tourId || !stopId) return;
  const cached = getLocalCache(`rl_tour_stops_${tourId}`, []);
  const updated = cached.map(s => s.id === stopId ? { ...s, ...updates } : s);
  setLocalCache(`rl_tour_stops_${tourId}`, updated);

  try {
    await updateDoc(doc(db, 'tours', tourId, 'stops', stopId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.debug('updateTourStop queued in offline cache:', err.message);
  }
}

export async function deleteTourStop(tourId, stopId) {
  if (!tourId || !stopId) return;
  const cached = getLocalCache(`rl_tour_stops_${tourId}`, []);
  setLocalCache(`rl_tour_stops_${tourId}`, cached.filter(s => s.id !== stopId));

  try {
    await deleteDoc(doc(db, 'tours', tourId, 'stops', stopId));
  } catch (err) {
    console.debug('deleteTourStop queued in offline cache:', err.message);
  }
}

export function listenToTourStops(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }

  const cached = getLocalCache(`rl_tour_stops_${tourId}`, []);
  if (cached.length > 0) callback(cached);

  const ref = collection(db, 'tours', tourId, 'stops');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.order || 0) - (b.order || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    setLocalCache(`rl_tour_stops_${tourId}`, list);
    callback(list);
  }, err => {
    console.debug('listenToTourStops offline fallback:', err.message);
    if (cached.length > 0) callback(cached);
  });
}

// ─── TOUR GALLERY ─────────────────────────────────────────────────────────────

export async function addTourPhoto(tourId, photoData) {
  if (!tourId || (!photoData.photoUrl && !photoData.driveFileId)) return null;
  const id = generateId('photo');
  const docData = {
    id,
    photoUrl: photoData.photoUrl || photoData.thumbnailUrl || '',
    previewUrl: photoData.previewUrl || photoData.photoUrl || '',
    thumbnailUrl: photoData.thumbnailUrl || photoData.photoUrl || '',
    webViewLink: photoData.webViewLink || '',
    downloadUrl: photoData.webContentLink || photoData.downloadUrl || '',
    fileName: photoData.fileName || '',
    fileType: photoData.fileType || 'image', // image | video | pdf | other
    mimeType: photoData.mimeType || 'image/jpeg',
    fileSizeBytes: Number(photoData.fileSizeBytes) || 0,
    caption: photoData.caption || '',
    uploadedBy: photoData.uploadedBy || '',
    uploaderName: photoData.uploaderName || 'Member',
    uploaderPhoto: photoData.uploaderPhoto || '',
    source: photoData.source || 'upload', // google_drive | upload | camera
    driveFileId: photoData.driveFileId || '',
    folderId: photoData.folderId || '',
    folderViewLink: photoData.folderViewLink || '',
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'tours', tourId, 'gallery', id), docData);
  return id;
}

export async function deleteTourPhoto(tourId, photoId) {
  if (!tourId || !photoId) return;
  try {
    await deleteDoc(doc(db, 'tours', tourId, 'gallery', photoId));
  } catch (err) {
    console.error('deleteTourPhoto error:', err);
  }
}

export function listenToTourGallery(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }
  const ref = collection(db, 'tours', tourId, 'gallery');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    callback(list);
  }, err => {
    console.debug('listenToTourGallery error:', err.message);
    callback([]);
  });
}

// ─── TOUR SAFETY & SOS ALERTS ─────────────────────────────────────────────────

export async function broadcastSosAlert(tourId, alertData) {
  if (!tourId) return null;
  const id = generateId('sos');
  const docData = {
    id,
    senderUid: alertData.senderUid || '',
    senderName: alertData.senderName || 'Rider',
    lat: alertData.lat || null,
    lng: alertData.lng || null,
    battery: alertData.battery || null,
    status: 'active', // active | resolved | safe_checkin
    type: alertData.type || 'sos', // sos | safe_checkin
    message: alertData.message || '🚨 Emergency SOS alert! Rider needs assistance.',
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'tours', tourId, 'sos_alerts', id), docData);
  return id;
}

export async function resolveSosAlert(tourId, alertId) {
  if (!tourId || !alertId) return;
  try {
    await updateDoc(doc(db, 'tours', tourId, 'sos_alerts', alertId), {
      status: 'resolved',
      resolvedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('resolveSosAlert error:', err);
  }
}

export function listenToTourSosAlerts(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }
  const ref = collection(db, 'tours', tourId, 'sos_alerts');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    callback(list);
  }, err => {
    console.debug('listenToTourSosAlerts error:', err.message);
    callback([]);
  });
}

// ─── TOUR INVITATIONS & RESPONSE ──────────────────────────────────────────────

export async function respondToTourInvitation(tourId, uid, accept = true) {
  if (!tourId || !uid) return;
  try {
    const memberRef = doc(db, 'tours', tourId, 'members', uid);
    if (accept) {
      await updateDoc(memberRef, {
        status: 'accepted',
        joinedAt: new Date().toISOString()
      });
      // Ensure uid is in tour memberIds
      await updateDoc(doc(db, 'tours', tourId), {
        memberIds: arrayUnion(uid)
      });
    } else {
      await updateDoc(memberRef, {
        status: 'declined',
        declinedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'tours', tourId), {
        memberIds: arrayRemove(uid)
      });
    }
  } catch (err) {
    console.error('respondToTourInvitation error:', err);
  }
}

