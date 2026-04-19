/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — AUTH MODULE
   Firebase Auth + Firestore user docs + itinerary system.
   ═══════════════════════════════════════════════════════════════════════════ */

import { auth, db } from './firebase-config.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
  deleteUser,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  increment, serverTimestamp,
  collection, query, where, orderBy, limit,
  getDocs, addDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

/* ── State ────────────────────────────────────────────────────────────── */
let _user     = null;
let _userData = null;
const _callbacks = [];

/* ── Firestore User Doc ───────────────────────────────────────────────── */

async function ensureUserDoc(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const data = {
      email:                user.email || '',
      displayName:          user.displayName || '',
      photoURL:             user.photoURL || null,
      dateOfBirth:          null,
      plan:                 'free',
      totalDiscoveries:     0,
      savedPlacesCount:     0,
      membershipRenewalDate:null,
      createdAt:            serverTimestamp(),
      lastActiveAt:         serverTimestamp(),
    };
    await setDoc(ref, data);
    return { ...data };
  }

  await updateDoc(ref, { lastActiveAt: serverTimestamp() });
  return snap.data();
}

/* ── Sign Up ──────────────────────────────────────────────────────────── */

async function signUp(email, password, name, dob) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  _userData = await ensureUserDoc(cred.user);
  if (dob) {
    await updateDoc(doc(db, 'users', cred.user.uid), { dateOfBirth: dob });
    _userData.dateOfBirth = dob;
  }
  return cred.user;
}

/* ── Sign In ──────────────────────────────────────────────────────────── */

async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  _userData = await ensureUserDoc(cred.user);
  return cred.user;
}

/* ── Google Sign In ───────────────────────────────────────────────────── */

async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  _userData = await ensureUserDoc(cred.user);
  return cred.user;
}

/* ── Sign Out ─────────────────────────────────────────────────────────── */

async function signOut() {
  await fbSignOut(auth);
  _user     = null;
  _userData = null;
}

/* ── Password Reset ───────────────────────────────────────────────────── */

async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/* ── Update Profile ───────────────────────────────────────────────────── */

async function updateUserProfile({ name, dob, newPassword }) {
  if (!_user) throw new Error('Not signed in');

  if (name && name !== _user.displayName) {
    await updateProfile(_user, { displayName: name });
  }

  const updates = {};
  if (name) updates.displayName = name;
  if (dob)  updates.dateOfBirth = dob;

  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, 'users', _user.uid), updates);
    Object.assign(_userData, updates);
  }

  if (newPassword) {
    await updatePassword(_user, newPassword);
  }
}

/* ── Delete Account ───────────────────────────────────────────────────── */

async function deleteAccount() {
  if (!_user) throw new Error('Not signed in');
  const uid = _user.uid;

  // Delete discoveries
  const dSnap = await getDocs(query(collection(db, 'discoveries'), where('userId', '==', uid)));
  const b1 = writeBatch(db);
  dSnap.docs.forEach(d => b1.delete(d.ref));
  await b1.commit();

  // Delete trips
  const tSnap = await getDocs(query(collection(db, 'trips'), where('userId', '==', uid)));
  const b2 = writeBatch(db);
  tSnap.docs.forEach(d => b2.delete(d.ref));
  await b2.commit();

  await deleteDoc(doc(db, 'users', uid));
  await deleteUser(_user);
  _user = null;
  _userData = null;
}

/* ── Delete Data Only ─────────────────────────────────────────────────── */

async function deleteUserData() {
  if (!_user) throw new Error('Not signed in');
  const uid = _user.uid;

  const dSnap = await getDocs(query(collection(db, 'discoveries'), where('userId', '==', uid)));
  const b1 = writeBatch(db);
  dSnap.docs.forEach(d => b1.delete(d.ref));
  await b1.commit();

  const tSnap = await getDocs(query(collection(db, 'trips'), where('userId', '==', uid)));
  const b2 = writeBatch(db);
  tSnap.docs.forEach(d => b2.delete(d.ref));
  await b2.commit();

  await updateDoc(doc(db, 'users', uid), { totalDiscoveries: 0, savedPlacesCount: 0 });
  if (_userData) { _userData.totalDiscoveries = 0; _userData.savedPlacesCount = 0; }
}

/* ── Discovery History ────────────────────────────────────────────────── */

async function getDiscoveryHistory(count = 30) {
  if (!_user) return [];
  const q = query(
    collection(db, 'discoveries'),
    where('userId', '==', _user.uid),
    orderBy('discoveredAt', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ── Trips / Itinerary ────────────────────────────────────────────────── */

async function getTrips() {
  if (!_user) return [];
  const q = query(
    collection(db, 'trips'),
    where('userId', '==', _user.uid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createTrip(name) {
  if (!_user) throw new Error('Not signed in');
  const ref = await addDoc(collection(db, 'trips'), {
    userId:    _user.uid,
    name,
    places:    [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

async function addPlaceToTrip(tripId, place) {
  if (!_user) return;
  const ref  = doc(db, 'trips', tripId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const places = snap.data().places || [];
  places.push({
    placeId:  place.placeId,
    name:     place.name,
    category: place.category,
    address:  place.address,
    location: place.location,
    rating:   place.rating,
    addedAt:  new Date().toISOString(),
  });

  await updateDoc(ref, { places });
  await updateDoc(doc(db, 'users', _user.uid), { savedPlacesCount: increment(1) });
  if (_userData) _userData.savedPlacesCount = (_userData.savedPlacesCount || 0) + 1;
}

/* ── Accessors ────────────────────────────────────────────────────────── */

const getUser     = () => _user;
const getUserData = () => _userData;
const isSignedIn  = () => _user !== null;
const isPremium   = () => _userData?.plan === 'premium';

function onAuthChange(cb) { _callbacks.push(cb); }

/* ── Init ─────────────────────────────────────────────────────────────── */

function init() {
  onAuthStateChanged(auth, async user => {
    _user = user;
    _userData = user ? await ensureUserDoc(user) : null;
    _callbacks.forEach(cb => cb(user, _userData));
  });
}

const Auth = {
  init,
  signUp, signIn, signInWithGoogle, signOut,
  resetPassword, updateUserProfile,
  deleteAccount, deleteUserData,
  getUser, getUserData, isSignedIn, isPremium, onAuthChange,
  getDiscoveryHistory, getTrips, createTrip, addPlaceToTrip,
};

export default Auth;
