import type { Request, Response } from 'express';
import webpush from 'web-push';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Local disk persistence for push subscriptions (decoupled from Firestore)
const DATA_DIR = path.join(process.cwd(), 'data');
const PUSH_SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

interface StoredPushSub {
  id: string;
  endpoint: string;
  keys: {
    p256dh?: string;
    auth?: string;
  };
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

function loadPushSubscriptions(): Map<string, StoredPushSub> {
  const map = new Map<string, StoredPushSub>();
  try {
    ensureDataDir();
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      const raw = fs.readFileSync(PUSH_SUBS_FILE, 'utf-8');
      const list: StoredPushSub[] = JSON.parse(raw);
      for (const item of list) {
        if (item && item.endpoint) {
          map.set(item.id || getEndpointId(item.endpoint), item);
        }
      }
    }
  } catch (err) {
    console.warn('[Push Service] Could not read push_subscriptions.json:', err);
  }
  return map;
}

function savePushSubscriptions(map: Map<string, StoredPushSub>) {
  try {
    ensureDataDir();
    const arr = Array.from(map.values());
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Push Service] Could not write push_subscriptions.json:', err);
  }
}

const VAPID_FILE = path.join(DATA_DIR, 'vapid_keys.json');

// VAPID credentials for Web Push protocol (RFC 8292 / RFC 8291 standard)
let resolvedPublicKey = process.env.VAPID_PUBLIC_KEY;
let resolvedPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!resolvedPublicKey || !resolvedPrivateKey) {
  try {
    ensureDataDir();
    if (fs.existsSync(VAPID_FILE)) {
      const savedKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
      resolvedPublicKey = resolvedPublicKey || savedKeys.publicKey;
      resolvedPrivateKey = resolvedPrivateKey || savedKeys.privateKey;
    }
  } catch (readErr) {
    console.warn('[Push Service] Could not read vapid_keys.json:', readErr);
  }
}

if (!resolvedPublicKey || !resolvedPrivateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    resolvedPublicKey = resolvedPublicKey || generated.publicKey;
    resolvedPrivateKey = resolvedPrivateKey || generated.privateKey;
    try {
      ensureDataDir();
      fs.writeFileSync(VAPID_FILE, JSON.stringify({
        publicKey: resolvedPublicKey,
        privateKey: resolvedPrivateKey,
      }, null, 2), 'utf-8');
      console.log('[Push Service] Persisted generated VAPID keys to data/vapid_keys.json');
    } catch (saveErr) {
      console.warn('[Push Service] Could not write vapid_keys.json:', saveErr);
    }
  } catch (genErr) {
    console.warn('[Push Service] Could not generate dynamic VAPID keys:', genErr);
  }
}

export const VAPID_PUBLIC_KEY = resolvedPublicKey || '';
export const VAPID_PRIVATE_KEY = resolvedPrivateKey || '';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@currentnews.blog';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('[Push Service] VAPID details configured successfully.');
  } catch (vapidErr) {
    console.error('[Push Service] VAPID initialization error:', vapidErr);
  }
}

// Generate stable deterministic ID from endpoint URL
function getEndpointId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').substring(0, 32);
}

/**
 * GET /api/push/public-key
 * Returns the VAPID Public Key needed by the browser/Android device to generate push credentials.
 */
export function handleGetVapidPublicKey(_req: Request, res: Response) {
  return res.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
  });
}

/**
 * POST /api/push/subscribe
 * Registers a device push subscription into local JSON store.
 */
export async function handleSubscribe(req: Request, res: Response) {
  try {
    const { subscription, userAgent } = req.body || {};

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: 'Missing required push subscription object or keys',
      });
    }

    const docId = getEndpointId(subscription.endpoint);
    const subsMap = loadPushSubscriptions();

    const existing = subsMap.get(docId);
    subsMap.set(docId, {
      id: docId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: userAgent || req.headers['user-agent'] || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    savePushSubscriptions(subsMap);

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
 * Removes a device push subscription when the user toggles off alerts.
 */
export async function handleUnsubscribe(req: Request, res: Response) {
  try {
    const { endpoint } = req.body || {};

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing subscription endpoint',
      });
    }

    const docId = getEndpointId(endpoint);
    const subsMap = loadPushSubscriptions();
    subsMap.delete(docId);
    savePushSubscriptions(subsMap);

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
 */
export async function handleGetSubscribersCount(_req: Request, res: Response) {
  try {
    const subsMap = loadPushSubscriptions();
    return res.json({
      success: true,
      count: subsMap.size,
    });
  } catch (error: any) {
    console.warn('[Push Service] Count notice:', error);
    return res.json({
      success: true,
      count: 0,
    });
  }
}

/**
 * POST /api/push/broadcast
 * Dispatches an automated background push notification to all subscribed devices.
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
      title: title || 'Current News Live',
      body: body || 'A new article has just been published.',
      url: url || '/',
      postId: postId || '',
      image: image || undefined,
      icon: icon || 'https://i.imgur.com/gFgShoZ.jpeg',
      badge: 'https://i.imgur.com/gFgShoZ.jpeg',
      timestamp: Date.now(),
    });

    const subsMap = loadPushSubscriptions();
    const subscriptions = Array.from(subsMap.values());

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
                p256dh: sub.keys?.p256dh,
                auth: sub.keys?.auth,
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
              subsMap.delete(sub.id);
              purged++;
            } else {
              console.warn(`[Push Service] Push delivery notice for ${sub.id}:`, err.message);
            }
          }
        })
      );
    }

    if (purged > 0) {
      savePushSubscriptions(subsMap);
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
