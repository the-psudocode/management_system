import { useEffect, useState } from "react";
import { createPlan, getCurrentUserProfile, getPlans, getProducts } from "../services/api";
import type { Product, SubscriptionPlan } from "../types";
import { formatCurrency } from "../utils/format";

export function Plans() {
	const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
	const [products, setProducts] = useState<Product[]>([]);
	const [canManage, setCanManage] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [name, setName] = useState("");
	const [productId, setProductId] = useState("");
	const [interval, setInterval] = useState<"monthly" | "quarterly" | "yearly">("monthly");
	const [price, setPrice] = useState("");

	async function load() {
		setLoading(true);
		setError("");
		try {
			const [planList, productList, profile] = await Promise.all([
				getPlans(), getProducts(1, 100), getCurrentUserProfile(),
			]);
			setPlans(planList);
			setProducts(productList.data);
			setProductId((current) => current || productList.data[0]?.id || "");
			setCanManage(profile.role === "admin");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load plans.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { void load(); }, []);

	async function handleCreate(event: React.FormEvent) {
		event.preventDefault();
		setSaving(true);
		setError("");
		try {
			await createPlan({ productId, name, billingInterval: interval, priceInPaise: Math.round(Number(price) * 100) });
			setName("");
			setPrice("");
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not create plan.");
		} finally {
			setSaving(false);
		}
	}

	return <section className="mx-auto max-w-6xl space-y-6 p-6">
		<header><h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1><p className="text-sm text-slate-500">Plans are loaded from the billing API.</p></header>
		{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		{canManage && <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-5">
			<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name" className="rounded border p-2" />
			<select required value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded border p-2">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
			<select value={interval} onChange={(e) => setInterval(e.target.value as typeof interval)} className="rounded border p-2"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>
			<input required min="0.01" step="0.01" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (INR)" className="rounded border p-2" />
			<button disabled={saving || !productId} className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Create plan"}</button>
		</form>}
		<div className="overflow-x-auto rounded-xl border bg-white">
			<table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Plan</th><th className="p-3">Product</th><th className="p-3">Interval</th><th className="p-3">Price</th><th className="p-3">Status</th></tr></thead><tbody>
			{plans.map((plan) => <tr key={plan.id} className="border-t"><td className="p-3 font-medium">{plan.name}</td><td className="p-3">{plan.productName || products.find((p) => p.id === plan.productId)?.name || "—"}</td><td className="p-3">{plan.billingInterval}</td><td className="p-3">{formatCurrency(Number(plan.priceInPaise))}</td><td className="p-3">{plan.status || (plan.isActive ? "active" : "archived")}</td></tr>)}
			{!loading && plans.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No plans found.</td></tr>}
			{loading && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading plans…</td></tr>}
			</tbody></table>
		</div>
	</section>;
}

export default Plans;
