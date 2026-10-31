// ============================================================
// src/services/api.ts
// API service layer
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
		totalPages: Math.ceil(items.length / pageSize),
	};
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
	await delay();
	return mockDashboardSummary;
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
	await delay();
	return mockDashboardAnalytics;
}

export async function getCustomers(
	page = 1,
	pageSize = 10,
	search = "",
): Promise<PaginatedResponse<Customer>> {
	await delay();
	const filtered = search
		? mockCustomers.filter(
				(c) =>
					c.name.toLowerCase().includes(search.toLowerCase()) ||
					c.company.toLowerCase().includes(search.toLowerCase()),
			)
		: mockCustomers;
	return paginate(filtered, page, pageSize);
}

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
