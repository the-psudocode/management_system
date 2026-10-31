import { useEffect, useState } from "react";
import { getPayments } from "../services/api";
import type { Payment } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

export function Payments() {
	const [payments, setPayments] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		getPayments(1, 100).then((result) => setPayments(result.data))
			.catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load payments."))
			.finally(() => setLoading(false));
	}, []);

	return <section className="mx-auto max-w-6xl space-y-6 p-6">
		<header><h1 className="text-2xl font-bold text-slate-900">Payments</h1><p className="text-sm text-slate-500">Recorded payments and invoice allocations from the billing API.</p></header>
		{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Received</th><th className="p-3">Customer</th><th className="p-3">Method</th><th className="p-3">Reference</th><th className="p-3">Amount</th><th className="p-3">Invoices</th></tr></thead><tbody>
			{payments.map((payment) => <tr key={payment.id} className="border-t"><td className="p-3">{formatDate(payment.receivedAt || payment.date || "")}</td><td className="p-3">{payment.customerName || payment.customerId || "—"}</td><td className="p-3 capitalize">{(payment.method || payment.paymentMethod).replace(/_/g, " ")}</td><td className="p-3">{payment.reference || payment.referenceNumber || "—"}</td><td className="p-3">{formatCurrency(Number(payment.amountPaise || payment.amountInPaise || 0))}</td><td className="p-3">{payment.allocations?.map((allocation: any) => allocation.invoice?.number || allocation.invoiceId).join(", ") || payment.invoiceId || "—"}</td></tr>)}
			{!loading && payments.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No recorded payments.</td></tr>}
			{loading && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Loading payments…</td></tr>}
		</tbody></table></div>
		<p className="text-xs text-slate-500">These are recorded ledger payments. This screen does not initiate or verify a card/UPI gateway transaction.</p>
	</section>;
}

export default Payments;
