import express from 'express';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { verifyFirebaseIdToken } from '../../middleware/firebaseAuth.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';

const router = express.Router();

router.post('/auth/signup', async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().trim().min(1).max(200),
      companyName: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(60).optional(),
    }).parse(req.body);
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) throw ApiError.unauthorized('A Firebase ID token is required to create your Brightloop profile.');

    const decoded = await verifyFirebaseIdToken(token);
    const email = decoded.email?.trim().toLowerCase();
    if (!email) throw ApiError.forbidden('A Firebase account email is required.');

    const user = await prisma.$transaction(async (tx) => {
      let record = await tx.user.findUnique({ where: { firebaseUid: decoded.uid } });
      if (!record) {
        const existingEmail = await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
        if (existingEmail) {
          if (!decoded.email_verified) throw ApiError.forbidden('Verify your Firebase email before linking this existing Brightloop account.');
          if (existingEmail.status.toLowerCase() !== 'active') throw ApiError.forbidden('This account is not active in Brightloop Billing.');
          record = await tx.user.update({ where: { id: existingEmail.id }, data: { firebaseUid: decoded.uid } });
        } else {
          record = await tx.user.create({
            data: { firebaseUid: decoded.uid, email, name: input.name, role: 'customer', status: 'active' },
          });
        }
      }

      if (record.email.toLowerCase() !== email) throw ApiError.forbidden('The Firebase email does not match the Brightloop account.');
      if (record.status.toLowerCase() !== 'active') throw ApiError.forbidden('This account is not active in Brightloop Billing.');
      if (record.role.toLowerCase() === 'customer') {
        await tx.customer.upsert({
          where: { userId: record.id },
          create: { userId: record.id, companyName: input.companyName || input.name, phone: input.phone || null },
          update: {},
        });
      }
      return { id: record.id, name: record.name, email: record.email, role: record.role };
    });

    return sendSuccess(res, user, 'Brightloop profile ready.', 201);
  } catch (error) {
    if (error?.code?.startsWith?.('auth/')) return next(ApiError.unauthorized('The Firebase ID token is invalid or expired.'));
    return next(error);
  }
});

export default router;
