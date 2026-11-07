import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

export async function handleR2Upload(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No image file was provided for upload.' });
      return;
    }

    // Determine extension from original name or mimetype
    const mime = (file.mimetype || '').toLowerCase();
    const originalName = file.originalname || '';
    let ext = 'jpg';
    if (mime === 'image/png') ext = 'png';
    else if (mime === 'image/webp') ext = 'webp';
    else if (mime === 'image/gif') ext = 'gif';
    else if (mime === 'image/svg+xml') ext = 'svg';
    else if (mime === 'image/avif') ext = 'avif';
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg';
    else {
      const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch) {
        const foundExt = extMatch[1].toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif', 'avif'].includes(foundExt)) {
          ext = foundExt === 'jpeg' ? 'jpg' : foundExt;
        }
      }
    }

    // Standardize ContentType so browsers display images correctly
    let uploadContentType = file.mimetype;
    if (!uploadContentType || uploadContentType === 'application/octet-stream' || !uploadContentType.startsWith('image/')) {
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        avif: 'image/avif',
      };
      uploadContentType = mimeMap[ext] || 'image/jpeg';
    }

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
        console.warn('R2 S3 storage push notice:', r2Error);
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
        console.warn('R2 REST API upload notice:', cfErr);
      }
    }

    // If R2 is not configured or failed, save locally in public/uploads for instant reliability
    if (!publicUrl) {
      const localDir = path.join(process.cwd(), 'public', 'uploads', String(year), month);
      await fs.promises.mkdir(localDir, { recursive: true });
      const localFileName = `${Date.now()}_${randomHex}_${sanitizedOriginal}.${ext}`;
      const localFilePath = path.join(localDir, localFileName);
      await fs.promises.writeFile(localFilePath, file.buffer);

      publicUrl = `/uploads/${year}/${month}/${localFileName}`;
      fallbackUrl = publicUrl;
    }

    res.json({
      success: true,
      url: publicUrl,
      fallbackUrl: fallbackUrl,
      key: key,
      size: file.size,
      mimetype: file.mimetype,
    });
  } catch (error: any) {
    console.warn('Upload fallback note:', error);
    const file = req.file;
    if (file && file.buffer) {
      const mime = file.mimetype || 'image/jpeg';
      const fallbackDataUrl = `data:${mime};base64,${file.buffer.toString('base64')}`;
      res.status(200).json({
        success: true,
        url: fallbackDataUrl,
        fallbackUrl: fallbackDataUrl,
        size: file.size,
        mimetype: mime,
      });
      return;
    }
    res.status(200).json({
      success: false,
      error: 'Failed to upload photo: ' + (error?.message || 'unknown error'),
    });
  }
}
