// ============================================================
// src/types/index.ts
// All TypeScript interfaces for Brightloop Billing
// ============================================================

export type SubscriptionStatus =
	| "draft"
	| "quotation"
	| "confirmed"
	| "active"
	| "paused"
	| "closed";

export type InvoiceStatus = "draft" | "confirmed" | "paid" | "overdue";

export type UserRole = "admin" | "staff" | "customer";

export type BillingInterval = "monthly" | "quarterly" | "yearly";

export type DiscountType = "fixed" | "percentage";

export interface Customer {
	id: string;
	name: string;
	email: string;
	phone: string;
	company: string;
	address: string;
	city: string;
	state: string;
	pincode: string;
	gstin: string;
	createdAt: string;
	status: "active" | "inactive";
}

export interface ProductVariant {
	id: string;
	name: string;
	sku: string;
	priceInPaise: number;
	isActive: boolean;
}

export interface Product {
	id: string;
	name: string;
	description: string;
	category: string;
	basePriceInPaise: number;
	variants: ProductVariant[];
	isActive: boolean;
	createdAt: string;
}

export interface SubscriptionPlan {
	id: string;
	name: string;
	description: string;
	productId: string;
	productName: string;
	variantId?: string;
	variantName?: string;
	priceInPaise: number;
	billingInterval: BillingInterval;
	trialDays: number;
	isActive: boolean;
}

export interface Subscription {
	id: string;
	customerId: string;
	customerName: string;
	planId: string;
	planName: string;
	status: SubscriptionStatus;
	startDate: string;
	endDate: string | null;
	nextBillingDate: string | null;
	billingInterval: BillingInterval;
	amountInPaise: number;
	createdAt: string;
}

export interface TaxRule {
	id: string;
	name: string;
	rate: number;
	type: "CGST" | "SGST" | "IGST" | "GST";
	appliesTo: string;
}

export interface Discount {
	id: string;
	code: string;
	description: string;
	type: DiscountType;
	value: number;
	startDate: string;
	endDate: string;
	maxUses: number;
	currentUses: number;
	applicableProductIds: string[];
	isActive: boolean;
}

export interface InvoiceLineItem {
	id: string;
	description: string;
	quantity: number;
	unitPriceInPaise: number;
	taxInPaise: number;
	discountInPaise: number;
	totalInPaise: number;
}

export interface Invoice {
	id: string;
	invoiceNumber: string;
	customerId: string;
	customerName: string;
	subscriptionId: string;
	status: InvoiceStatus;
	lineItems: InvoiceLineItem[];
	subtotalInPaise: number;
	taxInPaise: number;
	discountInPaise: number;
	totalInPaise: number;
	amountPaidInPaise: number;
	outstandingInPaise: number;
	billingPeriodStart: string;
	billingPeriodEnd: string;
	dueDate: string;
	createdAt: string;
}

export interface Payment {
	id: string;
	invoiceId: string;
	amountInPaise: number;
	method: "upi" | "bank_transfer" | "card" | "cash" | "cheque";
	reference: string;
	date: string;
	notes: string;
}

export interface DashboardSummary {
	activeSubscriptions: number;
	mrrInPaise: number;
	arrInPaise: number;
	totalRevenueInPaise: number;
	outstandingInPaise: number;
	overdueInvoices: number;
	totalCustomers: number;
	newCustomersThisMonth: number;
}

export interface RevenueDataPoint {
	month: string;
	revenue: number;
	subscriptions: number;
}

export interface AgingBucket {
	range: string;
	count: number;
	amountInPaise: number;
}

export interface DashboardAnalytics {
	revenueTrend: RevenueDataPoint[];
	subscriptionStats: {
		active: number;
		draft: number;
		paused: number;
		closed: number;
	};
	overdueAging: AgingBucket[];
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}
