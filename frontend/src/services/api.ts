// frontend/src/services/api.ts
import axios from "axios";
import { getCurrentUserToken, loginWithEmail, signUpWithEmail, sendVerificationEmail } from "./firebase";
import type {
	Customer,
	Product,
	SubscriptionPlan,
	Subscription,
	Invoice,
	Payment,
	DashboardSummary,
	DashboardAnalytics,
	PaginatedResponse,
	SubscriptionStatus,
	AuthProfile,
	Quotation,
	PortalOverview,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export const apiClient = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

apiClient.interceptors.request.use(async (config) => {
	try {
		const storedToken = localStorage.getItem("brightloop_token");
		if (storedToken) {
			config.headers.Authorization = `Bearer ${storedToken}`;
			return config;
		}
		const token = await getCurrentUserToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
	} catch (err) {
		console.warn("Could not retrieve authentication token:", err);
	}
	return config;
});

// Response interceptor to unwrap { success: true, data: ... }
apiClient.interceptors.response.use(
	(response) => {
		if (response.data && response.data.success !== undefined) {
			return response.data.data;
		}
		return response.data;
	},
	(error) => {
		const message =
			error.response?.data?.message ||
			error.response?.data?.error ||
			error.message ||
			"An unexpected error occurred.";
		return Promise.reject(new Error(message));
	},
);

// ============================================================
// Customers API
// ============================================================

export async function getCurrentUserProfile(): Promise<AuthProfile> {
	const profile: any = await apiClient.get("/me");
	return { ...profile, role: String(profile.role).toLowerCase() as AuthProfile["role"] };
}

export async function registerCustomerAccount(data: { name: string; companyName?: string; phone?: string }): Promise<void> {
	await apiClient.post('/auth/signup', data);
}

export async function getPortalOverview(): Promise<PortalOverview> {
	const overview: any = await apiClient.get("/portal");
	return {
		...overview,
		invoices: (overview.invoices || []).map(mapInvoice),
		payments: (overview.payments || []).map((p: any) => ({
			id: p.id,
			customerId: overview.customer?.id,
			amountInPaise: Number(p.amountPaise || 0),
			amountPaise: Number(p.amountPaise || 0),
			paymentMethod: p.method,
			method: p.method,
			reference: p.reference || "",
			referenceNumber: p.reference || "",
			date: p.receivedAt,
			paymentDate: p.receivedAt,
			notes: p.notes || "",
			allocations: p.allocations || [],
		})),
	};
}

export async function updateMyBillingProfile(data: { company?: string; phone: string; address: string; city: string; state: string; pincode: string; country: string; gstin: string }): Promise<Customer> {
	return apiClient.patch('/portal/profile', data);
}

function mapQuotation(q: any): Quotation {
	return {
		id: q.id,
		number: q.number,
		customerId: q.customerId,
		status: q.status,
		currency: q.currency || "INR",
		validUntil: q.validUntil,
		subtotalPaise: q.subtotalPaise,
		taxPaise: q.taxPaise,
		discountPaise: q.discountPaise,
		totalPaise: q.totalPaise,
		createdAt: q.createdAt,
		customer: q.customer ? { id: q.customer.id, company: q.customer.companyName || "" } : undefined,
		items: q.items || [],
	};
}

export async function getQuotations(page = 1, pageSize = 20): Promise<PaginatedResponse<Quotation>> {
	const result: any = await apiClient.get("/quotations", { params: { page, pageSize } });
	return {
		data: (result.data || []).map(mapQuotation),
		total: result.total || 0,
		page: result.page || page,
		pageSize: result.pageSize || pageSize,
		totalPages: result.totalPages || 1,
	};
}

export async function createQuotation(data: { customerId: string; planId: string; productId: string; quantity?: number }): Promise<Quotation> {
	const result: any = await apiClient.post("/quotations", {
		customerId: data.customerId,
		items: [{ productId: data.productId, planId: data.planId, quantity: data.quantity || 1 }],
	});
	return mapQuotation(result);
}

export async function sendQuotation(id: string): Promise<Quotation> {
	return mapQuotation(await apiClient.post(`/quotations/${id}/send`));
}

export async function acceptQuotation(id: string): Promise<Quotation> {
	return mapQuotation(await apiClient.post(`/quotations/${id}/accept`));
}

export async function rejectQuotation(id: string): Promise<Quotation> {
	return mapQuotation(await apiClient.post(`/quotations/${id}/reject`));
}

export async function convertQuotation(id: string): Promise<any> {
	return apiClient.post(`/quotations/${id}/convert`, {});
}

export async function getCustomers(
	page = 1,
	pageSize = 20,
	search = "",
	_status = "all",
): Promise<PaginatedResponse<Customer>> {
	const params: Record<string, any> = { page, pageSize };
	if (search) params.search = search;
	const res: any = await apiClient.get("/customers", { params });
	const items = (res.data || []).map((c: any) => ({
		id: c.id,
		userId: c.userId,
		name: c.name || "Unnamed Customer",
		email: c.email || "",
		phone: c.phone || "",
		company: c.company || c.companyName || "",
		address: c.address || c.billingAddress || "",
		city: c.city || "",
		state: c.state || "",
		pincode: c.pincode || "",
		gstin: c.gstin || "",
		status: c.status || "active",
		createdAt: c.createdAt,
		accountBalancePaise: c.accountBalancePaise ? Number(c.accountBalancePaise) : 0,
		creditLimitPaise: c.creditLimitPaise ? Number(c.creditLimitPaise) : 0,
	}));

	return {
		data: items,
		total: res.total || items.length,
		page: res.page || page,
		pageSize: res.pageSize || pageSize,
		totalPages: res.totalPages || 1,
	};
}

export async function createCustomer(data: any): Promise<Customer> {
	if (!data.userId) {
		throw new Error("Customer creation requires the ID of an existing Firebase-linked customer account.");
	}
	const payload: Record<string, any> = {
		userId: data.userId,
		company: data.company || data.name,
		phone: data.phone || undefined,
		address: data.address || undefined,
	};
	if (data.creditLimitPaise) {
		payload.creditLimitPaise = String(data.creditLimitPaise);
	}
	const res: any = await apiClient.post("/customers", payload);
	return res;
}

export async function updateCustomer(id: string, data: any): Promise<Customer> {
	const payload: Record<string, any> = {};
	if (data.company || data.companyName) {
		payload.company = data.company || data.companyName;
	}
	if (data.phone !== undefined) {
		payload.phone = data.phone;
	}
	if (data.address || data.billingAddress) {
		payload.address = data.address || data.billingAddress;
	}
	if (data.creditLimitPaise !== undefined) {
		payload.creditLimitPaise = String(data.creditLimitPaise);
	}
	const res: any = await apiClient.patch(`/customers/${id}`, payload);
	return res;
}

export async function getCustomerSubscriptions(customerId: string): Promise<Subscription[]> {
	const res: any = await apiClient.get(`/subscriptions`, { params: { customerId } });
	const list = res.data || [];
	return list.map(mapSubscription);
}

export async function getCustomerInvoices(customerId: string): Promise<Invoice[]> {
	const res: any = await apiClient.get(`/invoices`, { params: { customerId } });
	const list = res.data || [];
	return list.map(mapInvoice);
}

// ============================================================
// Products & Plans API
// ============================================================

export async function getProducts(
	page = 1,
	pageSize = 20,
	search = "",
	_category = "all",
): Promise<PaginatedResponse<Product>> {
	const params: Record<string, any> = { page, pageSize };
	if (search) params.search = search;
	const res: any = await apiClient.get("/products", { params });
	const items = (res.data || []).map((p: any) => ({
		id: p.id,
		name: p.name,
		description: p.description || "",
		category: p.type || "SaaS",
		type: p.type || "SaaS",
		basePriceInPaise: Number(p.salesPricePaise || 0),
		salesPricePaise: Number(p.salesPricePaise || 0),
		costPricePaise: p.costPricePaise === undefined ? undefined : Number(p.costPricePaise || 0),
		variants: (p.variants || []).map((v: any) => ({
			id: v.id,
			name: v.name,
			sku: v.sku,
			priceInPaise: Number(v.pricePaise || 0),
			priceAdjustmentInPaise: Number(v.pricePaise || 0),
			isActive: true,
		})),
		isActive: p.status === "active",
		status: p.status,
		createdAt: p.createdAt,
	}));

	return {
		data: items,
		total: res.total || items.length,
		page: res.page || page,
		pageSize: res.pageSize || pageSize,
		totalPages: res.totalPages || 1,
	};
}

export async function createProduct(data: any): Promise<Product> {
	const payload = {
		name: data.name,
		type: data.category || "service",
		description: data.description || "",
		salesPricePaise: String(data.basePriceInPaise || 0),
		costPricePaise: String(data.costPriceInPaise || 0),
		variants: (data.variants || []).map((v: any) => ({
			sku: v.sku || `SKU-${Date.now()}`,
			name: v.name,
			pricePaise: String(v.priceAdjustmentInPaise ?? v.priceInPaise ?? 0),
			currency: "INR",
		})),
		plans: (data.plans || []).map((plan: any) => ({
			name: plan.name,
			billingInterval: plan.billingInterval,
			intervalCount: Number(plan.intervalCount || 1),
			amountPaise: String(plan.amountPaise),
			currency: "INR",
			description: plan.description || "",
			minimumQuantity: Number(plan.minimumQuantity || 1),
		})),
	};
	const res: any = await apiClient.post("/products", payload);
	return res;
}

export async function updateProduct(id: string, data: any): Promise<Product> {
	const payload: Record<string, any> = {};
	if (data.name) payload.name = data.name;
	if (data.category) payload.type = data.category;
	if (data.description !== undefined) payload.description = data.description;
	if (data.basePriceInPaise !== undefined) payload.salesPricePaise = String(data.basePriceInPaise);
	if (data.costPriceInPaise !== undefined) payload.costPricePaise = String(data.costPriceInPaise);
	const res: any = await apiClient.patch(`/products/${id}`, payload);
	return res;
}

export async function toggleProductStatus(id: string): Promise<any> {
	return await apiClient.post(`/products/${id}/archive`);
}

export async function getPlans(page = 1, pageSize = 50): Promise<SubscriptionPlan[]> {
	const res: any = await apiClient.get("/plans", { params: { page, pageSize } });
	return (res.data || []).map((pl: any) => ({
		id: pl.id,
		name: pl.name,
		description: pl.description || "",
		productId: pl.productId,
		productName: pl.product?.name || "Product",
		productDescription: pl.product?.description || "",
		productType: pl.product?.type || "",
		productVariants: (pl.product?.variants || []).map((variant: any) => ({
			id: variant.id,
			name: variant.name,
			sku: variant.sku,
			priceInPaise: Number(variant.pricePaise || 0),
			priceAdjustmentInPaise: Number(variant.pricePaise || 0),
			isActive: true,
		})),
		priceInPaise: Number(pl.amountPaise || 0),
		amountPaise: Number(pl.amountPaise || 0),
		billingInterval: pl.billingInterval || "monthly",
		intervalCount: Number(pl.intervalCount || 1),
		minimumQuantity: Number(pl.minimumQuantity || 1),
		trialDays: 0,
		isActive: pl.status === "active",
		status: pl.status,
	}));
}

export async function createPlan(data: any): Promise<SubscriptionPlan> {
	const payload = {
		productId: data.productId,
		name: data.name,
		billingInterval: data.billingInterval || "monthly",
		intervalCount: Number(data.intervalCount || 1),
		amountPaise: String(data.priceInPaise || data.amountPaise || 0),
		currency: "INR",
		description: data.description || "",
	};
	const res: any = await apiClient.post("/plans", payload);
	return res;
}

export async function updatePlan(id: string, data: any): Promise<SubscriptionPlan> {
	const payload = {
		name: data.name,
		billingInterval: data.billingInterval,
		intervalCount: Number(data.intervalCount || 1),
		amountPaise: String(data.priceInPaise ?? data.amountPaise ?? 0),
		description: data.description || "",
	};
	return apiClient.patch(`/plans/${id}`, payload);
}

export async function archivePlan(id: string): Promise<void> {
	await apiClient.post(`/plans/${id}/archive`);
}

// ============================================================
// Subscriptions API
// ============================================================

function mapSubscription(s: any): Subscription {
	const firstItem = s.items?.[0];
	return {
		id: s.id,
		subscriptionNumber: s.number || s.id.slice(0, 8),
		number: s.number || s.id.slice(0, 8),
		customerId: s.customerId,
		customerName: s.customer?.companyName || s.customerName || "Customer",
		customer: s.customer,
		planId: firstItem?.planId || s.planId || "",
		planName: firstItem?.plan?.name || firstItem?.description || s.planName || "Plan",
		status: (s.status || "draft").toLowerCase() as SubscriptionStatus,
		startDate: s.startDate || s.createdAt,
		endDate: s.endDate || null,
		nextBillingDate: s.nextBillingDate || null,
		billingInterval: s.billingInterval || "monthly",
		amountInPaise: Number(firstItem?.unitPricePaise || s.amountPaise || 0),
		amountPaise: Number(firstItem?.unitPricePaise || s.amountPaise || 0),
		items: s.items || [],
		invoices: s.invoices || [],
		createdAt: s.createdAt,
		updatedAt: s.updatedAt,
	};
}

export async function getSubscriptions(
	page = 1,
	pageSize = 20,
	_search = "",
	status = "all",
): Promise<PaginatedResponse<Subscription>> {
	const params: Record<string, any> = { page, pageSize };
	if (status && status !== "all") params.status = status;
	const res: any = await apiClient.get("/subscriptions", { params });
	const items = (res.data || []).map(mapSubscription);
	return {
		data: items,
		total: res.total || items.length,
		page: res.page || page,
		pageSize: res.pageSize || pageSize,
		totalPages: res.totalPages || 1,
	};
}

export async function createSubscription(data: { customerId?: string; planId: string; variantId?: string; quantity?: number; startDate?: string; discountCode?: string }): Promise<Subscription> {
	const payload = {
		...(data.customerId ? { customerId: data.customerId } : {}),
		paymentTerms: "Net 30",
		startDate: data.startDate || new Date().toISOString().split("T")[0],
		...(data.discountCode ? { discountCode: data.discountCode } : {}),
		items: [
			{
				planId: data.planId,
				...(data.variantId ? { variantId: data.variantId } : {}),
				quantity: data.quantity || 1,
			},
		],
	};
	const res: any = await apiClient.post("/subscriptions", payload);
	return mapSubscription(res);
}

export async function updateSubscriptionStatus(
	id: string,
	status: SubscriptionStatus,
): Promise<Subscription> {
	const res: any = await apiClient.post(`/subscriptions/${id}/transition`, {
		to: status,
	});
	return mapSubscription(res);
}

// ============================================================
// Invoices & Payments API
// ============================================================

function mapInvoice(inv: any): Invoice {
	const subtotal = Number(inv.subtotalPaise || 0);
	const tax = Number(inv.taxPaise || 0);
	const discount = Number(inv.discountPaise || 0);
	const total = Number(inv.totalPaise || 0);
	const amountPaid = Number(inv.amountPaidPaise || 0);
	const outstanding = total - amountPaid;

	return {
		id: inv.id,
		invoiceNumber: inv.number || inv.id.slice(0, 8),
		number: inv.number || inv.id.slice(0, 8),
		customerId: inv.customerId,
		customerName: inv.customer?.companyName || inv.customerName || "Customer",
		customerEmail: inv.customer?.user?.email || "",
		customer: inv.customer,
		subscriptionId: inv.subscriptionId,
		subscription: inv.subscription,
		status: inv.status,
		items: inv.items || [],
		lineItems: (inv.items || []).map((it: any) => ({
			id: it.id,
			description: it.description,
			quantity: it.quantity,
			unitPriceInPaise: Number(it.unitPricePaise || 0),
			unitPricePaise: Number(it.unitPricePaise || 0),
			taxInPaise: Number(it.taxPaise || 0),
			taxPaise: Number(it.taxPaise || 0),
			discountInPaise: Number(it.discountPaise || 0),
			discountPaise: Number(it.discountPaise || 0),
			totalInPaise: Number(it.totalPaise || 0),
			totalPaise: Number(it.totalPaise || 0),
		})),
		subtotalInPaise: subtotal,
		subtotalPaise: subtotal,
		taxInPaise: tax,
		taxPaise: tax,
		discountInPaise: discount,
		discountPaise: discount,
		totalInPaise: total,
		totalPaise: total,
		amountPaidInPaise: amountPaid,
		paidAmountPaise: amountPaid,
		amountPaidPaise: amountPaid,
		outstandingInPaise: outstanding,
		balanceDuePaise: outstanding,
		billingPeriodStart: inv.billingPeriodStart || inv.createdAt,
		billingPeriodEnd: inv.billingPeriodEnd || inv.dueDate,
		dueDate: inv.dueDate || inv.createdAt,
		issueDate: inv.issuedAt || inv.createdAt,
		issuedAt: inv.issuedAt || null,
		allocations: inv.allocations || [],
		createdAt: inv.createdAt,
		updatedAt: inv.updatedAt,
	};
}

export async function getInvoices(
	statusFilter = "all",
	customerId?: string,
	_search?: string,
): Promise<Invoice[]> {
	const params: Record<string, any> = { pageSize: 100, page: 1 };
	if (statusFilter && statusFilter !== "all") params.status = statusFilter;
	if (customerId) params.customerId = customerId;
	const all: any[] = [];
	while (true) {
		const res: any = await apiClient.get("/invoices", { params });
		const list = res.data || [];
		all.push(...list);
		if (!res.totalPages || params.page >= res.totalPages || list.length === 0) break;
		params.page += 1;
	}
	const query = _search?.trim().toLowerCase();
	return all.map(mapInvoice).filter((invoice) => !query || `${invoice.invoiceNumber} ${invoice.customerName} ${invoice.customerEmail || ""}`.toLowerCase().includes(query));
}

export async function getInvoice(id: string): Promise<Invoice> {
	const res: any = await apiClient.get(`/invoices/${id}`);
	return mapInvoice(res);
}

export async function previewBilling(billingDate: string): Promise<any> {
	return apiClient.post("/billing/preview", { billingDate });
}

export async function runBilling(billingDate: string): Promise<any> {
	return apiClient.post("/billing/run", { billingDate });
}

export async function confirmInvoice(id: string): Promise<Invoice> {
	const res: any = await apiClient.post(`/invoices/${id}/confirm`);
	return mapInvoice(res);
}

export async function cancelInvoice(id: string): Promise<Invoice> {
	const res: any = await apiClient.post(`/invoices/${id}/cancel`);
	return mapInvoice(res);
}

export async function recordPayment(data: {
	invoiceId: string;
	amountPaise: number;
	paymentMethod?: string;
	referenceNumber?: string;
}): Promise<{ payment: Payment; invoice: Invoice }> {
	const method = (data.paymentMethod || "upi").toLowerCase();
	const payload = {
		method: ["upi", "bank_transfer", "card", "cash", "cheque"].includes(method)
			? method
			: "other",
		amountPaise: String(data.amountPaise),
		currency: "INR",
		reference: data.referenceNumber || `REF-${Date.now()}`,
		allocations: [
			{
				invoiceId: data.invoiceId,
				amountPaise: String(data.amountPaise),
			},
		],
	};

	const paymentRes: any = await apiClient.post("/payments", payload);
	const updatedInvoice = await getInvoice(data.invoiceId);
	return {
		payment: {
			id: paymentRes.id,
			invoiceId: data.invoiceId,
			amountInPaise: data.amountPaise,
			amountPaise: data.amountPaise,
			paymentMethod: paymentRes.method,
			method: paymentRes.method,
			reference: paymentRes.reference,
			referenceNumber: paymentRes.reference,
			date: paymentRes.receivedAt || new Date().toISOString(),
			paymentDate: paymentRes.receivedAt || new Date().toISOString(),
			notes: paymentRes.notes || "",
		},
		invoice: updatedInvoice,
	};
}

export async function getPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]> {
	const res: any = await apiClient.get("/payments", { params: { pageSize: 100 } });
	const payments = res.data || [];
	const matching: Payment[] = [];
	for (const p of payments) {
		const matchedAllocation = (p.allocations || []).find((a: any) => a.invoiceId === invoiceId);
		if (matchedAllocation) {
			matching.push({
				id: p.id,
				invoiceId,
				amountInPaise: Number(matchedAllocation.amountPaise || p.amountPaise || 0),
				amountPaise: Number(matchedAllocation.amountPaise || p.amountPaise || 0),
				paymentMethod: p.method,
				method: p.method,
				reference: p.reference || "",
				referenceNumber: p.reference || "",
				date: p.receivedAt || p.createdAt,
				paymentDate: p.receivedAt || p.createdAt,
				notes: p.notes || "",
			});
		}
	}
	return matching;
}

export async function getPayments(page = 1, pageSize = 50): Promise<PaginatedResponse<Payment>> {
	const result: any = await apiClient.get("/payments", { params: { page, pageSize } });
	const payments = (result.data || []).map((p: any) => ({
		id: p.id,
		invoiceId: p.allocations?.[0]?.invoiceId,
		customerId: p.customerId,
		customerName: p.customer?.companyName || p.customer?.user?.name || "Customer",
		amountInPaise: Number(p.amountPaise || 0),
		amountPaise: Number(p.amountPaise || 0),
		paymentMethod: p.method,
		method: p.method,
		reference: p.reference || "",
		referenceNumber: p.reference || "",
		date: p.receivedAt,
		paymentDate: p.receivedAt,
		notes: p.notes || "",
		allocations: p.allocations || [],
	}));
	return {
		data: payments,
		total: result.total || payments.length,
		page: result.page || page,
		pageSize: result.pageSize || pageSize,
		totalPages: result.totalPages || 1,
	};
}

// ============================================================
// Dashboard Analytics API
// ============================================================

export async function getDashboardSummary(): Promise<DashboardSummary> {
	const res: any = await apiClient.get("/analytics/dashboard");
	const s = res.summary || {};
	const mrr = Number(s.mrrInPaise || 0);
	const arr = Number(s.arrInPaise || 0);
	const rev = Number(s.totalRevenueInPaise || 0);
	const out = Number(s.outstandingInPaise || 0);
	const over = Number(s.overdueInvoices || 0);
	return {
		activeSubscriptions: Number(s.activeSubscriptions || 0),
		mrrInPaise: mrr,
		mrrPaise: mrr,
		arrInPaise: arr,
		arrPaise: arr,
		totalRevenueInPaise: rev,
		outstandingInPaise: out,
		overdueAmountPaise: out,
		overdueInvoices: over,
		overdueInvoicesCount: over,
		totalCustomers: Number(s.totalCustomers || 0),
		newCustomersThisMonth: Number(s.newCustomersThisMonth || 0),
	};
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
	const res: any = await apiClient.get("/analytics/dashboard");
	const a = res.analytics || {};
	const trend = (a.revenueTrend || []).map((t: any) => ({
		month: t.month ? new Date(t.month).toLocaleString("default", { month: "short" }) : "Month",
		revenue: Number(t.revenue || 0),
		mrrPaise: Number(t.revenue || t.mrrPaise || 0),
		arrPaise: Number(t.revenue ? t.revenue * 12 : t.arrPaise || 0),
		subscriptions: Number(t.subscriptions || 0),
	}));
	const stats = {
		active: Number(a.subscriptionStats?.active || 0),
		draft: Number(a.subscriptionStats?.draft || 0),
		paused: Number(a.subscriptionStats?.paused || 0),
		closed: Number(a.subscriptionStats?.closed || 0),
	};
	const subscriptionsByStatus = Array.isArray(a.subscriptionsByStatus)
		? a.subscriptionsByStatus
		: [
			{ status: "active", count: stats.active },
			{ status: "draft", count: stats.draft },
			{ status: "paused", count: stats.paused },
			{ status: "closed", count: stats.closed },
		];
	const aging = (a.overdueAging || []).map((ag: any) => ({
		range: ag.range || "1-30 Days",
		count: Number(ag.count || 0),
		amountInPaise: Number(ag.amountInPaise || ag.amountPaise || 0),
		amountPaise: Number(ag.amountInPaise || ag.amountPaise || 0),
	}));
	return {
		revenueTrend: trend,
		revenueHistory: trend,
		subscriptionStats: stats,
		subscriptionsByStatus,
		overdueAging: aging,
		agingOverdue: aging,
	};
}

// ============================================================
// Payment Claims & UPI QR
// ============================================================

export async function submitPaymentClaim(data: {
	invoiceId: string;
	utrNumber: string;
	amountRupees: number;
	notes?: string;
}) {
	return apiClient.post("/payment-claims", data);
}

export async function getPaymentClaims(): Promise<any[]> {
	return apiClient.get("/payment-claims") as unknown as Promise<any[]>;
}

export async function verifyPaymentClaim(claimId: string) {
	return apiClient.post(`/payment-claims/${claimId}/verify`);
}

export async function activateSubscriptionFromPaymentClaim(claimId: string) {
	return apiClient.post(`/payment-claims/${claimId}/activate-subscription`);
}

export async function getStaffMembers() {
	return apiClient.get("/staff");
}

export async function changeAccountRole(id: string, role: "customer" | "staff") {
	return apiClient.patch(`/accounts/${id}/role`, { role });
}

export async function inviteStaffMember(data: { name: string; email: string }) {
	return apiClient.post("/staff", data);
}

export async function deactivateStaffMember(id: string) {
	return apiClient.post(`/staff/${id}/deactivate`);
}

export async function getTaxRules() {
	return apiClient.get("/tax-rules");
}

export async function createTaxRule(data: { name: string; type: "GST" | "CGST" | "SGST" | "IGST"; rateBps: number; scope?: string; stateCode?: string; validFrom?: string; validUntil?: string }) {
	return apiClient.post("/tax-rules", data);
}

export async function deactivateTaxRule(id: string) {
	return apiClient.post(`/tax-rules/${id}/deactivate`);
}

export async function getDiscountRules() {
	return apiClient.get("/discounts");
}

export async function createDiscountRule(data: any) {
	return apiClient.post("/discounts", data);
}

export async function deactivateDiscountRule(id: string) {
	return apiClient.post(`/discounts/${id}/deactivate`);
}

// ============================================================
// Authentication API
// ============================================================

export async function loginUser(email: string, password?: string, expectedRole: "customer" | "staff" | "admin" = "customer") {
	localStorage.removeItem("brightloop_token");
	localStorage.removeItem("brightloop_user");

	let authenticated = false;
	let sessionToken: string | null = null;
	let userRecord: any = null;

	// 1. Try Firebase Authentication first if available
	try {
		const user = await loginWithEmail(email, password || "");
		if (user) {
			const idToken = await user.getIdToken();
			if (idToken) {
				const profile: any = await apiClient.post(
					"/auth/signup",
					{ name: email.split("@")[0], role: expectedRole },
					{ headers: { Authorization: `Bearer ${idToken}` } }
				);
				sessionToken = profile?.token || idToken;
				userRecord = profile?.user || profile;
				authenticated = true;
			}
		}
	} catch (fbErr: any) {
		console.warn("Firebase sign-in failed or unavailable, falling back to native database login:", fbErr?.message);
	}

	// 2. If Firebase did not succeed, fall back seamlessly to native backend database login
	if (!authenticated) {
		const res: any = await apiClient.post("/auth/login", {
			email: email.trim(),
			password: password || "",
			expectedRole,
		});
		sessionToken = res?.token;
		userRecord = res?.user || res;
	}

	if (sessionToken) {
		localStorage.setItem("brightloop_token", sessionToken);
	}
	if (userRecord) {
		localStorage.setItem("brightloop_user", JSON.stringify(userRecord));
	}
	return { user: userRecord, token: sessionToken };
}

export async function signupUser(data: {
	name: string;
	email: string;
	password?: string;
	role: "customer" | "staff";
	companyName?: string;
	phone?: string;
}) {
	localStorage.removeItem("brightloop_token");
	localStorage.removeItem("brightloop_user");
	if (data.role === "staff") {
		const invitation: any = await apiClient.post("/auth/staff-invites/check", { email: data.email });
		if (!invitation?.invited) throw new Error("Staff accounts can only be created with an email invited by a BrightLoop administrator.");
	}

	let firebaseToken: string | null = null;
	try {
		const user = await signUpWithEmail(data.email, data.password || "");
		if (user) {
			if (data.role === "staff" && !user.emailVerified) {
				await sendVerificationEmail(user);
				return { pendingEmailVerification: true, email: data.email, user: { role: data.role } };
			}
			firebaseToken = await user.getIdToken();
		}
	} catch (fbErr: any) {
		console.warn("Firebase signup failed or account exists, falling back to native database signup:", fbErr?.message);
	}

	const headers: Record<string, string> = {};
	if (firebaseToken) {
		headers.Authorization = `Bearer ${firebaseToken}`;
	}

	const profile: any = await apiClient.post(
		"/auth/signup",
		{
			name: data.name,
			email: data.email,
			password: data.password,
			role: data.role,
			companyName: data.companyName,
			phone: data.phone,
		},
		{ headers }
	);

	const token = profile?.token || firebaseToken;
	if (token) {
		localStorage.setItem("brightloop_token", token);
	}
	const userRecord = profile?.user || profile;
	localStorage.setItem("brightloop_user", JSON.stringify(userRecord));
	return { user: userRecord, token };
}

export function logout() {
	localStorage.removeItem("brightloop_token");
	localStorage.removeItem("brightloop_user");
}

export function getStoredUser() {
	try {
		const raw = localStorage.getItem("brightloop_user");
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

// Unified apiService object matching Invoices.tsx expectations
export const apiService = {
	login: loginUser,
	signup: signupUser,
	logout,
	getStoredUser,
	getCustomers: async () => {
		const res = await getCustomers(1, 100);
		return res.data;
	},
	getInvoices,
	getInvoice,
	createInvoice: async (_data: any): Promise<Invoice> => { throw new Error("Recurring invoices are generated from active subscription billing dates."); },
	confirmInvoice,
	cancelInvoice,
	previewBilling,
	runBilling,
	sendInvoice: confirmInvoice,
	recordPayment,
	getPaymentsByInvoiceId,
	submitPaymentClaim,
	getPaymentClaims,
	getStaffMembers,
	inviteStaffMember,
	deactivateStaffMember,
	verifyPaymentClaim,
	getProducts,
	createProduct,
	updateProduct,
	toggleProductStatus,
	getPlans,
	createPlan,
	getSubscriptions,
	createSubscription,
	updateSubscriptionStatus,
	getDashboardSummary,
	getDashboardAnalytics,
};
