import prisma from './src/database/index.js';
import { pathToFileURL } from 'node:url';

export const services = [
  {
    id: 'prod-brightloop-billing', slug: 'cloud-hosting', name: 'Cloud Hosting', type: 'software_service',
    description: 'Managed cloud hosting with monitored uptime, secure storage, backups, and technical support.',
    tiers: [
      { code: 'starter', name: 'Starter', description: 'One production site, SSL, daily backups, and standard support.', prices: { monthly: 299900n, quarterly: 809700n, yearly: 2999000n } },
      { code: 'growth', name: 'Professional', description: 'Multiple sites, expanded resources, priority support, and hourly backups.', prices: { monthly: 799900n, quarterly: 2159700n, yearly: 7999000n } },
      { code: 'scale', name: 'Enterprise', description: 'Dedicated resources, advanced availability, and a tailored service agreement.', prices: { monthly: 1999900n, yearly: 19999000n } },
    ],
  },
  {
    id: 'prod-business-email', slug: 'business-email', name: 'Business Email', type: 'software_service',
    description: 'Domain-based business email with spam protection, calendars, and account administration.',
    tiers: [
      { code: 'starter', name: 'Starter', description: 'Secure email for a small team.', prices: { weekly: 49900n, monthly: 149900n, yearly: 1499000n } },
      { code: 'professional', name: 'Professional', description: 'More mailboxes, shared calendars, and priority support.', prices: { weekly: 129900n, monthly: 399900n, yearly: 3999000n } },
      { code: 'enterprise', name: 'Enterprise', description: 'Centralized controls and tailored support for larger teams.', prices: { monthly: 999900n, yearly: 9999000n } },
    ],
  },
  {
    id: 'prod-cybersecurity-monitoring', slug: 'cybersecurity-monitoring', name: 'Cybersecurity Monitoring', type: 'software_service',
    description: 'Continuous threat monitoring, security alerts, and incident response support.',
    tiers: [
      { code: 'starter', name: 'Starter', description: 'Essential monitoring and monthly security summary.', prices: { monthly: 249900n, half_yearly: 1349400n, yearly: 2499000n } },
      { code: 'professional', name: 'Professional', description: 'Expanded monitoring, priority alerts, and response guidance.', prices: { monthly: 699900n, half_yearly: 3779400n, yearly: 6999000n } },
      { code: 'enterprise', name: 'Enterprise', description: 'Advanced coverage and a tailored security operations plan.', prices: { monthly: 1799900n, yearly: 17999000n } },
    ],
  },
  {
    id: 'prod-database-management', slug: 'database-management', name: 'Database Management', type: 'software_service',
    description: 'Database administration, performance monitoring, backup management, and support.',
    tiers: [
      { code: 'starter', name: 'Starter', description: 'Routine monitoring and managed backups for one database.', prices: { monthly: 199900n, quarterly: 539700n, yearly: 1999000n } },
      { code: 'professional', name: 'Professional', description: 'Performance tuning, recovery planning, and priority support.', prices: { monthly: 599900n, quarterly: 1619700n, yearly: 5999000n } },
      { code: 'enterprise', name: 'Enterprise', description: 'Multi-database operations with a tailored service agreement.', prices: { monthly: 1499900n, yearly: 14999000n } },
    ],
  },
  {
    id: 'prod-website-development', slug: 'website-development', name: 'Website Development', type: 'software_service',
    description: 'Ongoing website development, enhancements, and technical maintenance subscriptions.',
    tiers: [
      { code: 'starter', name: 'Starter', description: 'A monthly allocation for small site updates.', prices: { monthly: 499900n, quarterly: 1349700n } },
      { code: 'professional', name: 'Professional', description: 'Regular feature work and priority engineering support.', prices: { monthly: 1299900n, quarterly: 3509700n, yearly: 12999000n } },
      { code: 'enterprise', name: 'Enterprise', description: 'A dedicated delivery cadence and tailored engineering plan.', prices: { monthly: 2999900n, yearly: 29999000n } },
    ],
  },
  {
    id: 'prod-software-maintenance', slug: 'software-maintenance', name: 'Software Maintenance', type: 'software_service',
    description: 'Planned updates, issue resolution, compatibility checks, and ongoing support.',
    tiers: [
      { code: 'starter', name: 'Starter', description: 'Essential updates and business-hours support.', prices: { monthly: 99900n, half_yearly: 539400n, yearly: 999000n } },
      { code: 'professional', name: 'Professional', description: 'Priority issue handling and expanded maintenance coverage.', prices: { monthly: 349900n, half_yearly: 1889400n, yearly: 3499000n } },
      { code: 'enterprise', name: 'Enterprise', description: 'Extended coverage with a tailored service-level agreement.', prices: { monthly: 899900n, yearly: 8999000n } },
    ],
  },
  {
    id: 'prod-cloud-storage', slug: 'cloud-storage', name: 'Cloud Storage', type: 'software_service',
    description: 'Secure cloud storage with backups, access controls, and scalable capacity.',
    tiers: [
      { code: 'starter', name: 'Starter', description: 'Secure storage and scheduled backups for a small team.', prices: { weekly: 29900n, monthly: 99900n, yearly: 999000n } },
      { code: 'professional', name: 'Professional', description: 'More capacity, team access controls, and priority support.', prices: { weekly: 89900n, monthly: 299900n, yearly: 2999000n } },
      { code: 'enterprise', name: 'Enterprise', description: 'Expanded capacity with tailored retention and access policies.', prices: { monthly: 799900n, yearly: 7999000n } },
    ],
  },
];

async function seedDemoCatalog() {
  let productsAdded = 0;
  let plansAdded = 0;
  for (const service of services) {
    const basePricePaise = service.tiers[0].prices.monthly || service.tiers[0].prices.weekly || service.tiers[0].prices.half_yearly;
    const product = await prisma.product.upsert({
      where: { id: service.id },
      update: { name: service.name, type: service.type, description: service.description, salesPricePaise: basePricePaise, status: 'active' },
      create: { id: service.id, name: service.name, type: service.type, description: service.description, salesPricePaise: basePricePaise, costPricePaise: 0n, status: 'active' },
      select: { id: true },
    });
    productsAdded += 1;

    for (const tier of service.tiers) {
      for (const [billingInterval, amountPaise] of Object.entries(tier.prices)) {
        const legacyCloudId = service.id === 'prod-brightloop-billing' ? `plan-brightloop-${tier.code}-${billingInterval}` : null;
        const id = legacyCloudId || `plan-${service.slug}-${tier.code}-${billingInterval}`;
        await prisma.subscriptionPlan.upsert({
          where: { id },
          update: { productId: product.id, name: tier.name, billingInterval, intervalCount: 1, amountPaise, currency: 'INR', description: tier.description, status: 'active', minimumQuantity: 1 },
          create: { id, productId: product.id, name: tier.name, billingInterval, intervalCount: 1, amountPaise, currency: 'INR', description: tier.description, status: 'active', minimumQuantity: 1 },
        });
        plansAdded += 1;
      }
    }
  }

  const currentProductIds = services.map(({ id }) => id);
  const oldProducts = await prisma.product.findMany({
    where: {
      id: { notIn: currentProductIds },
      name: { in: ['Brightloop Web Development', 'Brightloop Cloud Hosting', 'Brightloop Business Email', 'Brightloop Cybersecurity Monitoring', 'Brightloop Database Management', 'Brightloop Software Maintenance', 'Brightloop Website Development'] },
    },
    select: { id: true },
  });
  const oldIds = oldProducts.map(({ id }) => id);
  if (oldIds.length) {
    await prisma.subscriptionPlan.updateMany({ where: { productId: { in: oldIds }, status: 'active' }, data: { status: 'archived' } });
    await prisma.product.updateMany({ where: { id: { in: oldIds } }, data: { status: 'archived' } });
  }

  console.log(`BrightLoop services catalog ready: ${productsAdded} services and ${plansAdded} plans across weekly, monthly, quarterly, half-yearly, and yearly billing options.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemoCatalog()
    .catch((error) => {
      console.error('Could not seed the BrightLoop services catalog. Check the database connection and schema.');
      console.error(error?.code || error?.name || 'Database error');
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
