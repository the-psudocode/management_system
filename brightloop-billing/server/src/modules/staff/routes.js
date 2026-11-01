import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler } from '../shared/handlers.js';

const router = Router();
const adminOnly = requireRole('admin');

router.get('/staff', adminOnly, asyncHandler(async (_req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: 'staff' },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });
  return sendSuccess(res, staff);
}));

router.patch('/accounts/:id/role', adminOnly, asyncHandler(async (req, res) => {
  const accountId = z.string().min(1).parse(req.params.id);
  const { role } = z.object({ role: z.enum(['customer', 'staff']) }).parse(req.body);
  if (accountId === req.user.id) throw ApiError.forbidden('You cannot change your own account role.');

  const account = await prisma.user.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, email: true, role: true, status: true, customer: { select: { id: true } } },
  });
  if (!account) throw ApiError.notFound('Account not found.');
  const currentRole = String(account.role).toLowerCase();
  if (!['customer', 'staff'].includes(currentRole)) throw ApiError.forbidden('Administrator roles cannot be changed from the account directory.');
  if (String(account.status).toLowerCase() === 'invited') throw ApiError.conflict('Complete the staff invitation before changing this account role.');
  if (currentRole === role) throw ApiError.badRequest(`This account already has the ${role} role.`);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: accountId },
      data: { role },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });
    if (role === 'customer' && !account.customer) {
      await tx.customer.create({ data: { userId: accountId } });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: req.user.id,
        action: 'user.role_changed',
        entityType: 'user',
        entityId: accountId,
        before: { role: currentRole },
        after: { role, changedBy: req.user.id },
      },
    });
    return result;
  });

  return sendSuccess(res, updated, `Account role changed to ${role}.`);
}));

router.post('/staff', adminOnly, asyncHandler(async (req, res) => {
  const input = z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().email() }).parse(req.body);
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (existing) throw ApiError.conflict('An account with this email already exists.');

  const staff = await prisma.user.create({
    data: {
      name: input.name,
      email,
      role: 'staff',
      status: 'invited',
      firebaseUid: `staff-invite-${randomUUID()}`,
    },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });
  await prisma.auditLog.create({ data: { actorUserId: req.user.id, action: 'staff.invited', entityType: 'user', entityId: staff.id, after: { email } } });
  return sendSuccess(res, staff, 'Staff invitation created. The staff member must register with this email and verify it before signing in.', 201);
}));

router.post('/staff/:id/deactivate', adminOnly, asyncHandler(async (req, res) => {
  const staffId = z.string().min(1).parse(req.params.id);
  const staff = await prisma.user.findUnique({ where: { id: staffId }, select: { id: true, role: true, status: true } });
  if (!staff || staff.role !== 'staff') throw ApiError.notFound('Staff account not found.');
  if (staff.status === 'inactive') throw ApiError.conflict('This staff account is already inactive.');
  const updated = await prisma.user.update({ where: { id: staffId }, data: { status: 'inactive' }, select: { id: true, name: true, email: true, role: true, status: true } });
  await prisma.auditLog.create({ data: { actorUserId: req.user.id, action: 'staff.deactivated', entityType: 'user', entityId: staffId, before: { status: staff.status }, after: { status: 'inactive' } } });
  return sendSuccess(res, updated, 'Staff account deactivated.');
}));

export default router;
