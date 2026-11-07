import crypto from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getAdminProjectId } from './firebaseAdmin.ts';

interface GoogleCertsCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let cachedCerts: GoogleCertsCache | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && cachedCerts.expiresAt > now) {
    return cachedCerts.certs;
  }

  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!res.ok) {
      throw new Error(`Failed to fetch Google public certs: ${res.status}`);
    }
    const certs = await res.json() as Record<string, string>;
    
    // Parse Cache-Control max-age header if available, default to 6 hours
    const cacheControl = res.headers.get('cache-control') || '';
    const match = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSec = match ? parseInt(match[1], 10) : 21600;

    cachedCerts = {
      certs,
      expiresAt: now + maxAgeSec * 1000
    };
    return certs;
  } catch (err) {
    if (cachedCerts) {
      return cachedCerts.certs;
    }
    throw err;
  }
}

/**
 * Fallback cryptographic verification using Google's public x509 certs.
 * Ensures tokens can be verified even when Identity Platform API is restricted or returns auth/internal-error.
 */
export async function verifyTokenWithGooglePublicCerts(token: string, expectedProjectId: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw { code: 'auth/invalid-id-token', message: 'Token format is invalid' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: any;
  let payload: any;

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
  } catch {
    throw { code: 'auth/invalid-id-token', message: 'Invalid JWT JSON encoding' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw { code: 'auth/invalid-id-token', message: 'Unsupported algorithm or missing kid' };
  }

  const certs = await getGooglePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw { code: 'auth/invalid-id-token', message: 'Unknown signing key id' };
  }

  const publicKey = crypto.createPublicKey(cert);
  const data = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, 'base64url');

  const isValid = crypto.verify('RSA-SHA256', data, publicKey, signature);
  if (!isValid) {
    throw { code: 'auth/invalid-id-token', message: 'Invalid cryptographic signature' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const clockSkewLeeway = 60; // 60s clock skew tolerance

  // Verify expiration
  if (typeof payload.exp !== 'number' || payload.exp < (nowSec - clockSkewLeeway)) {
    throw { code: 'auth/id-token-expired', message: 'Firebase ID token has expired' };
  }

  // Verify audience matches projectId
  if (payload.aud !== expectedProjectId) {
    throw { code: 'auth/id-token-audience-error', message: `Token audience ${payload.aud} does not match ${expectedProjectId}` };
  }

  // Verify issuer
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.iss !== expectedIssuer) {
    throw { code: 'auth/id-token-issuer-error', message: `Token issuer ${payload.iss} does not match ${expectedIssuer}` };
  }

  // Verify sub (user_id)
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw { code: 'auth/invalid-id-token', message: 'Token missing valid sub' };
  }

  return {
    uid: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    role: payload.role,
    ...payload
  };
}

/**
 * Resilient multi-tier Firebase ID token verification.
 * 1. Attempts verification without revocation check first (or with check if AUTH_CHECK_REVOKED === 'true').
 * 2. If an internal error occurs (e.g. Identity Platform quota or ADC permissions), falls back to Google's public certificates.
 */
export async function verifyFirebaseTokenSafely(token: string): Promise<any> {
  const projectId = getAdminProjectId();
  const shouldCheckRevoked = process.env.AUTH_CHECK_REVOKED === 'true';

  try {
    return await getAuth().verifyIdToken(token, shouldCheckRevoked);
  } catch (err: any) {
    const code = err?.code || '';

    // If token is actually expired or revoked, throw immediately
    if (code === 'auth/id-token-expired' || code === 'auth/id-token-revoked') {
      throw err;
    }

    // If revocation check failed due to backend error, try without revocation check
    if (shouldCheckRevoked) {
      try {
        return await getAuth().verifyIdToken(token, false);
      } catch (innerErr: any) {
        if (innerErr?.code === 'auth/id-token-expired' || innerErr?.code === 'auth/id-token-revoked') {
          throw innerErr;
        }
      }
    }

    // If firebase-admin threw auth/internal-error or any backend connectivity issue,
    // verify with Google's public certificates directly!
    console.warn(`[auth] firebase-admin verification error (${code || err?.message}). Using Google public certs fallback.`);
    return await verifyTokenWithGooglePublicCerts(token, projectId);
  }
}
