import type { Request, Response } from 'express';
import webpush from 'web-push';
import { query } from '../../server/db/neon.ts';

// ---------------------------------------------------------------------------
// VAPID keys — read ONLY from environment variables.
// If missing, push is disabled; we log a clear error and all endpoints
// return 503 so callers know to fix config rather than silently fail.
// ---------------------------------------------------------------------------
const VAPID_PUBLIC_KEY_RAW = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY_RAW = process.env.VAPID_PRIVATE_KEY;
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@currentnews.blog';

let pushEnabled = false;

if (!VAPID_PUBLIC_KEY_RAW || !VAPID_PRIVATE_KEY_RAW) {
  console.error(
    '[Push Service] CRITICAL: VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY are missing from environment. ' +
    'Push notifications are DISABLED. Set both env vars and redeploy to enable push.'
  );
} else {
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
  await query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE
       SET p256dh     = EXCLUDED.p256dh,
           auth       = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent`,
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
  const result = await query<PushRow>('SELECT endpoint, p256dh, auth FROM push_subscriptions');
  return result.rows;
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
 * Registers a device push subscription into Neon push_subscriptions table.
 */
export async function handleSubscribe(req: Request, res: Response) {
  if (!pushEnabled) {
    return res.status(503).json({ success: false, error: 'Push notifications are disabled (VAPID keys not configured).' });
  }

  try {
    const { subscription, userAgent } = req.body || {};

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: 'Missing required push subscription object or keys',
      });
    }

    const validationError = validateSubscription(subscription);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const ua: string = typeof userAgent === 'string'
      ? userAgent.slice(0, 512)
      : (req.headers['user-agent'] || '').slice(0, 512);

    await dbUpsertSubscription(
      subscription.endpoint as string,
      subscription.keys.p256dh as string,
      subscription.keys.auth as string,
      ua
    );

    return res.json({
      success: true,
      message: 'Device subscribed to background push notifications successfully.',
    });
  } catch (error: any) {
    console.error('[Push Service] Subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save push subscription',
    });
  }
}

/**
 * POST /api/push/unsubscribe
 * Removes a device push subscription.
 */
export async function handleUnsubscribe(req: Request, res: Response) {
  if (!pushEnabled) {
    return res.status(503).json({ success: false, error: 'Push notifications are disabled (VAPID keys not configured).' });
  }

  try {
    const { endpoint } = req.body || {};

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing subscription endpoint',
      });
    }

    await dbDeleteSubscription(endpoint);

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
 * POST /api/push/broadcast
 * Dispatches a push notification to all subscribed devices.
 * Requires admin role (enforced in server.ts).
 */
export async function handleBroadcast(req: Request, res: Response) {
  if (!pushEnabled) {
    return res.status(503).json({ success: false, error: 'Push notifications are disabled (VAPID keys not configured).' });
  }

  try {
    const { title, body, url, postId, image, icon } = req.body || {};

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Notification title is required',
      });
    }

    const payload = JSON.stringify({
      title: title || 'Current News Live',
      body: body || 'A new article has just been published.',
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
        message: 'No active device subscriptions found.',
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
          try {
            const pushConfig = {
              endpoint: sub.endpoint,
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
          } catch (err: any) {
            failed++;
            if (err.statusCode === 404 || err.statusCode === 410) {
              // Stale subscription — delete from DB
              await dbDeleteSubscription(sub.endpoint).catch(() => {});
              purged++;
            } else {
              console.warn(`[Push Service] Push delivery notice for ${sub.endpoint.slice(0, 60)}:`, err.message);
            }
          }
        })
      );
    }

    return res.json({
      success: true,
      message: `Notification broadcast dispatched. Sent: ${sent}, Failed: ${failed}, Purged: ${purged}`,
      sent,
      failed,
      purged,
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error('[Push Service] Broadcast dispatch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to dispatch push broadcast',
    });
  }
}
