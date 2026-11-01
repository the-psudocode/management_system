import { Router } from 'express';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler } from '../shared/handlers.js';
import { customerSelect, serializeCustomer, parseCustomerInput } from '../customers/customerDto.js';

const router = Router();

export async function loadPortalOverview(db, userId) {
  const customer = await db.customer.findUnique({
    where: { userId },
    select: customerSelect,
  });
  if (!customer) throw ApiError.notFound('Customer account not found.');

  const [subscriptions, invoices, quotations, payments] = await Promise.all([
    db.subscription.findMany({
      where: { customerId: customer.id },
      select: {
        id: true, number: true, status: true, billingInterval: true,
        startDate: true, endDate: true, nextBillingDate: true, currency: true, createdAt: true,
        items: { select: { id: true, description: true, quantity: true, unitPricePaise: true, plan: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.invoice.findMany({
      where: { customerId: customer.id },
      select: {
        id: true, number: true, subscriptionId: true, status: true, currency: true, billingPeriodStart: true,
        billingPeriodEnd: true, dueDate: true, subtotalPaise: true, taxPaise: true,
        discountPaise: true, totalPaise: true, amountPaidPaise: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.quotation.findMany({
      where: { customerId: customer.id },
      select: {
        id: true, number: true, status: true, currency: true, validUntil: true,
        subtotalPaise: true, taxPaise: true, discountPaise: true, totalPaise: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.payment.findMany({
      where: { customerId: customer.id },
      select: {
        id: true, method: true, amountPaise: true, currency: true,
        reference: true, receivedAt: true, notes: true,
        allocations: { select: { invoiceId: true, amountPaise: true } },
      },
      orderBy: { receivedAt: 'desc' },
    }),
  ]);

  return { customer: serializeCustomer(customer), subscriptions, invoices, quotations, payments };
}

router.get('/portal', requireRole('customer'), asyncHandler(async (req, res) => {
  return sendSuccess(res, await loadPortalOverview(prisma, req.user.id));
}));

router.patch('/portal/profile', requireRole('customer'), asyncHandler(async (req, res) => {
  const input = parseCustomerInput(req.body, true);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one profile field to update.');
  const customer = await prisma.customer.update({
    where: { userId: req.user.id },
    data: input,
    select: customerSelect,
  });
  return sendSuccess(res, serializeCustomer(customer), 'Your billing profile has been updated.');
}));

export default router;
