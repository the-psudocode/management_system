import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler, pagination, pageResult } from '../shared/handlers.js';

const router = Router();
const amount = z.string().regex(/^[1-9]\d*$/, 'Amount must be a positive integer string in paise.').transform(BigInt);

router.get('/payments', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const where = req.user.role.toLowerCase() === 'customer' ? { customer: { userId: req.user.id } } : {};
  const [data, total] = await prisma.$transaction([
    prisma.payment.findMany({ where, include: { customer: true, allocations: { include: { invoice: true } } }, orderBy: { receivedAt: 'desc' }, skip, take }),
    prisma.payment.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.post('/payments', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const input = z.object({
    method: z.enum(['upi', 'bank_transfer', 'card', 'cash', 'cheque', 'other']),
    amountPaise: amount,
    currency: z.string().length(3).default('INR'),
    reference: z.string().trim().max(200).optional(),
    receivedAt: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
    allocations: z.array(z.object({ invoiceId: z.string().min(1), amountPaise: amount })).min(1),
  }).parse(req.body);
  const allocationTotal = input.allocations.reduce((sum, item) => sum + item.amountPaise, 0n);
  if (allocationTotal !== input.amountPaise) throw ApiError.badRequest('Payment amount must equal the sum of its invoice allocations.');
  if (new Set(input.allocations.map((item) => item.invoiceId)).size !== input.allocations.length) throw ApiError.badRequest('Each invoice may appear only once in a payment allocation.');

  const payment = await prisma.$transaction(async (tx) => {
    const invoiceIds = input.allocations.map((item) => item.invoiceId);
    const invoices = await tx.invoice.findMany({ where: { id: { in: invoiceIds } } });
    if (invoices.length !== invoiceIds.length) throw ApiError.notFound('One or more invoices were not found.');
    const customers = new Set(invoices.map((invoice) => invoice.customerId));
    if (customers.size !== 1) throw ApiError.badRequest('One payment can be allocated only to invoices for the same customer.');

    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    if (invoices.some((invoice) => invoice.currency !== input.currency.toUpperCase())) throw ApiError.badRequest('Payment and invoice currencies must match.');
    for (const allocation of input.allocations) {
      const invoice = invoiceById.get(allocation.invoiceId);
      if (!['confirmed', 'partially_paid', 'overdue'].includes(invoice.status)) throw ApiError.conflict(`Invoice ${invoice.number} is not open for payment.`);
      const outstanding = invoice.totalPaise - invoice.amountPaidPaise;
      if (allocation.amountPaise > outstanding) throw ApiError.badRequest(`Allocation exceeds the outstanding balance for invoice ${invoice.number}.`);
    }

    const created = await tx.payment.create({
      data: {
        customerId: [...customers][0],
        method: input.method,
        amountPaise: input.amountPaise,
        currency: input.currency.toUpperCase(),
        reference: input.reference,
        receivedAt: input.receivedAt || new Date(),
        notes: input.notes,
        allocations: { create: input.allocations },
      },
    });

    for (const allocation of input.allocations) {
      const invoice = invoiceById.get(allocation.invoiceId);
      const nextPaid = invoice.amountPaidPaise + allocation.amountPaise;
      const remaining = invoice.totalPaise - nextPaid;
      const today = new Date();
      const overdue = invoice.dueDate < new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const status = remaining === 0n ? 'paid' : overdue ? 'overdue' : 'partially_paid';
      const changed = await tx.invoice.updateMany({
        where: { id: invoice.id, amountPaidPaise: invoice.amountPaidPaise, status: invoice.status },
        data: { amountPaidPaise: { increment: allocation.amountPaise }, status },
      });
      if (changed.count !== 1) throw ApiError.conflict(`Invoice ${invoice.number} changed while this payment was being recorded. Retry the payment.`);
    }

    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'payment.recorded', entityType: 'payment', entityId: created.id, after: { amountPaise: input.amountPaise.toString(), invoiceIds } } });
    return tx.payment.findUnique({ where: { id: created.id }, include: { allocations: { include: { invoice: true } } } });
  });
  return sendSuccess(res, payment, 'Payment recorded and allocated.', 201);
}));

export default router;
