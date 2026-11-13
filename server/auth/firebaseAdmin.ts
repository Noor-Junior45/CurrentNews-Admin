import 'dotenv/config';
import { initializeApp, getApps, applicationDefault, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

interface ParsedServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function parseServiceAccountFromEnv(): ParsedServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const jsonStr = raw.startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.client_email === 'string' &&
      typeof parsed.private_key === 'string'
    ) {
      return parsed as ParsedServiceAccount;
    }
  } catch (err: any) {
    console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err?.message || err);
  }
  return null;
}

const serviceAccount = parseServiceAccountFromEnv();

function resolveProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  if (serviceAccount?.project_id && serviceAccount.project_id.trim()) {
    return serviceAccount.project_id.trim();
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT.trim()) {
    return process.env.GCLOUD_PROJECT.trim();
  }
  if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT.trim()) {
    return process.env.GOOGLE_CLOUD_PROJECT.trim();
  }
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (cfg && cfg.projectId) {
        return cfg.projectId.trim();
      }
    }
  } catch (_) {}
  return '';
}

const projectId = resolveProjectId();

if (getApps().length === 0) {
  try {
    initializeApp({
      ...(projectId ? { projectId } : {}),
      credential: serviceAccount ? cert(serviceAccount as any) : applicationDefault(),
    });
  } catch (err: any) {
    // If ADC is not yet active in local non-GCP dev, fallback to projectId init so server boots cleanly
    console.warn('[Firebase Admin] Credential initialization notice:', err?.message || err);
    try {
      if (projectId) {
        initializeApp({ projectId });
      } else {
        initializeApp();
      }
    } catch (_) {}
  }
}

export const adminApp = getApps().length > 0 ? getApp() : null;
export const adminAuth = getAuth();

/**
 * Returns the active projectId used by firebase-admin.
 */
export function getAdminProjectId(): string {
  const pId = adminApp?.options?.projectId || resolveProjectId();
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
