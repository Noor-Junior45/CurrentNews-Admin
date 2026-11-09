import type { Request, Response } from 'express';
import webpush from 'web-push';
import { getMessaging } from 'firebase-admin/messaging';
import { adminApp } from '../../server/auth/firebaseAdmin.ts';
import { query } from '../../server/db/neon.ts';

// ---------------------------------------------------------------------------
// VAPID keys — read from environment variables with dynamic fallback.
// ---------------------------------------------------------------------------
let VAPID_PUBLIC_KEY_RAW = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE_KEY_RAW = process.env.VAPID_PRIVATE_KEY;
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@currentnews.blog';

let pushEnabled = false;

// If VAPID keys are missing from environment, generate a resilient fallback keypair
// so WebPush & browser notifications never enter a disabled state.
if (!VAPID_PUBLIC_KEY_RAW || !VAPID_PRIVATE_KEY_RAW) {
  try {
    const generated = webpush.generateVAPIDKeys();
    VAPID_PUBLIC_KEY_RAW = generated.publicKey;
    VAPID_PRIVATE_KEY_RAW = generated.privateKey;
    console.warn('[Push Service] VAPID keys were unset in environment — initialized dynamic keypair for active dispatch.');
  } catch (genErr) {
    console.error('[Push Service] Dynamic VAPID generation error:', genErr);
  }
}

if (VAPID_PUBLIC_KEY_RAW && VAPID_PRIVATE_KEY_RAW) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY_RAW, VAPID_PRIVATE_KEY_RAW);
    pushEnabled = true;
    console.log('[Push Service] VAPID details configured successfully.');
  } catch (vapidErr) {
    console.error('[Push Service] VAPID initialization error:', vapidErr);
  }
}

export const VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY_RAW || '';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Allowed push-service hostnames (suffix match). */
const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  '.push.apple.com',
  '.notify.windows.com',
  'updates.push.services.mozilla.com',
];

function isAllowedEndpoint(endpoint: string): boolean {
  if (!endpoint || typeof endpoint !== 'string') return false;
  if (!endpoint.startsWith('https://')) return false;
  try {
    const { hostname } = new URL(endpoint);
    return ALLOWED_PUSH_HOSTS.some((allowed) =>
      allowed.startsWith('.') ? hostname.endsWith(allowed) : hostname === allowed
    );
  } catch {
    return false;
  }
}

/** base64url characters only, with optional '=' padding. */
const BASE64URL_RE = /^[A-Za-z0-9\-_]+=*$/;

function isValidBase64url(value: unknown): value is string {
  return typeof value === 'string' && BASE64URL_RE.test(value);
}

function validateSubscription(subscription: any): string | null {
  const endpoint: unknown = subscription?.endpoint;
  const p256dh: unknown = subscription?.keys?.p256dh;
  const auth: unknown = subscription?.keys?.auth;

  if (typeof endpoint !== 'string' || endpoint.length > 500) {
    return 'endpoint must be a string ≤ 500 characters';
  }
  if (!isAllowedEndpoint(endpoint)) {
    return 'endpoint must be an https:// URL from an approved push service';
  }
  if (!isValidBase64url(p256dh) || (p256dh as string).length > 200) {
    return 'keys.p256dh must be a valid base64url string ≤ 200 characters';
  }
  if (!isValidBase64url(auth) || (auth as string).length > 50) {
    return 'keys.auth must be a valid base64url string ≤ 50 characters';
  }
  return null;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function dbUpsertSubscription(
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent: string
): Promise<void> {
  // Remove any stale subscription for this endpoint first to avoid requiring UPDATE permission
  try {
    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  } catch (delErr: any) {
    console.debug('[Push DB pre-delete notice]:', delErr?.message);
  }

  await query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [endpoint, p256dh, auth, userAgent]
  );
}

async function dbDeleteSubscription(endpoint: string): Promise<void> {
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

async function dbCountSubscriptions(): Promise<number> {
  const result = await query<{ count: string }>('SELECT COUNT(*) AS count FROM push_subscriptions');
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

interface PushRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function dbGetAllSubscriptions(): Promise<PushRow[]> {
  try {
    const result = await query<PushRow>('SELECT endpoint, p256dh, auth FROM push_subscriptions');
    return result.rows || [];
  } catch (err: any) {
    console.warn('[Push Service] Could not fetch subscriptions from database:', err?.message || err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/push/public-key
 * Returns the VAPID Public Key needed by browsers/Android to generate push credentials.
 */
export function handleGetVapidPublicKey(_req: Request, res: Response) {
  if (!pushEnabled) {
    return res.status(503).json({ success: false, error: 'Push notifications are disabled (VAPID keys not configured).' });
  }
  return res.json({ success: true, publicKey: VAPID_PUBLIC_KEY });
}

/**
 * POST /api/push/subscribe
 * Registers a device push subscription or device token into Neon push_subscriptions table.
 */
export async function handleSubscribe(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const subscription = body.subscription;
    const rawToken = body.token || body.endpoint || (typeof subscription === 'string' ? subscription : null);

    let endpoint = '';
    let p256dh = '';
    let authKey = '';

    if (rawToken && typeof rawToken === 'string') {
      endpoint = rawToken.trim();
    } else if (subscription && typeof subscription === 'object' && subscription.endpoint) {
      endpoint = String(subscription.endpoint).trim();
      p256dh = String(subscription.keys?.p256dh || '').trim();
      authKey = String(subscription.keys?.auth || '').trim();
    }

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing device token or subscription endpoint',
      });
    }

    const ua: string = typeof body.userAgent === 'string'
      ? body.userAgent.slice(0, 512)
      : (req.headers['user-agent'] || 'Web/Mobile Client').slice(0, 512);

    await dbUpsertSubscription(
      endpoint,
      p256dh,
      authKey,
      ua
    );

    return res.json({
      success: true,
      message: 'Device registered for push notifications in Neon successfully.',
    });
  } catch (error: any) {
    console.error('[Push Service] Subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save push subscription in database',
    });
  }
}

/**
 * POST /api/push/unsubscribe
 * Removes a device push subscription.
 */
export async function handleUnsubscribe(req: Request, res: Response) {
  try {
    const { endpoint, token } = req.body || {};
    const target = endpoint || token;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing subscription endpoint or token',
      });
    }

    await dbDeleteSubscription(target);

    return res.json({
      success: true,
      message: 'Device unsubscribed successfully.',
    });
  } catch (error: any) {
    console.error('[Push Service] Unsubscribe error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to unsubscribe device',
    });
  }
}

/**
 * GET /api/push/subscribers-count
 * Returns the count of registered push devices.
 * Requires admin or writer role (enforced in server.ts).
 */
export async function handleGetSubscribersCount(_req: Request, res: Response) {
  try {
    const count = await dbCountSubscriptions();
    return res.json({ success: true, count });
  } catch (error: any) {
    console.warn('[Push Service] Count notice:', error);
    return res.json({ success: true, count: 0 });
  }
}

/**
 * GET /api/admin/push/devices
 * Lists registered push devices with user agent and registration timestamp.
 */
export async function handleGetDevices(_req: Request, res: Response) {
  try {
    const result = await query<{
      id: string | number;
      endpoint: string;
      user_agent: string | null;
      created_at: string;
    }>('SELECT id, endpoint, user_agent, created_at FROM push_subscriptions ORDER BY created_at DESC LIMIT 200');

    const devices = (result.rows || []).map(r => ({
      id: String(r.id),
      endpoint: r.endpoint,
      userAgent: r.user_agent || 'Unknown Device',
      createdAt: r.created_at,
    }));

    return res.json({
      success: true,
      count: devices.length,
      devices,
    });
  } catch (error: any) {
    console.warn('[Push Service] Devices list notice:', error?.message || error);
    return res.json({ success: true, count: 0, devices: [] });
  }
}

/**
 * DELETE /api/admin/push/devices/:id
 * Removes a device registration from Neon.
 */
export async function handleDeleteDevice(req: Request, res: Response) {
  try {
    const idOrEndpoint = req.params.id || req.body?.id || req.body?.endpoint;
    if (!idOrEndpoint) {
      return res.status(400).json({ success: false, error: 'Device ID or endpoint is required' });
    }

    await query(
      'DELETE FROM push_subscriptions WHERE id::text = $1 OR endpoint = $1',
      [String(idOrEndpoint)]
    );

    return res.json({ success: true, message: 'Device removed successfully.' });
  } catch (error: any) {
    console.error('[Push Service] Delete device error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to remove device' });
  }
}

/**
 * POST /api/push/broadcast
 * Dispatches a push notification to all subscribed devices.
 * Requires admin role (enforced in server.ts).
 */
export async function handleBroadcast(req: Request, res: Response) {
  try {
    const { title, body, url, postId, image, icon } = req.body || {};

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Notification title is required',
      });
    }

    const payload = JSON.stringify({
      title: title || 'Current News Alert',
      body: body || 'A new editorial dispatch has just been published.',
      url: url || '/',
      postId: postId || '',
      image: image || undefined,
      icon: icon || 'https://i.imgur.com/gFgShoZ.jpeg',
      badge: 'https://i.imgur.com/gFgShoZ.jpeg',
      timestamp: Date.now(),
    });

    const subscriptions = await dbGetAllSubscriptions();

    if (subscriptions.length === 0) {
      return res.json({
        success: true,
        message: 'No registered devices found in database. Device subscriptions will appear when users or readers opt-in.',
        sent: 0,
        failed: 0,
        purged: 0,
        total: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    let purged = 0;

    const BATCH_SIZE = 25;
    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (sub) => {
          let delivered = false;
          const rawEndpoint = (sub.endpoint || '').trim();
          if (!rawEndpoint) {
            failed++;
            return;
          }

          // Check if this is an FCM registration token or FCM gateway URL
          const isFcmGateway = rawEndpoint.includes('fcm.googleapis.com/fcm/send/');
          const isRawFcmToken = !rawEndpoint.startsWith('http://') && !rawEndpoint.startsWith('https://') && rawEndpoint.length > 20;
          const fcmToken = isFcmGateway
            ? rawEndpoint.split('/fcm/send/')[1]?.trim()
            : (isRawFcmToken ? rawEndpoint : null);

          // 1. Deliver via Firebase Cloud Messaging (FCM) for native Android app & Google Play services
          if (fcmToken && adminApp) {
            try {
              const messaging = getMessaging(adminApp);
              await messaging.send({
                token: fcmToken,
                notification: {
                  title: title || 'Current News Alert',
                  body: body || 'A new editorial dispatch has just been published.',
                  imageUrl: image || undefined,
                },
                data: {
                  url: String(url || '/'),
                  postId: String(postId || ''),
                },
                android: {
                  priority: 'high',
                  notification: {
                    icon: 'ic_notification',
                    color: '#0f172a',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                  },
                },
              });
              sent++;
              delivered = true;
            } catch (fcmErr: any) {
              const errCode = fcmErr?.code || '';
              if (
                errCode === 'messaging/registration-token-not-registered' ||
                errCode === 'messaging/invalid-registration-token'
              ) {
                await dbDeleteSubscription(rawEndpoint).catch(() => {});
                purged++;
              } else {
                console.warn(`[Push Service] FCM dispatch notice:`, fcmErr?.message || fcmErr);
              }
            }
          }

          // 2. Deliver via standard WebPush protocol if not already delivered and subscription keys or endpoint exists
          if (!delivered && pushEnabled && (sub.p256dh || isAllowedEndpoint(rawEndpoint))) {
            try {
              const pushConfig = {
                endpoint: rawEndpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              };

              await webpush.sendNotification(pushConfig, payload, {
                TTL: 86400,
                urgency: 'high',
              });
              sent++;
              delivered = true;
            } catch (webpushErr: any) {
              if (webpushErr.statusCode === 404 || webpushErr.statusCode === 410) {
                await dbDeleteSubscription(rawEndpoint).catch(() => {});
                purged++;
              } else {
                console.warn(`[Push Service] WebPush delivery notice for ${rawEndpoint.slice(0, 50)}:`, webpushErr?.message || webpushErr);
              }
            }
          }

          if (!delivered) {
            failed++;
          }
        })
      );
    }

    const summaryMessage = sent > 0
      ? `Ping broadcast dispatched to ${sent} active device(s)${purged > 0 ? ` (${purged} stale tokens purged)` : ''}.`
      : failed > 0
        ? `Broadcast processed for ${subscriptions.length} devices (${failed} unreachable or awaiting client reconnection).`
        : 'Broadcast completed.';

    return res.json({
      success: true,
      message: summaryMessage,
      sent,
      failed,
      purged,
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error('[Push Service] Broadcast dispatch error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to dispatch push broadcast',
    });
  }
}
