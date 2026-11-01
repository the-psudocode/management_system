import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Package, QrCode, RefreshCw, ShoppingBag, X } from "lucide-react";
import { acceptQuotation, createSubscription, getPaymentClaims, getPlans, getPortalOverview, rejectQuotation, submitPaymentClaim } from "../services/api";
import type { BillingInterval, PortalOverview, ProductVariant, SubscriptionPlan } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

type PortalProps = { catalogOnly?: boolean };

function planFeatureList(description?: string): string[] {
	return (description || "").split(/[\n,;]/).map((feature) => feature.trim()).filter(Boolean);
}

const offlineDemoServices = [
	{ id: "cloud-hosting", name: "Cloud Hosting", description: "Managed hosting with monitored uptime, backups, and technical support.", tiers: [{ name: "Starter", amount: 299900, periods: ["monthly", "yearly"] }, { name: "Professional", amount: 799900, periods: ["monthly", "quarterly", "yearly"] }, { name: "Enterprise", amount: 1999900, periods: ["monthly", "yearly"] }] },
	{ id: "business-email", name: "Business Email", description: "Domain-based email with spam protection, calendars, and account administration.", tiers: [{ name: "Starter", amount: 149900, periods: ["weekly", "monthly", "yearly"] }, { name: "Professional", amount: 399900, periods: ["weekly", "monthly", "yearly"] }, { name: "Enterprise", amount: 999900, periods: ["monthly", "yearly"] }] },
	{ id: "cybersecurity-monitoring", name: "Cybersecurity Monitoring", description: "Threat monitoring, security alerts, and incident response support.", tiers: [{ name: "Starter", amount: 249900, periods: ["monthly", "half_yearly", "yearly"] }, { name: "Professional", amount: 699900, periods: ["monthly", "half_yearly", "yearly"] }, { name: "Enterprise", amount: 1799900, periods: ["monthly", "yearly"] }] },
	{ id: "database-management", name: "Database Management", description: "Database administration, performance monitoring, backups, and support.", tiers: [{ name: "Starter", amount: 199900, periods: ["monthly", "quarterly", "yearly"] }, { name: "Professional", amount: 599900, periods: ["monthly", "quarterly", "yearly"] }, { name: "Enterprise", amount: 1499900, periods: ["monthly", "yearly"] }] },
	{ id: "website-development", name: "Website Development", description: "Ongoing website development, feature work, and maintenance subscriptions.", tiers: [{ name: "Starter", amount: 499900, periods: ["monthly", "quarterly"] }, { name: "Professional", amount: 1299900, periods: ["monthly", "quarterly", "yearly"] }, { name: "Enterprise", amount: 2999900, periods: ["monthly", "yearly"] }] },
	{ id: "software-maintenance", name: "Software Maintenance", description: "Planned updates, issue resolution, compatibility checks, and support.", tiers: [{ name: "Starter", amount: 99900, periods: ["monthly", "half_yearly", "yearly"] }, { name: "Professional", amount: 349900, periods: ["monthly", "half_yearly", "yearly"] }, { name: "Enterprise", amount: 899900, periods: ["monthly", "yearly"] }] },
	{ id: "cloud-storage", name: "Cloud Storage", description: "Secure storage with backups, access controls, and scalable capacity.", tiers: [{ name: "Starter", amount: 99900, periods: ["weekly", "monthly", "yearly"] }, { name: "Professional", amount: 299900, periods: ["weekly", "monthly", "yearly"] }, { name: "Enterprise", amount: 799900, periods: ["monthly", "yearly"] }] },
];

const offlineDemoPlans: SubscriptionPlan[] = offlineDemoServices.flatMap((service) => service.tiers.flatMap((tier) => tier.periods.map((billingInterval) => ({
	id: `demo-${service.id}-${tier.name.toLowerCase()}-${billingInterval}`,
	name: tier.name,
	description: tier.name === "Starter" ? "Essential service coverage for smaller teams." : tier.name === "Professional" ? "Expanded resources and priority support for growing teams." : "Advanced coverage under a tailored service agreement.",
	productId: `demo-${service.id}`,
	productName: service.name,
	productDescription: service.description,
	priceInPaise: tier.amount,
	amountPaise: tier.amount,
	billingInterval: billingInterval as BillingInterval,
	intervalCount: 1,
	minimumQuantity: 1,
	trialDays: 0,
	isActive: true,
	status: "active",
}))));

function intervalLabel(interval: string, count = 1) {
	const labels: Record<string, string> = { daily: "day", weekly: "week", monthly: "month", quarterly: "quarter", half_yearly: "half-year", yearly: "year" };
	const unit = labels[interval] || interval;
	return count > 1 ? `every ${count} ${unit}${unit.endsWith("s") ? "" : "s"}` : `per ${unit}`;
}

const billingIntervalOrder: BillingInterval[] = ["daily", "weekly", "monthly", "quarterly", "half_yearly", "yearly"];
const billingIntervalNames: Record<BillingInterval, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", half_yearly: "Half-yearly", yearly: "Yearly" };

type CatalogProduct = { id: string; name: string; description: string; variants: ProductVariant[]; plans: SubscriptionPlan[] };
type ProductCatalogProps = {
	products: CatalogProduct[];
	selectedProductId: string;
	onSelectProduct: (productId: string) => void;
	selectedInterval: BillingInterval;
	onIntervalChange: (interval: BillingInterval) => void;
	catalogError: string;
	catalogIsDemo: boolean;
	activePlanIds: Set<string>;
	inProgressPlanIds: Set<string>;
	workingPlanId: string | null;
	onChoosePlan: (plan: SubscriptionPlan) => void;
};

function ProductCatalog({ products, selectedProductId, onSelectProduct, selectedInterval, onIntervalChange, catalogError, catalogIsDemo, activePlanIds, inProgressPlanIds, workingPlanId, onChoosePlan }: ProductCatalogProps) {
	const selectedProduct = products.find((product) => product.id === selectedProductId);
	const productIntervals = selectedProduct ? billingIntervalOrder.filter((interval) => selectedProduct.plans.some((plan) => plan.billingInterval === interval)) : [];
	const effectiveInterval = productIntervals.includes(selectedInterval) ? selectedInterval : productIntervals[0] || "monthly";
	const visiblePlans = selectedProduct?.plans.filter((plan) => plan.billingInterval === effectiveInterval) || [];
	return <section id="catalog" className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-sm">
		<header className="bg-[#eff2eb] px-6 py-8 text-center text-stone-900 sm:px-10 lg:py-10">
			<p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#60775c]">BrightLoop Subscription & Billing</p>
			<h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">{selectedProduct ? selectedProduct.name : "Explore products"}</h2>
			<p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-stone-600 sm:text-sm">{selectedProduct ? selectedProduct.description || "Choose the plan and billing schedule that works for you." : "Choose a product to see its plans and available billing schedules."}</p>
			{selectedProduct && productIntervals.length > 0 && <div className="mt-6">
				<p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">Available billing periods for this product</p>
				<div className="inline-flex flex-wrap justify-center gap-1 rounded-2xl border border-stone-200 bg-white/80 p-1">
					{productIntervals.map((interval) => <button key={interval} type="button" aria-pressed={effectiveInterval === interval} onClick={() => onIntervalChange(interval)} className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition sm:px-4 ${effectiveInterval === interval ? "bg-[#263b2d] text-white shadow-sm" : "text-stone-600 hover:bg-[#f4f6f1] hover:text-stone-950"}`}>{billingIntervalNames[interval]}</button>)}
				</div>
			</div>}
		</header>

		<div className="bg-[#fafaf7] p-5 sm:p-8 lg:p-10">
			{catalogError && <p role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{catalogError}</p>}
			{catalogIsDemo && <p className="mb-5 rounded-xl border border-[#dce5d8] bg-[#f4f7f1] p-3 text-xs text-[#425b3f]">Preview pricing shown. Connect and seed the billing catalog to submit a subscription.</p>}
			{products.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center"><Package size={32} className="mx-auto text-stone-400" /><h3 className="mt-3 text-base font-bold text-stone-800">No products are available yet</h3><p className="mt-1 text-xs text-stone-500">Please check back after products have been added to the catalog.</p></div> : selectedProduct ? <>
				<button type="button" onClick={() => onSelectProduct("")} className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#425b3f] hover:bg-[#e9eee5]"><ArrowLeft size={14} /> All products</button>
				{selectedProduct.variants.length > 0 && <div className="mb-5 rounded-xl border border-stone-200 bg-white p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Variants & optional add-ons</h3><p className="mt-1 text-xs text-stone-500">Choose an available option during checkout; its extra price is added to each billing period.</p><div className="mt-3 flex flex-wrap gap-2">{selectedProduct.variants.map((variant) => <span key={variant.id} className="rounded-lg border border-stone-200 bg-[#fafbf8] px-3 py-2 text-xs text-stone-700">{variant.name} <b className="ml-1 text-[#425b3f]">+{formatCurrency(Number(variant.priceAdjustmentInPaise ?? variant.priceInPaise))}</b></span>)}</div></div>}
				<div className="mb-5 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-lg font-bold text-[#263b2d]">Available plans</h3><p className="mt-1 text-xs text-stone-500">Plans offered for {selectedProduct.name}.</p></div><span className="rounded-full bg-[#e9eee5] px-3 py-1 text-[11px] font-semibold text-[#425b3f]">{visiblePlans.length} {billingIntervalNames[effectiveInterval]?.toLowerCase()} options</span></div>
				<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visiblePlans.map((plan) => {
					const active = activePlanIds.has(plan.id);
					const inProgress = inProgressPlanIds.has(plan.id);
					return <article key={plan.id} className="flex min-h-[350px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
						<div className="border-b border-stone-100 bg-[#f4f6f1] p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60775c]">{billingIntervalNames[effectiveInterval]} billing</p><h3 className="mt-1 text-xl font-extrabold tracking-tight text-[#263b2d]">{plan.name}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-stone-600">{plan.description || selectedProduct.description}</p></div>
						<div className="flex flex-1 flex-col p-5"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Recurring price</p><p className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900">{formatCurrency(Number(plan.priceInPaise))}</p><p className="text-xs font-medium text-stone-500">{intervalLabel(plan.billingInterval, plan.intervalCount || 1)}</p></div><ul className="mt-5 flex-1 space-y-3">{(planFeatureList(plan.description).length ? planFeatureList(plan.description) : ["Plan features confirmed during onboarding"]).map((feature) => <li key={feature} className="flex items-start gap-2.5 text-xs leading-5 text-stone-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#526d4f]" /><span>{feature}</span></li>)}</ul><button type="button" disabled={catalogIsDemo || active || inProgress || workingPlanId !== null} onClick={() => onChoosePlan(plan)} className={`mt-6 w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${active || inProgress ? "bg-stone-400" : "bg-[#263b2d] hover:bg-[#344d39]"}`}>{active ? "Active plan" : inProgress ? "Processing" : workingPlanId === plan.id ? "Loading…" : `Choose ${plan.name}`}</button></div>
					</article>;
				})}</div>
				<p className="mt-5 text-center text-[11px] text-stone-500">Taxes, if applicable, are calculated during billing.</p>
			</> : <>
				<div className="mb-5 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-lg font-bold text-[#263b2d]">Products</h3><p className="mt-1 text-xs text-stone-500">Select a product to compare its plans and billing terms.</p></div><span className="rounded-full bg-[#e9eee5] px-3 py-1 text-[11px] font-semibold text-[#425b3f]">{products.length} products</span></div>
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <button key={product.id} type="button" onClick={() => onSelectProduct(product.id)} className="group flex min-h-48 flex-col rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#bdcbb7] hover:shadow-md"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9eee5] text-[#425b3f]"><Package size={21}/></span><span className="mt-4 text-base font-bold text-stone-900">{product.name}</span><span className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{product.description || "Explore plans and billing options for this product."}</span><span className="mt-auto flex w-full items-center justify-between pt-5 text-xs font-semibold text-[#425b3f]"><span>{new Set(product.plans.map((plan) => plan.name)).size} plans · {product.plans.length} billing options</span><ArrowRight size={15} className="transition group-hover:translate-x-1" /></span></button>)}</div>
			</>}
		</div>
	</section>;
}

export function Portal({ catalogOnly = false }: PortalProps) {
	const [overview, setOverview] = useState<PortalOverview | null>(null);
	const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [catalogError, setCatalogError] = useState("");
	const [catalogIsDemo, setCatalogIsDemo] = useState(false);
	const [notice, setNotice] = useState("");
	const [workingPlanId, setWorkingPlanId] = useState<string | null>(null);
	const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
	const [checkoutVariantId, setCheckoutVariantId] = useState("");
	const [checkoutQuantity, setCheckoutQuantity] = useState(1);
	const [discountCode, setDiscountCode] = useState("");
	const [purchaseNumber, setPurchaseNumber] = useState("");
	const [purchaseInvoice, setPurchaseInvoice] = useState<any | null>(null);
	const [upiInvoice, setUpiInvoice] = useState<any | null>(null);
	const [utrNumber, setUtrNumber] = useState("");
	const [paymentAmountRupees, setPaymentAmountRupees] = useState("");
	const [paymentClaims, setPaymentClaims] = useState<any[]>([]);
	const [claimSubmitting, setClaimSubmitting] = useState(false);
	const [claimMsg, setClaimMsg] = useState("");
	const [claimError, setClaimError] = useState("");
	const [selectedBillingInterval, setSelectedBillingInterval] = useState<BillingInterval>("monthly");
	const [selectedProductId, setSelectedProductId] = useState("");

	async function handleClaimSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!upiInvoice || !utrNumber.trim()) return;
		const duePaise = Number(upiInvoice.balanceDuePaise ?? upiInvoice.outstandingInPaise ?? upiInvoice.totalPaise ?? upiInvoice.totalInPaise ?? 0);
		const amountRupees = Number(paymentAmountRupees);
		if (!Number.isFinite(amountRupees) || amountRupees <= 0 || Math.round(amountRupees * 100) > duePaise) {
			setClaimError("Enter an amount above zero and no greater than the outstanding balance.");
			return;
		}
		setClaimSubmitting(true);
		setClaimMsg("");
		setClaimError("");
		try {
			await submitPaymentClaim({
				invoiceId: upiInvoice.id,
				utrNumber: utrNumber.trim(),
				amountRupees,
				notes: `Customer self-service UPI payment claim for ${upiInvoice.invoiceNumber || upiInvoice.number || upiInvoice.id}`,
			});
			setClaimMsg("Payment submitted. Staff will verify the transfer and enable the plan, usually within 5–10 minutes.");
			setTimeout(() => {
				setUpiInvoice(null);
				setUtrNumber("");
				setClaimMsg("");
				void load();
			}, 2000);
		} catch (cause: any) {
			setError(cause instanceof Error ? cause.message : "Could not submit payment claim.");
		} finally {
			setClaimSubmitting(false);
		}
	}

	async function load() {
		setError("");
		setCatalogError("");
		setLoading(true);
		const [overviewResult, plansResult, claimsResult] = await Promise.allSettled([getPortalOverview(), getPlans(), getPaymentClaims()]);
		if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
		else setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : "Could not load your account.");
		if (claimsResult.status === "fulfilled") setPaymentClaims(Array.isArray(claimsResult.value) ? claimsResult.value : []);
		if (plansResult.status === "fulfilled" && plansResult.value.length > 0) {
			setPlans(plansResult.value);
			setCatalogIsDemo(false);
		} else {
			setPlans(offlineDemoPlans);
			setCatalogIsDemo(true);
			if (plansResult.status === "rejected") setCatalogError("Showing a local demo catalog preview. These sample plans are not stored in the database; connect the backend and seed its catalog to enable requests.");
			else setCatalogError("Showing a local demo catalog preview. Seed the database catalog to enable subscription requests.");
		}
		setLoading(false);
	}

	useEffect(() => { void load(); }, []);

	async function handleAccept(quotationId: string) {
		setNotice("");
		try {
			await acceptQuotation(quotationId);
			setNotice("Quotation accepted.");
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not accept this quotation.");
		}
	}

	async function handleReject(quotationId: string) {
		setNotice("");
		try {
			await rejectQuotation(quotationId);
			setNotice("Quotation declined.");
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not decline this quotation.");
		}
	}

	function beginCheckout(plan: SubscriptionPlan) {
		setCheckoutPlan(plan);
		setCheckoutVariantId("");
		setCheckoutQuantity(Math.max(1, plan.minimumQuantity || 1));
		setDiscountCode("");
		setPurchaseNumber("");
		setPurchaseInvoice(null);
		setError("");
		setNotice("");
	}

	async function completePurchase(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!checkoutPlan || !overview || catalogIsDemo) return;
		setWorkingPlanId(checkoutPlan.id);
		setError("");
		setNotice("");
		try {
			const subscription = await createSubscription({ planId: checkoutPlan.id, variantId: checkoutVariantId || undefined, quantity: checkoutQuantity, discountCode: discountCode.trim() || undefined });
			setPurchaseNumber(subscription.subscriptionNumber || subscription.id);
			setPurchaseInvoice(subscription.invoices?.[0] || null);
			setNotice("Your subscription is confirmed and the invoice is ready. After you pay, staff verifies the transfer and enables your plan, usually within 5–10 minutes.");
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not submit this subscription order.");
		} finally {
			setWorkingPlanId(null);
		}
	}

	if (loading) return <section className="flex min-h-72 items-center justify-center text-sm font-medium text-stone-500"><RefreshCw size={16} className="mr-2 animate-spin" />Loading your account…</section>;
	if (error && !overview) return <section className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</section>;
	if (!overview) return null;

	const outstanding = overview.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDuePaise ?? invoice.outstandingInPaise ?? 0), 0);
	const planIdsForStatus = (statuses: string[]) => new Set(overview.subscriptions.filter((subscription) => statuses.includes(subscription.status)).flatMap((subscription) => (subscription.items || []).map((item: any) => item.plan?.id || item.planId).filter(Boolean)));
	const activePlanIds = planIdsForStatus(["active"]);
	const inProgressPlanIds = planIdsForStatus(["draft", "quotation", "confirmed"]);
	const openInvoices = overview.invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled");
	const checkoutVariant = checkoutPlan?.productVariants?.find((variant) => variant.id === checkoutVariantId);
	const checkoutUnitPrice = Number(checkoutPlan?.priceInPaise || 0) + Number(checkoutVariant?.priceAdjustmentInPaise ?? checkoutVariant?.priceInPaise ?? 0);

	const productMap = new Map<string, CatalogProduct>();
	for (const plan of plans) {
		const productId = plan.productId || `product-${plan.productName || plan.name}`;
		const product = productMap.get(productId);
		if (product) product.plans.push(plan);
		else productMap.set(productId, { id: productId, name: plan.productName || plan.name, description: plan.productDescription || plan.description || "", variants: plan.productVariants || [], plans: [plan] });
	}
	const catalogProducts = [...productMap.values()].sort((left, right) => left.name.localeCompare(right.name));
	const catalogSection = <ProductCatalog products={catalogProducts} selectedProductId={selectedProductId} onSelectProduct={setSelectedProductId} selectedInterval={selectedBillingInterval} onIntervalChange={setSelectedBillingInterval} catalogError={catalogError} catalogIsDemo={catalogIsDemo} activePlanIds={activePlanIds} inProgressPlanIds={inProgressPlanIds} workingPlanId={workingPlanId} onChoosePlan={beginCheckout} />;

const checkoutDialog = checkoutPlan && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !purchaseNumber) setCheckoutPlan(null); }}>
		<div role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="w-full max-w-lg rounded-2xl border border-stone-200 bg-[#fffefa] p-5 shadow-2xl sm:p-7">
			<div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60775c]">Subscription checkout</p><h2 id="checkout-title" className="mt-1 text-xl font-bold text-stone-900">{purchaseNumber ? "Order submitted" : "Confirm your plan"}</h2></div>{!purchaseNumber && <button type="button" aria-label="Close checkout" onClick={() => setCheckoutPlan(null)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><X size={18} /></button>}</div>
			{purchaseNumber ? <div className="mt-5 space-y-4"><div className="rounded-xl border border-[#dce5d8] bg-[#f4f7f1] p-4"><p className="text-sm font-semibold text-[#344a35]">Subscription {purchaseNumber}</p><p className="mt-1 text-xs leading-5 text-stone-600">An invoice has been generated. After payment is verified, staff enables your plan, usually within 5–10 minutes.</p>{purchaseInvoice && <p className="mt-2 text-xs font-semibold text-[#344a35]">Invoice {purchaseInvoice.number}: {formatCurrency(Number(purchaseInvoice.totalPaise))} due</p>}</div>{purchaseInvoice && Number(purchaseInvoice.balanceDuePaise ?? purchaseInvoice.totalPaise ?? 0) > 0 && <button type="button" onClick={() => { const due = Number(purchaseInvoice.balanceDuePaise ?? purchaseInvoice.totalPaise ?? 0); setUpiInvoice(purchaseInvoice); setPaymentAmountRupees((due / 100).toFixed(2)); setUtrNumber(""); setClaimMsg(""); setClaimError(""); setCheckoutPlan(null); }} className="w-full rounded-xl bg-[#263b2d] px-4 py-3 text-sm font-bold text-white hover:bg-[#344d39]"><QrCode size={15} className="mr-2 inline"/>Pay invoice via UPI</button>}<button type="button" onClick={() => setCheckoutPlan(null)} className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Done</button></div> : <form onSubmit={(event) => void completePurchase(event)} className="mt-5 space-y-4">
				<div className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">{checkoutPlan.productName}</p><p className="mt-1 font-bold text-stone-900">{checkoutPlan.name}</p><p className="mt-1 text-xs text-stone-500">{checkoutPlan.description || checkoutPlan.productDescription}</p></div>
				{checkoutPlan.productVariants?.length ? <label className="block"><span className="text-xs font-semibold text-stone-700">Brand or add-on <span className="font-normal text-stone-400">(optional)</span></span><select value={checkoutVariantId} onChange={(event) => setCheckoutVariantId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#71866b]"><option value="">No add-on</option>{checkoutPlan.productVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · +{formatCurrency(Number(variant.priceAdjustmentInPaise ?? variant.priceInPaise))} / {intervalLabel(checkoutPlan.billingInterval, checkoutPlan.intervalCount || 1)}</option>)}</select><span className="mt-1 block text-[11px] text-stone-500">The selected add-on is added to each billing interval.</span></label> : null}
				<label className="block"><span className="text-xs font-semibold text-stone-700">Quantity</span><input type="number" min={checkoutPlan.minimumQuantity || 1} max="100" step="1" required value={checkoutQuantity} onChange={(event) => setCheckoutQuantity(Math.max(checkoutPlan.minimumQuantity || 1, Math.min(100, Number(event.target.value) || 1)))} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#71866b]" /></label>
				<label className="block"><span className="text-xs font-semibold text-stone-700">Discount code <span className="font-normal text-stone-400">(optional)</span></span><input type="text" autoComplete="off" value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} placeholder="Enter a discount code" className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm uppercase outline-none focus:border-[#71866b]" /></label>
				<div className="space-y-2 rounded-xl bg-[#f4f6f1] p-4 text-sm"><div className="flex justify-between text-stone-600"><span>Plan price</span><span>{formatCurrency(Number(checkoutPlan.priceInPaise))} {intervalLabel(checkoutPlan.billingInterval, checkoutPlan.intervalCount || 1)}</span></div>{checkoutVariant && <div className="flex justify-between text-stone-600"><span>{checkoutVariant.name} add-on</span><span>+{formatCurrency(Number(checkoutVariant.priceAdjustmentInPaise ?? checkoutVariant.priceInPaise))}</span></div>}<div className="flex justify-between text-stone-600"><span>Quantity</span><span>{checkoutQuantity}</span></div><div className="flex justify-between border-t border-stone-200 pt-2 font-bold text-stone-900"><span>Recurring subtotal</span><span>{formatCurrency(checkoutUnitPrice * checkoutQuantity)} / {intervalLabel(checkoutPlan.billingInterval, checkoutPlan.intervalCount || 1)}</span></div><p className="text-[11px] leading-4 text-stone-500">Taxes and discounts, if applicable, are calculated by the server when billing generates an invoice.</p></div>
				{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
				<div className="flex gap-3"><button type="button" onClick={() => setCheckoutPlan(null)} className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Cancel</button><button type="submit" disabled={workingPlanId !== null} className="flex-1 rounded-xl bg-[#263b2d] px-4 py-3 text-sm font-bold text-white hover:bg-[#344d39] disabled:opacity-60"><ShoppingBag size={15} className="mr-2 inline" />{workingPlanId ? "Submitting…" : "Confirm subscription"}</button></div>
			</form>}
		</div>
	</div>;

	if (catalogOnly) return <><section className="mx-auto max-w-6xl space-y-6 p-4 md:p-6"><header className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-stone-900">Browse products</h1><p className="mt-1 text-sm text-stone-500">Choose a product first to see its plans.</p></div><Link to="/portal" className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">My dashboard</Link></header>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-xl border border-[#dce5d8] bg-[#edf1e9] p-3 text-sm text-[#425b3f]">{notice}</p>}{catalogSection}</section>{checkoutDialog}</>;

	return <><section className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
		<header><h1 className="text-2xl font-bold text-slate-900">Welcome, {overview.customer.name}</h1><p className="text-sm text-slate-500">Your Brightloop Billing account overview.</p></header>
		{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		{notice && <p role="status" className="rounded-xl border border-[#dce5d8] bg-[#edf1e9] p-3 text-sm text-[#425b3f]">{notice}</p>}
		{catalogSection}
		<details className="rounded-2xl border border-stone-200 bg-white p-5">
			<summary className="cursor-pointer list-none font-semibold text-stone-800">My billing activity <span className="ml-2 text-xs font-normal text-stone-500">Subscriptions, invoices, quotations, and payments</span></summary>
			<div className="mt-5 space-y-5">
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Active subscriptions</p><p className="mt-2 text-2xl font-bold">{overview.subscriptions.filter((subscription) => subscription.status === "active").length}</p></div>
			<div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Open invoices</p><p className="mt-2 text-2xl font-bold">{openInvoices.length}</p></div>
			<div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Outstanding</p><p className="mt-2 text-2xl font-bold">{formatCurrency(outstanding)}</p></div>
			<div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Available products</p><p className="mt-2 text-2xl font-bold">{catalogProducts.length}</p><Link to="/portal/catalog" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#526d4f]">Browse products <ArrowRight size={12} /></Link></div>
		</div>
		<div className="rounded-2xl border border-stone-200 bg-white p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Subscriptions</h2><span className="text-xs text-stone-500">{overview.subscriptions.length} total</span></div>{overview.subscriptions.length === 0 ? <p className="text-sm text-stone-500">No subscription requests yet. Choose a product above to explore its plans.</p> : <ul className="divide-y divide-stone-100">{overview.subscriptions.map((subscription) => <li key={subscription.id} className="flex flex-wrap justify-between gap-3 py-3"><span className="font-medium">{subscription.items?.map((item: any) => item.description).join(", ") || subscription.number || subscription.id}</span><span className="text-sm capitalize text-stone-500">{subscription.status} · next billing {subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : "pending confirmation"}</span></li>)}</ul>}</div>
		<div className="rounded-2xl border border-stone-200 bg-white p-5">
			<h2 className="mb-3 font-semibold">Invoices</h2>
			{overview.invoices.length === 0 ? (
				<p className="text-sm text-stone-500">No invoices yet. Invoices appear here after a subscription is activated and billed.</p>
			) : (
				<div className="divide-y divide-stone-100">
					{overview.invoices.map((invoice) => {
						const isPaid = invoice.status === "paid";
						const due = Number(invoice.balanceDuePaise ?? invoice.outstandingInPaise ?? invoice.totalPaise ?? invoice.totalInPaise ?? 0);
						return (
							<div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
								<div>
									<span className="font-semibold text-stone-900">{invoice.invoiceNumber || invoice.number || invoice.id}</span>
									<span className={`ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
										{invoice.status}
									</span>
									<span className="ml-3 text-xs text-stone-500">Due: {invoice.dueDate ? formatDate(invoice.dueDate) : "N/A"}</span>
								</div>
								<div className="flex items-center gap-3">
									<span className="font-semibold text-stone-900">{formatCurrency(due)}</span>
									{!isPaid && (
										<button
											type="button"
											onClick={() => {
												setUpiInvoice(invoice);
												setUtrNumber("");
												setClaimMsg("");
								setClaimError("");
								setPaymentAmountRupees((due / 100).toFixed(2));
											}}
											className="inline-flex items-center gap-1.5 rounded-lg bg-[#263b2d] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#344d39]"
										>
											<QrCode size={13} /> Pay via UPI QR
										</button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
		<div className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="mb-1 font-semibold">Quotations</h2>{overview.quotations.length === 0 ? <p className="mt-3 text-sm text-stone-500">No quotations yet.</p> : <ul className="divide-y divide-stone-100">{overview.quotations.map((quote) => <li key={quote.id} className="flex flex-wrap items-center justify-between gap-4 py-3"><span>{quote.number} <span className="ml-2 text-sm capitalize text-stone-500">{quote.status}</span></span><span>{formatCurrency(Number(quote.totalPaise))} · valid until {formatDate(quote.validUntil)}</span>{quote.status === "sent" && <span className="flex gap-2"><button onClick={() => void handleAccept(quote.id)} className="rounded-lg bg-[#263b2d] px-3 py-2 text-xs font-bold text-white">Accept</button><button onClick={() => void handleReject(quote.id)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">Decline</button></span>}</li>)}</ul>}</div>
		<div className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="mb-3 font-semibold">Payments</h2>{overview.payments.length === 0 ? <p className="text-sm text-stone-500">No verified payments recorded yet.</p> : <ul className="divide-y divide-stone-100">{overview.payments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-3 py-3"><span>{payment.reference || payment.id} · {payment.method}</span><span>{formatCurrency(Number(payment.amountPaise || payment.amountInPaise || 0))} · {formatDate(payment.receivedAt || payment.paymentDate || "")}</span></li>)}</ul>}</div>
		<div className="rounded-2xl border border-stone-200 bg-white p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Payment verification</h2><span className="text-xs text-stone-500">{paymentClaims.filter((claim) => claim.status === "pending").length} pending</span></div><p className="mb-3 text-xs text-stone-500">Staff verifies your transfer and enables fully paid plans, usually within 5–10 minutes.</p>{paymentClaims.length === 0 ? <p className="text-sm text-stone-500">No payment claims submitted.</p> : <ul className="divide-y divide-stone-100">{paymentClaims.map((claim) => { const displayStatus = claim.status === "verified" && claim.subscriptionStatus === "confirmed" ? "Verified · activation pending" : claim.status === "verified" && claim.subscriptionStatus === "active" ? "Plan enabled" : claim.status || "pending"; return <li key={claim.claimId || claim.id} className="flex flex-wrap justify-between gap-3 py-3"><span className="text-sm">{claim.invoiceNumber} · UTR {claim.reference}</span><span className="text-right text-sm">{formatCurrency(Number(claim.amountPaise || 0))}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${claim.status === "verified" ? "bg-emerald-100 text-emerald-800" : claim.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{displayStatus}</span></span></li>; })}</ul>}</div>
			</div>
		</details>
	</section>
	{checkoutDialog}
	{upiInvoice && (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setUpiInvoice(null); }}>
			<div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60775c]">UPI Instant Payment</p>
						<h2 className="mt-1 text-lg font-bold text-stone-900">Scan QR Code to Pay</h2>
					</div>
					<button type="button" onClick={() => setUpiInvoice(null)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
				</div>

				<div className="flex flex-col items-center justify-center p-4 bg-stone-50 rounded-xl border border-dashed border-stone-300 text-center">
					<p className="text-xs text-stone-600 mb-2 font-medium">Scan using any UPI App (GPay, PhonePe, Paytm)</p>
					<img
						src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=billing@brightloop.io&pn=Brightloop+Billing&am=${Number(paymentAmountRupees || 0).toFixed(2)}&cu=INR&tn=${upiInvoice.invoiceNumber || upiInvoice.number || upiInvoice.id}`)}`}
						alt="UPI QR Code"
						className="w-40 h-40 border p-1 bg-white rounded-lg shadow-sm"
					/>
					<div className="mt-2 text-center">
						<span className="text-xs font-mono font-bold text-stone-800">billing@brightloop.io</span>
						<p className="text-xs text-stone-500 mt-0.5">QR amount: <strong className="text-stone-900">{formatCurrency(Math.round(Number(paymentAmountRupees || 0) * 100))}</strong></p>
					</div>
				</div>

				{claimMsg ? (
					<div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-medium">
						{claimMsg}
					</div>
				) : (
					<form onSubmit={handleClaimSubmit} className="space-y-3">
						{claimError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">{claimError}</p>}
						<div>
							<label className="block text-xs font-semibold text-stone-700 mb-1">Payment amount (₹)</label>
							<input type="number" min="0.01" step="0.01" max={(Number(upiInvoice.balanceDuePaise ?? upiInvoice.outstandingInPaise ?? upiInvoice.totalPaise ?? upiInvoice.totalInPaise ?? 0) / 100).toFixed(2)} required value={paymentAmountRupees} onChange={(event) => { setPaymentAmountRupees(event.target.value); setClaimError(""); }} className="w-full rounded-lg border border-stone-300 p-2 text-sm focus:border-[#71866b] focus:outline-none" />
							<p className="mt-1 text-[11px] text-stone-400">Outstanding balance: {formatCurrency(Number(upiInvoice.balanceDuePaise ?? upiInvoice.outstandingInPaise ?? upiInvoice.totalPaise ?? upiInvoice.totalInPaise ?? 0))}. You may make a partial payment.</p>
						</div>
						<div>
							<label className="block text-xs font-semibold text-stone-700 mb-1">
								UTR / Transaction Reference Number
							</label>
							<input
								type="text"
								required
								placeholder="e.g. 123456789012 or UTR-98765"
								value={utrNumber}
								onChange={(e) => setUtrNumber(e.target.value)}
								className="w-full rounded-lg border border-stone-300 p-2 text-sm font-mono focus:border-[#71866b] focus:outline-none"
							/>
							<p className="text-[11px] text-stone-400 mt-1">Found in your UPI app receipt after making payment.</p>
						</div>
						<div className="flex gap-2 pt-2">
							<button
								type="button"
								onClick={() => setUpiInvoice(null)}
								className="flex-1 rounded-xl border border-stone-200 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={claimSubmitting || !utrNumber.trim()}
								className="flex-1 rounded-xl bg-[#263b2d] py-2.5 text-xs font-bold text-white hover:bg-[#344d39] disabled:opacity-50"
							>
								{claimSubmitting ? "Submitting..." : "Submit Claim"}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	)}
</>;
}

export default Portal;
