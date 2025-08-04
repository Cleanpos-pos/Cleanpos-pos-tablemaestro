
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const primaryFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Primary Firebase App
let app: FirebaseApp;
if (!getApps().some(app => app.name === 'primary')) {
  try {
    app = initializeApp(primaryFirebaseConfig, 'primary');
    console.log('[FirebaseConfig] Primary Firebase app initialized successfully.');
  } catch (error) {
    console.error('[FirebaseConfig] Error initializing primary Firebase app:', error);
    throw error;
  }
} else {
  app = getApp('primary');
  console.log('[FirebaseConfig] Primary Firebase app already initialized.');
}

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Keep posDb as null for simplicity of removal
const posDb = null;

export { app, db, storage, auth, posDb };
