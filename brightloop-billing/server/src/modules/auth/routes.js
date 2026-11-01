// brightloop-billing/server/src/modules/auth/routes.js
import express from 'express';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { verifyFirebaseIdToken } from '../../middleware/firebaseAuth.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { signToken } from '../../utils/token.js';

const router = express.Router();

router.post('/auth/staff-invites/check', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    const invitation = await prisma.user.findFirst({
      where: { email: { equals: email.toLowerCase(), mode: 'insensitive' }, role: 'staff', status: 'invited' },
      select: { id: true },
    });
    return sendSuccess(res, { invited: Boolean(invitation) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Native & Demo Login
 * Authenticates user credentials directly against PostgreSQL database,
 * returning a secure signed JWT session token.
 */
router.post('/auth/login', async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().trim().email(),
      password: z.string().optional(),
      expectedRole: z.enum(['customer', 'staff', 'admin']).optional(),
    }).parse(req.body);

    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user) {
      throw ApiError.unauthorized('No account found with this email address.');
    }

    if (String(user.status || '').trim().toLowerCase() !== 'active') {
      throw ApiError.forbidden('This account is not active in Brightloop Billing.');
    }

    const role = String(user.role).trim().toLowerCase();
    if (input.expectedRole && role !== input.expectedRole && !(role === 'admin' && input.expectedRole !== 'admin')) {
      throw ApiError.forbidden(`This account is registered as ${role}. Please use the ${role} sign-in page.`);
    }
    const token = signToken({
      id: user.id,
      email: user.email,
      role,
    });

    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
      },
    }, 'Authentication successful.');
  } catch (error) {
    return next(error);
  }
});

/**
 * Sign Up (Dual mode: Native DB registration or Firebase ID token linking)
 */
router.post('/auth/signup', async (req, res, next) => {
  try {
    const rawAuth = req.headers.authorization || '';
    const token = /^Bearer\s+(.+)$/i.exec(rawAuth)?.[1];

    // Mode A: Firebase ID Token provided
    if (token) {
      const input = z.object({
        name: z.string().trim().min(1).max(200).optional(),
        role: z.enum(['customer', 'staff', 'admin']).default('customer'),
        companyName: z.string().trim().max(200).optional(),
        phone: z.string().trim().max(60).optional(),
      }).parse(req.body);

      const decoded = await verifyFirebaseIdToken(token);
      const email = decoded.email?.trim().toLowerCase();
      if (!email) throw ApiError.forbidden('A Firebase account email is required.');
      const displayName = input.name || decoded.name?.trim() || email.split('@')[0];

      const user = await prisma.$transaction(async (tx) => {
        let record = await tx.user.findUnique({ where: { firebaseUid: decoded.uid } });
        if (!record) {
          const existingEmail = await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
          if (existingEmail) {
            if (!decoded.email_verified) throw ApiError.forbidden('Verify your Firebase email before linking this existing Brightloop account.');
            const existingRole = String(existingEmail.role).trim().toLowerCase();
            if (existingRole !== input.role && existingRole !== 'admin') {
              throw ApiError.forbidden(`This email already belongs to a ${existingRole} account. Continue with the ${existingRole} sign-up or sign-in page.`);
            }
            const invitedStaff = existingRole === 'staff' && existingEmail.status.toLowerCase() === 'invited' && input.role === 'staff';
            if (existingEmail.status.toLowerCase() !== 'active' && !invitedStaff) throw ApiError.forbidden('This account is not active in Brightloop Billing.');
            record = await tx.user.update({ where: { id: existingEmail.id }, data: { firebaseUid: decoded.uid, ...(invitedStaff ? { status: 'active', name: displayName } : {}) } });
          } else {
            if (input.role === 'admin') throw ApiError.forbidden('Administrator accounts cannot be created through public sign-up.');
            if (input.role === 'staff') throw ApiError.forbidden('Staff accounts must be invited by a BrightLoop administrator.');
            record = await tx.user.create({
              data: { firebaseUid: decoded.uid, email, name: displayName, role: input.role, status: 'active' },
            });
          }
        }

        if (record.email.toLowerCase() !== email) throw ApiError.forbidden('The Firebase email does not match the Brightloop account.');
        if (record.status.toLowerCase() !== 'active') throw ApiError.forbidden('This account is not active in Brightloop Billing.');
        const recordRole = String(record.role).trim().toLowerCase();
        if (recordRole !== input.role && recordRole !== 'admin') {
          throw ApiError.forbidden(`This email already belongs to a ${recordRole} account. Continue with the ${recordRole} sign-up or sign-in page.`);
        }
        if (record.role.toLowerCase() === 'customer') {
          await tx.customer.upsert({
            where: { userId: record.id },
            create: { userId: record.id, companyName: input.companyName || displayName, phone: input.phone || null },
            update: {},
          });
        }
        return { id: record.id, name: record.name, email: record.email, role: record.role };
      });

      const sessionToken = signToken({
        id: user.id,
        email: user.email,
        role: String(user.role).trim().toLowerCase(),
      });

      return sendSuccess(res, { token: sessionToken, user }, 'Brightloop profile ready.', 201);
    }

    // Mode B: Native database signup (no Firebase required)
    const nativeInput = z.object({
      name: z.string().trim().min(1).max(200),
      email: z.string().trim().email(),
      password: z.string().optional(),
      role: z.enum(['customer', 'staff']).default('customer'),
      companyName: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(60).optional(),
    }).parse(req.body);

    const email = nativeInput.email.trim().toLowerCase();
    if (nativeInput.role === 'staff') throw ApiError.forbidden('Staff accounts must be invited by a BrightLoop administrator.');
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existing) {
      throw ApiError.conflict('An account with this email address already exists.');
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          name: nativeInput.name,
          role: nativeInput.role,
          status: 'active',
        },
      });

      if (nativeInput.role === 'customer') {
        await tx.customer.create({
          data: {
            userId: createdUser.id,
            companyName: nativeInput.companyName || nativeInput.name,
            phone: nativeInput.phone || null,
          },
        });
      }

      return {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
      };
    });

    const sessionToken = signToken({
      id: newUser.id,
      email: newUser.email,
      role: String(newUser.role).trim().toLowerCase(),
    });

    return sendSuccess(res, { token: sessionToken, user: newUser }, 'Account created successfully.', 201);
  } catch (error) {
    if (error?.code?.startsWith?.('auth/')) return next(ApiError.unauthorized('The Firebase ID token is invalid or expired.'));
    return next(error);
  }
});

export default router;
