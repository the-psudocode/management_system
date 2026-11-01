import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Layers3, Plus } from "lucide-react";
import { archivePlan, createPlan, getCurrentUserProfile, getPlans, getProducts, updatePlan } from "../services/api";
import type { BillingInterval, Product, SubscriptionPlan } from "../types";
import { formatCurrency } from "../utils/format";

const intervals: Array<{ value: BillingInterval; label: string }> = [
	{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" }, { value: "half_yearly", label: "Half-yearly" }, { value: "yearly", label: "Yearly" },
];
const field = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#71866b] focus:ring-2 focus:ring-[#71866b]/15";

function planFeatures(description?: string) {
	return (description || "").split(/[\n,;]/).map((feature) => feature.trim()).filter(Boolean);
}

export function Plans() {
	const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
	const [products, setProducts] = useState<Product[]>([]);
	const [canManage, setCanManage] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [name, setName] = useState("");
	const [productId, setProductId] = useState("");
	const [interval, setInterval] = useState<BillingInterval>("monthly");
	const [price, setPrice] = useState("");
	const [description, setDescription] = useState("");
	const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

	async function load() {
		setLoading(true); setError("");
		try {
			const [planList, productList, profile] = await Promise.all([getPlans(1, 100), getProducts(1, 100), getCurrentUserProfile()]);
			setPlans(planList); setProducts(productList.data); setCanManage(profile.role === "admin" || profile.role === "staff");
			setProductId((current) => productList.data.some((product) => product.id === current) ? current : productList.data[0]?.id || "");
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load plans."); }
		finally { setLoading(false); }
	}
	useEffect(() => { void load(); }, []);

	const groups = useMemo(() => {
		const map = new Map<string, { product: Product | undefined; productName: string; productType: string; plans: SubscriptionPlan[] }>();
		for (const plan of plans) {
			const product = products.find((item) => item.id === plan.productId);
			const group = map.get(plan.productId) || { product, productName: plan.productName || product?.name || "Product", productType: plan.productType || product?.type || product?.category || "", plans: [] };
			group.plans.push(plan); map.set(plan.productId, group);
		}
		return [...map.entries()].sort((left, right) => left[1].productName.localeCompare(right[1].productName));
	}, [plans, products]);

	async function handleCreate(event: React.FormEvent) {
		event.preventDefault(); setSaving(true); setError(""); setNotice("");
		try {
			const data = { productId, name, billingInterval: interval, priceInPaise: Math.round(Number(price) * 100), description };
			if (editingPlan) {
				await updatePlan(editingPlan.id, data);
				setNotice(`${name} ${interval.replace("_", " ")} price updated.`);
			} else {
				await createPlan(data);
				setNotice("Price option added to this product plan tier.");
			}
			setEditingPlan(null); setName(""); setPrice(""); setDescription(""); await load();
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create plan."); }
		finally { setSaving(false); }
	}

	function startEditing(plan: SubscriptionPlan) {
		setEditingPlan(plan); setProductId(plan.productId); setName(plan.name); setInterval(plan.billingInterval);
		setPrice((Number(plan.priceInPaise) / 100).toFixed(2)); setDescription(plan.description || ""); setError(""); setNotice("");
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	async function handleArchive(plan: SubscriptionPlan) {
		if (!window.confirm(`Archive the ${plan.billingInterval.replace("_", " ")} price for ${plan.name}? Existing subscriptions will keep their current terms.`)) return;
		setError(""); setNotice("");
		try { await archivePlan(plan.id); setNotice(`${plan.name} ${plan.billingInterval.replace("_", " ")} price archived.`); await load(); }
		catch (cause) { setError(cause instanceof Error ? cause.message : "Could not archive this plan price."); }
	}

	return <section className="mx-auto max-w-7xl space-y-5 p-1 md:p-2">
		<header><p className="text-xs font-bold uppercase tracking-[.16em] text-[#60775c]">Catalog setup</p><h1 className="mt-1 text-2xl font-bold text-stone-900">Plans & pricing</h1><p className="mt-1 text-sm text-stone-500">Each product contains plan tiers, included features, billing prices, and optional variants.</p></header>
		{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
		{canManage && <form onSubmit={(event) => void handleCreate(event)} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><span className="rounded-lg bg-[#edf1e9] p-2 text-[#425b3f]"><Plus size={17}/></span><div><h2 className="font-semibold text-stone-900">{editingPlan ? "Edit plan price" : "Add a tier price"}</h2><p className="text-xs text-stone-500">Use the same plan name to group its weekly, monthly, quarterly, or yearly prices.</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"><label className="text-xs font-semibold text-stone-600">Product<select required disabled={Boolean(editingPlan)} value={productId} onChange={(event) => setProductId(event.target.value)} className={`${field} mt-1 disabled:bg-stone-100`}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="text-xs font-semibold text-stone-600">Plan tier<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Starter, Professional, Enterprise" className={`${field} mt-1`}/></label><label className="text-xs font-semibold text-stone-600">Billing interval<select disabled={Boolean(editingPlan)} value={interval} onChange={(event) => setInterval(event.target.value as BillingInterval)} className={`${field} mt-1 disabled:bg-stone-100`}>{intervals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-xs font-semibold text-stone-600">Recurring price (₹)<input required min="0.01" step="0.01" type="number" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price for this interval" className={`${field} mt-1`}/></label><div className="flex gap-2 self-end"><button disabled={saving || !productId} className="rounded-xl bg-[#263b2d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#344d39] disabled:opacity-50">{saving ? "Saving…" : editingPlan ? "Save changes" : "Add price"}</button>{editingPlan && <button type="button" onClick={() => { setEditingPlan(null); setName(""); setPrice(""); setDescription(""); }} className="rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-semibold text-stone-600">Cancel</button>}</div><label className="text-xs font-semibold text-stone-600 md:col-span-2 xl:col-span-5">Included features <span className="font-normal text-stone-400">(separate each item with a comma or new line)</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="5 projects, 3 users, email support" className={`${field} mt-1`}/></label></div></form>}
		<div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"><span className="font-semibold text-stone-800">Product → plan tiers → prices</span><span className="text-xs text-stone-500">{groups.length} products · {new Set(plans.map((plan) => `${plan.productId}:${plan.name}`)).size} tiers · {plans.length} prices</span></div>
		{loading ? <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">Loading grouped plans…</div> : groups.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center"><Layers3 className="mx-auto text-stone-400" size={30}/><h2 className="mt-3 font-semibold text-stone-800">No subscription plans yet</h2><p className="mt-1 text-sm text-stone-500">Launch a product with its first plan from Products.</p></div> : <div className="space-y-4">{groups.map(([id, group], index) => {
			const availableIntervals = intervals.filter((item) => group.plans.some((plan) => plan.billingInterval === item.value));
			const tiers = [...group.plans.reduce((map, plan) => { const tier = map.get(plan.name) || { name: plan.name, description: plan.description || "", prices: [] as SubscriptionPlan[] }; if (!tier.description && plan.description) tier.description = plan.description; tier.prices.push(plan); map.set(plan.name, tier); return map; }, new Map<string, { name: string; description: string; prices: SubscriptionPlan[] }>()).values()];
			return <details key={id} open={index === 0} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[#f7f8f4] px-5 py-4"><span className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-[#e9eee5] p-2 text-[#425b3f]"><Layers3 size={18}/></span><span className="min-w-0"><span className="block truncate font-bold text-stone-900">{group.productName}</span><span className="mt-0.5 block text-xs text-stone-500">{group.productType} · {tiers.length} plan tiers · {group.plans.length} billing prices</span></span></span><ChevronDown size={17} className="shrink-0 text-stone-500"/></summary><div className="space-y-5 p-4 sm:p-5">
				{group.product?.variants?.length ? <section className="rounded-xl border border-stone-200 bg-[#fafbf8] p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Variants & add-ons · selected at checkout</h3><div className="mt-3 flex flex-wrap gap-2">{group.product.variants.map((variant) => <span key={variant.id} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700">{variant.name} <b className="ml-1 text-[#425b3f]">+{formatCurrency(Number(variant.priceAdjustmentInPaise ?? variant.priceInPaise))}</b></span>)}</div></section> : null}
				<div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#f7f8f4] text-xs font-bold uppercase tracking-wider text-stone-500"><tr><th className="px-3 py-3">Plan tier</th><th className="px-3 py-3">Included features</th>{availableIntervals.map((item) => <th key={item.value} className="px-3 py-3">{item.label}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{tiers.map((tier) => <tr key={tier.name}><td className="px-3 py-4 align-top font-bold text-stone-900">{tier.name}</td><td className="max-w-xs px-3 py-4 align-top text-xs text-stone-600">{planFeatures(tier.description).length ? <ul className="space-y-1">{planFeatures(tier.description).map((feature) => <li key={feature} className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-[#526d4f]"/>{feature}</li>)}</ul> : <span>Features to be confirmed</span>}</td>{availableIntervals.map((item) => { const pricePlan = tier.prices.find((plan) => plan.billingInterval === item.value); return <td key={item.value} className="px-3 py-4 align-top font-semibold text-stone-900">{pricePlan ? <><div>{formatCurrency(Number(pricePlan.priceInPaise))}<small className="mt-1 block font-normal capitalize text-stone-500">per {item.label.toLowerCase()}</small></div>{canManage && <div className="mt-2 flex gap-2"><button type="button" onClick={() => startEditing(pricePlan)} className="rounded-md border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-50">Edit</button><button type="button" onClick={() => void handleArchive(pricePlan)} className="rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50">Archive</button></div>}</> : <span className="text-stone-300">—</span>}</td>; })}</tr>)}</tbody></table></div>
			</div></details>;
		})}</div>}
	</section>;
}

export default Plans;
