/**
 * appVersionManager.ts — Cloud/Server-Driven App Update Controller (Option B)
 * 
 * Compares current client build info (via @capacitor/app or web manifest)
 * against Cloud Run / Edge API to trigger non-intrusive bottom update sheets or
 * mandatory security update locks.
 */

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { webUrl } from './webBase';

export interface AppVersionInfo {
  latestVersion: string;
  latestVersionCode: number;
  minSupportedVersion: string;
  minSupportedVersionCode: number;
  title: string;
  releaseNotes: string[];
  forceUpdate: boolean;
  playStoreUrl: string;
  directApkUrl: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  currentVersionCode: number;
  remoteInfo: AppVersionInfo | null;
}

const CURRENT_CLIENT_VERSION = '1.0.0';
const CURRENT_CLIENT_VERSION_CODE = 1;
const SNOOZE_STORAGE_KEY = 'cn_update_snooze_until';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours snooze

/**
 * Compares semantic version strings (e.g., "1.1.0" vs "1.0.0")
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '0.0.0').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const clean2 = (v2 || '0.0.0').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(clean1.length, clean2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

class AppVersionManager {
  private cachedClientInfo: { version: string; build: number } | null = null;

  /**
   * Retrieves the locally installed version from Capacitor runtime or fallback
   */
  public async getInstalledClientVersion(): Promise<{ version: string; build: number }> {
    if (this.cachedClientInfo) return this.cachedClientInfo;

    if (Capacitor.isNativePlatform()) {
      try {
        const info = await App.getInfo();
        this.cachedClientInfo = {
          version: info.version || CURRENT_CLIENT_VERSION,
          build: parseInt(info.build, 10) || CURRENT_CLIENT_VERSION_CODE,
        };
        return this.cachedClientInfo;
      } catch (err) {
        console.debug('[AppVersion] Native App.getInfo() deferred:', err);
      }
    }

    this.cachedClientInfo = {
      version: CURRENT_CLIENT_VERSION,
      build: CURRENT_CLIENT_VERSION_CODE,
    };
    return this.cachedClientInfo;
  }

  /**
   * Queries the Cloud Run API or Edge CDN to check for newer editions
   */
  public async checkForUpdates(): Promise<UpdateCheckResult> {
    const client = await this.getInstalledClientVersion();

    let remote: AppVersionInfo | null = null;

    // 1. Fetch from Origin API
    try {
      const resp = await fetch(webUrl('/api/app/version'), {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.latestVersion) {
          remote = data;
        }
      }
    } catch (err) {
      console.debug('[AppVersion] Origin API check deferred:', err);
    }

    // 2. Fetch from Cloudflare CDN fallback if Origin API was unreachable
    if (!remote) {
      try {
        const cdnResp = await fetch('https://media.currentnews.blog/app-version.json', {
          signal: AbortSignal.timeout(3000),
        });
        if (cdnResp.ok) {
          remote = await cdnResp.json();
        }
      } catch {
        // Quiet fallback
      }
    }

    if (!remote) {
      return {
        updateAvailable: false,
        forceUpdate: false,
        currentVersion: client.version,
        currentVersionCode: client.build,
        remoteInfo: null,
      };
    }

    // Check version difference
    const codeDiff = (remote.latestVersionCode || 0) > client.build;
    const semverDiff = compareSemver(remote.latestVersion, client.version) > 0;
    const isUpdateAvailable = codeDiff || semverDiff;

    // Check if update is mandatory (breaking schema change or security requirement)
    const isForceUpdate = Boolean(
      remote.forceUpdate ||
      ((remote.minSupportedVersionCode || 0) > client.build) ||
      (remote.minSupportedVersion && compareSemver(remote.minSupportedVersion, client.version) > 0)
    );

    return {
      updateAvailable: isUpdateAvailable,
      forceUpdate: isForceUpdate,
      currentVersion: client.version,
      currentVersionCode: client.build,
      remoteInfo: remote,
    };
  }

  /**
   * Checks if user has snoozed the update banner in the last 24 hours
   */
  public isUpdateSnoozed(): boolean {
    try {
      const snoozedUntil = localStorage.getItem(SNOOZE_STORAGE_KEY);
      if (!snoozedUntil) return false;
      const expireTime = parseInt(snoozedUntil, 10);
      return !isNaN(expireTime) && Date.now() < expireTime;
    } catch {
      return false;
    }
  }

  /**
   * Snoozes the non-mandatory update notification for 24 hours
   */
  public snoozeUpdate(): void {
    try {
      localStorage.setItem(SNOOZE_STORAGE_KEY, String(Date.now() + SNOOZE_DURATION_MS));
    } catch (err) {
      console.debug('Failed to write snooze storage:', err);
    }
  }

  /**
   * Clears the snooze state (e.g. when checking manually in Settings)
   */
  public clearSnooze(): void {
    try {
      localStorage.removeItem(SNOOZE_STORAGE_KEY);
    } catch {}
  }
}

export const appVersionManager = new AppVersionManager();
