import prisma from './src/database/index.js';

async function seed() {
  console.log('--- Seeding Neon Database ---');

  // 1. Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@brightloop.io' },
    update: { firebaseUid: '0ADVf1Lp7dbU4o0lzMUKKuyRGZx2', role: 'admin', status: 'active', name: 'Brightloop Admin' },
    create: {
      firebaseUid: '0ADVf1Lp7dbU4o0lzMUKKuyRGZx2',
      email: 'admin@brightloop.io',
      name: 'Brightloop Admin',
      role: 'admin',
      status: 'active',
    },
  });
  console.log('Admin user seeded:', admin.id, admin.email);

  // 2. Staff User
  const staff = await prisma.user.upsert({
    where: { email: 'staff.operations@brightloop.io' },
    update: { firebaseUid: 'sSurWNT9qxb9Vsyx65ZBZimofrv2', role: 'staff', status: 'active', name: 'Operations Staff' },
    create: {
      firebaseUid: 'sSurWNT9qxb9Vsyx65ZBZimofrv2',
      email: 'staff.operations@brightloop.io',
      name: 'Operations Staff',
      role: 'staff',
      status: 'active',
    },
  });
  console.log('Staff user seeded:', staff.id, staff.email);

  // 3. Customer User
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer1@acme.corp' },
    update: { firebaseUid: 'CjrHxdVdeiXf4cQDaCRlmwrey7v1', role: 'customer', status: 'active', name: 'Acme Corp Admin' },
    create: {
      firebaseUid: 'CjrHxdVdeiXf4cQDaCRlmwrey7v1',
      email: 'customer1@acme.corp',
      name: 'Acme Corp Admin',
      role: 'customer',
      status: 'active',
    },
  });
  console.log('Customer user seeded:', customerUser.id, customerUser.email);

  // Customer profile for Acme
  const customerRecord = await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {
      companyName: 'Acme Corporation Pvt Ltd',
      phone: '+91 9876543210',
      billingAddress: '42 Industrial Area, Outer Ring Road',
      billingCity: 'Bengaluru',
      billingStateCode: 'KA',
      postalCode: '560103',
      gstin: '29ABCDE1234F1Z5',
      creditLimitPaise: 50000000n, // 500,000 INR
    },
    create: {
      userId: customerUser.id,
      companyName: 'Acme Corporation Pvt Ltd',
      phone: '+91 9876543210',
      billingAddress: '42 Industrial Area, Outer Ring Road',
      billingCity: 'Bengaluru',
      billingStateCode: 'KA',
      postalCode: '560103',
      gstin: '29ABCDE1234F1Z5',
      accountBalancePaise: 0n,
      creditLimitPaise: 50000000n,
    },
  });
  console.log('Customer record seeded:', customerRecord.id, customerRecord.companyName);

  // 4. Sample customer 2: Alice Innovate
  let user2 = await prisma.user.findFirst({ where: { email: 'alice@innovate.io' } });
  if (!user2) {
    user2 = await prisma.user.create({
      data: {
        firebaseUid: 'firebase_alice_innovate',
        email: 'alice@innovate.io',
        name: 'Alice Smith',
        role: 'customer',
        status: 'active',
      },
    });
  }
  const cust2 = await prisma.customer.upsert({
    where: { userId: user2.id },
    update: {},
    create: {
      userId: user2.id,
      companyName: 'Innovate Solutions Inc',
      phone: '+91 9811223344',
      billingAddress: '100 Silicon Highway',
      billingCity: 'Hyderabad',
      billingStateCode: 'TS',
      postalCode: '500081',
      gstin: '36ABCDE1234F1Z5',
      accountBalancePaise: 0n,
      creditLimitPaise: 20000000n,
    },
  });
  console.log('Customer 2 seeded:', cust2.id);

  console.log('Database seeded successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
