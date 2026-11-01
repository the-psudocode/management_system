import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, ExternalLink, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { getInvoices, getPaymentClaims, getSubscriptions, updateSubscriptionStatus } from "../services/api";
import type { Invoice, Subscription } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

type QueueTab = "review" | "enabled" | "closed";
const panel = "rounded-2xl border border-stone-200 bg-white shadow-sm";

export function SubscriptionRequests() {
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
	const [invoices, setInvoices] = useState<Invoice[]>([]);
	const [claims, setClaims] = useState<any[]>([]);
	const [tab, setTab] = useState<QueueTab>("review");
	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(true);
	const [workingId, setWorkingId] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const load = useCallback(async () => {
		setLoading(true); setError("");
		const [subsResult, invoicesResult, claimsResult] = await Promise.allSettled([
			getSubscriptions(1, 100), getInvoices(), getPaymentClaims(),
		]);
		if (subsResult.status === "fulfilled") setSubscriptions(subsResult.value.data);
		else setError(subsResult.reason instanceof Error ? subsResult.reason.message : "Could not load subscription requests.");
		if (invoicesResult.status === "fulfilled") setInvoices(invoicesResult.value);
		if (claimsResult.status === "fulfilled") setClaims(claimsResult.value);
		setLoading(false);
	}, []);

	useEffect(() => { void load(); }, [load]);

	const invoicesBySubscription = useMemo(() => {
		const groups = new Map<string, Invoice[]>();
		for (const invoice of invoices) {
			if (!invoice.subscriptionId) continue;
			groups.set(invoice.subscriptionId, [...(groups.get(invoice.subscriptionId) || []), invoice]);
		}
		return groups;
	}, [invoices]);

	const counts = {
		review: subscriptions.filter((sub) => ["draft", "quotation", "confirmed"].includes(sub.status)).length,
		enabled: subscriptions.filter((sub) => sub.status === "active").length,
		closed: subscriptions.filter((sub) => sub.status === "closed").length,
	};
	const visible = subscriptions.filter((sub) => {
		const matchTab = tab === "review" ? ["draft", "quotation", "confirmed"].includes(sub.status) : tab === "enabled" ? sub.status === "active" : sub.status === "closed";
		const text = `${sub.customerName} ${sub.planName} ${sub.subscriptionNumber || sub.number || ""}`.toLowerCase();
		return matchTab && text.includes(query.trim().toLowerCase());
	});

	async function enable(sub: Subscription) {
		setWorkingId(sub.id); setError(""); setNotice("");
		try {
			await updateSubscriptionStatus(sub.id, "active");
			setNotice(`Plan enabled for ${sub.customerName}.`);
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not enable the subscription.");
		} finally { setWorkingId(null); }
	}

	function getPaymentState(sub: Subscription) {
		const subscriptionInvoices = invoicesBySubscription.get(sub.id) || [];
		const firstInvoice = [...subscriptionInvoices].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
		const subClaims = claims.filter((claim) => claim.invoiceId === firstInvoice?.id);
		const pendingClaim = subClaims.some((claim) => claim.status === "pending");
		if (!firstInvoice) return { label: "Invoice not issued", ready: false, invoice: null as Invoice | null, pendingClaim };
		const paid = firstInvoice.status === "paid" && Number(firstInvoice.balanceDuePaise ?? 0) === 0;
		if (paid) return { label: "Paid · ready to enable", ready: true, invoice: firstInvoice, pendingClaim };
		if (pendingClaim) return { label: "Payment claim needs verification", ready: false, invoice: firstInvoice, pendingClaim };
		if (firstInvoice.status === "partially_paid") return { label: "Partial payment · balance due", ready: false, invoice: firstInvoice, pendingClaim };
		return { label: "Awaiting customer payment", ready: false, invoice: firstInvoice, pendingClaim };
	}

	return <section className="mx-auto max-w-6xl space-y-5 p-1 md:p-2">
		<header className="flex flex-wrap items-end justify-between gap-3">
			<div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#60775c]">Staff workspace</p><h1 className="mt-1 text-2xl font-bold text-stone-900">Subscription requests</h1><p className="mt-1 text-sm text-stone-500">Review customer plan requests, verify payment status, and enable paid subscriptions.</p></div>
			<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>Refresh queue</button>
		</header>
		{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
		<div className="grid gap-3 sm:grid-cols-3">
			{([{ key: "review", label: "Needs review", icon: Clock3 }, { key: "enabled", label: "Enabled plans", icon: CheckCircle2 }, { key: "closed", label: "Closed requests", icon: ShieldCheck }] as const).map(({ key, label, icon: Icon }) => <button type="button" key={key} onClick={() => setTab(key)} aria-pressed={tab === key} className={`rounded-2xl border p-4 text-left transition ${tab === key ? "border-[#aebb9f] bg-[#edf1e9] ring-1 ring-[#aebb9f]" : "border-stone-200 bg-white hover:bg-stone-50"}`}><span className="flex items-center justify-between"><span className="text-sm font-semibold text-stone-700">{label}</span><Icon size={17} className="text-[#526d4f]"/></span><span className="mt-2 block text-2xl font-bold text-stone-900">{counts[key]}</span></button>)}
		</div>
		<div className={`${panel} overflow-hidden`}>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-4"><div><h2 className="font-bold text-stone-900">{tab === "review" ? "Requests to review" : tab === "enabled" ? "Enabled subscriptions" : "Closed subscriptions"}</h2><p className="mt-1 text-xs text-stone-500">{tab === "review" ? "A plan is enabled only after its invoice is fully paid." : "Customer subscriptions and their current status."}</p></div><label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2"><Search size={15} className="text-stone-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or plan" className="w-52 bg-transparent text-sm outline-none placeholder:text-stone-400"/></label></div>
			{loading ? <div className="p-12 text-center text-sm text-stone-500">Loading subscription requests…</div> : visible.length === 0 ? <div className="p-12 text-center"><CheckCircle2 className="mx-auto text-[#71866b]" size={30}/><h3 className="mt-3 font-bold text-stone-800">No {tab === "review" ? "requests need review" : tab === "enabled" ? "enabled subscriptions" : "closed requests"}</h3><p className="mt-1 text-sm text-stone-500">New customer requests will appear here.</p></div> : <div className="divide-y divide-stone-100">{visible.map((sub) => {
				const payment = getPaymentState(sub);
				const claim = claims.find((item) => item.invoiceId === payment.invoice?.id && item.status === "pending");
				return <article key={sub.id} className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:px-5">
					<div className="min-w-0"><p className="text-xs text-stone-500">Request {sub.subscriptionNumber || sub.number || sub.id}</p><h3 className="mt-1 truncate font-bold text-stone-900">{sub.planName}</h3><p className="mt-1 text-sm text-stone-600">{sub.customerName}</p><p className="mt-1 text-xs capitalize text-stone-500">{String(sub.billingInterval || "monthly").replace("_", " ")} billing · submitted {sub.createdAt ? formatDate(sub.createdAt) : "—"}</p></div>
					<div><p className="text-xs font-semibold text-stone-500">PAYMENT REVIEW</p><p className={`mt-1 text-sm font-semibold ${payment.ready ? "text-emerald-700" : claim ? "text-amber-700" : "text-stone-700"}`}>{payment.label}</p>{payment.invoice && <p className="mt-1 text-xs text-stone-500">Invoice {payment.invoice.invoiceNumber}: {formatCurrency(Number(payment.invoice.totalPaise))} · balance {formatCurrency(Number(payment.invoice.balanceDuePaise || 0))}</p>}</div>
					<div className="flex flex-wrap gap-2 md:justify-end">{payment.ready && sub.status === "confirmed" ? <button type="button" onClick={() => void enable(sub)} disabled={workingId !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-[#263b2d] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#344d39] disabled:opacity-50"><CheckCircle2 size={14}/>{workingId === sub.id ? "Enabling…" : "Enable plan"}</button> : claim ? <Link to="/payments" className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">Review payment claim <ArrowRight size={14}/></Link> : tab === "review" ? <Link to="/payments" className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50">Payment queue <ExternalLink size={13}/></Link> : null}</div>
				</article>;
			})}</div>}
		</div>
	</section>;
}
