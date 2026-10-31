import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';

async function run() {
  console.log('Testing Sign In and Sign Up in Browser...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [Console Error]:', msg.text());
  });

  // 1. Visit Login
  console.log('1. Navigating to login page...');
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });

  // 2. Click "👑 Admin" demo button
  console.log('2. Clicking Admin Demo Fill button...');
  const adminBtn = await page.waitForSelector('button ::-p-text(Admin)');
  if (adminBtn) await adminBtn.click();
  await new Promise((r) => setTimeout(r, 500));

  // 3. Click Sign In
  console.log('3. Submitting Sign In...');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  console.log('Current URL after Sign In:', page.url());

  // 4. Test Sign Out and Sign Up
  console.log('4. Navigating back to login page to test Sign Up...');
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });

  console.log('5. Switching to Sign Up tab...');
  const signupTab = await page.waitForSelector('button ::-p-text(Sign Up)');
  if (signupTab) await signupTab.click();
  await new Promise((r) => setTimeout(r, 500));

  console.log('6. Filling Sign Up form...');
  await page.type('input[placeholder="e.g. John Doe"]', 'Jane Doe');
  const uniqueEmail = `jane_${Date.now()}@brightloop.io`;
  await page.type('input[placeholder="name@company.com"]', uniqueEmail);
  await page.type('input[placeholder="At least 6 characters"]', 'Password123!');
  await page.type('input[placeholder="e.g. Acme Corporation"]', 'Doe Analytics Inc');

  console.log('7. Submitting Sign Up...');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  console.log('Current URL after Sign Up:', page.url());

  await browser.close();
  console.log('Browser test finished successfully!');
}

run().catch((err) => {
  console.error('Browser test failed:', err);
  process.exit(1);
});

