// brightloop-billing/server/src/middleware/firebaseAuth.js
import fs from 'node:fs';
import path from 'node:path';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import prisma from '../database/index.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyNativeToken } from '../utils/token.js';

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

export async function verifyFirebaseIdToken(token) {
  return firebaseAuthClient().verifyIdToken(token, false);
}

export async function requireFirebaseUser(req, res, next) {
  // Allow public endpoints through
  if (req.path === '/auth/signup' || req.path === '/health') {
    return next();
  }

  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(ApiError.unauthorized('Authentication token is required.'));

  const rawToken = match[1];

  // 1. Check native JWT token first
  try {
    const nativePayload = verifyNativeToken(rawToken);
    if (nativePayload && nativePayload.id) {
      const user = await prisma.user.findUnique({
        where: { id: nativePayload.id },
        select: { id: true, firebaseUid: true, email: true, name: true, role: true, status: true },
      });

      if (!user || String(user.status ?? '').trim().toLowerCase() !== 'active') {
        return next(ApiError.forbidden('This account is not active in Brightloop Billing.'));
      }

      req.user = {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        role: String(user.role).trim().toLowerCase(),
      };
      return next();
    }
  } catch (err) {
    // Fall through to Firebase check
  }

  // 2. Fall back to Firebase ID token verification
  try {
    const decoded = await verifyFirebaseIdToken(rawToken);
    let user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true, firebaseUid: true, email: true, name: true, role: true, status: true },
    });

    if (!user && decoded.email) {
      if (!decoded.email_verified) {
        return next(ApiError.forbidden('Verify the Firebase email before linking it to a Brightloop account.'));
      }
      user = await prisma.user.findFirst({
        where: { email: { equals: decoded.email.trim(), mode: 'insensitive' } },
        select: { id: true, firebaseUid: true, email: true, name: true, role: true, status: true },
      });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: decoded.uid },
        });
      }
    }

    if (!user || String(user.status ?? '').trim().toLowerCase() !== 'active') {
      return next(ApiError.forbidden('This account is not active in Brightloop Billing.'));
    }

    req.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      name: user.name,
      role: String(user.role).trim().toLowerCase(),
    };
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error?.code?.startsWith('auth/')) {
      return next(ApiError.unauthorized('The authentication token is invalid, expired, or revoked.'));
    }
    if (error?.code === 'app/invalid-credential' || error?.code === 'app/no-app') {
      return next(new ApiError(503, 'Authentication service is unavailable.'));
    }
    return next(error);
  }
}
