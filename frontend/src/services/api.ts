// frontend/src/services/api.ts
import {
	mockCustomers,
	mockProducts,
	mockPlans,
	mockSubscriptions,
	mockInvoices,
	mockPayments,
	mockDashboardSummary,
	mockDashboardAnalytics,
} from "../data/mockData";
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

let customersData: Customer[] = [...mockCustomers];
let productsData: Product[] = [...mockProducts];
let plansData: SubscriptionPlan[] = [...mockPlans];
let subscriptionsData: Subscription[] = [...mockSubscriptions];
let invoicesData: Invoice[] = [...mockInvoices];
let paymentsData: Payment[] = [...mockPayments];

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

export const apiService = {
	// --- Dashboard API ---
	async getDashboardSummary(): Promise<DashboardSummary> {
		await delay();
		return { ...mockDashboardSummary };
	},

	async getDashboardAnalytics(): Promise<DashboardAnalytics> {
		await delay();
		return { ...mockDashboardAnalytics };
	},

	// --- Customers API ---
	async getCustomers(search?: string, status?: string): Promise<Customer[]> {
		await delay();
		let result = [...customersData];
		if (search) {
			const q = search.toLowerCase();
			result = result.filter(
				(c) =>
					c.name.toLowerCase().includes(q) ||
					c.email.toLowerCase().includes(q) ||
					c.phone.includes(q),
			);
		}
		if (status && status !== "all") {
			result = result.filter((c) => c.status === status);
		}
		return result;
	},

	async getCustomerById(id: string): Promise<Customer | undefined> {
		await delay();
		return customersData.find((c) => c.id === id);
	},

	async createCustomer(
		customer: Omit<Customer, "id" | "createdAt" | "updatedAt">,
	): Promise<Customer> {
		await delay();
		const newCustomer: Customer = {
			...customer,
			id: `cust_${Date.now()}`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		customersData.unshift(newCustomer);
		return newCustomer;
	},

	async updateCustomer(
		id: string,
		updates: Partial<Customer>,
	): Promise<Customer> {
		await delay();
		const index = customersData.findIndex((c) => c.id === id);
		if (index === -1) throw new Error("Customer not found");
		customersData[index] = {
			...customersData[index],
			...updates,
			updatedAt: new Date().toISOString(),
		};
		return customersData[index];
	},

	// --- Products API ---
	async getProducts(category?: string): Promise<Product[]> {
		await delay();
		if (category && category !== "all") {
			return productsData.filter((p) => p.category === category);
		}
		return [...productsData];
	},

	async createProduct(
		product: Omit<Product, "id" | "createdAt" | "updatedAt">,
	): Promise<Product> {
		await delay();
		const newProduct: Product = {
			...product,
			id: `prod_${Date.now()}`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		productsData.unshift(newProduct);
		return newProduct;
	},

	async updateProduct(
		id: string,
		updates: Partial<Product>,
	): Promise<Product> {
		await delay();
		const index = productsData.findIndex((p) => p.id === id);
		if (index === -1) throw new Error("Product not found");
		productsData[index] = {
			...productsData[index],
			...updates,
			updatedAt: new Date().toISOString(),
		};
		return productsData[index];
	},

	// --- Subscription Plans API ---
	async getPlans(): Promise<SubscriptionPlan[]> {
		await delay();
		return [...plansData];
	},

	// --- Subscriptions API ---
	async getSubscriptions(
		status?: string,
		customerId?: string,
	): Promise<Subscription[]> {
		await delay();
		let result = [...subscriptionsData];
		if (status && status !== "all") {
			result = result.filter((s) => s.status === status);
		}
		if (customerId) {
			result = result.filter((s) => s.customerId === customerId);
		}
		return result;
	},

	async createSubscription(subData: {
		customerId: string;
		planId: string;
		startDate: string;
		billingCycle: "monthly" | "yearly";
	}): Promise<Subscription> {
		await delay();
		const customer = customersData.find((c) => c.id === subData.customerId);
		const plan = plansData.find((p) => p.id === subData.planId);

		const pricePaise =
			subData.billingCycle === "yearly"
				? (plan?.priceYearlyPaise ?? 0)
				: (plan?.priceMonthlyPaise ?? 0);

		const newSub: Subscription = {
			id: `sub_${Date.now()}`,
			subscriptionNumber: `SUB-${Math.floor(1000 + Math.random() * 9000)}`,
			customerId: subData.customerId,
			customerName: customer?.name ?? "Unknown Customer",
			planId: subData.planId,
			planName: plan?.name ?? "Unknown Plan",
			status: "confirmed",
			billingCycle: subData.billingCycle,
			startDate: subData.startDate,
			nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0],
			amountPaise: pricePaise,
			currency: "INR",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		subscriptionsData.unshift(newSub);
		return newSub;
	},

	async updateSubscriptionStatus(
		id: string,
		status: Subscription["status"],
	): Promise<Subscription> {
		await delay();
		const index = subscriptionsData.findIndex((s) => s.id === id);
		if (index === -1) throw new Error("Subscription not found");
		subscriptionsData[index] = {
			...subscriptionsData[index],
			status,
			updatedAt: new Date().toISOString(),
		};
		return subscriptionsData[index];
	},

	// --- Invoices API ---
	async getInvoices(
		status?: string,
		customerId?: string,
		search?: string,
	): Promise<Invoice[]> {
		await delay();
		let result = [...invoicesData];
		if (status && status !== "all") {
			result = result.filter((i) => i.status === status);
		}
		if (customerId) {
			result = result.filter((i) => i.customerId === customerId);
		}
		if (search) {
			const q = search.toLowerCase();
			result = result.filter(
				(i) =>
					i.invoiceNumber.toLowerCase().includes(q) ||
					i.customerName.toLowerCase().includes(q),
			);
		}
		return result;
	},

	async getInvoiceById(id: string): Promise<Invoice | undefined> {
		await delay();
		return invoicesData.find((i) => i.id === id);
	},

	async createInvoice(invoicePayload: {
		customerId: string;
		dueDate: string;
		items: {
			description: string;
			quantity: number;
			unitPricePaise: number;
		}[];
		taxPaise?: number;
		discountPaise?: number;
	}): Promise<Invoice> {
		await delay();
		const customer = customersData.find(
			(c) => c.id === invoicePayload.customerId,
		);

		const subtotalPaise = invoicePayload.items.reduce(
			(sum, item) => sum + item.quantity * item.unitPricePaise,
			0,
		);
		const taxPaise =
			invoicePayload.taxPaise ?? Math.round(subtotalPaise * 0.18);
		const discountPaise = invoicePayload.discountPaise ?? 0;
		const totalPaise = subtotalPaise + taxPaise - discountPaise;

		const newInvoice: Invoice = {
			id: `inv_${Date.now()}`,
			invoiceNumber: `INV-2025-${Math.floor(100 + Math.random() * 900)}`,
			customerId: invoicePayload.customerId,
			customerName: customer?.name ?? "Client",
			customerEmail: customer?.email ?? "",
			status: "sent",
			issueDate: new Date().toISOString().split("T")[0],
			dueDate: invoicePayload.dueDate,
			items: invoicePayload.items.map((item, idx) => ({
				id: `li_${idx + 1}`,
				description: item.description,
				quantity: item.quantity,
				unitPricePaise: item.unitPricePaise,
				taxRatePercent: 18,
				totalPaise: item.quantity * item.unitPricePaise,
			})),
			subtotalPaise,
			taxPaise,
			discountPaise,
			totalPaise,
			paidAmountPaise: 0,
			balanceDuePaise: totalPaise,
			currency: "INR",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		invoicesData.unshift(newInvoice);
		return newInvoice;
	},

	async recordPayment(paymentData: {
		invoiceId: string;
		amountPaise: number;
		paymentMethod: Payment["paymentMethod"];
		referenceNumber: string;
	}): Promise<{ invoice: Invoice; payment: Payment }> {
		await delay();
		const invoiceIndex = invoicesData.findIndex(
			(i) => i.id === paymentData.invoiceId,
		);
		if (invoiceIndex === -1) throw new Error("Invoice not found");

		const inv = invoicesData[invoiceIndex];
		const newPaidAmount = inv.paidAmountPaise + paymentData.amountPaise;
		const newBalanceDue = Math.max(0, inv.totalPaise - newPaidAmount);

		let newStatus: Invoice["status"] = inv.status;
		if (newBalanceDue === 0) {
			newStatus = "paid";
		} else if (newPaidAmount > 0) {
			newStatus = "partially_paid";
		}

		const updatedInvoice: Invoice = {
			...inv,
			paidAmountPaise: newPaidAmount,
			balanceDuePaise: newBalanceDue,
			status: newStatus,
			updatedAt: new Date().toISOString(),
		};
		invoicesData[invoiceIndex] = updatedInvoice;

		const newPayment: Payment = {
			id: `pay_${Date.now()}`,
			invoiceId: inv.id,
			invoiceNumber: inv.invoiceNumber,
			customerId: inv.customerId,
			customerName: inv.customerName,
			amountPaise: paymentData.amountPaise,
			paymentMethod: paymentData.paymentMethod,
			referenceNumber: paymentData.referenceNumber,
			status: "completed",
			paymentDate: new Date().toISOString().split("T")[0],
			createdAt: new Date().toISOString(),
		};
		paymentsData.unshift(newPayment);

		return { invoice: updatedInvoice, payment: newPayment };
	},

	async getPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]> {
		await delay();
		return paymentsData.filter((p) => p.invoiceId === invoiceId);
	},
};
