import prisma from './src/database/index.js';

const demoCatalog = [
  {
    product: {
      name: 'Brightloop Billing Suite',
      type: 'software',
      description: 'Subscription billing, invoice management and revenue operations for growing teams.',
      salesPricePaise: 499900n,
      costPricePaise: 0n,
    },
    plans: [
      { name: 'Starter', billingInterval: 'monthly', amountPaise: 499900n, description: 'Core billing tools for small teams.' },
      { name: 'Growth', billingInterval: 'monthly', amountPaise: 1499900n, description: 'Automated billing and reporting for scaling businesses.' },
      { name: 'Scale', billingInterval: 'yearly', amountPaise: 14999900n, description: 'Annual billing suite for larger operations.' },
    ],
  },
  {
    product: {
      name: 'Cloud Storage Vault',
      type: 'service',
      description: 'Managed cloud storage with scheduled backups and secure file retention.',
      salesPricePaise: 29900n,
      costPricePaise: 0n,
    },
    plans: [
      { name: 'Vault Basic', billingInterval: 'monthly', amountPaise: 29900n, description: 'Secure storage for essential business files.' },
      { name: 'Vault Business', billingInterval: 'monthly', amountPaise: 89900n, description: 'Expanded storage and priority backup monitoring.' },
    ],
  },
  {
    product: {
      name: 'Priority Customer Support',
      type: 'service',
      description: 'A dedicated support service for subscription and billing operations.',
      salesPricePaise: 99900n,
      costPricePaise: 0n,
    },
    plans: [
      { name: 'Support Standard', billingInterval: 'monthly', amountPaise: 99900n, description: 'Business-hours email support.' },
      { name: 'Support Plus', billingInterval: 'monthly', amountPaise: 249900n, description: 'Priority support with faster response targets.' },
    ],
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
