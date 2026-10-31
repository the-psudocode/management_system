import fs from 'node:fs';
import path from 'node:path';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import prisma from '../database/index.js';
import { ApiError } from '../utils/ApiError.js';

let authInstance;

function firebaseAuthClient() {
  if (authInstance) return authInstance;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new ApiError(503, 'Firebase authentication is not configured.');
  }

  let credential;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      credential = cert(serviceAccount);
    }
  }

  if (!credential) {
    credential = applicationDefault();
  }

  const app = getApps()[0] || initializeApp({
    credential,
    projectId,
  });
  authInstance = getAuth(app);
  return authInstance;
}

export async function requireFirebaseUser(req, res, next) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(ApiError.unauthorized('A Firebase ID token is required.'));

  try {
    const decoded = await firebaseAuthClient().verifyIdToken(match[1], true);
    let user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true, firebaseUid: true, email: true, name: true, role: true, status: true },
    });

    if (!user && decoded.email) {
      user = await prisma.user.findFirst({
        where: { email: decoded.email },
        select: { id: true, firebaseUid: true, email: true, name: true, role: true, status: true },
      });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: decoded.uid },
        });
      }
    }

    if (!user || user.status !== 'active') {
      return next(ApiError.forbidden('This account is not active in Brightloop Billing.'));
    }

    req.user = { id: user.id, firebaseUid: user.firebaseUid, email: user.email, name: user.name, role: user.role };
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error?.code?.startsWith('auth/')) {
      return next(ApiError.unauthorized('The Firebase ID token is invalid, expired, or revoked.'));
    }
    if (error?.code === 'app/invalid-credential' || error?.code === 'app/no-app') {
      return next(new ApiError(503, 'Firebase Admin credentials are unavailable.'));
    }
    return next(error);
  }
}
