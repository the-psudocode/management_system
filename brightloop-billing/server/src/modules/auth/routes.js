// brightloop-billing/server/src/modules/auth/routes.js
import express from 'express';
import crypto from 'node:crypto';
import prisma from '../../database/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { signToken } from '../../utils/token.js';

const router = express.Router();

const DEMO_ACCOUNTS = {
  'admin@brightloop.io': { name: 'Brightloop Admin', role: 'admin' },
  'staff.operations@brightloop.io': { name: 'Operations Staff', role: 'staff' },
  'customer1@acme.corp': { name: 'Acme Corp Customer', role: 'customer', company: 'Acme Corporation' },
};

router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, email: true, name: true, role: true, status: true, firebaseUid: true },
    });

    // Auto-provision demo accounts if not in database
    if (!user && DEMO_ACCOUNTS[normalizedEmail]) {
      const demo = DEMO_ACCOUNTS[normalizedEmail];
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: demo.name,
          role: demo.role,
          status: 'active',
          firebaseUid: `demo_${crypto.randomUUID()}`,
        },
        select: { id: true, email: true, name: true, role: true, status: true, firebaseUid: true },
      });

      if (demo.role === 'customer') {
        await prisma.customer.create({
          data: {
            userId: user.id,
            companyName: demo.company || demo.name,
            accountBalancePaise: 0n,
            creditLimitPaise: 50000000n,
          },
        });
      }
    }

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    if (user.status !== 'active') {
      throw ApiError.forbidden('This account has been deactivated. Please contact support.');
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, 'Login successful');
  } catch (err) {
    return next(err);
  }
});

router.post('/auth/signup', async (req, res, next) => {
  try {
    const { email, password, name, role = 'customer', companyName, phone } = req.body;

    if (!email || !password || !name) {
      throw ApiError.badRequest('Name, email, and password are required.');
    }

    if (password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters long.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const assignedRole = ['admin', 'staff', 'customer'].includes(role) ? role : 'customer';

    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (existing) {
      throw ApiError.conflict('An account with this email already exists. Please sign in instead.');
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        role: assignedRole,
        status: 'active',
        firebaseUid: `native_${crypto.randomUUID()}`,
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    // If role is customer, create corresponding customer profile
    if (assignedRole === 'customer' || companyName) {
      await prisma.customer.create({
        data: {
          userId: user.id,
          companyName: (companyName || name).trim(),
          phone: phone ? phone.trim() : null,
          accountBalancePaise: 0n,
          creditLimitPaise: 10000000n, // 100,000 INR default credit limit
        },
      });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/auth/me', (req, res) => {
  return sendSuccess(res, { user: req.user }, 'Current user profile');
});

export default router;
