import type { Request, Response } from 'express';

async function sendResendEmail(toEmail: string, subject: string, htmlContent: string, textContent: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not defined.');
  }

  const senderEmail = process.env.RESEND_SENDER_EMAIL || 'alerts@currentnews.blog';
  const senderName = process.env.RESEND_SENDER_NAME || 'Current News';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${senderName} <${senderEmail}>`,
      to: [toEmail],
      subject: subject,
      html: htmlContent,
      text: textContent,
      reply_to: 'Current News <support@guashoomin.resend.app>'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.message) {
        parsedMessage = parsed.message;
      }
    } catch (e) {}

    const lowerMsg = parsedMessage.toLowerCase();
    // Resend's equivalent of Brevo's "IP not whitelisted" gotcha: until you verify a
    // sending domain, it only lets you send to the email address on your own account.
    if (
      response.status === 403 &&
      (lowerMsg.includes('domain is not verified') ||
        lowerMsg.includes('you can only send testing emails') ||
        lowerMsg.includes('verify a domain'))
    ) {
      throw new Error(`RESEND_DOMAIN_UNVERIFIED: ${parsedMessage}`);
    }

    throw new Error(`Resend API responded with status ${response.status}: ${parsedMessage}`);
  }

  return await response.json();
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidSingleEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  // Disallow any whitespace, commas, semicolons, linebreaks
  if (/[\s,;\r\n]/.test(trimmed)) return false;
  // Strict RFC-compliant single email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

export default async function handler(req: Request, res: Response) {
  // Support both POST (standard) and OPTIONS (for preflight if needed)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, title, link } = req.body || {};

  if (!email || !title) {
    return res.status(400).json({ success: false, message: 'Recipient email and subject title are required.' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  if (!isValidSingleEmail(trimmedEmail)) {
    return res.status(400).json({ success: false, message: 'Invalid recipient email address format.' });
  }

  // Validate and sanitize link URL — must start with the approved domain
  let safeLink = 'https://currentnews.blog';
  if (link && typeof link === 'string') {
    const rawLink = link.trim();
    if (rawLink.startsWith('https://currentnews.blog') || rawLink.startsWith('https://www.currentnews.blog')) {
      safeLink = rawLink;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid link. Must start with https://currentnews.blog or https://www.currentnews.blog.' });
    }
  }

  const safeTitle = escapeHtml(String(title).trim());
  const safeLinkEscaped = escapeHtml(safeLink);

  try {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #0f172a;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header p {
      color: #94a3b8;
      margin: 4px 0 0 0;
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .content {
      padding: 40px 32px;
      color: #334155;
    }
    .content h2 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    .content p {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 8px 0;
    }
    .btn {
      display: inline-block;
      background-color: #0f172a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer a {
      color: #0f172a;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Current News</h1>
        <p>Independent Ledger &amp; Alerts</p>
      </div>
      <div class="content">
        <h2>${safeTitle}</h2>
        <p>Hello,</p>
        <p>We are pleased to bring you the latest verified update from Current News. Stay ahead of the curve with our independent journalism and real-time dispatches.</p>
        <p>Click the button below to access the live story or explore our coverage immediately.</p>
        <div class="btn-container">
          <a href="${safeLinkEscaped}" class="btn" target="_blank">Access Live Story</a>
        </div>
      </div>
      <div class="footer">
        <p><strong>Current News</strong></p>
        <p>Serving the public interest with transparent, accurate, and autonomous journalism.</p>
        <p style="margin-top: 12px; color: #94a3b8;">
          You received this email because you subscribed to our breaking news alerts.<br>
          If you wish to stop receiving these dispatches, you can <a href="${safeLinkEscaped}/unsubscribe">unsubscribe</a> at any time.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const textContent = `Welcome to Current News! ${safeTitle}. Read more at ${safeLink}`;
    const result = await sendResendEmail(email, safeTitle, htmlContent, textContent);

    console.log(`[VERCEL SERVERLESS RESEND API] Email successfully dispatched. Result:`, result);
    return res.status(200).json({
      success: true,
      message: `Automated breaking news alert email compiled and sent to ${email} via Resend API.`
    });

  } catch (err: any) {
    console.error('[VERCEL SERVERLESS RESEND API] Failed to send email via Resend API:', err);

    if (err.message && err.message.startsWith('RESEND_DOMAIN_UNVERIFIED:')) {
      const rawMessage = err.message.replace('RESEND_DOMAIN_UNVERIFIED:', '').trim();
      return res.status(403).json({
        success: false,
        isDomainRestriction: true,
        message: `Resend blocked this request because your sending domain isn't verified yet.`,
        detail: rawMessage,
        solution: `Please log into Resend, go to Domains (https://resend.com/domains), add and verify "currentnews.blog" (or whichever domain you're sending from), then set RESEND_SENDER_EMAIL to an address on that domain. Until verified, Resend only lets you send to the email address on your own Resend account.`
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Resend API dispatch failed',
      error: err.message
    });
  }
}
