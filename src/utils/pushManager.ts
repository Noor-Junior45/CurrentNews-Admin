/**
 * Client Push Notification Manager
 * Handles Web Push & Android Push subscriptions, syncing to backend server for automated dispatches.
 */

import { webUrl } from './webBase';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Convert VAPID base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Fetch the active VAPID public key from backend server
 */
async function getVapidPublicKey(): Promise<string> {
  try {
    const res = await fetch(webUrl('/api/push/public-key'));
    if (res.ok) {
      const data = await res.json();
      if (data.publicKey) return data.publicKey;
    }
  } catch (e) {
    console.debug('[Push] Failed to fetch server VAPID key:', e);
  }
  return '';
}

/**
 * Prompt user for permission, subscribe to PushManager, and register device token in Firestore
 */
export async function subscribeUserToPush(): Promise<{ success: boolean; message?: string }> {
  if (!isPushSupported()) {
    return { success: false, message: 'Push notifications are not supported on this device/browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      localStorage.setItem('browser_notifications_enabled', 'false');
      window.dispatchEvent(new Event('settings-updated'));
      return { success: false, message: 'Notification permission was denied or dismissed.' };
    }

    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      return { success: false, message: 'Push notification service key is currently unavailable.' };
    }

    const reg = await navigator.serviceWorker.ready;
    const convertedKey = urlBase64ToUint8Array(publicKey);

    // Get existing or create new subscription
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    // Register subscription on backend server
    const response = await fetch(webUrl('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${response.status}`);
    }

    localStorage.setItem('browser_notifications_enabled', 'true');
    window.dispatchEvent(new Event('settings-updated'));

    return { success: true, message: 'Successfully subscribed to automated background alerts!' };
  } catch (error: any) {
    console.error('[Push] Subscription failed:', error);
    return { success: false, message: error.message || 'Failed to complete push registration.' };
  }
}

/**
 * Unsubscribe user from push alerts and delete token from backend
 */
export async function unsubscribeUserFromPush(): Promise<{ success: boolean; message?: string }> {
  if (!isPushSupported()) {
    return { success: true };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      await fetch(webUrl('/api/push/unsubscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch((e) => console.warn('[Push] Unsubscribe server notify error:', e));

      await subscription.unsubscribe();
    }

    localStorage.setItem('browser_notifications_enabled', 'false');
    window.dispatchEvent(new Event('settings-updated'));

    return { success: true, message: 'Push notifications disabled.' };
  } catch (error: any) {
    console.error('[Push] Unsubscription failed:', error);
    return { success: false, message: error.message || 'Failed to unsubscribe.' };
  }
}

/**
 * Check if the user is currently subscribed to push
 */
export async function isUserPushSubscribed(): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Silently synchronizes active subscription with backend on app boot
 */
export async function syncPushSubscriptionOnAppBoot(): Promise<void> {
  if (!isPushSupported()) return;

  if (Notification.permission === 'granted' && localStorage.getItem('browser_notifications_enabled') !== 'false') {
    try {
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        const publicKey = await getVapidPublicKey();
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      if (subscription) {
        await fetch(webUrl('/api/push/subscribe'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            userAgent: navigator.userAgent,
          }),
        }).catch(() => {});
        localStorage.setItem('browser_notifications_enabled', 'true');
      }
    } catch (e) {
      console.debug('[Push] Background sync error:', e);
    }
  }
}
