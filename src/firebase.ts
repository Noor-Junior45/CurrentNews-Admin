import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

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

// Initialize singleton Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth: Auth = getAuth(app);