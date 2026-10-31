import { Router } from 'express';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../shared/handlers.js';
import { asDateOnly } from '../billing/calculations.js';

const router = Router();

function optionalRange(query) {
  const now = new Date();
  const to = query.to ? asDateOnly(query.to) : asDateOnly(now);
  const from = query.from ? asDateOnly(query.from) : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));
  if (from > to) throw ApiError.badRequest('from must be on or before to.');
  return { from, to };
}

const monthlyRevenueSql = (from, to) => prisma.$queryRaw`
  WITH months AS (
    SELECT generate_series(date_trunc('month', ${from}::date), date_trunc('month', ${to}::date), INTERVAL '1 month')::date AS month
  ), payments_by_month AS (
    SELECT date_trunc('month', received_at)::date AS month,
           SUM(amount_paise)::bigint AS revenue_paise,
           COUNT(*)::bigint AS payment_count
    FROM payments
    WHERE received_at >= ${from} AND received_at < (${to}::date + INTERVAL '1 day')
    GROUP BY 1
  ), subscriptions_by_month AS (
    SELECT date_trunc('month', created_at)::date AS month, COUNT(*)::bigint AS subscription_count
    FROM subscriptions
    WHERE created_at >= ${from} AND created_at < (${to}::date + INTERVAL '1 day')
    GROUP BY 1
  )
  SELECT months.month,
         COALESCE(payments_by_month.revenue_paise, 0)::bigint AS revenue_paise,
         COALESCE(payments_by_month.payment_count, 0)::bigint AS payment_count,
         COALESCE(subscriptions_by_month.subscription_count, 0)::bigint AS subscription_count
  FROM months
  LEFT JOIN payments_by_month USING (month)
  LEFT JOIN subscriptions_by_month USING (month)
  ORDER BY months.month
`;

router.get('/analytics/dashboard', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const now = new Date();
  const today = asDateOnly(now);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const [activeSubscriptions, totalCustomers, newCustomers, mrrRows, revenueRows, overdueRows, statusRows, agingRows] = await Promise.all([
    prisma.subscription.count({ where: { status: 'active', startDate: { lte: today } } }),
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.$queryRaw`
      SELECT COALESCE(ROUND(SUM(i.unit_price_paise::numeric * i.quantity * CASE
        WHEN LOWER(s.billing_interval) IN ('daily','day') THEN 30.0 / s.interval_count
        WHEN LOWER(s.billing_interval) IN ('weekly','week') THEN 4.345 / s.interval_count
        WHEN LOWER(s.billing_interval) = 'quarterly' THEN 1.0 / (3 * s.interval_count)
        WHEN LOWER(s.billing_interval) IN ('yearly','year') THEN 1.0 / (12 * s.interval_count)
        WHEN LOWER(s.billing_interval) IN ('monthly','month') THEN 1.0 / s.interval_count
        ELSE 0 END)), 0)::bigint AS mrr_paise
      FROM subscription_items i JOIN subscriptions s ON s.id = i.subscription_id
      WHERE s.status = 'active' AND (s.start_date IS NULL OR s.start_date <= ${today})
    `,
    prisma.$queryRaw`SELECT COALESCE(SUM(amount_paise), 0)::bigint AS revenue_paise FROM payments`,
    prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS invoice_count,
             COALESCE(SUM(total_paise - amount_paid_paise), 0)::bigint AS outstanding_paise
      FROM invoices
      WHERE status NOT IN ('draft','cancelled') AND due_date < ${today}
        AND total_paise > amount_paid_paise
    `,
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.$queryRaw`
      SELECT CASE
        WHEN ${today}::date - due_date BETWEEN 1 AND 30 THEN '1-30 days'
        WHEN ${today}::date - due_date BETWEEN 31 AND 60 THEN '31-60 days'
        ELSE '60+ days' END AS range,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(total_paise - amount_paid_paise), 0)::bigint AS amount_paise
      FROM invoices
      WHERE status NOT IN ('draft','cancelled') AND due_date < ${today}
        AND total_paise > amount_paid_paise
      GROUP BY 1 ORDER BY 1
    `,
  ]);

  const mrr = mrrRows[0]?.mrr_paise || 0n;
  const statuses = Object.fromEntries(statusRows.map((row) => [row.status.toLowerCase(), row._count._all]));
  const agingByRange = new Map(agingRows.map((row) => [row.range, row]));
  const aging = ['1-30 days', '31-60 days', '60+ days'].map((range) => {
    const row = agingByRange.get(range);
    return { range, count: row?.count || 0n, amountInPaise: row?.amount_paise || 0n };
  });
  const { from, to } = optionalRange(req.query);
  const trendRows = await monthlyRevenueSql(from, to);
  return sendSuccess(res, {
    summary: {
      activeSubscriptions,
      mrrInPaise: mrr,
      arrInPaise: mrr * 12n,
      totalRevenueInPaise: revenueRows[0]?.revenue_paise || 0n,
      outstandingInPaise: overdueRows[0]?.outstanding_paise || 0n,
      overdueInvoices: overdueRows[0]?.invoice_count || 0n,
      totalCustomers,
      newCustomersThisMonth: newCustomers,
    },
    analytics: {
      revenueTrend: trendRows.map((row) => ({ month: row.month, revenue: row.revenue_paise, subscriptions: row.subscription_count })),
      subscriptionStats: {
        active: activeSubscriptions,
        draft: statuses.draft || 0,
        paused: statuses.paused || 0,
        closed: statuses.closed || 0,
      },
      overdueAging: aging,
    },
  });
}));

router.get('/analytics/revenue', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const { from, to } = optionalRange(req.query);
  const rows = await monthlyRevenueSql(from, to);
  return sendSuccess(res, { from, to, basis: 'payments_received', data: rows.map((row) => ({ month: row.month, revenueInPaise: row.revenue_paise, paymentCount: row.payment_count })) });
}));

router.get('/analytics/overdue', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const today = req.query.asOf ? asDateOnly(req.query.asOf) : asDateOnly(new Date());
  const rows = await prisma.$queryRaw`
    SELECT i.id, i.number, i.customer_id, c.company_name, i.due_date,
           (i.total_paise - i.amount_paid_paise)::bigint AS outstanding_paise,
           (${today}::date - i.due_date)::integer AS days_overdue
    FROM invoices i JOIN customers c ON c.id = i.customer_id
    WHERE i.status NOT IN ('draft','cancelled') AND i.due_date < ${today}
      AND i.total_paise > i.amount_paid_paise
    ORDER BY i.due_date ASC
    LIMIT 500
  `;
  return sendSuccess(res, rows);
}));

export default router;
