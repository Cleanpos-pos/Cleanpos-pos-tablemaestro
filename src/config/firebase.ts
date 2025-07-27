
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Log the config only in development or if a specific debug flag is set.
// For active debugging of a deployed app, you might temporarily enable this log more broadly.
if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_FIREBASE_CONFIG === 'true') {
  console.log('[FirebaseConfig] Initializing with config:', firebaseConfig);
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('[FirebaseConfig] CRITICAL: Firebase API Key or Project ID is missing. Check environment variables.');
  }
}

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log('[FirebaseConfig] Firebase app initialized successfully.');
  } catch (error) {
    console.error('[FirebaseConfig] Error initializing Firebase app:', error);
    // Potentially throw the error or handle it to prevent the app from breaking further,
    // though if Firebase doesn't init, many things will fail.
    throw error; // Re-throw to make it clear initialization failed
  }
} else {
  app = getApp();
  console.log('[FirebaseConfig] Firebase app already initialized.');
}

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
