import { useEffect, useState } from "react";
import { acceptQuotation, getPortalOverview } from "../services/api";
import type { PortalOverview } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

export function Portal() {
	const [overview, setOverview] = useState<PortalOverview | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	async function load() {
		setError("");
		return getPortalOverview().then(setOverview)
			.catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your account."))
			.finally(() => setLoading(false));
	}

	useEffect(() => { void load(); }, []);

	async function handleAccept(quotationId: string) {
		setError("");
		try {
			await acceptQuotation(quotationId);
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not accept this quotation.");
		}
	}

	if (loading) return <section className="p-6 text-slate-500">Loading your account…</section>;
	if (error) return <section className="m-6 rounded-lg bg-rose-50 p-4 text-rose-700" role="alert">{error}</section>;
	if (!overview) return null;

	const outstanding = overview.invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDuePaise ?? invoice.outstandingInPaise ?? 0), 0);
	return <section className="mx-auto max-w-6xl space-y-6 p-6">
		<header><h1 className="text-2xl font-bold text-slate-900">Welcome, {overview.customer.name}</h1><p className="text-sm text-slate-500">Your Brightloop Billing account overview.</p></header>
		<div className="grid gap-4 md:grid-cols-3">
			<div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">Subscriptions</p><p className="mt-2 text-2xl font-semibold">{overview.subscriptions.length}</p></div>
			<div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">Open invoices</p><p className="mt-2 text-2xl font-semibold">{overview.invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled").length}</p></div>
			<div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">Outstanding</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(outstanding)}</p></div>
		</div>
		<div className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Subscriptions</h2>{overview.subscriptions.length === 0 ? <p className="text-sm text-slate-500">No subscriptions yet.</p> : <ul className="divide-y">{overview.subscriptions.map((subscription) => <li key={subscription.id} className="flex justify-between gap-4 py-3"><span>{subscription.items?.map((item: any) => item.description).join(", ") || subscription.number || subscription.id}</span><span className="text-sm capitalize text-slate-500">{subscription.status} · next billing {formatDate(subscription.nextBillingDate || "")}</span></li>)}</ul>}</div>
		<div className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Invoices</h2>{overview.invoices.length === 0 ? <p className="text-sm text-slate-500">No invoices yet.</p> : <div className="divide-y">{overview.invoices.map((invoice) => <div key={invoice.id} className="flex justify-between gap-4 py-3"><span>{invoice.invoiceNumber || invoice.number || invoice.id} <span className="ml-2 text-sm capitalize text-slate-500">{invoice.status}</span></span><span>{formatCurrency(Number(invoice.totalInPaise ?? invoice.totalPaise ?? 0))}</span></div>)}</div>}</div>
		<div className="rounded-xl border bg-white p-5"><h2 className="mb-1 font-semibold">Quotations</h2><p className="mb-3 text-xs text-slate-500">Accepting a quotation records your acceptance; subscription activation is handled separately.</p>{overview.quotations.length === 0 ? <p className="text-sm text-slate-500">No quotations yet.</p> : <ul className="divide-y">{overview.quotations.map((quote) => <li key={quote.id} className="flex flex-wrap items-center justify-between gap-4 py-3"><span>{quote.number} <span className="ml-2 text-sm capitalize text-slate-500">{quote.status}</span></span><span>{formatCurrency(Number(quote.totalPaise))} · valid until {formatDate(quote.validUntil)}</span>{quote.status === "sent" && <button onClick={() => void handleAccept(quote.id)} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white">Accept</button>}</li>)}</ul>}</div>
		<div className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Payments</h2>{overview.payments.length === 0 ? <p className="text-sm text-slate-500">No payments recorded.</p> : <ul className="divide-y">{overview.payments.map((payment) => <li key={payment.id} className="flex justify-between gap-4 py-3"><span>{payment.reference || payment.id} · {payment.method}</span><span>{formatCurrency(Number(payment.amountPaise || payment.amountInPaise || 0))} · {formatDate(payment.receivedAt || payment.paymentDate || "")}</span></li>)}</ul>}</div>
	</section>;
}

export default Portal;
