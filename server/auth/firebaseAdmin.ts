import { initializeApp, getApps, applicationDefault, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const rawProjectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0638643565';
const projectId = rawProjectId.trim();

if (getApps().length === 0) {
  try {
    initializeApp({
      projectId,
      // Automatically uses Application Default Credentials (ADC) in Google Cloud Run and Google Cloud Shell
      credential: applicationDefault()
    });
  } catch (err: any) {
    // If ADC is not yet active in local non-GCP dev, fallback to projectId init so server boots cleanly
    console.warn('[Firebase Admin] ADC initialization notice:', err?.message || err);
    try {
      initializeApp({ projectId });
    } catch (_) {}
  }
}

export const adminApp = getApps().length > 0 ? getApp() : null;
export const adminAuth = getAuth();

/**
 * Returns the active projectId used by firebase-admin.
 */
export function getAdminProjectId(): string {
  const pId = adminApp?.options?.projectId || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0638643565';
  return (pId || '').trim();
}

/**
 * Logs which projectId firebase-admin is using on server start
 * and warns if it differs from process.env.FIREBASE_PROJECT_ID.
 */
export function logFirebaseAdminProjectId(): void {
  const activeId = getAdminProjectId();
  const envId = process.env.FIREBASE_PROJECT_ID;

  console.log(`[Firebase Admin] active projectId: ${activeId}`);
  if (envId && activeId !== envId) {
    console.warn(`[Firebase Admin] WARNING: active projectId (${activeId}) differs from process.env.FIREBASE_PROJECT_ID (${envId})`);
  }
}
