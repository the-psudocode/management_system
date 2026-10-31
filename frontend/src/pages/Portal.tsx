import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Layers3, Package, RefreshCw } from "lucide-react";
import { acceptQuotation, createSubscription, getPlans, getPortalOverview } from "../services/api";
import type { PortalOverview, SubscriptionPlan } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

type PortalProps = { catalogOnly?: boolean };

const offlineDemoPlans: SubscriptionPlan[] = [
	{ id: "demo-web-starter", name: "Starter", description: "Responsive business website, hosting setup, and up to 2 content updates each month.", productId: "demo-web", productName: "Brightloop Web Development", productDescription: "Managed website development and continuous improvement.", priceInPaise: 499900, amountPaise: 499900, billingInterval: "monthly", minimumQuantity: 1, trialDays: 0, isActive: true, status: "active" },
	{ id: "demo-web-pro", name: "Professional", description: "Custom website, analytics integration, priority updates, and monthly performance review.", productId: "demo-web", productName: "Brightloop Web Development", productDescription: "Managed website development and continuous improvement.", priceInPaise: 999900, amountPaise: 999900, billingInterval: "monthly", minimumQuantity: 1, trialDays: 0, isActive: true, status: "active" },
	{ id: "demo-cloud-basic", name: "Basic", description: "Single site, SSL, daily backups, and uptime monitoring.", productId: "demo-cloud", productName: "Brightloop Cloud Hosting", productDescription: "Managed hosting with SSL, automated backups, and scalable resources.", priceInPaise: 49900, amountPaise: 49900, billingInterval: "monthly", minimumQuantity: 1, trialDays: 0, isActive: true, status: "active" },
	{ id: "demo-cloud-business", name: "Business", description: "Multiple sites, expanded resources, priority support, and hourly backups.", productId: "demo-cloud", productName: "Brightloop Cloud Hosting", productDescription: "Managed hosting with SSL, automated backups, and scalable resources.", priceInPaise: 149900, amountPaise: 149900, billingInterval: "monthly", minimumQuantity: 1, trialDays: 0, isActive: true, status: "active" },
	{ id: "demo-email-standard", name: "Standard", description: "One business mailbox, custom domain, spam filtering, and calendar sync.", productId: "demo-email", productName: "Brightloop Business Email", productDescription: "Business email hosting for your custom domain.", priceInPaise: 19900, amountPaise: 19900, billingInterval: "monthly", minimumQuantity: 1, trialDays: 0, isActive: true, status: "active" },
	{ id: "demo-security-essential", name: "Essential", description: "Continuous monitoring, vulnerability scans, incident alerts, and monthly report.", productId: "demo-security", productName: "Brightloop Cybersecurity Monitoring", productDescription: "Continuous monitoring and practical security alerts.", priceInPaise: 299900, amountPaise: 299900, billingInterval: "monthly", minimumQuantity: 1, trialDays: 0, isActive: true, status: "active" },
	{ id: "demo-database-standard", name: "Standard", description: "Daily backups, health monitoring, performance checks, and recovery assistance.", productId: "demo-database", productName: "Brightloop Database Management", productDescription: "Managed database care and recovery planning.", priceInPaise: 199900, amountPaise: 199900, billingInterval: "monthly", minimumQuantity: 1, trialDays: 0, isActive: true, status: "active" },
	{ id: "demo-maintenance-premium", name: "Premium", description: "Security updates, monthly maintenance, issue triage, and priority support.", productId: "demo-maintenance", productName: "Brightloop Software Maintenance", productDescription: "Keep business software secure and reliable.", priceInPaise: 399900, amountPaise: 399900, billingInterval: "monthly", minimumQuantity: 1, trialDays: 0, isActive: true, status: "active" },
];

function intervalLabel(interval: string, count = 1) {
	const labels: Record<string, string> = { daily: "day", weekly: "week", monthly: "month", quarterly: "quarter", yearly: "year" };
	const unit = labels[interval] || interval;
	return count > 1 ? `every ${count} ${unit}s` : `per ${unit}`;
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

	async function load() {
		setError("");
		setCatalogError("");
		setLoading(true);
		const [overviewResult, plansResult] = await Promise.allSettled([getPortalOverview(), getPlans()]);
		if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
		else setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : "Could not load your account.");
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

	async function handlePlanRequest(plan: SubscriptionPlan) {
		if (!overview || catalogIsDemo) return;
		setWorkingPlanId(plan.id);
		setError("");
		setNotice("");
		try {
			await createSubscription({
				customerId: overview.customer.id,
				planId: plan.id,
				quantity: plan.minimumQuantity || 1,
			});
			setNotice(`Your request for ${plan.productName} · ${plan.name} was sent to the Brightloop team.`);
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not request this plan.");
		} finally {
			setWorkingPlanId(null);
		}
	}

	if (loading) return <section className="flex min-h-72 items-center justify-center text-sm font-medium text-stone-500"><RefreshCw size={16} className="mr-2 animate-spin" />Loading your account…</section>;
	if (error && !overview) return <section className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</section>;
	if (!overview) return null;

	const outstanding = overview.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDuePaise ?? invoice.outstandingInPaise ?? 0), 0);
	const openSubscriptions = overview.subscriptions.filter((subscription) => subscription.status !== "closed");
	const requestedPlanIds = new Set(openSubscriptions.flatMap((subscription) => (subscription.items || []).map((item: any) => item.plan?.id || item.planId).filter(Boolean)));
	const openInvoices = overview.invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled");

	const catalogSection = <section id="catalog" className="space-y-4">
		<div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60775c]">Catalog</p><h2 className="mt-1 text-xl font-bold tracking-tight text-stone-900">Products & services</h2><p className="mt-1 text-sm text-stone-500">Choose a plan and send a subscription request to our team.</p></div>{!catalogOnly && <Link to="/portal/catalog" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#425b3f] hover:bg-[#edf1e9]">Browse all plans <ArrowRight size={14} /></Link>}</div>
		{catalogError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{catalogError}</p>}
		{plans.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{plans.map((plan) => {
			const requested = requestedPlanIds.has(plan.id);
			return <article key={plan.id} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_5px_22px_rgba(30,40,30,.04)]">
				<div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf1e9] text-[#526d4f]"><Package size={19} /></span><span className="rounded-full bg-[#f4f6f1] px-2.5 py-1 text-[10px] font-semibold capitalize text-stone-600">{plan.productName || "Service"}</span></div>
				<h3 className="mt-4 text-base font-bold text-stone-900">{plan.name}</h3>
				<p className="mt-1 min-h-10 text-xs leading-5 text-stone-500">{plan.description || plan.productDescription || "Subscription service from Brightloop."}</p>
				<div className="mt-4 flex items-baseline gap-1"><span className="text-2xl font-extrabold tracking-tight text-stone-900">{formatCurrency(Number(plan.priceInPaise))}</span><span className="text-xs text-stone-500">{intervalLabel(plan.billingInterval)}</span></div>
				{(plan.minimumQuantity || 1) > 1 && <p className="mt-2 text-[11px] text-stone-500">Minimum quantity: {plan.minimumQuantity}</p>}
				<button type="button" disabled={catalogIsDemo || requested || workingPlanId !== null} onClick={() => void handlePlanRequest(plan)} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${requested ? "border border-[#dce5d8] bg-[#f4f7f1] text-[#526d4f]" : "bg-[#263b2d] text-white hover:bg-[#344d39]"}`}>
					{catalogIsDemo ? "Demo preview only" : requested ? <><Check size={14} /> Request sent</> : workingPlanId === plan.id ? "Sending request…" : <>Request this plan <ArrowRight size={14} /> </>}
				</button>
			</article>;
		})}</div> : !catalogError && <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf1e9] text-[#526d4f]"><Layers3 size={19} /></span><h3 className="mt-3 text-sm font-bold text-stone-800">No plans are published yet</h3><p className="mt-1 text-xs text-stone-500">The Brightloop team is preparing the catalog. Check back soon.</p></div>}
	</section>;

	if (catalogOnly) return <section className="mx-auto max-w-6xl space-y-6 p-4 md:p-6"><header className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-stone-900">Browse plans</h1><p className="mt-1 text-sm text-stone-500">Explore services available for your account.</p></div><Link to="/portal" className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">My dashboard</Link></header>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-xl border border-[#dce5d8] bg-[#edf1e9] p-3 text-sm text-[#425b3f]">{notice}</p>}{catalogSection}</section>;

	return <section className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
		<header><h1 className="text-2xl font-bold text-slate-900">Welcome, {overview.customer.name}</h1><p className="text-sm text-slate-500">Your Brightloop Billing account overview.</p></header>
		{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		{notice && <p role="status" className="rounded-xl border border-[#dce5d8] bg-[#edf1e9] p-3 text-sm text-[#425b3f]">{notice}</p>}
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Active subscriptions</p><p className="mt-2 text-2xl font-bold">{overview.subscriptions.filter((subscription) => subscription.status === "active").length}</p></div>
			<div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Open invoices</p><p className="mt-2 text-2xl font-bold">{openInvoices.length}</p></div>
			<div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Outstanding</p><p className="mt-2 text-2xl font-bold">{formatCurrency(outstanding)}</p></div>
			<div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Available plans</p><p className="mt-2 text-2xl font-bold">{plans.length}</p><Link to="/portal/catalog" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#526d4f]">Explore catalog <ArrowRight size={12} /></Link></div>
		</div>
		{catalogSection}
		<div className="rounded-2xl border border-stone-200 bg-white p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Subscriptions</h2><span className="text-xs text-stone-500">{overview.subscriptions.length} total</span></div>{overview.subscriptions.length === 0 ? <p className="text-sm text-stone-500">No subscription requests yet. Browse the catalog above to get started.</p> : <ul className="divide-y divide-stone-100">{overview.subscriptions.map((subscription) => <li key={subscription.id} className="flex flex-wrap justify-between gap-3 py-3"><span className="font-medium">{subscription.items?.map((item: any) => item.description).join(", ") || subscription.number || subscription.id}</span><span className="text-sm capitalize text-stone-500">{subscription.status} · next billing {subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : "pending confirmation"}</span></li>)}</ul>}</div>
		<div className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="mb-3 font-semibold">Invoices</h2>{overview.invoices.length === 0 ? <p className="text-sm text-stone-500">No invoices yet. Invoices appear here after a subscription is activated and billed.</p> : <div className="divide-y divide-stone-100">{overview.invoices.map((invoice) => <div key={invoice.id} className="flex flex-wrap justify-between gap-3 py-3"><span>{invoice.invoiceNumber || invoice.number || invoice.id} <span className="ml-2 text-sm capitalize text-stone-500">{invoice.status}</span></span><span className="font-semibold">{formatCurrency(Number(invoice.totalInPaise ?? invoice.totalPaise ?? 0))}</span></div>)}</div>}</div>
		<div className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="mb-1 font-semibold">Quotations</h2>{overview.quotations.length === 0 ? <p className="mt-3 text-sm text-stone-500">No quotations yet.</p> : <ul className="divide-y divide-stone-100">{overview.quotations.map((quote) => <li key={quote.id} className="flex flex-wrap items-center justify-between gap-4 py-3"><span>{quote.number} <span className="ml-2 text-sm capitalize text-stone-500">{quote.status}</span></span><span>{formatCurrency(Number(quote.totalPaise))} · valid until {formatDate(quote.validUntil)}</span>{quote.status === "sent" && <button onClick={() => void handleAccept(quote.id)} className="rounded-lg bg-[#263b2d] px-3 py-2 text-xs font-bold text-white">Accept quotation</button>}</li>)}</ul>}</div>
		<div className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="mb-3 font-semibold">Payments</h2>{overview.payments.length === 0 ? <p className="text-sm text-stone-500">No payments recorded.</p> : <ul className="divide-y divide-stone-100">{overview.payments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-3 py-3"><span>{payment.reference || payment.id} · {payment.method}</span><span>{formatCurrency(Number(payment.amountPaise || payment.amountInPaise || 0))} · {formatDate(payment.receivedAt || payment.paymentDate || "")}</span></li>)}</ul>}</div>
	</section>;
}

export default Portal;
