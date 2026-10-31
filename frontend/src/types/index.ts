// frontend/src/types/index.ts

export type CustomerStatus = "active" | "inactive" | "archived" | string;

export interface Customer {
	id: string;
	name: string;
	email: string;
	phone: string;
	company?: string;
	companyName?: string;
	status?: any;
	isActive?: boolean;
	taxId?: string;
	gstin?: string;
	address?: string;
	city?: string;
	state?: string;
	pincode?: string;
	billingAddress?: {
		street: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
	};
	createdAt: string;
	updatedAt: string;
}

export type ProductStatus = "active" | "inactive" | "archived" | string;
export type ProductCategory =
	| "software"
	| "addon"
	| "service"
	| "usage"
	| string;

export interface ProductVariant {
	id: string;
	name: string;
	sku: string;
	pricePaise?: number;
	priceInPaise?: number;
	billingCycle?: "monthly" | "yearly" | "one_time" | string;
	isActive?: boolean;
}

export interface Product {
	id: string;
	name: string;
	code?: string;
	description: string;
	category: ProductCategory;
	status?: any;
	isActive?: boolean;
	basePriceInPaise?: number;
	variants: ProductVariant[];
	createdAt: string;
	updatedAt: string;
}

export interface SubscriptionPlan {
	id: string;
	name: string;
	code: string;
	description: string;
	priceMonthlyPaise: number;
	priceYearlyPaise: number;
	priceInPaise?: number;
	billingInterval?: "monthly" | "quarterly" | "yearly" | string;
	features: string[];
	isPopular?: boolean;
}

export type SubscriptionStatus =
	| "draft"
	| "quotation"
	| "confirmed"
	| "active"
	| "paused"
	| "closed";

export interface Subscription {
	id: string;
	subscriptionNumber?: string;
	subscriptionCode?: string;
	customerId: string;
	customerName?: string;
	planId: string;
	planName?: string;
	status: SubscriptionStatus;
	billingCycle?: "monthly" | "yearly" | string;
	billingInterval?: "monthly" | "quarterly" | "yearly" | string;
	startDate: string;
	nextBillingDate?: string;
	endDate?: string;
	amountPaise?: number;
	amountInPaise?: number;
	currency: string;
	createdAt: string;
	updatedAt: string;
}

export type InvoiceStatus =
	| "draft"
	| "sent"
	| "paid"
	| "partially_paid"
	| "overdue"
	| "void";

export interface InvoiceItem {
	id: string;
	description: string;
	quantity: number;
	unitPricePaise?: number;
	priceInPaise?: number;
	taxRatePercent?: number;
	totalPaise?: number;
	totalInPaise?: number;
}

export interface Invoice {
	id: string;
	invoiceNumber: string;
	customerId: string;
	customerName: string;
	customerEmail?: string;
	status: InvoiceStatus;
	issueDate: string;
	dueDate: string;
	items: InvoiceItem[];
	subtotalPaise: number;
	taxPaise: number;
	discountPaise?: number;
	totalPaise: number;
	totalInPaise?: number;
	paidAmountPaise: number;
	balanceDuePaise: number;
	currency: string;
	createdAt: string;
	updatedAt: string;
}

export type PaymentMethod =
	| "upi"
	| "credit_card"
	| "bank_transfer"
	| "net_banking"
	| "cash";
export type PaymentStatus = "completed" | "pending" | "failed" | "refunded";

export interface Payment {
	id: string;
	invoiceId: string;
	invoiceNumber?: string;
	customerId: string;
	customerName?: string;
	amountPaise?: number;
	amountInPaise?: number;
	paymentMethod: PaymentMethod;
	referenceNumber: string;
	status: PaymentStatus;
	paymentDate: string;
	notes?: string;
	createdAt: string;
}

export interface DashboardSummary {
	mrrPaise: number;
	mrrInPaise?: number;
	arrPaise: number;
	arrInPaise?: number;
	activeSubscriptions: number;
	totalCustomers: number;
	newCustomersThisMonth?: number;
	overdueInvoicesCount: number;
	overdueInvoices?: number;
	overdueAmountPaise: number;
	outstandingInPaise?: number;
}

export interface DashboardAnalytics {
	revenueHistory: { month: string; mrrPaise: number; arrPaise: number }[];
	revenueTrend?: { month: string; mrr: number; arr: number }[];
	subscriptionsByStatus: { status: string; count: number }[];
	subscriptionStats?: {
		active: number;
		paused: number;
		draft: number;
		closed: number;
	};
	agingOverdue: { range: string; amountPaise: number; count: number }[];
	overdueAging?: { range: string; amount: number; count: number }[];
}
