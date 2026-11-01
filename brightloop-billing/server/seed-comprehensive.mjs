// brightloop-billing/server/seed-comprehensive.mjs
import prisma from './src/database/index.js';
import { services } from './seed-demo.mjs';

async function seed() {
  console.log('--- Starting Comprehensive Idempotent Seed Process ---');

  // 1. Admin & Staff Users
  await prisma.user.upsert({
    where: { email: 'admin@brightloop.io' },
    update: { name: 'Brightloop Admin', role: 'admin', status: 'active', firebaseUid: 'admin_uid_brightloop' },
    create: { email: 'admin@brightloop.io', name: 'Brightloop Admin', role: 'admin', status: 'active', firebaseUid: 'admin_uid_brightloop' },
  });

  await prisma.user.upsert({
    where: { email: 'staff.operations@brightloop.io' },
    update: { name: 'Operations Staff', role: 'staff', status: 'active', firebaseUid: 'staff_ops_brightloop' },
    create: { email: 'staff.operations@brightloop.io', name: 'Operations Staff', role: 'staff', status: 'active', firebaseUid: 'staff_ops_brightloop' },
  });

  await prisma.user.upsert({
    where: { email: 'staff.support@brightloop.io' },
    update: { name: 'Support Staff', role: 'staff', status: 'active', firebaseUid: 'staff_sup_brightloop' },
    create: { email: 'staff.support@brightloop.io', name: 'Support Staff', role: 'staff', status: 'active', firebaseUid: 'staff_sup_brightloop' },
  });

  console.log('Admin & Staff seeded.');

  // 2. Tax Rules
  await prisma.taxRule.upsert({
    where: { id: 'tax-gst-18' },
    update: { name: 'GST 18%', rateBps: 1800, type: 'GST', isActive: true },
    create: { id: 'tax-gst-18', name: 'GST 18%', rateBps: 1800, type: 'GST', isActive: true },
  });

  await prisma.taxRule.upsert({
    where: { id: 'tax-gst-12' },
    update: { name: 'GST 12%', rateBps: 1200, type: 'GST', isActive: true },
    create: { id: 'tax-gst-12', name: 'GST 12%', rateBps: 1200, type: 'GST', isActive: true },
  });
  console.log('Tax rules seeded.');

  // 3. Discounts
  await prisma.discount.upsert({
    where: { code: 'WELCOME500' },
    update: { description: 'Welcome 500 Off', value: 50000n, type: 'fixed', isActive: true },
    create: {
      code: 'WELCOME500',
      description: 'Welcome ₹500 off first subscription',
      type: 'fixed',
      value: 50000n,
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2026-12-31'),
      wholeSubscription: true,
      isActive: true,
    },
  });

  await prisma.discount.upsert({
    where: { code: 'ANNUAL15' },
    update: { description: 'Annual 15% Savings', value: 1500n, type: 'percentage', isActive: true },
    create: {
      code: 'ANNUAL15',
      description: '15% savings for annual plans',
      type: 'percentage',
      value: 1500n,
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2026-12-31'),
      wholeSubscription: true,
      isActive: true,
    },
  });
  console.log('Discounts seeded.');

  // 4. Products & Variants & Plans
  const productData = services.map((service) => ({
    id: service.id,
    name: service.name,
    type: service.type,
    description: service.description,
    salesPricePaise: service.tiers[0].prices.monthly || service.tiers[0].prices.weekly || service.tiers[0].prices.half_yearly,
    costPricePaise: 0n,
    variants: [],
    plans: service.tiers.flatMap((tier) => Object.entries(tier.prices).map(([billingInterval, amountPaise]) => ({
      id: service.id === 'prod-brightloop-billing'
        ? `plan-brightloop-${tier.code}-${billingInterval}`
        : `plan-${service.slug}-${tier.code}-${billingInterval}`,
      name: tier.name,
      description: tier.description,
      amountPaise,
      billingInterval,
      intervalCount: 1,
    }))),
  }));
  for (const p of productData) {
    const prod = await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, type: p.type, description: p.description, salesPricePaise: p.salesPricePaise, costPricePaise: p.costPricePaise, status: 'active' },
      create: { id: p.id, name: p.name, type: p.type, description: p.description, salesPricePaise: p.salesPricePaise, costPricePaise: p.costPricePaise, status: 'active' },
    });

    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: { name: v.name, pricePaise: v.pricePaise },
        create: { id: v.id, productId: prod.id, sku: v.sku, name: v.name, pricePaise: v.pricePaise },
      });
    }

    for (const pl of p.plans) {
      await prisma.subscriptionPlan.upsert({
        where: { id: pl.id },
        update: { name: pl.name, description: pl.description, amountPaise: pl.amountPaise, billingInterval: pl.billingInterval, intervalCount: pl.intervalCount, status: 'active' },
        create: {
          id: pl.id,
          productId: prod.id,
          name: pl.name,
          description: pl.description,
          amountPaise: pl.amountPaise,
          billingInterval: pl.billingInterval,
          intervalCount: pl.intervalCount,
          minimumQuantity: 1,
          status: 'active',
        },
      });
    }
  }
  const oldProducts = await prisma.product.findMany({
    where: {
      id: { notIn: services.map(({ id }) => id) },
      name: { in: ['Brightloop Web Development', 'Brightloop Cloud Hosting', 'Brightloop Business Email', 'Brightloop Cybersecurity Monitoring', 'Brightloop Database Management', 'Brightloop Software Maintenance', 'Brightloop Website Development'] },
    },
    select: { id: true },
  });
  const oldProductIds = oldProducts.map(({ id }) => id);
  if (oldProductIds.length) {
    await prisma.subscriptionPlan.updateMany({ where: { productId: { in: oldProductIds }, status: 'active' }, data: { status: 'archived' } });
    await prisma.product.updateMany({ where: { id: { in: oldProductIds } }, data: { status: 'archived' } });
  }
  console.log(`BrightLoop Software service catalog seeded: ${services.length} services and ${productData.reduce((sum, product) => sum + product.plans.length, 0)} plan options.`);

  // 5. 10 Customers
  const customerSeeds = [
    { email: 'customer1@acme.corp', name: 'Acme Corp Customer', company: 'Acme Corporation Pvt Ltd', phone: '+91 9876543210', city: 'Bengaluru', state: 'KA', gstin: '29ABCDE1234F1Z5' },
    { email: 'finance@infosolutions.in', name: 'Rajesh Sharma', company: 'InfoSolutions Technologies', phone: '+91 9811223344', city: 'Mumbai', state: 'MH', gstin: '27AAACI1234H1Z5' },
    { email: 'ops@greenpulse.io', name: 'Priya Nair', company: 'GreenPulse Renewable Energy', phone: '+91 9844332211', city: 'Chennai', state: 'TN', gstin: '33AABCG5678J1Z2' },
    { email: 'founder@quarksystems.com', name: 'Vikram Mehta', company: 'Quark Systems AI', phone: '+91 9900112233', city: 'Hyderabad', state: 'TS', gstin: '36AAACQ9876K1Z9' },
    { email: 'tech@finovate.co', name: 'Ananya Roy', company: 'Finovate Capital Advisors', phone: '+91 9833445566', city: 'Kolkata', state: 'WB', gstin: '19AAACF4321L1Z3' },
    { email: 'admin@zenithlogistics.in', name: 'Suresh Patel', company: 'Zenith Global Logistics', phone: '+91 9722334455', city: 'Ahmedabad', state: 'GJ', gstin: '24AAACZ6543M1Z8' },
    { email: 'contact@urbanbites.in', name: 'Kavita Reddy', company: 'UrbanBites Retail Pvt Ltd', phone: '+91 9611224488', city: 'Bengaluru', state: 'KA', gstin: '29AAACU8765N1Z4' },
    { email: 'management@novacare.org', name: 'Dr. Arun Joshi', company: 'NovaCare Diagnostics', phone: '+91 9544331122', city: 'Pune', state: 'MH', gstin: '27AAACN3214P1Z6' },
    { email: 'support@edulearn.co.in', name: 'Sunita Sen', company: 'EduLearn Digital Academy', phone: '+91 9433221100', city: 'Delhi', state: 'DL', gstin: '07AAACE9871Q1Z1' },
    { email: 'lead@solargen.net', name: 'Deepak Verma', company: 'SolarGen Infrastructure', phone: '+91 9322110099', city: 'Jaipur', state: 'RJ', gstin: '08AAACS1234R1Z7' },
  ];

  const createdCustomers = [];
  for (const c of customerSeeds) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { name: c.name, role: 'customer', status: 'active' },
      create: { email: c.email, name: c.name, role: 'customer', status: 'active', firebaseUid: `cust_uid_${c.email.split('@')[0]}` },
    });

    const cust = await prisma.customer.upsert({
      where: { userId: user.id },
      update: {
        companyName: c.company,
        phone: c.phone,
        billingAddress: `Sector 4, ${c.city}`,
        billingCity: c.city,
        billingStateCode: c.state,
        gstin: c.gstin,
        creditLimitPaise: 50000000n,
      },
      create: {
        userId: user.id,
        companyName: c.company,
        phone: c.phone,
        billingAddress: `Sector 4, ${c.city}`,
        billingCity: c.city,
        billingStateCode: c.state,
        postalCode: '560001',
        gstin: c.gstin,
        creditLimitPaise: 50000000n,
      },
    });
    createdCustomers.push(cust);
  }
  console.log('10 Customers seeded.');

  // 6. Quotations (Draft, Sent, Accepted, Converted)
  const quoteStatuses = ['draft', 'sent', 'accepted', 'converted', 'draft', 'sent', 'accepted', 'converted'];
  for (let i = 0; i < 8; i++) {
    const cust = createdCustomers[i % createdCustomers.length];
    const qNum = `QUO-2026-${(100000 + i).toString()}`;
    await prisma.quotation.upsert({
      where: { number: qNum },
      update: { status: quoteStatuses[i] },
      create: {
        number: qNum,
        customerId: cust.id,
        status: quoteStatuses[i],
        currency: 'INR',
        validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        subtotalPaise: 249900n,
        taxPaise: 44982n,
        discountPaise: 0n,
        totalPaise: 294882n,
        items: {
          create: [
            {
              productId: 'prod-brightloop-billing',
              planId: 'plan-brightloop-growth-monthly',
              description: 'BrightLoop Growth plan proposal',
              quantity: 1,
              unitPricePaise: 249900n,
              totalPaise: 249900n,
            },
          ],
        },
      },
    });
  }
  console.log('8 Quotations seeded.');

  // 7. Subscriptions (Active, Confirmed, Paused, Closed)
  const subStatuses = ['active', 'active', 'active', 'active', 'confirmed', 'confirmed', 'paused', 'paused', 'closed', 'active', 'active', 'confirmed'];
  const createdSubs = [];
  for (let i = 0; i < 12; i++) {
    const cust = createdCustomers[i % createdCustomers.length];
    const sNum = `SUB-2026-${(20000 + i).toString()}`;
    const tierIndex = i % 3;
    const tierCode = ['starter', 'growth', 'scale'][tierIndex];
    const amount = [99900n, 249900n, 599900n][tierIndex];
    const planId = `plan-brightloop-${tierCode}-monthly`;

    const sub = await prisma.subscription.upsert({
      where: { number: sNum },
      update: { status: subStatuses[i] },
      create: {
        number: sNum,
        customerId: cust.id,
        status: subStatuses[i],
        billingInterval: 'monthly',
        intervalCount: 1,
        startDate: new Date(Date.now() - (60 - i * 5) * 24 * 3600 * 1000),
        nextBillingDate: new Date(Date.now() + (30 - i * 2) * 24 * 3600 * 1000),
        items: {
          create: [
            {
              productId: 'prod-brightloop-billing',
              planId: planId,
              description: `${sNum} Plan Subscription`,
              quantity: 1,
              unitPricePaise: amount,
            },
          ],
        },
      },
    });
    createdSubs.push(sub);
  }
  console.log('12 Subscriptions seeded.');

  // 8. 20 Invoices (Paid, Partially Paid, Confirmed, Overdue)
  const invStatuses = [
    'paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'paid',
    'partially_paid', 'partially_paid', 'partially_paid', 'partially_paid',
    'confirmed', 'confirmed', 'confirmed', 'confirmed',
    'overdue', 'overdue', 'overdue', 'overdue'
  ];

  const createdInvoices = [];
  for (let i = 0; i < 20; i++) {
    const cust = createdCustomers[i % createdCustomers.length];
    const sub = createdSubs[i % createdSubs.length];
    const iNum = `INV-2026-${(1000 + i).toString()}`;
    const subtotal = [99900n, 249900n, 599900n][i % 3];
    const tax = (subtotal * 18n) / 100n;
    const total = subtotal + tax;
    const paidAmount = invStatuses[i] === 'paid' ? total : invStatuses[i] === 'partially_paid' ? 100000n : 0n;

    const isOverdue = invStatuses[i] === 'overdue';
    const dueDate = isOverdue
      ? new Date(Date.now() - (15 + i) * 24 * 3600 * 1000)
      : new Date(Date.now() + (15 + i) * 24 * 3600 * 1000);

    const periodStart = new Date(Date.now() - (30 + i) * 24 * 3600 * 1000);
    const periodEnd = new Date(Date.now() - (i) * 24 * 3600 * 1000);

    let period = await prisma.billingPeriod.findFirst({
      where: { subscriptionId: sub.id, periodStart, periodEnd },
    });
    if (!period) {
      period = await prisma.billingPeriod.create({
        data: {
          subscriptionId: sub.id,
          periodStart,
          periodEnd,
        },
      });
    }

    const inv = await prisma.invoice.upsert({
      where: { number: iNum },
      update: { status: invStatuses[i], amountPaidPaise: paidAmount },
      create: {
        number: iNum,
        customerId: cust.id,
        subscriptionId: sub.id,
        billingPeriodId: period.id,
        status: invStatuses[i],
        currency: 'INR',
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        dueDate,
        subtotalPaise: subtotal,
        taxPaise: tax,
        discountPaise: 0n,
        totalPaise: total,
        amountPaidPaise: paidAmount,
        items: {
          create: [
            {
              productId: 'prod-brightloop-billing',
              description: 'BrightLoop Billing Platform subscription',
              quantity: 1,
              unitPricePaise: subtotal,
              taxPaise: tax,
              totalPaise: total,
            },
          ],
        },
      },
    });
    createdInvoices.push(inv);
  }
  console.log('20 Invoices seeded (Paid, Partially Paid, Confirmed, Overdue).');

  // 9. 15 Payments linked to Invoices
  for (let i = 0; i < 15; i++) {
    const inv = createdInvoices[i];
    const paymentAmount = inv.status === 'paid' ? inv.totalPaise : 100000n;
    const pRef = `UTR-2026-${(980000000 + i).toString()}`;

    const existingPayment = await prisma.payment.findFirst({
      where: { reference: pRef },
    });

    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          customerId: inv.customerId,
          method: 'upi',
          amountPaise: paymentAmount,
          currency: 'INR',
          reference: pRef,
          receivedAt: new Date(Date.now() - (20 - i) * 24 * 3600 * 1000),
          notes: `Verified UPI QR Payment via UTR ${pRef}`,
          allocations: {
            create: [
              {
                invoiceId: inv.id,
                amountPaise: paymentAmount,
              },
            ],
          },
        },
      });
    }
  }
  console.log('15 Payments seeded.');

  console.log('--- Comprehensive Demo Dataset Successfully Seeded! ---');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
