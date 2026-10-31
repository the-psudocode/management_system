import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import config from './index.js';

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
 * based on whether valid credentials have been provided in the environment.
 */
export const getFirebaseAuth = () => {
  if (authInstance) {
    return authInstance;
  }

  // Force mock mode if explicitly requested or running unit tests without credentials
  const shouldUseMock =
    process.env.MOCK_AUTH === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH &&
      !process.env.FIREBASE_PROJECT_ID &&
      !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      !process.env.FIREBASE_AUTH_EMULATOR_HOST);

  if (shouldUseMock) {
    console.log('[Firebase Auth] Initializing in mock mode (no external credentials configured or test mode enabled).');
    authInstance = new MockFirebaseAuth();
    return authInstance;
  }

  try {
    if (admin.apps.length === 0) {
      let credential = null;

      // Check service account JSON path
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (serviceAccountPath) {
        const resolvedPath = path.isAbsolute(serviceAccountPath)
          ? serviceAccountPath
          : path.resolve(process.cwd(), serviceAccountPath);

        if (fs.existsSync(resolvedPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
          credential = admin.credential.cert(serviceAccount);
        } else {
          console.warn(`[Firebase Auth] Service account file not found at ${resolvedPath}. Falling back to default credentials.`);
        }
      }

      // Check direct environment variables
      if (!credential && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        credential = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        });
      }

      if (credential) {
        admin.initializeApp({ credential });
        console.log('[Firebase Auth] Successfully initialized with service account credentials.');
      } else {
        // Application Default Credentials or Emulator
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'brightloop-billing'
        });
        console.log('[Firebase Auth] Initialized using application default credentials / emulator.');
      }
    }

    authInstance = admin.auth();
    return authInstance;
  } catch (error) {
    console.error('[Firebase Auth] Failed to initialize Firebase Admin SDK:', error.message);
    console.warn('[Firebase Auth] Falling back to Mock Auth Provider for local operations.');
    authInstance = new MockFirebaseAuth();
    return authInstance;
  }
};

export const resetFirebaseAuth = () => {
  authInstance = null;
};

export const auth = getFirebaseAuth();
export default auth;

