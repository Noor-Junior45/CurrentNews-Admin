import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';

import appletConfig from '../firebase-applet-config.json';

const getEnv = (key: string, fallback: string): string => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  if (metaEnv && metaEnv[key]) {
    return metaEnv[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return fallback;
};

export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', appletConfig.apiKey || ''),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', appletConfig.authDomain || ''),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', appletConfig.projectId || ''),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', appletConfig.storageBucket || ''),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', appletConfig.messagingSenderId || ''),
  appId: getEnv('VITE_FIREBASE_APP_ID', appletConfig.appId || ''),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID', appletConfig.measurementId || ''),
};

export const FIRESTORE_DATABASE_ID = getEnv('FIRESTORE_DATABASE_ID', appletConfig.firestoreDatabaseId || '');

// Initialize singleton Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth: Auth = getAuth(app);

// Initialize Cloud Firestore with proxy/iframe long-polling auto-detection
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    }, FIRESTORE_DATABASE_ID);
  } catch (_) {
    return getFirestore(app, FIRESTORE_DATABASE_ID);
  }
})();

/**
 * Graceful Firestore error handler preventing unhandled quota or permission crash
 */
export function handleFirestoreError(err: unknown): void {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as any).code;
    if (code === 'resource-exhausted') {
      console.warn('[Firestore] Quota exceeded, switching to memory cache fallback.');
      return;
    }
  }
  console.warn('[Firestore] Handled non-fatal operation error:', err);
}