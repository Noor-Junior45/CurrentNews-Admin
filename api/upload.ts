import type { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { detectImageTypeFromMagicBytes } from '../src/server/r2Upload.ts';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Only POST is accepted.' });
  }

  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }

    // Read request body buffer
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const fullBuffer = Buffer.concat(chunks);

    // Parse boundary
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = match ? match[1] || match[2] : null;
    if (!boundary) {
      return res.status(400).json({ error: 'Invalid multipart boundary' });
    }

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = splitBuffer(fullBuffer, boundaryBuffer);

    let fileBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    let originalName = 'photo.jpg';

    for (const part of parts) {
      const headerEndIndex = part.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) continue;

      const headerText = part.subarray(0, headerEndIndex).toString('utf8');
      const bodyBuffer = part.subarray(headerEndIndex + 4);

      if (headerText.includes('name="image"') && headerText.includes('filename="')) {
        const fnMatch = headerText.match(/filename="([^"]+)"/);
        if (fnMatch) originalName = fnMatch[1];

        const ctMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
        if (ctMatch) mimeType = ctMatch[1].trim();

        // Strip trailing \r\n before closing boundary
        let endLen = bodyBuffer.length;
        if (bodyBuffer.subarray(endLen - 2).toString() === '\r\n') {
          endLen -= 2;
        }
        fileBuffer = bodyBuffer.subarray(0, endLen);
        break;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'No image file binary was received.' });
    }

    // Helper to sanitize domain strings against accidental protocol or path prefixes
    const sanitizeDomain = (val: string | undefined, fallback: string): string => {
      if (!val) return fallback;
      let d = val.trim().replace(/^(?:https?[:/]*)+/i, '');
      d = d.split('/')[0];
      d = d.replace(/\/+$/, '').trim();
      return d || fallback;
    };

    const customDomain = sanitizeDomain(process.env.R2_PUBLIC_DOMAIN, 'media.currentnews.blog');
    const r2DevDomain = sanitizeDomain(process.env.R2_DEV_DOMAIN, '');

    // Reject SVG by MIME or extension
    if (mimeType.toLowerCase() === 'image/svg+xml' || /\.svg$/i.test(originalName)) {
      return res.status(400).json({
        success: false,
        error: 'SVG uploads are strictly prohibited. Only JPEG, PNG, WebP, GIF, and AVIF are permitted.'
      });
    }

    // Verify real file type from magic bytes, not client MIME type
    const detected = detectImageTypeFromMagicBytes(fileBuffer);
    if (!detected) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported image file. Only real JPEG, PNG, WebP, GIF, and AVIF files are permitted.'
      });
    }

    const ext = detected.ext;
    const uploadContentType = detected.mime;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomHex = crypto.randomBytes(8).toString('hex');
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'photo';
    const key = `uploads/${year}/${month}/${Date.now()}_${randomHex}_${sanitizedName}.${ext}`;

    // Attempt upload to Cloudflare R2
    const accountId = process.env.R2_ACCOUNT_ID;
    let accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
    let secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
    const bucketName = process.env.R2_BUCKET_NAME || 'currentnews-media';

    let uploadedToCloud = false;

    // Check if access keys were swapped in environment settings
    if (accessKeyId.length === 64 && secretAccessKey.length === 32) {
      const temp = accessKeyId;
      accessKeyId = secretAccessKey;
      secretAccessKey = temp;
    }

    if (accountId && accessKeyId && secretAccessKey && accessKeyId.length === 32) {
      try {
        const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
        const s3Client = new S3Client({
          region: 'auto',
          endpoint: endpoint,
          credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
          },
        });

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: uploadContentType,
          CacheControl: 'public, max-age=31536000, immutable',
        });

        await s3Client.send(command);
        uploadedToCloud = true;
      } catch (s3Err) {
        console.warn('S3 upload notice:', s3Err);
      }
    }

    // If S3 credentials did not work but an API token is present, try Cloudflare REST API directly
    if (!uploadedToCloud && accountId && (accessKeyId.length > 32 || secretAccessKey.length > 32)) {
      const apiToken = accessKeyId.length > 32 ? accessKeyId : secretAccessKey;
      try {
        const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;
        const cfRes = await fetch(cfUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': uploadContentType,
          },
          body: fileBuffer,
        });
        if (cfRes.ok) {
          uploadedToCloud = true;
        }
      } catch (cfErr) {
        console.warn('Cloudflare REST API notice:', cfErr);
      }
    }

    if (uploadedToCloud) {
      return res.status(200).json({
        success: true,
        url: `https://${customDomain}/${key}`,
        fallbackUrl: r2DevDomain ? `https://${r2DevDomain}/${key}` : `https://${customDomain}/${key}`,
        key: key,
        size: fileBuffer.length,
        mimetype: uploadContentType,
      });
    }

    // If R2 upload fails, return an error to the client. Never return a base64 data URL fallback.
    return res.status(500).json({
      success: false,
      error: 'Failed to upload photo to Cloudflare R2 storage.'
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Upload error: ' + (error?.message || 'unknown error'),
    });
  }
}

// Utility to split buffer by delimiter
function splitBuffer(buf: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let index: number;

  while ((index = buf.indexOf(delimiter, start)) !== -1) {
    if (index > start) {
      parts.push(buf.subarray(start, index));
    }
    start = index + delimiter.length;
  }

  if (start < buf.length) {
    parts.push(buf.subarray(start));
  }

  return parts;
}
