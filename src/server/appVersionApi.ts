import express from 'express';
import fs from 'fs';
import path from 'path';

export interface AppVersionConfig {
  latestVersion: string;
  latestVersionCode: number;
  minSupportedVersion: string;
  minSupportedVersionCode: number;
  title: string;
  releaseNotes: string[];
  forceUpdate: boolean;
  playStoreUrl: string;
  directApkUrl: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const VERSION_FILE = path.join(DATA_DIR, 'app-version.json');

// Default initial production version state
const DEFAULT_VERSION_CONFIG: AppVersionConfig = {
  latestVersion: "1.0.1",
  latestVersionCode: 2,
  minSupportedVersion: "1.0.0",
  minSupportedVersionCode: 1,
  title: "New Live Edition Available",
  releaseNotes: [
    "Ultra-fast article preview loading with zero layout shift.",
    "Integrated multi-origin edge load balancing.",
    "Improved offline cache and regional dispatches."
  ],
  forceUpdate: false,
  playStoreUrl: "https://play.google.com/store/apps/details?id=blog.currentnews.app",
  directApkUrl: "https://media.currentnews.blog/app/currentnews-latest.apk",
  updatedAt: new Date().toISOString()
};

function ensureVersionConfigFile(): AppVersionConfig {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(VERSION_FILE)) {
      const raw = fs.readFileSync(VERSION_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_VERSION_CONFIG, ...parsed };
    }
    fs.writeFileSync(VERSION_FILE, JSON.stringify(DEFAULT_VERSION_CONFIG, null, 2), 'utf-8');
    return DEFAULT_VERSION_CONFIG;
  } catch (err) {
    console.error('[AppVersion] Error loading version file, using defaults:', err);
    return DEFAULT_VERSION_CONFIG;
  }
}

/**
 * GET /api/app/version
 * Returns the authoritative version requirement for Android, PWA and Web clients
 */
export async function handleGetAppVersion(_req: express.Request, res: express.Response) {
  try {
    const config = ensureVersionConfigFile();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({
      success: true,
      ...config
    });
  } catch (error: any) {
    console.error('[AppVersion GET Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve app version configuration'
    });
  }
}

/**
 * POST /api/app/version
 * Admin endpoint to dynamically update version codes and release notes
 */
export async function handleUpdateAppVersion(req: express.Request, res: express.Response) {
  try {
    const body = req.body || {};
    const current = ensureVersionConfigFile();

    const updated: AppVersionConfig = {
      ...current,
      latestVersion: body.latestVersion ? String(body.latestVersion).trim() : current.latestVersion,
      latestVersionCode: typeof body.latestVersionCode === 'number' ? body.latestVersionCode : current.latestVersionCode,
      minSupportedVersion: body.minSupportedVersion ? String(body.minSupportedVersion).trim() : current.minSupportedVersion,
      minSupportedVersionCode: typeof body.minSupportedVersionCode === 'number' ? body.minSupportedVersionCode : current.minSupportedVersionCode,
      title: body.title ? String(body.title).trim() : current.title,
      releaseNotes: Array.isArray(body.releaseNotes) && body.releaseNotes.length > 0 ? body.releaseNotes : current.releaseNotes,
      forceUpdate: typeof body.forceUpdate === 'boolean' ? body.forceUpdate : current.forceUpdate,
      playStoreUrl: body.playStoreUrl ? String(body.playStoreUrl).trim() : current.playStoreUrl,
      directApkUrl: body.directApkUrl ? String(body.directApkUrl).trim() : current.directApkUrl,
      updatedAt: new Date().toISOString()
    };

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(VERSION_FILE, JSON.stringify(updated, null, 2), 'utf-8');

    return res.status(200).json({
      success: true,
      message: 'App version configuration updated successfully',
      config: updated
    });
  } catch (error: any) {
    console.error('[AppVersion POST Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update app version configuration'
    });
  }
}
