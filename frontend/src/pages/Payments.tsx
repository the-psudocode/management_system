// frontend/src/pages/Payments.tsx
import { useEffect, useState } from "react";
import { activateSubscriptionFromPaymentClaim, getPayments, getPaymentClaims, verifyPaymentClaim } from "../services/api";
import type { Payment } from "../types";
import { formatCurrency, formatDate } from "../utils/format";
import { CheckCircle2, Clock, QrCode, ShieldCheck, XCircle } from "lucide-react";

export function Payments() {
	const [activeTab, setActiveTab] = useState<"recorded" | "claims">("recorded");
	const [payments, setPayments] = useState<Payment[]>([]);
	const [claims, setClaims] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [claimsLoading, setClaimsLoading] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [actionId, setActionId] = useState<string | null>(null);

	async function loadAll() {
		setError("");
		setLoading(true);
		try {
			const [payRes, claimRes] = await Promise.allSettled([
				getPayments(1, 100),
				getPaymentClaims(),
			]);
			if (payRes.status === "fulfilled") {
				setPayments(payRes.value.data);
			} else {
				setError(payRes.reason instanceof Error ? payRes.reason.message : "Could not load payments.");
			}
			if (claimRes.status === "fulfilled") {
				setClaims(Array.isArray(claimRes.value) ? claimRes.value : []);
			}
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void loadAll();
	}, []);

	async function handleVerify(claimId: string) {
		setActionId(claimId);
		setNotice("");
		setError("");
		try {
			await verifyPaymentClaim(claimId);
			setNotice("Payment verified and allocated. If it settles the invoice, enable the customer's plan from this claim.");
			await loadAll();
		} catch (err: any) {
			setError(err instanceof Error ? err.message : "Failed to verify payment claim.");
		} finally {
			setActionId(null);
		}
	}

	async function handleEnablePlan(claimId: string) {
		setActionId(claimId);
		setNotice("");
		setError("");
		try {
			await activateSubscriptionFromPaymentClaim(claimId);
			setNotice("Plan enabled. The customer can now access the subscribed service.");
			await loadAll();
		} catch (err: any) {
			setError(err instanceof Error ? err.message : "Could not enable the plan.");
		} finally {
			setActionId(null);
		}
	}

	const pendingClaims = claims.filter((c) => (c.status || "pending").toLowerCase() === "pending");

	return (
		<section className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Payments & Verification</h1>
					<p className="text-sm text-slate-500">
						Verify customer UPI payments, then enable each fully paid subscription plan.
					</p>
				</div>

				<div className="flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
					<button
						type="button"
						onClick={() => setActiveTab("recorded")}
						className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
							activeTab === "recorded"
								? "bg-[#263b2d] text-white shadow-sm"
								: "text-stone-600 hover:text-stone-900"
						}`}
					>
						Ledger Payments ({payments.length})
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("claims")}
						className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
							activeTab === "claims"
								? "bg-[#263b2d] text-white shadow-sm"
								: "text-stone-600 hover:text-stone-900"
						}`}
					>
						<QrCode size={14} />
						UPI Claims
						{pendingClaims.length > 0 && (
							<span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white">
								{pendingClaims.length} pending
							</span>
						)}
					</button>
				</div>
			</header>

			{error && (
				<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
					{error}
				</div>
			)}
			{notice && (
				<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
					<CheckCircle2 size={16} />
					<span>{notice}</span>
				</div>
			)}

			{activeTab === "recorded" ? (
				<div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
					<table className="w-full text-left text-sm">
						<thead className="bg-[#f7f8f4] text-xs font-bold uppercase tracking-wider text-stone-600">
							<tr>
								<th className="p-3.5">Received</th>
								<th className="p-3.5">Customer</th>
								<th className="p-3.5">Method</th>
								<th className="p-3.5">Reference / UTR</th>
								<th className="p-3.5">Amount</th>
								<th className="p-3.5">Invoices</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-stone-100">
							{payments.map((payment) => (
								<tr key={payment.id} className="hover:bg-stone-50/50">
									<td className="p-3.5 text-xs text-stone-600">
										{formatDate(payment.receivedAt || payment.date || "")}
									</td>
									<td className="p-3.5 font-semibold text-stone-900">
										{payment.customerName || payment.customerId || "—"}
									</td>
									<td className="p-3.5">
										<span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-stone-700">
											{(payment.method || payment.paymentMethod || "other").replace(/_/g, " ")}
										</span>
									</td>
									<td className="p-3.5 font-mono text-xs text-stone-700">
										{payment.reference || payment.referenceNumber || "—"}
									</td>
									<td className="p-3.5 font-bold text-stone-900">
										{formatCurrency(Number(payment.amountPaise || payment.amountInPaise || 0))}
									</td>
									<td className="p-3.5 text-xs font-mono text-stone-600">
										{payment.allocations?.map((allocation: any) => allocation.invoice?.number || allocation.invoiceId).join(", ") ||
											payment.invoiceId ||
											"—"}
									</td>
								</tr>
							))}
							{!loading && payments.length === 0 && (
								<tr>
									<td colSpan={6} className="p-8 text-center text-sm text-stone-500">
										No recorded ledger payments found.
									</td>
								</tr>
							)}
							{loading && (
								<tr>
									<td colSpan={6} className="p-8 text-center text-sm text-stone-500">
										Loading recorded payments…
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			) : (
				<div className="space-y-4">
					<div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
						<table className="w-full text-left text-sm">
							<thead className="bg-[#f7f8f4] text-xs font-bold uppercase tracking-wider text-stone-600">
								<tr>
									<th className="p-3.5">Submitted</th>
									<th className="p-3.5">Customer</th>
									<th className="p-3.5">Invoice #</th>
									<th className="p-3.5">UTR Reference</th>
									<th className="p-3.5">Amount</th>
									<th className="p-3.5">Status</th>
									<th className="p-3.5 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-stone-100">
								{claims.map((claim) => {
									const isPending = (claim.status || "pending").toLowerCase() === "pending";
									const isVerified = (claim.status || "").toLowerCase() === "verified";
									return (
										<tr key={claim.id || claim.claimId} className="hover:bg-stone-50/50">
											<td className="p-3.5 text-xs text-stone-600">
												{claim.submittedAt ? formatDate(claim.submittedAt) : "Just now"}
											</td>
											<td className="p-3.5 font-semibold text-stone-900">
												{claim.customerName || "Customer"}
											</td>
											<td className="p-3.5 font-mono text-xs text-indigo-700 font-semibold">
												{claim.invoiceNumber || claim.invoiceId}
											</td>
											<td className="p-3.5 font-mono text-xs font-bold text-stone-800">
												{claim.reference || claim.utrNumber || "—"}
											</td>
											<td className="p-3.5 font-bold text-stone-900">
												{formatCurrency(Number(claim.amountPaise || (claim.amountRupees ? claim.amountRupees * 100 : 0)))}
											</td>
											<td className="p-3.5">
												<span
													className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
														isVerified
															? "bg-emerald-100 text-emerald-800"
															: isPending
															? "bg-amber-100 text-amber-800"
															: "bg-rose-100 text-rose-800"
													}`}
												>
													{isVerified ? <CheckCircle2 size={12} /> : isPending ? <Clock size={12} /> : <XCircle size={12} />}
													{claim.status || "pending"}
												</span>
											</td>
											<td className="p-3.5 text-right">
												{isPending ? (
													<button
														type="button"
														disabled={actionId !== null}
														onClick={() => handleVerify(claim.id || claim.claimId)}
														className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
													>
														<ShieldCheck size={14} />
														{actionId === (claim.id || claim.claimId) ? "Verifying…" : "Verify payment"}
													</button>
												) : isVerified && claim.invoiceStatus === "paid" && claim.subscriptionId && claim.subscriptionStatus === "confirmed" ? (
													<button
														type="button"
														disabled={actionId !== null}
														onClick={() => void handleEnablePlan(claim.id || claim.claimId)}
														className="inline-flex items-center gap-1.5 rounded-lg bg-[#263b2d] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#344d39] disabled:opacity-50"
													>
														<CheckCircle2 size={14} />
														{actionId === (claim.id || claim.claimId) ? "Enabling…" : "Enable plan"}
													</button>
												) : (
													<span className="text-xs text-stone-400">{isVerified && claim.subscriptionStatus === "active" ? "Plan enabled" : isVerified && claim.subscriptionId ? "Payment verified · invoice balance remains" : "Reviewed"}</span>
												)}
											</td>
										</tr>
									);
								})}
								{!loading && claims.length === 0 && (
									<tr>
										<td colSpan={7} className="p-8 text-center text-sm text-stone-500">
											No UPI payment claims submitted yet.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<p className="text-xs text-slate-500">
				BrightLoop uses staff review: verify the transfer, then enable the linked subscription once its invoice is fully paid.
			</p>
		</section>
	);
}

export default Payments;
