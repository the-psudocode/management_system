// ============================================================
// src/utils/format.ts
// Formatting utilities for Brightloop Billing
// ============================================================

export function formatCurrency(paise: number): string {
	const rupees = paise / 100;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(rupees);
}

export function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	return new Date(dateStr).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function getStatusBadgeClass(status: string): string {
	switch (status.toLowerCase()) {
		case "active":
		case "paid":
			return "bg-emerald-50 text-emerald-700 border border-emerald-200";
		case "confirmed":
			return "bg-blue-50 text-blue-700 border border-blue-200";
		case "draft":
			return "bg-slate-100 text-slate-700 border border-slate-200";
		case "paused":
			return "bg-amber-50 text-amber-700 border border-amber-200";
		case "closed":
		case "overdue":
			return "bg-rose-50 text-rose-700 border border-rose-200";
		default:
			return "bg-slate-50 text-slate-700 border border-slate-200";
	}
}
