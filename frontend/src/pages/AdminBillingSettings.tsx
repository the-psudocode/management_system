import { useEffect, useState } from "react";
import { Percent, Plus, ShieldCheck, Tags } from "lucide-react";
import { createDiscountRule, createTaxRule, deactivateDiscountRule, deactivateTaxRule, getDiscountRules, getProducts, getTaxRules } from "../services/api";
import type { Product } from "../types";

type TaxRule = { id: string; name: string; type: string; rateBps: number; isActive: boolean };
type DiscountRule = { id: string; code: string; description?: string; type: string; value: number | string; isActive: boolean; wholeSubscription: boolean; endsAt: string };
const today = new Date().toISOString().slice(0, 10);
const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;

export function AdminBillingSettings() {
	const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
	const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
	const [products, setProducts] = useState<Product[]>([]);
	const [taxName, setTaxName] = useState("GST");
	const [taxType, setTaxType] = useState<TaxRule["type"]>("GST");
	const [taxPercent, setTaxPercent] = useState("18");
	const [taxStateCode, setTaxStateCode] = useState("");
	const [taxValidFrom, setTaxValidFrom] = useState("");
	const [taxValidUntil, setTaxValidUntil] = useState("");
	const [discountCode, setDiscountCode] = useState("");
	const [discountDescription, setDiscountDescription] = useState("");
	const [discountType, setDiscountType] = useState<"fixed" | "percentage">("percentage");
	const [discountValue, setDiscountValue] = useState("10");
	const [discountStart, setDiscountStart] = useState(today);
	const [discountEnd, setDiscountEnd] = useState(nextYear);
	const [discountWholeSubscription, setDiscountWholeSubscription] = useState(true);
	const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
	const [minimumPurchaseRupees, setMinimumPurchaseRupees] = useState("");
	const [minimumQuantity, setMinimumQuantity] = useState("");
	const [maximumUses, setMaximumUses] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	async function load() {
		setLoading(true);
		setError("");
		const [taxResult, discountResult, productResult] = await Promise.allSettled([getTaxRules(), getDiscountRules(), getProducts(1, 100)]);
		if (taxResult.status === "fulfilled") setTaxRules(Array.isArray(taxResult.value) ? taxResult.value : (taxResult.value as any)?.data || []);
		else setError(taxResult.reason instanceof Error ? taxResult.reason.message : "Could not load tax settings.");
		if (discountResult.status === "fulfilled") setDiscounts(Array.isArray(discountResult.value) ? discountResult.value : (discountResult.value as any)?.data || []);
		else setError(discountResult.reason instanceof Error ? discountResult.reason.message : "Could not load discounts.");
		if (productResult.status === "fulfilled") setProducts(productResult.value.data.filter((product) => product.isActive));
		setLoading(false);
	}

	useEffect(() => { void load(); }, []);

	async function submitTax(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true); setError(""); setNotice("");
		try {
			await createTaxRule({ name: taxName.trim(), type: taxType as any, rateBps: Math.round(Number(taxPercent) * 100), scope: "all_products", stateCode: taxStateCode.trim() || undefined, validFrom: taxValidFrom || undefined, validUntil: taxValidUntil || undefined });
			setNotice("Tax rule created. It will be applied to invoices according to the configured location rules.");
			await load();
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the tax rule."); }
		finally { setSaving(false); }
	}

	async function submitDiscount(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true); setError(""); setNotice("");
		try {
			const value = discountType === "percentage" ? Math.round(Number(discountValue) * 100) : String(Math.round(Number(discountValue) * 100));
			const productIds = discountWholeSubscription ? [] : selectedProductIds;
			await createDiscountRule({
				code: discountCode.trim().toUpperCase(), description: discountDescription.trim() || undefined,
				type: discountType, value, startsAt: discountStart, endsAt: discountEnd,
				wholeSubscription: discountWholeSubscription, productIds,
				minimumPurchasePaise: minimumPurchaseRupees ? String(Math.round(Number(minimumPurchaseRupees) * 100)) : undefined,
				minimumQuantity: minimumQuantity ? Number(minimumQuantity) : undefined,
				maxUses: maximumUses ? Number(maximumUses) : undefined,
			});
			setNotice("Discount created. Customers can enter its code during checkout; eligibility is checked by the billing server.");
			setDiscountCode(""); setDiscountDescription(""); setSelectedProductIds([]); setMinimumPurchaseRupees(""); setMinimumQuantity(""); setMaximumUses("");
			await load();
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the discount."); }
		finally { setSaving(false); }
	}

	async function deactivateTax(id: string) {
		try { await deactivateTaxRule(id); setNotice("Tax rule deactivated."); await load(); }
		catch (cause) { setError(cause instanceof Error ? cause.message : "Could not deactivate tax rule."); }
	}
	async function deactivateDiscount(id: string) {
		try { await deactivateDiscountRule(id); setNotice("Discount deactivated."); await load(); }
		catch (cause) { setError(cause instanceof Error ? cause.message : "Could not deactivate discount."); }
	}

	const fieldClass = "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-[#71866b] focus:outline-none";
	return <section className="mx-auto max-w-6xl space-y-6">
		<header><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#60775c]">Administrator controls</p><h1 className="mt-1 text-2xl font-bold text-stone-900">Billing rules</h1><p className="mt-1 text-sm text-stone-500">Configure tax and discount rules used when BrightLoop calculates invoices.</p></header>
		<div className="rounded-xl border border-[#dce5d8] bg-[#f4f7f1] p-4 text-xs leading-5 text-[#425b3f]"><ShieldCheck size={15} className="mr-1 inline"/>Rules are enforced by the billing backend. Tax location settings may also require the business state code and customer billing state; no payment is considered verified until staff review it.</div>
		{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		{notice && <p role="status" className="rounded-xl border border-[#dce5d8] bg-[#edf1e9] p-3 text-sm text-[#425b3f]">{notice}</p>}
		<div className="grid gap-5 xl:grid-cols-2">
			<div className="space-y-5">
				<form onSubmit={(event) => void submitTax(event)} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
					<div className="flex items-center gap-2"><span className="rounded-lg bg-[#e9eee5] p-2 text-[#425b3f]"><Percent size={18}/></span><h2 className="font-semibold">Add tax rule</h2></div>
					<label className="block"><span className="text-xs font-semibold text-stone-700">Rule name</span><input required value={taxName} onChange={(event) => setTaxName(event.target.value)} className={fieldClass}/></label>
					<div className="grid grid-cols-2 gap-3"><label className="block"><span className="text-xs font-semibold text-stone-700">Tax type</span><select value={taxType} onChange={(event) => setTaxType(event.target.value)} className={fieldClass}><option value="GST">GST (generic)</option><option value="CGST">CGST</option><option value="SGST">SGST</option><option value="IGST">IGST</option></select></label><label className="block"><span className="text-xs font-semibold text-stone-700">Rate (%)</span><input type="number" min="0.01" max="100" step="0.01" required value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} className={fieldClass}/></label></div>
					<div className="grid grid-cols-2 gap-3"><label className="block"><span className="text-xs font-semibold text-stone-700">State code <span className="font-normal text-stone-400">(optional)</span></span><input value={taxStateCode} onChange={(event) => setTaxStateCode(event.target.value.toUpperCase())} placeholder="e.g. KA" className={fieldClass}/></label><label className="block"><span className="text-xs font-semibold text-stone-700">Valid from <span className="font-normal text-stone-400">(optional)</span></span><input type="date" value={taxValidFrom} onChange={(event) => setTaxValidFrom(event.target.value)} className={fieldClass}/></label></div>
					<label className="block"><span className="text-xs font-semibold text-stone-700">Valid until <span className="font-normal text-stone-400">(optional)</span></span><input type="date" value={taxValidUntil} onChange={(event) => setTaxValidUntil(event.target.value)} className={fieldClass}/></label>
					<button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#263b2d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#344d39] disabled:opacity-60"><Plus size={15}/>Create tax rule</button>
				</form>
				<div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><h2 className="border-b border-stone-100 px-5 py-4 font-semibold">Tax rules</h2>{loading ? <p className="p-5 text-sm text-stone-500">Loading…</p> : taxRules.length === 0 ? <p className="p-5 text-sm text-stone-500">No tax rules configured.</p> : <ul className="divide-y divide-stone-100">{taxRules.map((rule) => <li key={rule.id} className="flex items-center justify-between gap-3 px-5 py-3"><span><strong className="text-sm">{rule.name}</strong><small className="ml-2 text-xs text-stone-500">{rule.type} · {(rule.rateBps / 100).toFixed(2)}%</small></span>{rule.isActive && <button type="button" onClick={() => void deactivateTax(rule.id)} className="text-xs font-semibold text-rose-700 hover:underline">Deactivate</button>}</li>)}</ul>}</div>
			</div>
			<div className="space-y-5">
				<form onSubmit={(event) => void submitDiscount(event)} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
					<div className="flex items-center gap-2"><span className="rounded-lg bg-[#e9eee5] p-2 text-[#425b3f]"><Tags size={18}/></span><h2 className="font-semibold">Create discount</h2></div>
					<label className="block"><span className="text-xs font-semibold text-stone-700">Code</span><input required maxLength={80} value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} className={`${fieldClass} uppercase`}/></label>
					<label className="block"><span className="text-xs font-semibold text-stone-700">Description</span><input value={discountDescription} onChange={(event) => setDiscountDescription(event.target.value)} className={fieldClass}/></label>
					<div className="grid grid-cols-2 gap-3"><label className="block"><span className="text-xs font-semibold text-stone-700">Discount type</span><select value={discountType} onChange={(event) => setDiscountType(event.target.value as "fixed" | "percentage")} className={fieldClass}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (₹)</option></select></label><label className="block"><span className="text-xs font-semibold text-stone-700">{discountType === "percentage" ? "Percent" : "Amount (₹)"}</span><input type="number" min="0.01" max={discountType === "percentage" ? "100" : undefined} step="0.01" required value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} className={fieldClass}/></label></div>
					<div className="grid grid-cols-2 gap-3"><label className="block"><span className="text-xs font-semibold text-stone-700">Starts</span><input type="date" required value={discountStart} onChange={(event) => setDiscountStart(event.target.value)} className={fieldClass}/></label><label className="block"><span className="text-xs font-semibold text-stone-700">Ends</span><input type="date" required value={discountEnd} onChange={(event) => setDiscountEnd(event.target.value)} className={fieldClass}/></label></div>
					<div className="grid grid-cols-3 gap-2"><label className="block"><span className="text-[11px] font-semibold text-stone-700">Minimum total (₹)</span><input type="number" min="0.01" step="0.01" value={minimumPurchaseRupees} onChange={(event) => setMinimumPurchaseRupees(event.target.value)} className={fieldClass}/></label><label className="block"><span className="text-[11px] font-semibold text-stone-700">Min quantity</span><input type="number" min="1" step="1" value={minimumQuantity} onChange={(event) => setMinimumQuantity(event.target.value)} className={fieldClass}/></label><label className="block"><span className="text-[11px] font-semibold text-stone-700">Max uses</span><input type="number" min="1" step="1" value={maximumUses} onChange={(event) => setMaximumUses(event.target.value)} className={fieldClass}/></label></div>
					<label className="flex items-center gap-2 text-xs text-stone-700"><input type="checkbox" checked={discountWholeSubscription} onChange={(event) => setDiscountWholeSubscription(event.target.checked)} className="accent-[#344a35]"/>Apply to the whole subscription</label>
					{!discountWholeSubscription && <fieldset className="rounded-xl border border-stone-200 p-3"><legend className="px-1 text-xs font-semibold text-stone-700">Eligible products</legend>{products.map((product) => <label key={product.id} className="flex items-center gap-2 py-1 text-xs text-stone-600"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} className="accent-[#344a35]"/>{product.name}</label>)}</fieldset>}
					<button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#263b2d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#344d39] disabled:opacity-60"><Plus size={15}/>Create discount</button>
				</form>
				<div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><h2 className="border-b border-stone-100 px-5 py-4 font-semibold">Discount codes</h2>{loading ? <p className="p-5 text-sm text-stone-500">Loading…</p> : discounts.length === 0 ? <p className="p-5 text-sm text-stone-500">No discounts configured.</p> : <ul className="divide-y divide-stone-100">{discounts.map((discount) => <li key={discount.id} className="flex items-center justify-between gap-3 px-5 py-3"><span><strong className="text-sm">{discount.code}</strong><small className="ml-2 text-xs text-stone-500">{discount.type === "percentage" ? `${Number(discount.value) / 100}%` : "Fixed"} · through {new Date(discount.endsAt).toLocaleDateString()}</small></span>{discount.isActive && <button type="button" onClick={() => void deactivateDiscount(discount.id)} className="text-xs font-semibold text-rose-700 hover:underline">Deactivate</button>}</li>)}</ul>}</div>
			</div>
		</div>
	</section>;
}

export default AdminBillingSettings;
