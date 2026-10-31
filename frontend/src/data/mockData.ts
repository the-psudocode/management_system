// frontend/src/data/mockData.ts
import {
	Customer,
	Product,
	SubscriptionPlan,
	Subscription,
	Invoice,
	Payment,
	DashboardSummary,
	DashboardAnalytics,
} from "../types";

export const mockDashboardSummary: DashboardSummary = {
	mrrPaise: 125000000,
	arrPaise: 1500000000,
	activeSubscriptions: 142,
	totalCustomers: 185,
	overdueInvoicesCount: 6,
	overdueAmountPaise: 34500000,
};

export const mockDashboardAnalytics: DashboardAnalytics = {
	revenueHistory: [
		{ month: "May", mrrPaise: 85000000, arrPaise: 1020000000 },
		{ month: "Jun", mrrPaise: 92000000, arrPaise: 1104000000 },
		{ month: "Jul", mrrPaise: 101000000, arrPaise: 1212000000 },
		{ month: "Aug", mrrPaise: 110000000, arrPaise: 1320000000 },
		{ month: "Sep", mrrPaise: 118000000, arrPaise: 1416000000 },
		{ month: "Oct", mrrPaise: 125000000, arrPaise: 1500000000 },
	],
	subscriptionsByStatus: [
		{ status: "active", count: 142 },
		{ status: "confirmed", count: 18 },
		{ status: "quotation", count: 12 },
		{ status: "draft", count: 8 },
		{ status: "paused", count: 5 },
		{ status: "closed", count: 9 },
	],
	agingOverdue: [
		{ range: "1-15 Days", amountPaise: 12000000, count: 3 },
		{ range: "16-30 Days", amountPaise: 14500000, count: 2 },
		{ range: "31-60 Days", amountPaise: 8000000, count: 1 },
		{ range: "60+ Days", amountPaise: 0, count: 0 },
	],
};

export const mockCustomers: Customer[] = [
	{
		id: "cust_1",
		name: "Rajesh Kumar",
		email: "rajesh@techcorp.in",
		phone: "+91 98765 43210",
		companyName: "TechCorp Solutions India",
		status: "active",
		taxId: "27AABCU9603R1ZM",
		billingAddress: {
			street: "102 Tech Park, Bandra Kurla Complex",
			city: "Mumbai",
			state: "Maharashtra",
			postalCode: "400051",
			country: "India",
		},
		createdAt: "2024-01-15T10:00:00Z",
		updatedAt: "2024-10-01T12:00:00Z",
	},
	{
		id: "cust_2",
		name: "Priya Sharma",
		email: "priya@innovateanalytics.com",
		phone: "+91 91234 56789",
		companyName: "Innovate Analytics Pvt Ltd",
		status: "active",
		taxId: "29AAACI1234H1Z5",
		billingAddress: {
			street: "45 Koramangala 4th Block",
			city: "Bengaluru",
			state: "Karnataka",
			postalCode: "560034",
			country: "India",
		},
		createdAt: "2024-02-10T11:30:00Z",
		updatedAt: "2024-09-20T14:15:00Z",
	},
	{
		id: "cust_3",
		name: "Amitabh Verma",
		email: "amitabh@cloudscale.in",
		phone: "+91 99887 76655",
		companyName: "CloudScale Systems",
		status: "inactive",
		taxId: "07AAACC5678J1Z2",
		billingAddress: {
			street: "Sector 62",
			city: "Noida",
			state: "Uttar Pradesh",
			postalCode: "201301",
			country: "India",
		},
		createdAt: "2024-03-05T09:00:00Z",
		updatedAt: "2024-08-11T16:00:00Z",
	},
];

export const mockProducts: Product[] = [
	{
		id: "prod_1",
		name: "Brightloop Core Billing Engine",
		description:
			"Automated SaaS subscription billing & GST compliance platform",
		category: "software",
		status: "active",
		variants: [
			{
				id: "v_1",
				name: "Starter Monthly",
				sku: "BL-STR-M",
				pricePaise: 499900,
				billingCycle: "monthly",
			},
			{
				id: "v_2",
				name: "Starter Yearly",
				sku: "BL-STR-Y",
				pricePaise: 4999000,
				billingCycle: "yearly",
			},
			{
				id: "v_3",
				name: "Pro Monthly",
				sku: "BL-PRO-M",
				pricePaise: 1499900,
				billingCycle: "monthly",
			},
			{
				id: "v_4",
				name: "Pro Yearly",
				sku: "BL-PRO-Y",
				pricePaise: 14999000,
				billingCycle: "yearly",
			},
		],
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
	},
	{
		id: "prod_2",
		name: "Razorpay / UPI Payment Gateway Connector",
		description: "Instant webhooks integration for Indian payment gateways",
		category: "addon",
		status: "active",
		variants: [
			{
				id: "v_5",
				name: "Standard Addon",
				sku: "BL-GATEWAY-STD",
				pricePaise: 199900,
				billingCycle: "monthly",
			},
		],
		createdAt: "2024-02-01T00:00:00Z",
		updatedAt: "2024-02-01T00:00:00Z",
	},
];

export const mockPlans: SubscriptionPlan[] = [
	{
		id: "plan_1",
		name: "Starter Tier",
		code: "STARTER",
		description:
			"Perfect for early stage startups handling up to 500 subscriptions",
		priceMonthlyPaise: 499900,
		priceYearlyPaise: 4999000,
		features: [
			"Up to 500 active customers",
			"Standard GST invoicing",
			"UPI / Card payments integration",
			"Email support",
		],
	},
	{
		id: "plan_2",
		name: "Growth Pro",
		code: "PRO",
		description:
			"For growing SaaS platforms requiring automated dunning & aging reports",
		priceMonthlyPaise: 1499900,
		priceYearlyPaise: 14999000,
		features: [
			"Unlimited customers",
			"Advanced revenue metrics (MRR/ARR)",
			"Automated tax reports",
			"Priority 24/7 phone support",
		],
		isPopular: true,
	},
];

export const mockSubscriptions: Subscription[] = [
	{
		id: "sub_1",
		subscriptionNumber: "SUB-2025-001",
		customerId: "cust_1",
		customerName: "TechCorp Solutions India",
		planId: "plan_2",
		planName: "Growth Pro",
		status: "active",
		billingCycle: "monthly",
		startDate: "2024-01-15",
		nextBillingDate: "2025-11-15",
		amountPaise: 1499900,
		currency: "INR",
		createdAt: "2024-01-15T10:00:00Z",
		updatedAt: "2024-10-15T10:00:00Z",
	},
	{
		id: "sub_2",
		subscriptionNumber: "SUB-2025-002",
		customerId: "cust_2",
		customerName: "Innovate Analytics Pvt Ltd",
		planId: "plan_1",
		planName: "Starter Tier",
		status: "active",
		billingCycle: "yearly",
		startDate: "2024-02-10",
		nextBillingDate: "2025-02-10",
		amountPaise: 4999000,
		currency: "INR",
		createdAt: "2024-02-10T11:30:00Z",
		updatedAt: "2024-02-10T11:30:00Z",
	},
];

export const mockInvoices: Invoice[] = [
	{
		id: "inv_1",
		invoiceNumber: "INV-2025-001",
		customerId: "cust_1",
		customerName: "TechCorp Solutions India",
		customerEmail: "rajesh@techcorp.in",
		status: "paid",

		issueDate: "2025-10-01",
		dueDate: "2025-10-15",
		items: [
			{
				id: "li_1",
				description: "Growth Pro Plan (Monthly)",
				quantity: 1,
				unitPricePaise: 1499900,
				taxRatePercent: 18,
				totalPaise: 1499900,
			},
		],
		subtotalPaise: 1499900,
		taxPaise: 269982,
		discountPaise: 0,
		totalPaise: 1769882,
		paidAmountPaise: 1769882,
		balanceDuePaise: 0,
		currency: "INR",
		createdAt: "2025-10-01T10:00:00Z",
		updatedAt: "2025-10-05T12:00:00Z",

	},
	{
		id: "inv_2",
		invoiceNumber: "INV-2025-002",
		customerId: "cust_2",
		customerName: "Innovate Analytics Pvt Ltd",
		customerEmail: "priya@innovateanalytics.com",
		status: "overdue",

		issueDate: "2025-09-15",
		dueDate: "2025-09-30",
		items: [
			{
				id: "li_2",
				description: "Starter Tier Plan (Yearly)",
				quantity: 1,
				unitPricePaise: 4999000,
				taxRatePercent: 18,
				totalPaise: 4999000,
			},
		],
		subtotalPaise: 4999000,
		taxPaise: 899820,
		discountPaise: 0,
		totalPaise: 5898820,
		paidAmountPaise: 0,
		balanceDuePaise: 5898820,
		currency: "INR",
		createdAt: "2025-09-15T11:00:00Z",
		updatedAt: "2025-09-15T11:00:00Z",

	},
];

export const mockPayments: Payment[] = [
	{
		id: "pay_1",
		invoiceId: "inv_1",
		invoiceNumber: "INV-2025-001",
		customerId: "cust_1",
		customerName: "TechCorp Solutions India",
		amountPaise: 1769882,
		paymentMethod: "upi",
		referenceNumber: "UTR-982374982",
		status: "completed",
		paymentDate: "2025-10-05",
		createdAt: "2025-10-05T12:00:00Z",
	},
];
