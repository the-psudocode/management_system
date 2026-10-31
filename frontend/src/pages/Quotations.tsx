import { useEffect, useState } from "react";
import { acceptQuotation, createQuotation, getCurrentUserProfile, getCustomers, getPlans, getQuotations, sendQuotation } from "../services/api";
import type { Customer, Quotation, SubscriptionPlan, UserRole } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

export function Quotations() {
	const [quotations, setQuotations] = useState<Quotation[]>([]);
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
	const [role, setRole] = useState<UserRole | null>(null);
	const [customerId, setCustomerId] = useState("");
	const [planId, setPlanId] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	async function load() {
		setLoading(true);
		setError("");
		try {
			const [quoteResult, profile] = await Promise.all([getQuotations(), getCurrentUserProfile()]);
			setQuotations(quoteResult.data);
			setRole(profile.role);
			if (profile.role !== "customer") {
				const [customerResult, planResult] = await Promise.all([getCustomers(1, 100), getPlans()]);
				setCustomers(customerResult.data);
				setPlans(planResult);
				setCustomerId((current) => current || customerResult.data[0]?.id || "");
				setPlanId((current) => current || planResult[0]?.id || "");
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load quotations.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { void load(); }, []);

	async function create(event: React.FormEvent) {
		event.preventDefault();
		const selectedPlan = plans.find((plan) => plan.id === planId);
		if (!selectedPlan) return;
		setSaving(true);
		setError("");
		try {
			await createQuotation({ customerId, planId, productId: selectedPlan.productId });
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not create quotation.");
		} finally {
			setSaving(false);
		}
	}

	async function update(id: string, action: "send" | "accept") {
		setError("");
		try {
			if (action === "send") await sendQuotation(id);
			else await acceptQuotation(id);
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : `Could not ${action} quotation.`);
		}
	}

	return <section className="mx-auto max-w-6xl space-y-6 p-6">
		<header><h1 className="text-2xl font-bold text-slate-900">Quotations</h1><p className="text-sm text-slate-500">View, prepare, and manage quotation status.</p><p className="mt-1 text-xs text-slate-500">Marking a quotation as sent changes its status; email delivery is not configured.</p></header>
		{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		{role !== null && role !== "customer" && <form onSubmit={create} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
			<select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="rounded border p-2">{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company || customer.name}</option>)}</select>
			<select required value={planId} onChange={(e) => setPlanId(e.target.value)} className="rounded border p-2">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
			<button disabled={saving || !customerId || !planId} className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">{saving ? "Creating…" : "Create quotation"}</button>
		</form>}
		<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Number</th><th className="p-3">Customer</th><th className="p-3">Status</th><th className="p-3">Total</th><th className="p-3">Valid until</th><th className="p-3">Actions</th></tr></thead><tbody>
			{quotations.map((quote) => <tr key={quote.id} className="border-t"><td className="p-3 font-medium">{quote.number}</td><td className="p-3">{quote.customer?.company || customers.find((c) => c.id === quote.customerId)?.company || quote.customerId}</td><td className="p-3 capitalize">{quote.status}</td><td className="p-3">{formatCurrency(Number(quote.totalPaise))}</td><td className="p-3">{formatDate(quote.validUntil)}</td><td className="p-3"><div className="flex gap-2">{role !== "customer" && quote.status === "draft" && <button onClick={() => void update(quote.id, "send")} className="rounded border px-2 py-1">Mark sent</button>}{role === "customer" && quote.status === "sent" && <button onClick={() => void update(quote.id, "accept")} className="rounded bg-emerald-600 px-2 py-1 text-white">Accept</button>}</div></td></tr>)}
			{!loading && quotations.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No quotations found.</td></tr>}
			{loading && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Loading quotations…</td></tr>}
		</tbody></table></div>
		<p className="text-xs text-slate-500">Accepted quotations are not converted here; subscription conversion remains with the subscription owner.</p>
	</section>;
}

export default Quotations;
