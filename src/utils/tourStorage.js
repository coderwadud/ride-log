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
 * Returns the new tourId.
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

  await setDoc(doc(db, 'tours', tourId), tourDoc);

  // Add organizer as member sub-document
  await setDoc(doc(db, 'tours', tourId, 'members', uid), {
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
  });

  return tourId;
}

/**
 * Update top-level tour fields (title, status, dates, destinations, costEstimate, etc.)
 */
export async function updateTour(tourId, updates) {
  if (!tourId) return;
  try {
    const ref = doc(db, 'tours', tourId);
    await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('updateTour error:', err);
  }
}

/**
 * Soft-delete a tour (sets status = 'cancelled').
 */
export async function cancelTour(tourId) {
  return updateTour(tourId, { status: 'cancelled' });
}

/**
 * Hard-delete a tour document (organizer only — does not delete subcollections).
 */
export async function deleteTour(tourId) {
  if (!tourId) return;
  try {
    await deleteDoc(doc(db, 'tours', tourId));
  } catch (err) {
    console.error('deleteTour error:', err);
  }
}

/**
 * Get a single tour document (one-time fetch).
 */
export async function getTour(tourId) {
  if (!tourId) return null;
  try {
    const snap = await getDoc(doc(db, 'tours', tourId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.debug('getTour error:', err.message);
    return null;
  }
}

/**
 * Get all tours where the current user is a member.
 * Returns array sorted by startDate desc.
 */
export async function getMyTours(uid) {
  if (!uid || uid === 'guest') return [];
  try {
    const q = query(
      collection(db, 'tours'),
      where('memberIds', 'array-contains', uid),
      orderBy('startDate', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.debug('getMyTours error:', err.message);
    // Fallback without orderBy if index not ready
    try {
      const q2 = query(collection(db, 'tours'), where('memberIds', 'array-contains', uid));
      const snap2 = await getDocs(q2);
      const list = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
      return list;
    } catch (e2) {
      return [];
    }
  }
}

/**
 * Real-time listener for a single tour document.
 */
export function listenToTour(tourId, callback) {
  if (!tourId) return () => {};
  const ref = doc(db, 'tours', tourId);
  return onSnapshot(ref, snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  }, err => {
    console.debug('listenToTour error:', err.message);
    callback(null);
  });
}

/**
 * Real-time listener for user's tour list.
 */
export function listenToMyTours(uid, callback) {
  if (!uid || uid === 'guest') { callback([]); return () => {}; }
  try {
    const q = query(collection(db, 'tours'), where('memberIds', 'array-contains', uid));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
      callback(list);
    }, err => {
      console.debug('listenToMyTours error:', err.message);
      callback([]);
    });
  } catch (err) {
    callback([]);
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
 */
export function listenToTourMembers(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }
  const ref = collection(db, 'tours', tourId, 'members');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(list);
  }, err => {
    console.debug('listenToTourMembers error:', err.message);
    callback([]);
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
  try {
    await setDoc(doc(db, 'tours', tourId, 'expenses', expenseId), expense);
    return expense;
  } catch (err) {
    console.error('addExpense error:', err);
    return null;
  }
}

/**
 * Update an existing expense.
 */
export async function updateExpense(tourId, expenseId, updates) {
  if (!tourId || !expenseId) return;
  try {
    await updateDoc(doc(db, 'tours', tourId, 'expenses', expenseId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('updateExpense error:', err);
  }
}

/**
 * Delete an expense.
 */
export async function deleteExpense(tourId, expenseId) {
  if (!tourId || !expenseId) return;
  try {
    await deleteDoc(doc(db, 'tours', tourId, 'expenses', expenseId));
  } catch (err) {
    console.error('deleteExpense error:', err);
  }
}

/**
 * Real-time listener for all tour expenses.
 */
export function listenToExpenses(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }
  const ref = collection(db, 'tours', tourId, 'expenses');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    callback(list);
  }, err => {
    console.debug('listenToExpenses error:', err.message);
    callback([]);
  });
}

// ─── FUND CONTRIBUTIONS ────────────────────────────────────────────────────────

/**
 * Record a fund contribution.
 * contribData: { amount, contributedBy: { uid?, guestId?, name }, date, notes }
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
  try {
    await setDoc(doc(db, 'tours', tourId, 'fund_contributions', contribId), contrib);
    return contrib;
  } catch (err) {
    console.error('addFundContribution error:', err);
    return null;
  }
}

/**
 * Delete a fund contribution.
 */
export async function deleteFundContribution(tourId, contribId) {
  if (!tourId || !contribId) return;
  try {
    await deleteDoc(doc(db, 'tours', tourId, 'fund_contributions', contribId));
  } catch (err) {
    console.error('deleteFundContribution error:', err);
  }
}

/**
 * Real-time listener for fund contributions.
 */
export function listenToFundContributions(tourId, callback) {
  if (!tourId) { callback([]); return () => {}; }
  const ref = collection(db, 'tours', tourId, 'fund_contributions');
  return onSnapshot(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    callback(list);
  }, err => {
    console.debug('listenToFundContributions error:', err.message);
    callback([]);
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
