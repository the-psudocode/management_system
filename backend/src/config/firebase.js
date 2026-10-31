import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let authInstance = null;

/**
 * In-memory Mock Auth Provider for offline development and automated testing
 * when real Firebase credentials are not yet supplied in .env
 */
class MockFirebaseAuth {
  constructor() {
    this.users = new Map(); // uid -> userRecord
    this.emailToUid = new Map(); // email -> uid
    this.tokens = new Map(); // idToken -> uid
  }

  async verifyIdToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
      const err = new Error('Decoding Firebase ID token failed. Token is empty or not a string.');
      err.code = 'auth/argument-error';
      throw err;
    }

    // Support simulated token format: "test-token:<uid>" or lookup from created tokens
    let uid = this.tokens.get(idToken);
    if (!uid && idToken.startsWith('test-token:')) {
      uid = idToken.split(':')[1];
    }

    if (!uid) {
      // Check if the idToken itself is a valid uid in our store
      if (this.users.has(idToken)) {
        uid = idToken;
      } else {
        const err = new Error('Firebase ID token has invalid signature or is expired.');
        err.code = 'auth/id-token-expired';
        throw err;
      }
    }

    const user = this.users.get(uid);
    return {
      uid,
      email: user ? user.email : `${uid}@example.com`,
      name: user ? user.displayName : 'Test User',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
  }

  async createUser({ email, password, displayName }) {
    const normalizedEmail = email.toLowerCase().trim();
    if (this.emailToUid.has(normalizedEmail)) {
      const err = new Error('The email address is already in use by another account.');
      err.code = 'auth/email-already-exists';
      throw err;
    }

    const uid = 'fb_uid_' + Math.random().toString(36).substring(2, 10);
    const userRecord = {
      uid,
      email: normalizedEmail,
      displayName: displayName || '',
      emailVerified: false,
      disabled: false,
      metadata: {
        creationTime: new Date().toUTCString(),
        lastSignInTime: null
      }
    };

    this.users.set(uid, userRecord);
    this.emailToUid.set(normalizedEmail, uid);
    this.tokens.set(`test-token:${uid}`, uid);

    return userRecord;
  }

  async getUserByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const uid = this.emailToUid.get(normalizedEmail);
    if (!uid) {
      const err = new Error(`No user record found for the provided email: ${email}`);
      err.code = 'auth/user-not-found';
      throw err;
    }
    return this.users.get(uid);
  }

  async generatePasswordResetLink(email) {
    const normalizedEmail = email.toLowerCase().trim();
    // Verify user exists
    const uid = this.emailToUid.get(normalizedEmail);
    if (!uid) {
      const err = new Error(`No user record found for email: ${email}`);
      err.code = 'auth/user-not-found';
      throw err;
    }
    const token = Math.random().toString(36).substring(2);
    return `https://brightloop-billing.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=${token}&apiKey=test`;
  }

  async deleteUser(uid) {
    const user = this.users.get(uid);
    if (user) {
      this.emailToUid.delete(user.email);
      this.users.delete(uid);
    }
  }

  // Helper method for automated testing to seed a test user and obtain a test ID token
  createMockToken(uid, email = 'user@example.com', displayName = 'User') {
    const userRecord = {
      uid,
      email: email.toLowerCase().trim(),
      displayName,
      emailVerified: true
    };
    this.users.set(uid, userRecord);
    this.emailToUid.set(userRecord.email, uid);
    const token = `test-token:${uid}`;
    this.tokens.set(token, uid);
    return token;
  }
}

/**
 * Initializes and returns the Firebase Admin Auth instance.
 * Automatically selects between real Firebase Admin SDK and Mock Auth provider
 * based on environment variables and credentials.
 *
 * Rules:
 * - If MOCK_AUTH=false: Mock auth is strictly disabled; real Firebase initialization is required.
 * - If MOCK_AUTH=true: Mock auth is explicitly used for local offline development.
 * - If credentials are provided: Real Firebase Admin SDK is initialized using service account JSON or environment variables.
 * - Never print or expose the private key or full service account credentials.
 */
export const getFirebaseAuth = () => {
  if (authInstance) {
    return authInstance;
  }

  const explicitMock = process.env.MOCK_AUTH === 'true';
  const explicitDisableMock = process.env.MOCK_AUTH === 'false';

  const rawServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasServiceAccountPath = Boolean(rawServiceAccountPath && rawServiceAccountPath.trim());
  const hasEnvCredentials = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  );
  const hasCredentials = hasServiceAccountPath || hasEnvCredentials;

  // Determine whether mock auth should be used
  let shouldUseMock = false;
  if (explicitMock) {
    shouldUseMock = true;
  } else if (explicitDisableMock) {
    shouldUseMock = false;
  } else if (!hasCredentials && !process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    shouldUseMock = true;
  } else if (process.env.NODE_ENV === 'test' && !hasCredentials) {
    shouldUseMock = true;
  }

  if (shouldUseMock) {
    console.log('[Firebase Auth] Initializing in mock mode (MOCK_AUTH=true or offline development without credentials).');
    authInstance = new MockFirebaseAuth();
    return authInstance;
  }

  try {
    if (admin.apps.length === 0) {
      let credential = null;

      // 1. Resolve and load service account JSON file (stored outside or inside repo)
      if (hasServiceAccountPath) {
        const cleanedPath = rawServiceAccountPath.trim().replace(/^["']|["']$/g, '');
        let resolvedPath = path.isAbsolute(cleanedPath)
          ? path.normalize(cleanedPath)
          : path.resolve(process.cwd(), cleanedPath);

        // If relative path is not found from process.cwd(), also check relative to backend directory
        if (!fs.existsSync(resolvedPath)) {
          const backendRelative = path.resolve(__dirname, '../../', cleanedPath);
          if (fs.existsSync(backendRelative)) {
            resolvedPath = backendRelative;
          }
        }

        if (fs.existsSync(resolvedPath)) {
          const serviceAccountRaw = fs.readFileSync(resolvedPath, 'utf8');
          const serviceAccount = JSON.parse(serviceAccountRaw);
          credential = admin.credential.cert(serviceAccount);
        } else {
          const notFoundMsg = `[Firebase Auth] Service account file not found at: ${resolvedPath}`;
          if (explicitDisableMock || process.env.NODE_ENV === 'production') {
            throw new Error(notFoundMsg);
          }
          console.warn(`${notFoundMsg}. Falling back to default credentials.`);
        }
      }

      // 2. Direct environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
      if (!credential && hasEnvCredentials) {
        credential = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        });
      }

      if (credential) {
        admin.initializeApp({
          credential,
          projectId: process.env.FIREBASE_PROJECT_ID || undefined
        });
        console.log('[Firebase Auth] Successfully initialized Firebase Admin SDK with service account credentials.');
      } else {
        // Application Default Credentials or Emulator
        const projectId = process.env.FIREBASE_PROJECT_ID || 'brightloop-billing';
        admin.initializeApp({ projectId });
        console.log(`[Firebase Auth] Initialized using application default credentials / emulator for project: ${projectId}`);
      }
    }

    authInstance = admin.auth();
    return authInstance;
  } catch (error) {
    console.error('[Firebase Auth] Failed to initialize Firebase Admin SDK:', error.message);
    if (explicitDisableMock || process.env.NODE_ENV === 'production') {
      throw error;
    }
    console.warn('[Firebase Auth] Falling back to Mock Auth Provider for offline local operations.');
    authInstance = new MockFirebaseAuth();
    return authInstance;
  }
};

export const setFirebaseAuth = (customInstance) => {
  authInstance = customInstance;
};

export const resetFirebaseAuth = () => {
  authInstance = null;
};

export { MockFirebaseAuth };

// Proxy object delegating to the active Firebase Auth instance so consumers always interact with the configured provider
export const auth = new Proxy({}, {
  get(target, prop) {
    const instance = authInstance || getFirebaseAuth();
    if (prop === 'constructor') {
      return instance.constructor;
    }
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  }
});

export default auth;

