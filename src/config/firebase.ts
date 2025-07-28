
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

const posFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_POS_FIREBASE_APIKEY,
  authDomain: process.env.NEXT_PUBLIC_POS_FIREBASE_AUTHDOMAIN,
  projectId: process.env.NEXT_PUBLIC_POS_FIREBASE_PROJECTID,
  storageBucket: process.env.NEXT_PUBLIC_POS_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_POS_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_POS_FIREBASE_APP_ID,
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

// Initialize Secondary (POS) Firebase App if config is provided
let posApp: FirebaseApp | null = null;
let posDb: any = null;

const requiredPosKeys: (keyof typeof posFirebaseConfig)[] = ['apiKey', 'projectId', 'authDomain'];
const missingKeys = requiredPosKeys.filter(key => !posFirebaseConfig[key]);

if (missingKeys.length === 0) {
    if (!getApps().some(app => app.name === 'pos')) {
        try {
            posApp = initializeApp(posFirebaseConfig, 'pos');
            posDb = getFirestore(posApp);
            console.log('[FirebaseConfig] Secondary (POS) Firebase app initialized successfully.');
        } catch (error) {
            console.error('[FirebaseConfig] Error initializing secondary (POS) Firebase app:', error);
            // We don't throw here, the app can potentially work without it.
        }
    } else {
        posApp = getApp('pos');
        posDb = getFirestore(posApp);
        console.log('[FirebaseConfig] Secondary (POS) Firebase app already initialized.');
    }
} else {
    console.warn(`[FirebaseConfig] Secondary (POS) Firebase config not found or is incomplete. Table integration will be disabled. Missing required keys in .env: ${missingKeys.map(k => `NEXT_PUBLIC_POS_FIREBASE_${k.toUpperCase()}`).join(', ')}`);
}


const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth, posDb };
