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

export type InvoiceStatus =
	| "draft"
	| "sent"
	| "confirmed"
	| "partially_paid"
	| "paid"
	| "overdue"
	| "cancelled"
	| "void";

export type UserRole = "admin" | "staff" | "customer";

export type BillingInterval = "daily" | "weekly" | "monthly" | "quarterly" | "half_yearly" | "yearly";

export type DiscountType = "fixed" | "percentage";
export type QuotationStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "converted";

export interface AuthProfile {
	id: string;
	name: string;
	email: string;
	role: UserRole;
}

export interface Customer {
	id: string;
	userId?: string;
	name: string;
	email: string;
	phone: string;
	company: string;
	companyName?: string;
	address: string;
	city: string;
	state: string;
	pincode: string;
	country?: string;
	gstin: string;
	createdAt: string;
	updatedAt?: string;
	status: "active" | "inactive";
	accountBalancePaise?: number | string | null;
	creditLimitPaise?: number | string | null;
}

export interface ProductVariant {
	id: string;
	name: string;
	sku: string;
	priceInPaise: number;
	pricePaise?: number | string;
	priceAdjustmentInPaise?: number | string;
	billingCycle?: string;
	isActive: boolean;
}

export interface Product {
	id: string;
	name: string;
	description: string;
	category: string;
	type?: string;
	basePriceInPaise: number;
	salesPricePaise?: number | string;
	costPricePaise?: number | string;
	variants: ProductVariant[];
	plans?: SubscriptionPlan[];
	status?: string;
	isActive: boolean;
	createdAt: string;
	updatedAt?: string;
}

export interface SubscriptionPlan {
	id: string;
	code?: string;
	name: string;
	description?: string;
	productId: string;
	productName?: string;
	productDescription?: string;
	productType?: string;
	productVariants?: ProductVariant[];
	minimumQuantity?: number;
	variantId?: string;
	variantName?: string;
	priceInPaise: number;
	amountPaise?: number | string;
	priceMonthlyPaise?: number;
	priceYearlyPaise?: number;
	billingInterval: BillingInterval;
	intervalCount?: number;
	trialDays?: number;
	isActive: boolean;
	status?: string;
}

export interface Subscription {
	id: string;
	subscriptionNumber?: string;
	number?: string;
	customerId: string;
	customerName: string;
	customer?: any;
	planId: string;
	planName: string;
	status: SubscriptionStatus;
	startDate: string;
	endDate: string | null;
	nextBillingDate: string | null;
	billingInterval: BillingInterval;
	billingCycle?: string;
	amountInPaise: number;
	amountPaise?: number;
	items?: any[];
	invoices?: Invoice[];
	createdAt: string;
	updatedAt?: string;
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
	unitPriceInPaise?: number;
	unitPricePaise?: number;
	taxInPaise?: number;
	taxPaise?: number;
	discountInPaise?: number;
	discountPaise?: number;
	totalInPaise?: number;
	totalPaise?: number;
	unitPriceRupees?: string;
}

export interface Invoice {
	id: string;
	invoiceNumber: string;
	number?: string;
	customerId: string;
	customerName: string;
	customerEmail?: string;
	customer?: any;
	subscriptionId?: string;
	subscription?: any;
	status: InvoiceStatus;
	currency?: string;
	lineItems?: InvoiceLineItem[];
	items?: any[];
	subtotalInPaise?: number;
	subtotalPaise: number;
	taxInPaise?: number;
	taxPaise: number;
	discountInPaise?: number;
	discountPaise: number;
	totalInPaise?: number;
	totalPaise: number;
	amountPaidInPaise?: number;
	paidAmountPaise: number;
	amountPaidPaise?: number;
	outstandingInPaise?: number;
	balanceDuePaise: number;
	billingPeriodStart?: string;
	billingPeriodEnd?: string;
	dueDate: string;
	issueDate?: string;
	issuedAt?: string | null;
	allocations?: any[];
	createdAt: string;
	updatedAt?: string;
}

export interface Quotation {
	id: string;
	number: string;
	customerId: string;
	status: QuotationStatus;
	currency: string;
	validUntil: string;
	subtotalPaise: number | string;
	taxPaise: number | string;
	discountPaise: number | string;
	totalPaise: number | string;
	createdAt: string;
	customer?: Pick<Customer, "id" | "company">;
	items?: Array<{ id: string; description: string; quantity: number; unitPricePaise: number | string }>;
}

export interface PortalOverview {
	customer: Customer;
	subscriptions: Subscription[];
	invoices: Invoice[];
	quotations: Quotation[];
	payments: Payment[];
}

export interface Payment {
	id: string;
	invoiceId?: string;
	invoiceNumber?: string;
	customerId?: string;
	customerName?: string;
	customer?: any;
	amountInPaise?: number;
	amountPaise: number;
	paymentMethod: "upi" | "bank_transfer" | "card" | "cash" | "cheque" | "other" | string;
	method?: "upi" | "bank_transfer" | "card" | "cash" | "cheque" | "other" | string;
	reference?: string;
	referenceNumber?: string;
	date?: string;
	paymentDate?: string;
	receivedAt?: string;
	notes?: string;
	currency?: string;
	allocations?: any[];
	status?: string;
	createdAt?: string;
}

export interface DashboardSummary {
	activeSubscriptions: number;
	mrrInPaise: number;
	mrrPaise?: number;
	arrInPaise: number;
	arrPaise?: number;
	totalRevenueInPaise: number;
	outstandingInPaise: number;
	overdueAmountPaise?: number;
	overdueInvoices: number;
	overdueInvoicesCount?: number;
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
	revenueHistory?: any[];
	subscriptionStats: {
		active: number;
		draft: number;
		paused: number;
		closed: number;
	};
	subscriptionsByStatus?: any;
	overdueAging: AgingBucket[];
	agingOverdue?: any[];
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}
