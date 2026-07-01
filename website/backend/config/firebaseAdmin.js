import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging as getFirebaseMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    return JSON.parse(inline);
  }

  const configuredPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (configuredPath) {
    const resolved = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(__dirname, '..', configuredPath);
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }

  return null;
}

export function initFirebaseAdmin() {
  if (getApps().length) {
    return getApps()[0];
  }

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    console.warn(
      '[firebase-admin] Not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.',
    );
    return null;
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
  });
  console.log('[firebase-admin] initialized:', serviceAccount.project_id);
  return app;
}

export function isFirebaseAdminReady() {
  return getApps().length > 0;
}

export function getMessaging() {
  if (!isFirebaseAdminReady()) {
    initFirebaseAdmin();
  }
  if (!isFirebaseAdminReady()) {
    throw new Error('Firebase Admin is not configured.');
  }
  return getFirebaseMessaging();
}
