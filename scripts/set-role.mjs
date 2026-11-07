#!/usr/bin/env node
/**
 * scripts/set-role.mjs
 * 
 * Sets Firebase Auth custom user claims (role) for staff accounts.
 * Usage:
 *   node scripts/set-role.mjs <email> <admin|writer|none>
 * 
 * Runs in Google Cloud Shell or any environment with Application Default Credentials (ADC).
 * Example:
 *   node scripts/set-role.mjs mdhassan1738@gmail.com admin
 */

import { initializeApp, getApps, applicationDefault, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [,, emailArg, roleArg] = process.argv;

if (!emailArg || !roleArg) {
  console.error('\n[ERROR] Usage: node scripts/set-role.mjs <email> <admin|writer|none>\n');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const role = roleArg.trim().toLowerCase();

if (!['admin', 'writer', 'none'].includes(role)) {
  console.error(`\n[ERROR] Invalid role "${roleArg}". Must be "admin", "writer", or "none".\n`);
  process.exit(1);
}

import fs from 'fs';
import path from 'path';

function getProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID.trim();
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT.trim();
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (parsed.projectId) return parsed.projectId;
    }
  } catch (_) {}
  return '';
}

const projectId = getProjectId();

if (getApps().length === 0) {
  try {
    initializeApp({
      projectId,
      credential: applicationDefault()
    });
  } catch (err) {
    initializeApp({ projectId });
  }
}

const auth = getAuth();

async function setRole() {
  console.log(`\n======================================================`);
  console.log(` CURRENT NEWS - Role Administration CLI`);
  console.log(` Target Email : ${email}`);
  console.log(` Target Role  : ${role}`);
  console.log(` Project ID   : ${projectId}`);
  console.log(`======================================================\n`);

  try {
    // 1. Look up user by email
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    console.log(`[OK] Located User: UID = ${uid}`);

    // 2. Set custom claims (empty object when 'none' to remove role)
    const customClaims = role === 'none' ? {} : { role };
    await auth.setCustomUserClaims(uid, customClaims);
    console.log(`[OK] Assigned Claims: ${JSON.stringify(customClaims)}`);

    // 3. Revoke existing refresh tokens so user is forced to refresh ID token with new claims
    await auth.revokeRefreshTokens(uid);
    console.log(`[OK] Refresh tokens revoked. Next sign-in/token-refresh will carry the new role immediately.`);

    console.log(`\n------------------------------------------------------`);
    console.log(` SUCCESS!`);
    console.log(` User UID  : ${uid}`);
    console.log(` New Role  : ${role}`);
    console.log(`------------------------------------------------------\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n[FAILED] Error setting role for ${email}:`, err?.message || err);
    process.exit(1);
  }
}

setRole();
