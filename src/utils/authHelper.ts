import { GoogleAuthProvider, signInWithPopup, signInWithCredential, UserCredential } from 'firebase/auth';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { auth } from '../firebase';

export interface AuthResult {
  success: boolean;
  user?: any;
  cancelled?: boolean;
  error?: string;
}

interface NativeGoogleAuthPlugin {
  signIn(options?: { clientId?: string }): Promise<{
    cancelled?: boolean;
    idToken?: string;
    email?: string;
    displayName?: string;
    photoUrl?: string;
    id?: string;
  }>;
  getApkFingerprints(): Promise<{
    sha1: string;
    sha256: string;
    packageName: string;
  }>;
  getApkSha1(): Promise<{
    sha1: string;
    packageName: string;
  }>;
  signOut(): Promise<void>;
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>('NativeGoogleAuth');

// The Web Client ID from Firebase / Google Cloud Console (client_type: 3)
const GOOGLE_WEB_CLIENT_ID = '468945089786-lj8p9tcr9m5ajjgbm5horon7pk8ln3rb.apps.googleusercontent.com';

let isAuthPending = false;

/**
 * Universal, Production-Ready Google Sign-In:
 * 1. On Native Android:
 *    Invokes Google Play Services' native "Choose an account" dialog bottom sheet.
 *    The user simply chooses their saved device Gmail account with one tap —
 *    NO webview redirects, NO popup errors, NO typing passwords!
 * 2. On Web / PWA:
 *    Gracefully uses Firebase signInWithPopup with account selection prompt.
 */
export async function signInWithGoogleSafe(): Promise<AuthResult> {
  if (isAuthPending) {
    console.debug('[Auth] Sign-in already pending, ignoring duplicate request.');
    return { success: false, cancelled: true };
  }

  isAuthPending = true;

  try {
    // ----------------------------------------------------
    // Path A: Native Android App Environment (Capacitor)
    // ----------------------------------------------------
    if (Capacitor.isNativePlatform()) {
      try {
        console.log('[Auth] Initiating Native Android Google Account Chooser...');
        const result = await NativeGoogleAuth.signIn({
          clientId: GOOGLE_WEB_CLIENT_ID
        });

        if (result.cancelled || !result.idToken) {
          console.log('[Auth] User dismissed native Google account picker.');
          return { success: false, cancelled: true };
        }

        // Exchange Google ID Token for Firebase Auth credential
        const credential = GoogleAuthProvider.credential(result.idToken);
        const userCred: UserCredential = await signInWithCredential(auth, credential);

        console.log('[Auth] Native Google Sign-In successful for user:', userCred.user.email);
        return {
          success: true,
          user: userCred.user
        };
      } catch (nativeErr: any) {
        console.warn('[Auth] Native Google Auth failed:', nativeErr);
        const msg = nativeErr?.message || String(nativeErr);

        // If native cancelled by user
        if (msg.includes('cancelled') || msg.includes('Canceled') || msg.includes('12501')) {
          return { success: false, cancelled: true };
        }

        // On native Android, do NOT fall through to web signInWithPopup because popups don't work in WebViews!
        // Return clear error message with exact diagnostic info so the user knows what happened.
        let userFacingError = msg;
        if (msg.includes('10') || msg.includes('DEVELOPER_ERROR') || msg.includes('SHA-1')) {
          userFacingError = 'Google Sign-In Error (Code 10): This APK\'s SHA-1 fingerprint needs to be registered in your Firebase Console under Android app (blog.currentnews.app).';
        }

        return {
          success: false,
          cancelled: false,
          error: userFacingError
        };
      }
    }

    // ----------------------------------------------------
    // Path B: Web / Desktop Browser Environment
    // ----------------------------------------------------
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    const credential: UserCredential = await signInWithPopup(auth, provider);
    return {
      success: true,
      user: credential.user,
    };
  } catch (err: any) {
    const code = err?.code || '';
    const message = err?.message || String(err);

    // Gracefully handle normal popup cancellations without alerts
    if (
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/user-cancelled' ||
      message.includes('cancelled-popup-request') ||
      message.includes('popup-closed-by-user')
    ) {
      console.log('[Auth] User dismissed or cancelled authentication prompt.');
      return {
        success: false,
        cancelled: true,
      };
    }

    console.warn('[Auth Warning]:', err);
    return {
      success: false,
      cancelled: false,
      error: message,
    };
  } finally {
    // Reset debounce lock after a short buffer
    setTimeout(() => {
      isAuthPending = false;
    }, 500);
  }
}

export interface ApkFingerprints {
  sha1: string;
  sha256: string;
  packageName: string;
}

export async function getApkFingerprintsSafe(): Promise<ApkFingerprints | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await NativeGoogleAuth.getApkFingerprints();
    } catch (_) {
      return null;
    }
  }
  return null;
}

export async function getApkSha1Safe(): Promise<{ sha1: string; packageName: string } | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await NativeGoogleAuth.getApkSha1();
    } catch (_) {
      return null;
    }
  }
  return null;
}
