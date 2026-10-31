// frontend/src/data/mockData.ts
import type {
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
	activeSubscriptions: 18,
	mrrInPaise: 4850000,
	arrInPaise: 58200000,
	totalRevenueInPaise: 342000000,
	outstandingInPaise: 4250000,
	overdueInvoices: 3,
	totalCustomers: 24,
	newCustomersThisMonth: 4,
};

export const mockDashboardAnalytics: DashboardAnalytics = {
	revenueTrend: [
		{ month: "May", revenue: 850000, subscriptions: 12 },
		{ month: "Jun", revenue: 920000, subscriptions: 14 },
		{ month: "Jul", revenue: 1010000, subscriptions: 15 },
		{ month: "Aug", revenue: 1100000, subscriptions: 16 },
		{ month: "Sep", revenue: 1180000, subscriptions: 17 },
		{ month: "Oct", revenue: 1250000, subscriptions: 18 },
	],
	subscriptionStats: {
		active: 18,
		draft: 3,
		paused: 1,
		closed: 2,
	},
	overdueAging: [
		{ range: "1-15 Days", amountInPaise: 1200000, count: 3 },
		{ range: "16-30 Days", amountInPaise: 1450000, count: 2 },
		{ range: "31-60 Days", amountInPaise: 800000, count: 1 },
		{ range: "60+ Days", amountInPaise: 0, count: 0 },
	],
};

export const mockCustomers: Customer[] = [
	{
		id: "cust_1",
		name: "Rajesh Kumar",
		email: "rajesh@techcorp.in",
		phone: "+91 98765 43210",
		company: "TechCorp Solutions India",
		address: "102 Tech Park, Bandra Kurla Complex",
		city: "Mumbai",
		state: "Maharashtra",
		pincode: "400051",
		gstin: "27AABCU9603R1ZM",
		status: "active",
		createdAt: "2024-01-15T10:00:00Z",
	},
	{
		id: "cust_2",
		name: "Priya Sharma",
		email: "priya@innovateanalytics.com",
		phone: "+91 91234 56789",
		company: "Innovate Analytics Pvt Ltd",
		address: "45 Koramangala 4th Block",
		city: "Bengaluru",
		state: "Karnataka",
		pincode: "560034",
		gstin: "29AAACI1234H1Z5",
		status: "active",
		createdAt: "2024-02-10T11:30:00Z",
	},
	{
		id: "cust_3",
		name: "Amitabh Verma",
		email: "amitabh@cloudscale.in",
		phone: "+91 99887 76655",
		company: "CloudScale Systems",
		address: "Sector 62",
		city: "Noida",
		state: "Uttar Pradesh",
		pincode: "201301",
		gstin: "07AAACC5678J1Z2",
		status: "inactive",
		createdAt: "2024-03-05T09:00:00Z",
	},
];

export const mockProducts: Product[] = [
	{
		id: "prod_1",
		name: "Brightloop Core Billing Engine",
		description: "Automated SaaS subscription billing & GST compliance platform",
		category: "software",
		basePriceInPaise: 499900,
		isActive: true,
		variants: [
			{
				id: "v_1",
				name: "Starter Monthly",
				sku: "BL-STR-M",
				priceInPaise: 499900,
				isActive: true,
			},
			{
				id: "v_2",
				name: "Starter Yearly",
				sku: "BL-STR-Y",
				priceInPaise: 4999000,
				isActive: true,
			},
		],
		createdAt: "2024-01-01T00:00:00Z",
	},
];

export const mockPlans: SubscriptionPlan[] = [
	{
		id: "plan_1",
		name: "Starter Tier",
		productId: "prod_1",
		priceInPaise: 499900,
		billingInterval: "monthly",
		isActive: true,
	},
	{
		id: "plan_2",
		name: "Growth Pro",
		productId: "prod_1",
		priceInPaise: 1499900,
		billingInterval: "monthly",
		isActive: true,
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
		billingInterval: "monthly",
		startDate: "2024-01-15",
		endDate: null,
		nextBillingDate: "2025-11-15",
		amountInPaise: 1499900,
		createdAt: "2024-01-15T10:00:00Z",
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
		subtotalPaise: 1499900,
		taxPaise: 269982,
		discountPaise: 0,
		totalPaise: 1769882,
		paidAmountPaise: 1769882,
		balanceDuePaise: 0,
		dueDate: "2025-10-15",
		createdAt: "2025-10-01T10:00:00Z",
	},
];

export const mockPayments: Payment[] = [
	{
		id: "pay_1",
		invoiceId: "inv_1",
		amountPaise: 1769882,
		paymentMethod: "upi",
		paymentDate: "2025-10-05",
		createdAt: "2025-10-05T12:00:00Z",
	},
];
