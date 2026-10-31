// frontend/src/services/api.ts
import axios from "axios";
import { getCurrentUserToken } from "./firebase";
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
} from "../types";

const API_BASE_URL = "http://localhost:5000/api/v1";

export const apiClient = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

apiClient.interceptors.request.use(async (config) => {
	try {
		const token = await getCurrentUserToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
	} catch (err) {
		console.warn("Could not retrieve Firebase ID token:", err);
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
	const payload: Record<string, any> = {
		userId: data.userId || "pre-existing-id",
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
		basePriceInPaise: Number(p.salesPricePaise || 0),
		variants: (p.variants || []).map((v: any) => ({
			id: v.id,
			name: v.name,
			sku: v.sku,
			priceInPaise: Number(v.pricePaise || 0),
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
		costPricePaise: "0",
		variants: (data.variants || []).map((v: any) => ({
			sku: v.sku || `SKU-${Date.now()}`,
			name: v.name,
			pricePaise: String(v.priceInPaise || 0),
			currency: "INR",
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
		priceInPaise: Number(pl.amountPaise || 0),
		amountPaise: Number(pl.amountPaise || 0),
		billingInterval: pl.billingInterval || "monthly",
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
		intervalCount: 1,
		amountPaise: String(data.priceInPaise || data.amountPaise || 0),
		currency: "INR",
		description: data.description || "",
	};
	const res: any = await apiClient.post("/plans", payload);
	return res;
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

export async function createSubscription(data: any): Promise<Subscription> {
	const payload = {
		customerId: data.customerId,
		paymentTerms: "Net 30",
		startDate: data.startDate || new Date().toISOString().split("T")[0],
		items: [
			{
				planId: data.planId,
				quantity: 1,
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
	const params: Record<string, any> = { pageSize: 100 };
	if (statusFilter && statusFilter !== "all") params.status = statusFilter;
	if (customerId) params.customerId = customerId;
	const res: any = await apiClient.get("/invoices", { params });
	const list = res.data || [];
	return list.map(mapInvoice);
}

export async function getInvoice(id: string): Promise<Invoice> {
	const res: any = await apiClient.get(`/invoices/${id}`);
	return mapInvoice(res);
}

export async function confirmInvoice(id: string): Promise<Invoice> {
	const res: any = await apiClient.post(`/invoices/${id}/confirm`);
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

// ============================================================
// Dashboard Analytics API
// ============================================================

export async function getDashboardSummary(): Promise<DashboardSummary> {
	const res: any = await apiClient.get("/analytics/dashboard");
	const s = res.summary || {};
	return {
		activeSubscriptions: Number(s.activeSubscriptions || 0),
		mrrInPaise: Number(s.mrrInPaise || 0),
		arrInPaise: Number(s.arrInPaise || 0),
		totalRevenueInPaise: Number(s.totalRevenueInPaise || 0),
		outstandingInPaise: Number(s.outstandingInPaise || 0),
		overdueInvoices: Number(s.overdueInvoices || 0),
		totalCustomers: Number(s.totalCustomers || 0),
		newCustomersThisMonth: Number(s.newCustomersThisMonth || 0),
	};
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
	const res: any = await apiClient.get("/analytics/dashboard");
	const a = res.analytics || {};
	return {
		revenueTrend: (a.revenueTrend || []).map((t: any) => ({
			month: t.month ? new Date(t.month).toLocaleString("default", { month: "short" }) : "Month",
			revenue: Number(t.revenue || 0),
			subscriptions: Number(t.subscriptions || 0),
		})),
		subscriptionStats: {
			active: Number(a.subscriptionStats?.active || 0),
			draft: Number(a.subscriptionStats?.draft || 0),
			paused: Number(a.subscriptionStats?.paused || 0),
			closed: Number(a.subscriptionStats?.closed || 0),
		},
		overdueAging: (a.overdueAging || []).map((ag: any) => ({
			range: ag.range,
			count: Number(ag.count || 0),
			amountInPaise: Number(ag.amountInPaise || 0),
		})),
	};
}

// Unified apiService object matching Invoices.tsx expectations
export const apiService = {
	getCustomers: async () => {
		const res = await getCustomers(1, 100);
		return res.data;
	},
	getInvoices,
	getInvoice,
	confirmInvoice,
	sendInvoice: confirmInvoice,
	recordPayment,
	getPaymentsByInvoiceId,
	createInvoice: async (_data: any): Promise<Invoice> => {
		const today = new Date().toISOString().split("T")[0];
		try {
			await apiClient.post("/billing/run", { billingDate: today });
		} catch (err) {
			console.warn("Billing run note:", err);
		}
		const invs = await getInvoices();
		return invs[0] || ({} as Invoice);
	},
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
