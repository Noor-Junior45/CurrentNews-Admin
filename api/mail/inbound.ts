import type { Request, Response } from 'express';

export const INBOUND_MAIL_CONFIG = {
  name: 'Current News Support',
  address: 'help@currentnews.blog',
  formatted: 'Current News Support <help@currentnews.blog>',
  mailto: 'mailto:Current%20News%20Support%20%3Chelp%40currentnews.blog%3E',
};

/**
 * Inbound Mail API Function
 * Serves canonical inbound mail configuration and processes inbound webhooks
 * for Current News Support <help@currentnews.blog>.
 */
export default async function handler(req: Request, res: Response) {
  // CORS & Preflight handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return the inbound mail recipient details for autofill and client integration
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'Current News Inbound Mail Dispatch',
      name: INBOUND_MAIL_CONFIG.name,
      address: INBOUND_MAIL_CONFIG.address,
      formatted: INBOUND_MAIL_CONFIG.formatted,
      mailto: INBOUND_MAIL_CONFIG.mailto,
      timestamp: new Date().toISOString(),
    });
  }

  // POST: Receive inbound webhook notifications (e.g. Resend Inbound Email Webhook)
  if (req.method === 'POST') {
    const payload = req.body || {};
    console.log('\n==================================================');
    console.log('[INBOUND MAIL WEBHOOK] Incoming message received');
    console.log(`Destination Recipient : ${INBOUND_MAIL_CONFIG.formatted}`);
    console.log('Sender From           :', payload.from || payload.sender || 'Unknown');
    console.log('Subject               :', payload.subject || 'No Subject');
    console.log('Timestamp             :', new Date().toISOString());
    console.log('==================================================\n');

    return res.status(200).json({
      success: true,
      message: `Inbound mail payload received for ${INBOUND_MAIL_CONFIG.formatted}`,
      recipient: INBOUND_MAIL_CONFIG.formatted,
      receivedAt: new Date().toISOString(),
    });
  }

  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed',
  });
}
