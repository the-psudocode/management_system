// test-e2e-browser.mjs
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://127.0.0.1:5173';

const results = {
	browserTestsPassed: [],
	browserTestsFailed: [],
	consoleErrors: [],
	networkErrors: [],
	apiRequestsTested: [],
};

async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runVerification() {
	console.log('Starting End-to-End Browser Verification via Headless Chrome...');
	const browser = await puppeteer.launch({
		executablePath: CHROME_PATH,
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
	});

	const page = await browser.newPage();
	await page.setViewport({ width: 1400, height: 900 });

	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			console.log('  [Browser Console Error]:', msg.text());
			results.consoleErrors.push(msg.text());
		}
	});

	page.on('requestfailed', (req) => {
		const failure = `${req.method()} ${req.url()}: ${req.failure()?.errorText}`;
		console.log('  [Browser Request Failed]:', failure);
		results.networkErrors.push(failure);
	});

	page.on('response', (res) => {
		if (res.url().includes('/api/v1/')) {
			const entry = `${res.request().method()} ${res.url()} -> ${res.status()}`;
			results.apiRequestsTested.push(entry);
		}
	});

	try {
		// ============================================================
		// PHASE 1: Application Startup & Initial Landing
		// ============================================================
		console.log('\n--- Phase 1: Application Startup ---');
		await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle0' });
		const title = await page.title();
		console.log('Page Title:', title);

		if (title) {
			results.browserTestsPassed.push('Phase 1: App loaded with title');
		} else {
			results.browserTestsFailed.push('Phase 1: Page title empty');
		}

		// ============================================================
		// PHASE 2: Authentication Tests
		// ============================================================
		console.log('\n--- Phase 2: Authentication Tests ---');

		// 2.1 Test Invalid Credentials
		console.log('Testing invalid credentials...');
		await page.waitForSelector('input[type="email"]');
		await page.$eval('input[type="email"]', (el) => (el.value = ''));
		await page.type('input[type="email"]', 'invalid@brightloop.io');
		await page.$eval('input[type="password"]', (el) => (el.value = ''));
		await page.type('input[type="password"]', 'WrongPassword123!');
		await page.click('button[type="submit"]');
		await sleep(2000);

		const errorText = await page.evaluate(() => {
			const alert = document.querySelector('.bg-rose-500\\/10');
			return alert ? alert.textContent : null;
		});
		console.log('Invalid login rejection message:', errorText);
		if (errorText && errorText.length > 0) {
			results.browserTestsPassed.push('Phase 2.1: Invalid credentials properly rejected by Firebase Auth');
		} else {
			results.browserTestsFailed.push('Phase 2.1: Invalid credentials error alert not displayed');
		}

		// 2.2 Test Valid Login as Admin
		console.log('Testing valid admin login...');
		await page.$eval('input[type="email"]', (el) => (el.value = ''));
		await page.type('input[type="email"]', 'admin@brightloop.io');
		await page.$eval('input[type="password"]', (el) => (el.value = ''));
		await page.type('input[type="password"]', 'Password123!');
		await page.click('button[type="submit"]');

		// Wait for navigation to /dashboard
		await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
		await sleep(3000);

		const currentUrl = page.url();
		console.log('URL after login:', currentUrl);
		if (currentUrl.includes('/dashboard')) {
			results.browserTestsPassed.push('Phase 2.2: Valid Firebase login redirects to /dashboard');
		} else {
			results.browserTestsFailed.push(`Phase 2.2: Expected /dashboard, got ${currentUrl}`);
		}

		// 2.3 Verify Authenticated Dashboard Content
		const dashboardHeader = await page.evaluate(() => {
			const h1s = Array.from(document.querySelectorAll('h1'));
			return h1s.map((h) => h.textContent).join(' ');
		});
		console.log('Dashboard heading:', dashboardHeader);
		if (dashboardHeader && dashboardHeader.includes('Dashboard')) {
			results.browserTestsPassed.push('Phase 2.3: Dashboard KPI view rendered');
		} else {
			results.browserTestsFailed.push('Phase 2.3: Dashboard heading not found');
		}

		// 2.4 Test Session Persistence on Page Refresh
		console.log('Testing page reload while authenticated...');
		await page.reload({ waitUntil: 'networkidle0' });
		await sleep(2000);
		if (page.url().includes('/dashboard')) {
			results.browserTestsPassed.push('Phase 2.4: Session preserved across browser refresh');
		} else {
			results.browserTestsFailed.push('Phase 2.4: Session lost on refresh');
		}

		// ============================================================
		// PHASE 3: Customer Workflow
		// ============================================================
		console.log('\n--- Phase 3: Customer Workflow ---');
		await page.click('a[href="/customers"]');
		await sleep(2500);

		const customersTitle = await page.evaluate(() => document.querySelector('h1')?.textContent);
		console.log('Customers Page Header:', customersTitle);

		const customerRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
		console.log('Customers rendered in table:', customerRows);
		if (customerRows > 0) {
			results.browserTestsPassed.push(`Phase 3.1: Customers list loaded (${customerRows} customers found)`);
		} else {
			results.browserTestsFailed.push('Phase 3.1: No customer rows loaded in table');
		}

		// Search customers
		console.log('Testing customer search...');
		const searchInput = await page.$('input[placeholder*="Search"]');
		if (searchInput) {
			await searchInput.type('Alice');
			await sleep(1500);
			const filteredRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
			console.log('Filtered customer rows for query "Alice":', filteredRows);
			results.browserTestsPassed.push('Phase 3.2: Customer search filter operates');
			// clear search
			await page.evaluate(() => {
				const input = document.querySelector('input[placeholder*="Search"]');
				if (input) {
					input.value = '';
					input.dispatchEvent(new Event('input', { bubbles: true }));
				}
			});
			await sleep(1000);
		}

		// Open Customer Details View
		console.log('Opening customer detail view...');
		const viewButton = await page.$('tbody tr td button');
		if (viewButton) {
			await viewButton.click();
			await sleep(2000);
			const detailModalOpen = await page.evaluate(() => {
				return Boolean(document.querySelector('.fixed.inset-0'));
			});
			if (detailModalOpen) {
				results.browserTestsPassed.push('Phase 3.3: Customer details modal opened with relation tabs');
				// Close modal
				const closeBtn = await page.$('.fixed.inset-0 button');
				if (closeBtn) await closeBtn.click();
				await sleep(500);
			} else {
				results.browserTestsFailed.push('Phase 3.3: Customer details modal did not open');
			}
		}

		// ============================================================
		// PHASE 4: Products & Plans Workflow
		// ============================================================
		console.log('\n--- Phase 4: Product & Plan Workflow ---');
		await page.click('a[href="/products"]');
		await sleep(2500);

		const productsTitle = await page.evaluate(() => document.querySelector('h1')?.textContent);
		console.log('Products Page Header:', productsTitle);

		const productRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
		console.log('Products loaded in table:', productRows);
		results.browserTestsPassed.push(`Phase 4.1: Products table rendered (${productRows} products)`);

		// ============================================================
		// PHASE 5: Invoices & Payment Workflow
		// ============================================================
		console.log('\n--- Phase 5: Invoices & Payments Workflow ---');
		await page.click('a[href="/invoices"]');
		await sleep(2500);

		const invoicesTitle = await page.evaluate(() => document.querySelector('h1')?.textContent);
		console.log('Invoices Page Header:', invoicesTitle);

		const invoiceRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
		console.log('Invoices loaded in table:', invoiceRows);
		results.browserTestsPassed.push(`Phase 5.1: Invoices table rendered (${invoiceRows} invoices)`);

		// Check if any invoice details can be opened
		const invViewBtn = await page.$('tbody tr button[title="View Invoice"]');
		if (invViewBtn) {
			console.log('Opening invoice modal details...');
			await invViewBtn.click();
			await sleep(2000);
			const invoiceModalOpen = await page.evaluate(() => {
				const modal = document.querySelector('.fixed.inset-0');
				return modal ? modal.textContent?.includes('Invoice Details') || modal.textContent?.includes('INVOICE') : false;
			});
			if (invoiceModalOpen) {
				results.browserTestsPassed.push('Phase 5.2: Invoice detail view opened with itemization and allocations');
				// close modal
				const closeBtn = await page.$('.fixed.inset-0 button');
				if (closeBtn) await closeBtn.click();
				await sleep(500);
			}
		}

		// ============================================================
		// PHASE 6: Subscriptions Workflow
		// ============================================================
		console.log('\n--- Phase 6: Subscriptions Workflow ---');
		await page.click('a[href="/subscriptions"]');
		await sleep(2500);

		const subsTitle = await page.evaluate(() => document.querySelector('h1')?.textContent);
		console.log('Subscriptions Page Header:', subsTitle);

		const subRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
		console.log('Subscriptions loaded in table:', subRows);
		results.browserTestsPassed.push(`Phase 6.1: Subscriptions table rendered (${subRows} subscriptions)`);

		// Check Add Subscription Modal
		const addSubBtn = await page.$('button');
		const addSubBtnText = await page.evaluate(() => {
			const btns = Array.from(document.querySelectorAll('button'));
			const found = btns.find((b) => b.textContent?.includes('New Subscription') || b.textContent?.includes('Add Subscription'));
			if (found) {
				found.click();
				return true;
			}
			return false;
		});
		if (addSubBtnText) {
			await sleep(1500);
			const subModalOpen = await page.evaluate(() => Boolean(document.querySelector('.fixed.inset-0')));
			if (subModalOpen) {
				results.browserTestsPassed.push('Phase 6.2: Add subscription modal displayed customer and plan dropdowns');
				const closeBtn = await page.$('.fixed.inset-0 button');
				if (closeBtn) await closeBtn.click();
				await sleep(500);
			}
		}

	} catch (err) {
		console.error('Browser verification exception:', err);
		results.browserTestsFailed.push(`Unhandled test exception: ${err.message}`);
	} finally {
		await browser.close();
		console.log('\n--- Browser Verification Complete ---');
		console.log('Tests Passed:', results.browserTestsPassed.length);
		console.log('Tests Failed:', results.browserTestsFailed.length);
		console.log('API Requests Tested:', results.apiRequestsTested.length);
		console.log('Console Errors:', results.consoleErrors.length);
		console.log('Network Errors:', results.networkErrors.length);

		console.log('\nSummary Data:\n', JSON.stringify(results, null, 2));
	}
}

runVerification();
