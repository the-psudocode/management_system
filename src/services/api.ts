// ============================================================
// src/services/api.ts
// API service layer with full CRUD support for local state
// ============================================================

import type {
	Customer,
	Product,
	Subscription,
	Invoice,
	DashboardSummary,
	DashboardAnalytics,
	PaginatedResponse,
} from "../types";

import {
	mockCustomers,
	mockProducts,
	mockSubscriptions,
	mockInvoices,
	mockDashboardSummary,
	mockDashboardAnalytics,
} from "../data/mockData";

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

function paginate<T>(
	items: T[],
	page: number,
	pageSize: number,
): PaginatedResponse<T> {
	const start = (page - 1) * pageSize;
	return {
		data: items.slice(start, start + pageSize),
		total: items.length,
		page,
		pageSize,
		totalPages: Math.ceil(items.length / pageSize) || 1,
	};
}

// ---------- DASHBOARD ----------

export async function getDashboardSummary(): Promise<DashboardSummary> {
	await delay();
	return mockDashboardSummary;
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
	await delay();
	return mockDashboardAnalytics;
}

// ---------- CUSTOMERS ----------

export async function getCustomers(
	page = 1,
	pageSize = 10,
	search = "",
	statusFilter = "all",
): Promise<PaginatedResponse<Customer>> {
	await delay();
	let filtered = [...mockCustomers];

	if (search) {
		const q = search.toLowerCase();
		filtered = filtered.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.email.toLowerCase().includes(q) ||
				c.company.toLowerCase().includes(q) ||
				c.city.toLowerCase().includes(q),
		);
	}

	if (statusFilter !== "all") {
		filtered = filtered.filter((c) => c.status === statusFilter);
	}

	return paginate(filtered, page, pageSize);
}

export async function getCustomerById(
	id: string,
): Promise<Customer | undefined> {
	await delay();
	return mockCustomers.find((c) => c.id === id);
}

export async function createCustomer(
	data: Omit<Customer, "id" | "createdAt">,
): Promise<Customer> {
	await delay();
	const newCustomer: Customer = {
		...data,
		id: `cust_${String(mockCustomers.length + 1).padStart(3, "0")}`,
		createdAt: new Date().toISOString().split("T")[0],
	};
	mockCustomers.unshift(newCustomer);
	mockDashboardSummary.totalCustomers += 1;
	return newCustomer;
}

export async function updateCustomer(
	id: string,
	data: Partial<Customer>,
): Promise<Customer> {
	await delay();
	const idx = mockCustomers.findIndex((c) => c.id === id);
	if (idx !== -1) {
		mockCustomers[idx] = { ...mockCustomers[idx], ...data };
		return mockCustomers[idx];
	}
	throw new Error("Customer not found");
}

export async function getCustomerSubscriptions(
	customerId: string,
): Promise<Subscription[]> {
	await delay();
	return mockSubscriptions.filter((s) => s.customerId === customerId);
}

export async function getCustomerInvoices(
	customerId: string,
): Promise<Invoice[]> {
	await delay();
	return mockInvoices.filter((i) => i.customerId === customerId);
}

// ---------- PRODUCTS ----------

export async function getProducts(
	page = 1,
	pageSize = 10,
	search = "",
): Promise<PaginatedResponse<Product>> {
	await delay();
	const filtered = search
		? mockProducts.filter((p) =>
				p.name.toLowerCase().includes(search.toLowerCase()),
			)
		: mockProducts;
	return paginate(filtered, page, pageSize);
}

// ---------- SUBSCRIPTIONS ----------

export async function getSubscriptions(
	page = 1,
	pageSize = 10,
	search = "",
): Promise<PaginatedResponse<Subscription>> {
	await delay();
	const filtered = search
		? mockSubscriptions.filter((s) =>
				s.customerName.toLowerCase().includes(search.toLowerCase()),
			)
		: mockSubscriptions;
	return paginate(filtered, page, pageSize);
}

// ---------- INVOICES ----------

export async function getInvoices(
	page = 1,
	pageSize = 10,
	search = "",
): Promise<PaginatedResponse<Invoice>> {
	await delay();
	const filtered = search
		? mockInvoices.filter((i) =>
				i.invoiceNumber.toLowerCase().includes(search.toLowerCase()),
			)
		: mockInvoices;
	return paginate(filtered, page, pageSize);
}
