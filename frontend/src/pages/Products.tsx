import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Fragment } from "react";
import { Check, ChevronDown, ChevronUp, CircleDollarSign, Layers3, Package, Plus, Search, Trash2 } from "lucide-react";
import { createProduct, getCurrentUserProfile, getPlans, getProducts, toggleProductStatus, updateProduct } from "../services/api";
import type { BillingInterval, Product, ProductVariant, SubscriptionPlan } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

type VariantDraft = { name: string; sku: string; adjustment: string };
type PlanDraft = { name: string; interval: BillingInterval; price: string; description: string };
type ProductDraft = { name: string; type: string; notes: string; salesPrice: string; costPrice: string };
const intervalOptions: Array<{ value: BillingInterval; label: string }> = [
	{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" }, { value: "half_yearly", label: "Half-yearly" }, { value: "yearly", label: "Yearly" },
];
const inputClass = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#71866b] focus:ring-2 focus:ring-[#71866b]/15";
const emptyProduct: ProductDraft = { name: "", type: "AI Agent", notes: "", salesPrice: "", costPrice: "" };

function slug(value: string) { return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
function groupPlanTiers(plans: SubscriptionPlan[]) {
	const tiers = new Map<string, { name: string; description: string; prices: SubscriptionPlan[] }>();
	for (const plan of plans) {
		const tier = tiers.get(plan.name) || { name: plan.name, description: plan.description || "", prices: [] };
		if (!tier.description && plan.description) tier.description = plan.description;
		tier.prices.push(plan); tiers.set(plan.name, tier);
	}
	return [...tiers.values()];
}

export function Products() {
	const [products, setProducts] = useState<Product[]>([]);
	const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
	const [canManage, setCanManage] = useState(false);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Product | null>(null);
	const [saving, setSaving] = useState(false);
	const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
	const [variants, setVariants] = useState<VariantDraft[]>([]);
	const [planDrafts, setPlanDrafts] = useState<PlanDraft[]>([{ name: "Starter", interval: "monthly", price: "", description: "" }]);
	const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true); setError("");
		try {
			const [productResult, planResult, profile] = await Promise.all([getProducts(1, 100, search), getPlans(1, 100), getCurrentUserProfile()]);
			setProducts(productResult.data);
			setPlans(planResult);
			setCanManage(profile.role === "admin");
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load products."); }
		finally { setLoading(false); }
	}, [search]);
	useEffect(() => { void load(); }, [load]);

	const plansByProduct = useMemo(() => {
		const map = new Map<string, SubscriptionPlan[]>();
		for (const plan of plans) map.set(plan.productId, [...(map.get(plan.productId) || []), plan]);
		return map;
	}, [plans]);

	function openCreate() {
		setEditing(null); setDraft(emptyProduct); setVariants([]);
		setPlanDrafts([{ name: "Starter", interval: "monthly", price: "", description: "" }]);
		setError(""); setModalOpen(true);
	}
	function openEdit(product: Product) {
		setEditing(product);
		setDraft({ name: product.name, type: product.type || product.category, notes: product.description || "", salesPrice: (Number(product.salesPricePaise ?? product.basePriceInPaise) / 100).toFixed(2), costPrice: (Number(product.costPricePaise ?? 0) / 100).toFixed(2) });
		setError(""); setModalOpen(true);
	}
	function addVariant() { setVariants((current) => [...current, { name: "", sku: "", adjustment: "0" }]); }
	function addPlan() { setPlanDrafts((current) => [...current, { name: "", interval: "monthly", price: "", description: "" }]); }

	async function submit(event: FormEvent) {
		event.preventDefault(); setError(""); setNotice(""); setSaving(true);
		try {
			const productData = {
				name: draft.name.trim(), category: draft.type.trim(), description: draft.notes.trim(),
				basePriceInPaise: Math.round(Number(draft.salesPrice) * 100), costPriceInPaise: Math.round(Number(draft.costPrice) * 100),
			};
			if (editing) {
				await updateProduct(editing.id, productData);
				setNotice("Product details updated.");
			} else {
				if (planDrafts.length === 0 || planDrafts.some((plan) => !plan.name.trim() || !(Number(plan.price) > 0))) {
					throw new Error("Add at least one named billing plan with a valid price.");
				}
				const created = await createProduct({
					...productData,
					variants: variants.filter((variant) => variant.name.trim()).map((variant) => ({
						name: variant.name.trim(), sku: variant.sku.trim() || `${slug(draft.name)}-${slug(variant.name)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
						priceAdjustmentInPaise: Math.round(Number(variant.adjustment || 0) * 100),
					})),
					plans: planDrafts.map((plan) => ({ name: plan.name.trim(), billingInterval: plan.interval, intervalCount: 1, amountPaise: Math.round(Number(plan.price) * 100), description: plan.description.trim() })),
				});
				setNotice(`${created.name} launched with ${planDrafts.length} billing ${planDrafts.length === 1 ? "plan" : "plans"}.`);
			}
			setModalOpen(false); setEditing(null); await load();
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this product."); }
		finally { setSaving(false); }
	}

	async function archive(product: Product) {
		if (!window.confirm(`Archive ${product.name}? Customers will no longer be able to start a subscription for it.`)) return;
		setError(""); setNotice("");
		try { await toggleProductStatus(product.id); setNotice(`${product.name} was archived.`); await load(); }
		catch (cause) { setError(cause instanceof Error ? cause.message : "Could not archive product."); }
	}

	return <section className="mx-auto max-w-7xl space-y-5 p-1 md:p-2">
		<header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#60775c]">Catalog setup</p><h1 className="mt-1 text-2xl font-bold text-stone-900">Products</h1><p className="mt-1 text-sm text-stone-500">Launch a product with its cost, variants, and recurring billing plans.</p></div>{canManage && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#263b2d] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#344d39]"><Plus size={16}/>Launch product</button>}</header>
		{error && !modalOpen && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
		<div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><label className="relative w-full sm:max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name or type" className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#71866b] focus:bg-white"/></label><span className="text-xs text-stone-500">{products.length} products</span></div>
		<div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
			{loading ? <p className="p-12 text-center text-sm text-stone-500">Loading product catalog…</p> : products.length === 0 ? <div className="p-12 text-center"><Package size={30} className="mx-auto text-stone-400"/><h2 className="mt-3 font-semibold text-stone-800">No products yet</h2><p className="mt-1 text-sm text-stone-500">Launch the first product and configure its billing options.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#f7f8f4] text-xs font-bold uppercase tracking-wider text-stone-500"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Sales price</th>{canManage && <th className="px-5 py-3">Cost price</th>}<th className="px-5 py-3">Variants</th><th className="px-5 py-3">Plans</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{products.map((product) => { const productPlans = plansByProduct.get(product.id) || []; const expanded = expandedProduct === product.id; return <Fragment key={product.id}><tr className="hover:bg-stone-50/70"><td className="px-5 py-4"><p className="font-semibold text-stone-900">{product.name}</p><p className="mt-0.5 text-xs text-stone-500">{product.type || product.category}</p></td><td className="px-5 py-4 font-semibold">{formatCurrency(Number(product.salesPricePaise ?? product.basePriceInPaise))}</td>{canManage && <td className="px-5 py-4 text-stone-700">{formatCurrency(Number(product.costPricePaise || 0))}</td>}<td className="px-5 py-4"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">{product.variants.length} {product.variants.length === 1 ? "variant" : "variants"}</span></td><td className="px-5 py-4"><span className="rounded-full bg-[#edf1e9] px-2.5 py-1 text-xs font-semibold text-[#425b3f]">{productPlans.length} {productPlans.length === 1 ? "plan" : "plans"}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{product.status || (product.isActive ? "active" : "archived")}</span></td><td className="px-5 py-4 text-right"><div className="inline-flex items-center gap-2"><button type="button" onClick={() => setExpandedProduct(expanded ? null : product.id)} aria-label={`${expanded ? "Hide" : "Show"} plans for ${product.name}`} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100">{expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>{canManage && <><button type="button" onClick={() => openEdit(product)} className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50">Edit</button><button type="button" onClick={() => void archive(product)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">Archive</button></>}</div></td></tr>{expanded && <tr><td colSpan={canManage ? 7 : 6} className="bg-[#fafbf8] px-5 py-4"><div className="grid gap-5 lg:grid-cols-2"><div><h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Product notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{product.description || "No notes added."}</p><h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-stone-500">Variants & add-ons</h3>{product.variants.length ? <ul className="mt-2 space-y-2">{product.variants.map((variant: ProductVariant) => <li key={variant.id} className="flex justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><span>{variant.name} <small className="text-stone-400">{variant.sku}</small></span><span className="font-semibold">+{formatCurrency(Number(variant.priceAdjustmentInPaise ?? variant.priceInPaise))}</span></li>)}</ul> : <p className="mt-2 text-sm text-stone-500">No variants</p>}</div><div><h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Plan tiers & prices</h3>{productPlans.length ? <div className="mt-2 space-y-3">{groupPlanTiers(productPlans).map((tier) => <div key={tier.name} className="rounded-xl border border-stone-200 bg-white p-3"><p className="font-semibold text-stone-900">{tier.name}</p>{tier.description && <p className="mt-1 text-xs text-stone-500">{tier.description}</p>}<div className="mt-2 flex flex-wrap gap-2">{tier.prices.sort((a, b) => intervalOptions.findIndex((option) => option.value === a.billingInterval) - intervalOptions.findIndex((option) => option.value === b.billingInterval)).map((plan) => <span key={plan.id} className="rounded-lg bg-[#f4f6f1] px-2.5 py-1.5 text-xs text-stone-700"><span className="capitalize">{plan.billingInterval.replace("_", " ")}</span> <b className="text-[#344a35]">{formatCurrency(Number(plan.priceInPaise))}</b></span>)}</div></div>)}</div> : <p className="mt-2 text-sm text-stone-500">No active plans configured.</p>}</div></div></td></tr>}</Fragment>; })}</tbody></table></div>}
		</div>
		{modalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/45 p-3 sm:p-5"><form onSubmit={(event) => void submit(event)} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-[#fffefa] shadow-2xl"><div className="flex items-start justify-between border-b border-stone-200 px-5 py-4 sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#60775c]">Product catalog</p><h2 className="mt-1 text-xl font-bold text-stone-900">{editing ? "Edit product details" : "Launch a product"}</h2><p className="mt-1 text-xs text-stone-500">Set up product economics and subscription options in one place.</p></div><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Close"><span aria-hidden="true">×</span></button></div>
			<div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
				<section><div className="mb-3 flex items-center gap-2"><Package size={17} className="text-[#526d4f]"/><h3 className="font-semibold text-stone-900">Product details</h3></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-stone-600">Product name *<input required maxLength={200} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. BrightLoop AI Agent" className={inputClass}/></label><label className="text-xs font-semibold text-stone-600">Type *<input required maxLength={60} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} placeholder="AI Agent, SaaS, Service…" className={inputClass}/></label><label className="text-xs font-semibold text-stone-600">Base sales price (₹) *<input required min="0" step="0.01" type="number" value={draft.salesPrice} onChange={(event) => setDraft({ ...draft, salesPrice: event.target.value })} placeholder="e.g. 1200" className={inputClass}/></label><label className="text-xs font-semibold text-stone-600">Cost price (₹) *<input required min="0" step="0.01" type="number" value={draft.costPrice} onChange={(event) => setDraft({ ...draft, costPrice: event.target.value })} placeholder="e.g. 400" className={inputClass}/></label><label className="text-xs font-semibold text-stone-600 sm:col-span-2">Product notes<textarea rows={3} maxLength={4000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Describe the product and what customers receive." className={inputClass}/></label></div></section>
				{!editing && <>
					<section className="border-t border-stone-200 pt-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><Layers3 size={17} className="text-[#526d4f]"/><h3 className="font-semibold text-stone-900">Variants and add-ons</h3></div><p className="mt-1 text-xs text-stone-500">Optional brand or feature choices; the amount is added to each plan price.</p></div><button type="button" onClick={addVariant} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"><Plus size={14}/>Add variant</button></div>{variants.length === 0 ? <p className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">No variants. Add a brand or feature when customers can choose an option.</p> : <div className="space-y-3">{variants.map((variant, index) => <div key={index} className="grid gap-3 rounded-xl border border-stone-200 bg-white p-3 sm:grid-cols-[1fr_1fr_180px_auto] sm:items-end"><label className="text-xs font-semibold text-stone-600">Variant name<input required value={variant.name} onChange={(event) => setVariants((current) => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder="Odoo" className={inputClass}/></label><label className="text-xs font-semibold text-stone-600">SKU <span className="font-normal text-stone-400">(optional)</span><input value={variant.sku} onChange={(event) => setVariants((current) => current.map((item, i) => i === index ? { ...item, sku: event.target.value } : item))} placeholder="Auto-generated" className={inputClass}/></label><label className="text-xs font-semibold text-stone-600">Additional price (₹)<input required min="0" step="0.01" type="number" value={variant.adjustment} onChange={(event) => setVariants((current) => current.map((item, i) => i === index ? { ...item, adjustment: event.target.value } : item))} className={inputClass}/></label><button type="button" aria-label="Remove variant" onClick={() => setVariants((current) => current.filter((_, i) => i !== index))} className="mb-1 rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16}/></button></div>)}</div>}</section>
					<section className="border-t border-stone-200 pt-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><CircleDollarSign size={17} className="text-[#526d4f]"/><h3 className="font-semibold text-stone-900">Subscription plans *</h3></div><p className="mt-1 text-xs text-stone-500">Create plan tiers and billing intervals offered for this product.</p></div><button type="button" onClick={addPlan} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"><Plus size={14}/>Add plan</button></div><div className="space-y-3">{planDrafts.map((plan, index) => <div key={index} className="grid gap-3 rounded-xl border border-stone-200 bg-white p-3 sm:grid-cols-[1.1fr_1fr_1fr_auto] sm:items-end"><label className="text-xs font-semibold text-stone-600">Plan name<input required value={plan.name} onChange={(event) => setPlanDrafts((current) => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder="Starter, Pro…" className={inputClass}/></label><label className="text-xs font-semibold text-stone-600">Billing interval<select value={plan.interval} onChange={(event) => setPlanDrafts((current) => current.map((item, i) => i === index ? { ...item, interval: event.target.value as BillingInterval } : item))} className={inputClass}>{intervalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-xs font-semibold text-stone-600">Recurring price (₹)<input required min="0.01" step="0.01" type="number" value={plan.price} onChange={(event) => setPlanDrafts((current) => current.map((item, i) => i === index ? { ...item, price: event.target.value } : item))} placeholder="e.g. 950" className={inputClass}/></label><button type="button" disabled={planDrafts.length === 1} aria-label="Remove plan" onClick={() => setPlanDrafts((current) => current.filter((_, i) => i !== index))} className="mb-1 rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30"><Trash2 size={16}/></button><label className="text-xs font-semibold text-stone-600 sm:col-span-4">Plan description <span className="font-normal text-stone-400">(optional)</span><input value={plan.description} onChange={(event) => setPlanDrafts((current) => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder="What's included in this plan?" className={inputClass}/></label></div>)}</div></section>
				</>}
				{editing && <p className="rounded-xl border border-[#dce5d8] bg-[#f4f7f1] p-4 text-xs leading-5 text-[#425b3f]">This editor updates product details and pricing. Manage this product’s billing plans in the grouped Plans workspace.</p>}
				{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-stone-50/70 px-5 py-4 sm:px-7"><p className="text-xs text-stone-500">{editing ? "Product economics are admin-only." : `${variants.length} variants · ${planDrafts.length} billing plans configured`}</p><div className="flex gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#263b2d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#344d39] disabled:opacity-60">{saving ? "Saving…" : <><Check size={15}/>{editing ? "Save product" : "Launch product"}</>}</button></div></div>
		</form></div>}
	</section>;
}

export const ProductsPage = Products;
export default Products;
