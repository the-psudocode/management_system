// test-e2e-workflow.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const API_BASE = 'http://localhost:5000/api/v1';
const WEB_API_KEY = 'AIzaSyCiRTdWBGw3Z9O-5R8rDAE5pHFm-SNg6zQ';

const sa = JSON.parse(fs.readFileSync('./brightloop-billing/server/firebase-service-account.json'));
initializeApp({ credential: cert(sa) });
const auth = getAuth();

async function getIdTokenForUid(uid) {
	const customToken = await auth.createCustomToken(uid);
	const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token: customToken, returnSecureToken: true }),
	});
	const data = await res.json();
	return data.idToken;
}

async function api(path, method = 'GET', body = null, token = null) {
	const headers = { 'Content-Type': 'application/json' };
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${API_BASE}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : null,
	});
	const json = await res.json().catch(() => ({}));
	return { status: res.status, data: json };
}

const audit = {
	workflowsCompleted: [],
	workflowsFailed: [],
	rbacVerified: [],
	rbacFailed: [],
};

async function run() {
	console.log('--- Starting End-to-End Workflow & RBAC Verification ---');

	// 1. Acquire Tokens for Admin, Staff, and Customer
	console.log('Acquiring real Firebase ID tokens...');
	const adminToken = await getIdTokenForUid('0ADVf1Lp7dbU4o0lzMUKKuyRGZx2'); // admin@brightloop.io
	const staffToken = await getIdTokenForUid('sSurWNT9qxb9Vsyx65ZBZimofrv2'); // staff.operations@brightloop.io
	const custToken = await getIdTokenForUid('CjrHxdVdeiXf4cQDaCRlmwrey7v1');  // customer1@acme.corp

	console.log('Admin Token:', Boolean(adminToken));
	console.log('Staff Token:', Boolean(staffToken));
	console.log('Cust Token:', Boolean(custToken));

	// ============================================================
	// PHASE 4 & 5: Complete Product -> Quotation -> Subscription -> Invoice -> Payment Lifecycle
	// ============================================================
	try {
		console.log('\n[Phase 4] Creating Test Product & Plan...');
		const prodRes = await api('/products', 'POST', {
			name: 'E2E Cloud Storage Enterprise',
			type: 'cloud_service',
			description: 'Test product for automated E2E lifecycle verification',
			salesPricePaise: '100000', // 1,000 INR
			costPricePaise: '30000',
			variants: [
				{ sku: `E2E-VAR-${Date.now()}`, name: '1TB Tier', pricePaise: '120000', currency: 'INR' },
			],
		}, adminToken);

		if (prodRes.status !== 201) throw new Error(`Product creation failed: ${JSON.stringify(prodRes.data)}`);
		const testProduct = prodRes.data.data;
		console.log('Test Product created:', testProduct.id, testProduct.name);
		audit.workflowsCompleted.push('Phase 4.1: Admin created product with variant');

		// Create Plan
		const planRes = await api('/plans', 'POST', {
			productId: testProduct.id,
			name: 'Monthly 1TB Enterprise Plan',
			billingInterval: 'monthly',
			intervalCount: 1,
			amountPaise: '120000', // 1,200 INR per month
			currency: 'INR',
			description: '1TB Monthly Cloud Plan',
		}, adminToken);
		if (planRes.status !== 201) throw new Error(`Plan creation failed: ${JSON.stringify(planRes.data)}`);
		const testPlan = planRes.data.data;
		console.log('Test Plan created:', testPlan.id, testPlan.name);
		audit.workflowsCompleted.push('Phase 4.2: Admin created subscription plan');

		// Get a test customer
		const custsRes = await api('/customers?pageSize=1', 'GET', null, adminToken);
		const targetCustomer = custsRes.data.data.data[0];
		console.log('Target Customer for Billing:', targetCustomer.id, targetCustomer.name || targetCustomer.company);

		// ============================================================
		// PHASE 5: Quotation -> Subscription Lifecycle
		// ============================================================
		console.log('\n[Phase 5] Creating Quotation...');
		const quoteRes = await api('/quotations', 'POST', {
			customerId: targetCustomer.id,
			validDays: 30,
			paymentTerms: 'Net 30',
			items: [
				{
					productId: testProduct.id,
					planId: testPlan.id,
					quantity: 1,
					unitPricePaise: '120000',
					description: 'Monthly 1TB Enterprise Plan',
				},
			],
		}, staffToken);
		if (quoteRes.status !== 201) throw new Error(`Quotation creation failed: ${JSON.stringify(quoteRes.data)}`);
		const quote = quoteRes.data.data;
		console.log('Quotation created (draft):', quote.id, quote.number, 'Total:', quote.totalPaise);
		audit.workflowsCompleted.push('Phase 5.1: Staff created draft quotation');

		// Send quotation
		const sendRes = await api(`/quotations/${quote.id}/send`, 'POST', {}, staffToken);
		if (sendRes.status !== 200) throw new Error(`Quotation send failed: ${JSON.stringify(sendRes.data)}`);
		console.log('Quotation marked as sent');
		audit.workflowsCompleted.push('Phase 5.2: Quotation marked sent');

		// Accept quotation
		const acceptRes = await api(`/quotations/${quote.id}/accept`, 'POST', {}, staffToken);
		if (acceptRes.status !== 200) throw new Error(`Quotation accept failed: ${JSON.stringify(acceptRes.data)}`);
		console.log('Quotation accepted');
		audit.workflowsCompleted.push('Phase 5.3: Quotation accepted');

		// Convert to Subscription
		const today = new Date().toISOString().split('T')[0];
		const convertRes = await api(`/quotations/${quote.id}/convert`, 'POST', {
			startDate: today,
			autoRenew: true,
		}, staffToken);
		if (convertRes.status !== 201) throw new Error(`Quotation convert failed: ${JSON.stringify(convertRes.data)}`);
		const sub = convertRes.data.data;
		console.log('Subscription generated:', sub.id, sub.number, 'Status:', sub.status);
		audit.workflowsCompleted.push('Phase 5.4: Quotation converted to subscription');

		// Valid Lifecycle transitions: quotation -> confirmed -> active
		const confRes = await api(`/subscriptions/${sub.id}/transition`, 'POST', { to: 'confirmed' }, staffToken);
		console.log('Subscription transition to confirmed:', confRes.status);
		const actRes = await api(`/subscriptions/${sub.id}/transition`, 'POST', { to: 'active' }, staffToken);
		console.log('Subscription transition to active:', actRes.status, actRes.data.data?.status);
		if (actRes.status === 200 && actRes.data.data?.status === 'active') {
			audit.workflowsCompleted.push('Phase 5.5: Subscription confirmed and activated through lifecycle machine');
		}

		// Billing Run to generate Invoice
		console.log('\n[Phase 5.6] Running Billing for today...');
		const billingRes = await api('/billing/run', 'POST', { billingDate: today }, adminToken);
		console.log('Billing run completed:', billingRes.status, 'Created count:', billingRes.data.data?.createdCount);
		audit.workflowsCompleted.push('Phase 5.6: Billing run executed');

		// Find the generated invoice for this subscription
		const invListRes = await api(`/invoices?subscriptionId=${sub.id}`, 'GET', null, adminToken);
		const invoice = (invListRes.data.data?.data || []).find((i) => i.subscriptionId === sub.id) || invListRes.data.data?.data?.[0];
		if (!invoice) throw new Error('No invoice found after billing run');
		console.log('Invoice found:', invoice.id, invoice.number, 'Status:', invoice.status, 'Total:', invoice.totalPaise);

		// Confirm invoice if draft
		if (invoice.status === 'draft') {
			const confInvRes = await api(`/invoices/${invoice.id}/confirm`, 'POST', {}, staffToken);
			console.log('Invoice confirmed:', confInvRes.status);
			invoice.status = 'confirmed';
		}

		// Record Partial Payment (e.g. 500 INR = 50000 paise)
		console.log('\n[Phase 5.7] Recording Partial Payment (500 INR)...');
		const partialAmount = '50000';
		const partPayRes = await api('/payments', 'POST', {
			method: 'upi',
			amountPaise: partialAmount,
			currency: 'INR',
			reference: `UPI-TEST-${Date.now()}`,
			allocations: [
				{ invoiceId: invoice.id, amountPaise: partialAmount },
			],
		}, staffToken);
		console.log('Partial payment status:', partPayRes.status);
		if (partPayRes.status === 200) {
			const updatedInvRes = await api(`/invoices/${invoice.id}`, 'GET', null, adminToken);
			const updatedInv = updatedInvRes.data.data;
			console.log('Updated invoice after partial payment:', updatedInv.status, 'Paid:', updatedInv.amountPaidPaise, 'Total:', updatedInv.totalPaise);
			if (updatedInv.status === 'partially_paid') {
				audit.workflowsCompleted.push('Phase 5.7: Partial payment transitioned invoice to partially_paid');
			}
		}

		// Record Remaining Payment
		const checkInvRes = await api(`/invoices/${invoice.id}`, 'GET', null, adminToken);
		const curInv = checkInvRes.data.data;
		const remaining = String(BigInt(curInv.totalPaise) - BigInt(curInv.amountPaidPaise));
		console.log('\n[Phase 5.8] Recording Remaining Payment:', remaining, 'paise...');
		const fullPayRes = await api('/payments', 'POST', {
			method: 'bank_transfer',
			amountPaise: remaining,
			currency: 'INR',
			reference: `NEFT-TEST-${Date.now()}`,
			allocations: [
				{ invoiceId: invoice.id, amountPaise: remaining },
			],
		}, staffToken);
		console.log('Full payment status:', fullPayRes.status);
		if (fullPayRes.status === 200) {
			const finalInvRes = await api(`/invoices/${invoice.id}`, 'GET', null, adminToken);
			const finalInv = finalInvRes.data.data;
			console.log('Final invoice status:', finalInv.status, 'Paid:', finalInv.amountPaidPaise, 'Outstanding:', BigInt(finalInv.totalPaise) - BigInt(finalInv.amountPaidPaise));
			if (finalInv.status === 'paid') {
				audit.workflowsCompleted.push('Phase 5.8: Full payment transitioned invoice to paid with 0 outstanding balance');
			}
		}

	} catch (err) {
		console.error('Lifecycle workflow error:', err);
		audit.workflowsFailed.push(err.message);
	}

	// ============================================================
	// PHASE 6: Role-Based Access Enforcement
	// ============================================================
	console.log('\n--- Phase 6: Role-Based Access Enforcement ---');

	// 6.1 Staff attempting Admin-only operation: POST /products should fail with 403 Forbidden
	const staffAdminAttempt = await api('/products', 'POST', {
		name: 'Staff Unauthorized Product',
		type: 'service',
		salesPricePaise: '1000',
		costPricePaise: '500',
	}, staffToken);
	console.log('Staff -> POST /products (Admin only): status =', staffAdminAttempt.status);
	if (staffAdminAttempt.status === 403) {
		audit.rbacVerified.push('6.1: Staff rejected (403 Forbidden) from Admin-only product creation');
	} else {
		audit.rbacFailed.push(`6.1: Staff expected 403, got ${staffAdminAttempt.status}`);
	}

	// 6.2 Customer attempting Staff-only operation: POST /customers should fail with 403 Forbidden
	const custStaffAttempt = await api('/customers', 'POST', {
		userId: 'some-id',
		company: 'Unauthorized Co',
	}, custToken);
	console.log('Customer -> POST /customers (Staff only): status =', custStaffAttempt.status);
	if (custStaffAttempt.status === 403) {
		audit.rbacVerified.push('6.2: Customer rejected (403 Forbidden) from Staff-only customer creation');
	} else {
		audit.rbacFailed.push(`6.2: Customer expected 403, got ${custStaffAttempt.status}`);
	}

	// 6.3 Customer attempting to run billing: POST /billing/run should fail with 403 Forbidden
	const custBillingAttempt = await api('/billing/run', 'POST', { billingDate: '2026-10-31' }, custToken);
	console.log('Customer -> POST /billing/run (Admin only): status =', custBillingAttempt.status);
	if (custBillingAttempt.status === 403) {
		audit.rbacVerified.push('6.3: Customer rejected (403 Forbidden) from Admin-only billing run');
	} else {
		audit.rbacFailed.push(`6.3: Customer expected 403, got ${custBillingAttempt.status}`);
	}

	// 6.4 Customer listing: Customer role can only see their own customer profile
	const custSelfRes = await api('/customers', 'GET', null, custToken);
	console.log('Customer -> GET /customers items count:', custSelfRes.data.data?.data?.length);
	if (custSelfRes.status === 200 && custSelfRes.data.data?.data?.length <= 1) {
		audit.rbacVerified.push('6.4: Customer data isolation enforced (only own profile returned)');
	}

	// 6.5 Unauthenticated request: No token -> 401 Unauthorized
	const unauthRes = await api('/customers', 'GET', null, null);
	console.log('Unauthenticated -> GET /customers: status =', unauthRes.status);
	if (unauthRes.status === 401) {
		audit.rbacVerified.push('6.5: Unauthenticated request rejected (401 Unauthorized)');
	}

	// 6.6 Invalid token -> 401 Unauthorized
	const invalidTokenRes = await api('/customers', 'GET', null, 'invalid-bogus-token');
	console.log('Invalid Token -> GET /customers: status =', invalidTokenRes.status);
	if (invalidTokenRes.status === 401) {
		audit.rbacVerified.push('6.6: Invalid token rejected (401 Unauthorized)');
	}

	console.log('\n--- Final Workflow & RBAC Summary ---');
	console.log('Workflows Completed:', audit.workflowsCompleted.length);
	console.log('Workflows Failed:', audit.workflowsFailed.length);
	console.log('RBAC Checks Passed:', audit.rbacVerified.length);
	console.log('RBAC Checks Failed:', audit.rbacFailed.length);
	console.log(JSON.stringify(audit, null, 2));
}

run();
