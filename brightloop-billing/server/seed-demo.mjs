import prisma from './src/database/index.js';

const demoCatalog = [
  {
    product: {
      name: 'Brightloop Web Development',
      type: 'software',
      description: 'Managed website development and continuous improvement. Includes responsive design, content updates, uptime monitoring, and monthly performance reports.',
      salesPricePaise: 499900n,
      costPricePaise: 0n,
    },
    plans: [
      { name: 'Starter', billingInterval: 'monthly', amountPaise: 499900n, description: 'Responsive business website, hosting setup, and up to 2 content updates each month.' },
      { name: 'Professional', billingInterval: 'monthly', amountPaise: 999900n, description: 'Custom website, analytics integration, priority updates, and monthly performance review.' },
    ],
  },
  {
    product: { name: 'Brightloop Cloud Hosting', type: 'service', description: 'Managed cloud hosting with SSL, automated backups, uptime monitoring, and scalable resources.', salesPricePaise: 49900n, costPricePaise: 0n },
    plans: [
      { name: 'Basic', billingInterval: 'monthly', amountPaise: 49900n, description: 'Single site, SSL, daily backups, and 99.9% uptime monitoring.' },
      { name: 'Business', billingInterval: 'monthly', amountPaise: 149900n, description: 'Multiple sites, expanded resources, priority support, and hourly backups.' },
    ],
  },
  {
    product: { name: 'Brightloop Business Email', type: 'service', description: 'Business email hosting with custom domains, spam filtering, calendar and contact sync.', salesPricePaise: 19900n, costPricePaise: 0n },
    plans: [{ name: 'Standard', billingInterval: 'monthly', amountPaise: 19900n, description: 'One business mailbox, custom domain, spam filtering, and calendar sync.' }],
  },
  {
    product: { name: 'Brightloop Cybersecurity Monitoring', type: 'service', description: 'Continuous security monitoring with vulnerability checks, alerting, and monthly security summaries.', salesPricePaise: 299900n, costPricePaise: 0n },
    plans: [{ name: 'Essential', billingInterval: 'monthly', amountPaise: 299900n, description: 'Continuous monitoring, vulnerability scans, incident alerts, and a monthly report.' }],
  },
  {
    product: { name: 'Brightloop Database Management', type: 'service', description: 'Database health monitoring, backups, performance tuning, and recovery planning.', salesPricePaise: 199900n, costPricePaise: 0n },
    plans: [{ name: 'Standard', billingInterval: 'monthly', amountPaise: 199900n, description: 'Daily backups, health monitoring, performance checks, and recovery assistance.' }],
  },
  {
    product: { name: 'Brightloop Software Maintenance', type: 'service', description: 'Keep business software secure and reliable with updates, issue triage, and maintenance reports.', salesPricePaise: 399900n, costPricePaise: 0n },
    plans: [{ name: 'Premium', billingInterval: 'monthly', amountPaise: 399900n, description: 'Security updates, monthly maintenance window, issue triage, and priority support.' }],
  },
];

async function seedDemoCatalog() {
  let productsAdded = 0;
  let plansAdded = 0;

  for (const entry of demoCatalog) {
    let product = await prisma.product.findFirst({ where: { name: entry.product.name }, select: { id: true } });
    if (!product) {
      product = await prisma.product.create({
        data: { ...entry.product, status: 'active' },
        select: { id: true },
      });
      productsAdded += 1;
    }

    for (const plan of entry.plans) {
      const existing = await prisma.subscriptionPlan.findFirst({
        where: { productId: product.id, name: plan.name },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.subscriptionPlan.create({
        data: {
          productId: product.id,
          name: plan.name,
          billingInterval: plan.billingInterval,
          intervalCount: 1,
          amountPaise: plan.amountPaise,
          currency: 'INR',
          description: plan.description,
          status: 'active',
        },
      });
      plansAdded += 1;
    }
  }

  console.log(`Demo catalog ready. Added ${productsAdded} products/services and ${plansAdded} plans; existing entries were left unchanged.`);
}

seedDemoCatalog()
  .catch((error) => {
    console.error('Could not seed the demo catalog. Check the database connection and schema.');
    console.error(error?.code || error?.name || 'Database error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
