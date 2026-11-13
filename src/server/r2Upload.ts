import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Request, Response } from 'express';
import crypto from 'crypto';

// Lazy initialize S3 Client for Cloudflare R2
let s3Client: S3Client | null = null;

function getR2Credentials() {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  let accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  let secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucketName = process.env.R2_BUCKET_NAME || 'currentnews-media';

  // Check if access keys were swapped in environment settings
  if (accessKeyId.length === 64 && secretAccessKey.length === 32) {
    const temp = accessKeyId;
    accessKeyId = secretAccessKey;
    secretAccessKey = temp;
  }

  // AWS S3 / Cloudflare R2 S3 protocol requires accessKeyId to be strictly 32 hex characters
  const isS3Valid = Boolean(
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    accessKeyId.length === 32 &&
    secretAccessKey.length >= 32
  );

  // If user provided a Cloudflare API token (typically 40-60 characters, like length 53)
  const apiToken =
    (accessKeyId.length > 32 ? accessKeyId : (secretAccessKey.length > 32 ? secretAccessKey : null)) ||
    (process.env.CLOUDFLARE_API_TOKEN || '').trim() ||
    null;

  return { accountId, accessKeyId, secretAccessKey, bucketName, isS3Valid, apiToken };
}

function getR2Client(): S3Client | null {
  const creds = getR2Credentials();
  if (!creds.isS3Valid) {
    return null;
  }

  if (!s3Client) {
    const endpoint = process.env.R2_ENDPOINT || `https://${creds.accountId}.r2.cloudflarestorage.com`;

    s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });
  }
  return s3Client;
}

export function detectImageTypeFromMagicBytes(buffer: Buffer): { ext: 'jpg' | 'png' | 'webp' | 'gif' | 'avif'; mime: string } | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // Reject SVG or XML strings anywhere in the first 1KB (polyglot SVG prevention)
  const preview = buffer.subarray(0, 1024).toString('utf8').toLowerCase();
  if (preview.includes('<svg') || preview.includes('<?xml') || preview.includes('<!doctype svg')) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { ext: 'png', mime: 'image/png' };
  }

  // 3. GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && // G
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x38 && // 8
    (buffer[4] === 0x37 || buffer[4] === 0x39) && // 7 or 9
    buffer[5] === 0x61    // a
  ) {
    return { ext: 'gif', mime: 'image/gif' };
  }

  // 4. WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50   // WEBP
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  // 5. AVIF: ISOBMFF ftyp avif or avis
  if (buffer.length >= 12) {
    const isFtyp = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
    if (isFtyp) {
      const brand = buffer.subarray(8, 12).toString('ascii');
      if (brand === 'avif' || brand === 'avis') {
        return { ext: 'avif', mime: 'image/avif' };
      }
      const ftypBoxLen = buffer.readUInt32BE(0);
      const searchEnd = Math.min(buffer.length, ftypBoxLen > 0 ? ftypBoxLen : 64);
      for (let offset = 16; offset + 4 <= searchEnd; offset += 4) {
        const compBrand = buffer.subarray(offset, offset + 4).toString('ascii');
        if (compBrand === 'avif' || compBrand === 'avis') {
          return { ext: 'avif', mime: 'image/avif' };
        }
      }
    }
  }

  return null;
}

export async function handleR2Upload(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file || !file.buffer || file.buffer.length === 0) {
      res.status(400).json({ success: false, error: 'No image file was provided for upload.' });
      return;
    }

    const originalName = file.originalname || '';
    const clientMime = (file.mimetype || '').toLowerCase();

    // Reject SVG by MIME or extension
    if (clientMime === 'image/svg+xml' || /\.svg$/i.test(originalName)) {
      res.status(400).json({
        success: false,
        error: 'SVG uploads are strictly prohibited. Only JPEG, PNG, WebP, GIF, and AVIF are permitted.'
      });
      return;
    }

    // Verify real file type from magic bytes, not client MIME type
    const detected = detectImageTypeFromMagicBytes(file.buffer);
    if (!detected) {
      res.status(400).json({
        success: false,
        error: 'Invalid or unsupported image file. Only real JPEG, PNG, WebP, GIF, and AVIF files are permitted.'
      });
      return;
    }

    const ext = detected.ext;
    const uploadContentType = detected.mime;

    // Generate unique slug with year/month folder structure for clean organization
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomHex = crypto.randomBytes(8).toString('hex');
    const sanitizedOriginal = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'photo';
    const key = `uploads/${year}/${month}/${Date.now()}_${randomHex}_${sanitizedOriginal}.${ext}`;

    let publicUrl = '';
    let fallbackUrl = '';

    const sanitizeDomain = (val: string | undefined, fallback: string): string => {
      if (!val) return fallback;
      let d = val.trim().replace(/^(?:https?[:/]*)+/i, '');
      d = d.split('/')[0];
      d = d.replace(/\/+$/, '').trim();
      return d || fallback;
    };

    // Check if Cloudflare R2 is configured with valid S3 credentials
    const creds = getR2Credentials();
    const client = getR2Client();
    if (client) {
      try {
        const command = new PutObjectCommand({
          Bucket: creds.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: uploadContentType,
          CacheControl: 'public, max-age=31536000, immutable',
        });

        await client.send(command);

        const customDomain = sanitizeDomain(process.env.R2_PUBLIC_DOMAIN, 'media.currentnews.blog');
        const r2DevDomain = sanitizeDomain(process.env.R2_DEV_DOMAIN, '');

        publicUrl = `https://${customDomain}/${key}`;
        fallbackUrl = r2DevDomain ? `https://${r2DevDomain}/${key}` : publicUrl;
      } catch (r2Error) {
        console.error('R2 S3 storage push notice:', r2Error);
      }
    }

    // If S3 was not used or failed, try Cloudflare REST API directly if API token is available
    if (!publicUrl && creds.accountId && creds.apiToken) {
      try {
        const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/r2/buckets/${creds.bucketName}/objects/${key}`;
        const cfRes = await fetch(cfUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${creds.apiToken}`,
            'Content-Type': uploadContentType,
          },
          body: file.buffer,
        });
        if (cfRes.ok) {
          const customDomain = sanitizeDomain(process.env.R2_PUBLIC_DOMAIN, 'media.currentnews.blog');
          const r2DevDomain = sanitizeDomain(process.env.R2_DEV_DOMAIN, '');

          publicUrl = `https://${customDomain}/${key}`;
          fallbackUrl = r2DevDomain ? `https://${r2DevDomain}/${key}` : publicUrl;
        }
      } catch (cfErr) {
        console.error('R2 REST API upload notice:', cfErr);
      }
    }

    // If R2 upload fails, return an error to the client. Never return a base64 data URL fallback.
    if (!publicUrl) {
      res.status(500).json({
        success: false,
        error: 'Failed to upload photo to Cloudflare R2 storage.'
      });
      return;
    }

    res.json({
      success: true,
      url: publicUrl,
      fallbackUrl: fallbackUrl,
      key: key,
      size: file.size,
      mimetype: uploadContentType,
    });
  } catch (error: any) {
    console.error('[Upload Error]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload photo: ' + (error?.message || 'unknown error'),
    });
  }
}
