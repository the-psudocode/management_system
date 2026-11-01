// brightloop-billing/server/src/modules/payments/claims.js
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler } from '../shared/handlers.js';

const router = Router();
// 1. Submit Payment Claim (Customer or Staff)
router.post('/payment-claims', requireRole('customer', 'admin', 'staff'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  let rawPaise = body.amountPaise;
  if (!rawPaise && body.amountRupees) {
    rawPaise = String(Math.round(Number(body.amountRupees) * 100));
  }
  const ref = (body.reference || body.utrNumber || '').trim();

  if (!body.invoiceId) throw ApiError.badRequest('Invoice ID is required.');
  if (!ref || ref.length < 4) throw ApiError.badRequest('UTR / Reference must be at least 4 characters.');
  if (!rawPaise || !/^[1-9]\d*$/.test(String(rawPaise))) throw ApiError.badRequest('Amount must be a positive integer in paise.');

  const paiseBigInt = BigInt(String(rawPaise));
  const input = {
    invoiceId: body.invoiceId,
    amountPaise: paiseBigInt,
    reference: ref,
    notes: (body.notes || '').trim(),
  };

  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { customer: true },
  });
  if (!invoice) throw ApiError.notFound('Invoice not found.');

  // If customer, ensure ownership
  if (req.user.role.toLowerCase() === 'customer' && invoice.customer.userId !== req.user.id) {
    throw ApiError.forbidden('You can only submit payment claims for your own invoices.');
  }

  const outstanding = invoice.totalPaise - invoice.amountPaidPaise;
  if (input.amountPaise > outstanding) {
    throw ApiError.badRequest(`Claimed amount exceeds the outstanding balance (₹${Number(outstanding) / 100}).`);
  }

  const claimId = `claim_${randomUUID().slice(0, 12)}`;
  const claimData = {
    id: claimId,
    claimId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    customerId: invoice.customerId,
    customerName: invoice.customer.companyName || 'Valued Customer',
    amountPaise: input.amountPaise.toString(),
    amountRupees: Number(input.amountPaise) / 100,
    reference: input.reference,
    notes: input.notes || '',
    status: 'pending',
    submittedAt: new Date().toISOString(),
    submittedByUserId: req.user.id,
  };

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user.id,
      action: 'payment_claim.submitted',
      entityType: 'payment_claim',
      entityId: claimId,
      after: claimData,
    },
  });

  return sendSuccess(res, claimData, 'Payment claim submitted. Our team will verify and allocate the payment.', 201);
}));

// 2. List Payment Claims
router.get('/payment-claims', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const isCustomer = req.user.role.toLowerCase() === 'customer';
  let customerId = null;

  if (isCustomer) {
    const cust = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    if (!cust) return sendSuccess(res, []);
    customerId = cust.id;
  }

  const logs = await prisma.auditLog.findMany({
    where: { entityType: 'payment_claim', action: 'payment_claim.submitted' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Extract claim data
  let claims = logs
    .map((log) => log.after)
    .filter(Boolean);

  if (customerId) {
    claims = claims.filter((claim) => claim.customerId === customerId);
  }

  // Check if any were verified or rejected
  const resolutionLogs = await prisma.auditLog.findMany({
    where: {
      entityType: 'payment_claim',
      action: { in: ['payment_claim.verified', 'payment_claim.rejected'] },
    },
  });

  const resolutions = new Map(resolutionLogs.map((log) => [log.entityId, log.action.split('.')[1]]));

  const linkedInvoices = await prisma.invoice.findMany({
    where: { id: { in: claims.map((claim) => claim.invoiceId).filter(Boolean) } },
    select: { id: true, status: true, subscription: { select: { id: true, status: true } } },
  });
  const invoiceById = new Map(linkedInvoices.map((invoice) => [invoice.id, invoice]));
  const updatedClaims = claims.map((c) => {
    const invoice = invoiceById.get(c.invoiceId);
    return {
      ...c,
      id: c.claimId || c.id,
      status: resolutions.get(c.claimId) || c.status || 'pending',
      invoiceStatus: invoice?.status || null,
      subscriptionId: invoice?.subscription?.id || null,
      subscriptionStatus: invoice?.subscription?.status || null,
    };
  });

  return sendSuccess(res, updatedClaims, 'Payment claims retrieved.');
}));

// 3. Verify Payment Claim & Record in Ledger (Admin / Staff)
router.post('/payment-claims/:id/verify', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const claimId = req.params.id;

  const log = await prisma.auditLog.findFirst({
    where: { entityType: 'payment_claim', entityId: claimId, action: 'payment_claim.submitted' },
  });
  if (!log || !log.after) throw ApiError.notFound('Payment claim not found.');

  const claim = log.after;
  const claimAmountPaise = BigInt(claim.amountPaise);

  // Execute payment transaction
  const payment = await prisma.$transaction(async (tx) => {
    const resolution = await tx.auditLog.findFirst({
      where: { entityType: 'payment_claim', entityId: claimId, action: { in: ['payment_claim.verified', 'payment_claim.rejected'] } },
      select: { id: true },
    });
    if (resolution) throw ApiError.conflict('This payment claim has already been reviewed.');

    const invoice = await tx.invoice.findUnique({ where: { id: claim.invoiceId } });
    if (!invoice) throw ApiError.notFound('Associated invoice not found.');
    if (!['confirmed', 'partially_paid', 'overdue'].includes(invoice.status)) {
      throw ApiError.conflict(`Invoice ${invoice.number} is already fully settled or cancelled.`);
    }
    const outstanding = invoice.totalPaise - invoice.amountPaidPaise;
    if (claimAmountPaise > outstanding) throw ApiError.conflict('The invoice balance changed and is now lower than this claimed payment. Review the transaction before recording it.');
    const duplicateReference = await tx.payment.findFirst({ where: { reference: claim.reference }, select: { id: true } });
    if (duplicateReference) throw ApiError.conflict('This transaction reference has already been recorded.');
    const allocatedAmount = claimAmountPaise;

    const createdPayment = await tx.payment.create({
      data: {
        customerId: invoice.customerId,
        method: 'upi',
        amountPaise: allocatedAmount,
        currency: 'INR',
        reference: claim.reference,
        receivedAt: new Date(),
        notes: `Verified payment claim ${claimId}. UTR: ${claim.reference}`,
        allocations: {
          create: [
            {
              invoiceId: invoice.id,
              amountPaise: allocatedAmount,
            },
          ],
        },
      },
    });

    const nextPaid = invoice.amountPaidPaise + allocatedAmount;
    const remaining = invoice.totalPaise - nextPaid;
    const isOverdue = invoice.dueDate < new Date();
    const nextStatus = remaining === 0n ? 'paid' : isOverdue ? 'overdue' : 'partially_paid';

    const invoiceUpdate = await tx.invoice.updateMany({
      where: { id: invoice.id },
      data: {
        amountPaidPaise: { increment: allocatedAmount },
        status: nextStatus,
      },
    });
    if (invoiceUpdate.count !== 1) throw ApiError.conflict('The invoice changed while this payment was being reviewed. Please review it again.');

    await tx.auditLog.create({
      data: {
        actorUserId: req.user.id,
        action: 'payment_claim.verified',
        entityType: 'payment_claim',
        entityId: claimId,
        after: {
          ...claim,
          status: 'verified',
          verifiedByUserId: req.user.id,
          verifiedAt: new Date().toISOString(),
          paymentId: createdPayment.id,
        },
      },
    });

    return createdPayment;
  }, { isolationLevel: 'Serializable' });

  return sendSuccess(res, payment, 'Payment verified and recorded. Enable the customer plan after confirming the invoice is fully paid.');
}));

// 4. Enable a customer's plan only after staff verified the claim and the linked invoice is fully paid.
router.post('/payment-claims/:id/activate-subscription', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const claimId = req.params.id;
  const submitted = await prisma.auditLog.findFirst({
    where: { entityType: 'payment_claim', entityId: claimId, action: 'payment_claim.submitted' },
    select: { after: true },
  });
  if (!submitted?.after) throw ApiError.notFound('Payment claim not found.');
  const claim = submitted.after;

  const result = await prisma.$transaction(async (tx) => {
    const verified = await tx.auditLog.findFirst({
      where: { entityType: 'payment_claim', entityId: claimId, action: 'payment_claim.verified' },
      select: { id: true },
    });
    if (!verified) throw ApiError.conflict('Verify the payment claim before enabling the plan.');
    const invoice = await tx.invoice.findUnique({ where: { id: claim.invoiceId } });
    if (!invoice || invoice.status !== 'paid' || invoice.amountPaidPaise < invoice.totalPaise) {
      throw ApiError.conflict('The invoice must be fully paid before the plan can be enabled.');
    }
    if (!invoice.subscriptionId) throw ApiError.conflict('This invoice is not linked to a subscription.');
    const subscription = await tx.subscription.findUnique({ where: { id: invoice.subscriptionId } });
    if (!subscription) throw ApiError.notFound('Subscription not found.');
    if (subscription.status === 'active') return subscription;
    if (subscription.status !== 'confirmed') throw ApiError.conflict(`A ${subscription.status} subscription cannot be enabled.`);

    const now = new Date();
    const activationDate = subscription.startDate || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const changed = await tx.subscription.updateMany({
      where: { id: subscription.id, status: 'confirmed' },
      data: { status: 'active', startDate: activationDate, nextBillingDate: activationDate, pausedAt: null },
    });
    if (changed.count !== 1) throw ApiError.conflict('Subscription changed concurrently; reload and retry.');
    await tx.auditLog.create({
      data: {
        actorUserId: req.user.id,
        action: 'subscription.enabled_after_payment',
        entityType: 'subscription',
        entityId: subscription.id,
        before: { status: subscription.status },
        after: { status: 'active', invoiceId: invoice.id, claimId, enabledAt: now.toISOString() },
      },
    });
    return tx.subscription.findUnique({ where: { id: subscription.id } });
  }, { isolationLevel: 'Serializable' });

  return sendSuccess(res, result, 'Payment was verified and the customer plan is now enabled.');
}));

// 5. Reject Payment Claim (Admin / Staff)
router.post('/payment-claims/:id/reject', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const claimId = req.params.id;

  const log = await prisma.auditLog.findFirst({
    where: { entityType: 'payment_claim', entityId: claimId, action: 'payment_claim.submitted' },
  });
  if (!log || !log.after) throw ApiError.notFound('Payment claim not found.');

  await prisma.$transaction(async (tx) => {
    const resolution = await tx.auditLog.findFirst({
      where: { entityType: 'payment_claim', entityId: claimId, action: { in: ['payment_claim.verified', 'payment_claim.rejected'] } },
      select: { id: true },
    });
    if (resolution) throw ApiError.conflict('This payment claim has already been reviewed.');
    await tx.auditLog.create({
      data: {
        actorUserId: req.user.id,
        action: 'payment_claim.rejected',
        entityType: 'payment_claim',
        entityId: claimId,
        after: {
          ...log.after,
          status: 'rejected',
          rejectedByUserId: req.user.id,
          rejectedAt: new Date().toISOString(),
          reason: req.body.reason || 'Invalid transaction reference or unconfirmed UPI transfer.',
        },
      },
    });
  }, { isolationLevel: 'Serializable' });

  return sendSuccess(res, { claimId, status: 'rejected' }, 'Payment claim rejected.');
}));

export default router;
