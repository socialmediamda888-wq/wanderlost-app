/* ═══════════════════════════════════════════════════════════════════════════
   WANDERLOST v4 — FIREBASE CONFIG
   Single source of truth. CDN ES modules, no bundler.
   ═══════════════════════════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyCXE0uzZXBqapYdx_3yWX2KjLW3pY0NuyY',
  authDomain:        'wanderlost-4b711.firebaseapp.com',
  projectId:         'wanderlost-4b711',
  storageBucket:     'wanderlost-4b711.firebasestorage.app',
  messagingSenderId: '1004148285716',
  appId:             '1:1004148285716:web:e81bcfc761839967812201',
  measurementId:     'G-51MJ27W7MN',
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db };
