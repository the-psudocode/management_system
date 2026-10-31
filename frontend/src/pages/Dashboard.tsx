// frontend/src/pages/Dashboard.tsx
import React, { useState, useEffect } from "react";
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import {
	DollarSign,
	TrendingUp,
	RefreshCw,
	AlertCircle,
	ArrowUpRight,
} from "lucide-react";
import { apiService } from "../services/api";
import { DashboardSummary, DashboardAnalytics } from "../types";
import { formatCurrency } from "../utils/format";

export const DashboardPage: React.FC = () => {
	const [summary, setSummary] = useState<DashboardSummary | null>(null);
	const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function loadData() {
			try {
				const [sumData, anaData] = await Promise.all([
					apiService.getDashboardSummary(),
					apiService.getDashboardAnalytics(),
				]);
				setSummary(sumData);
				setAnalytics(anaData);
			} catch (err) {
				console.error("Failed to load dashboard data:", err);
			} finally {
				setLoading(false);
			}
		}
		loadData();
	}, []);

	if (loading || !summary || !analytics) {
		return (
			<div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-stone-200 bg-white">
				<div className="text-gray-500 font-medium">
					Loading your business overview…
				</div>
			</div>
		);
	}

	const chartData = (analytics.revenueHistory || analytics.revenueTrend || []).map((item: any) => ({
		month: item.month,
		mrr: Number(item.mrrPaise || item.revenue || 0) / 100,
		arr: Number(item.arrPaise || (item.revenue ? item.revenue * 12 : 0)) / 100,
	}));

	const statusBreakdown: { status: string; count: number }[] = Array.isArray(analytics.subscriptionsByStatus)
		? analytics.subscriptionsByStatus
		: Object.entries(analytics.subscriptionsByStatus || analytics.subscriptionStats || {}).map(([st, cnt]) => ({
				status: st,
				count: Number(cnt) || 0,
		  }));

	const agingBreakdown: any[] = Array.isArray(analytics.agingOverdue)
		? analytics.agingOverdue
		: Array.isArray(analytics.overdueAging)
		? analytics.overdueAging
		: [];

	const mrrPaise = summary.mrrPaise ?? summary.mrrInPaise ?? 0;
	const arrPaise = summary.arrPaise ?? summary.arrInPaise ?? 0;
	const overdueAmount =
		summary.overdueAmountPaise ?? summary.outstandingInPaise ?? 0;
	const overdueCount =
		summary.overdueInvoicesCount ?? summary.overdueInvoices ?? 0;

	return (
		<div className="space-y-5">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-gray-900">
						Business performance
					</h1>
					<p className="text-sm text-gray-500">
						Revenue, subscriptions and receivables at a glance
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
						<span>Monthly Recurring Revenue (MRR)</span>
						<TrendingUp className="w-4 h-4 text-emerald-500" />
					</div>
					<div className="text-2xl font-bold text-gray-900">
						{formatCurrency(mrrPaise)}
					</div>
					<div className="flex items-center text-xs text-emerald-600 mt-2 font-medium">
						<ArrowUpRight className="w-3.5 h-3.5 mr-1" />
						Current monthly run rate
					</div>
				</div>

				<div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
						<span>Annual Run Rate (ARR)</span>
						<DollarSign className="w-4 h-4 text-indigo-500" />
					</div>
					<div className="text-2xl font-bold text-gray-900">
						{formatCurrency(arrPaise)}
					</div>
					<div className="flex items-center text-xs text-indigo-600 mt-2 font-medium">
						<ArrowUpRight className="w-3.5 h-3.5 mr-1" />
						Projected yearly pace
					</div>
				</div>

				<div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
						<span>Active Subscriptions</span>
						<RefreshCw className="w-4 h-4 text-blue-500" />
					</div>
					<div className="text-2xl font-bold text-gray-900">
						{summary.activeSubscriptions}
					</div>
					<div className="text-xs text-gray-500 mt-2">
						Out of {summary.totalCustomers} customer accounts
					</div>
				</div>

				<div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
						<span>Overdue Receivables</span>
						<AlertCircle className="w-4 h-4 text-rose-500" />
					</div>
					<div className="text-2xl font-bold text-rose-600">
						{formatCurrency(overdueAmount)}
					</div>
					<div className="text-xs text-rose-500 mt-2 font-medium">
						{overdueCount} pending overdue invoices
					</div>
				</div>
			</div>

			<div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
				<div className="flex justify-between items-center">
					<div>
						<h3 className="text-base font-bold text-gray-900">
							Revenue trend
						</h3>
						<p className="text-xs text-gray-500">
							MRR vs projected ARR progression
						</p>
					</div>
				</div>
				<div className="h-72 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={chartData}
							margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
						>
							<defs>
								<linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
									<stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
								</linearGradient>
							</defs>
							<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
							<XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} />
							<YAxis
								stroke="#9ca3af"
								fontSize={12}
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => `₹${value.toLocaleString()}`}
							/>
							<Tooltip
								formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Amount"]}
								contentStyle={{
									backgroundColor: "#1f2937",
									borderColor: "#374151",
									borderRadius: "8px",
									color: "#fff",
								}}
							/>
							<Area
								type="monotone"
								dataKey="mrr"
								name="MRR"
								stroke="#4f46e5"
								strokeWidth={2}
								fillOpacity={1}
								fill="url(#mrrGradient)"
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
					<h3 className="text-base font-bold text-gray-900">
						Subscription Status Breakdown
					</h3>
					<div className="space-y-3">
						{statusBreakdown.map((s) => (
							<div
								key={s.status}
								className="flex justify-between items-center text-sm border-b border-gray-100 pb-2"
							>
								<span className="capitalize text-gray-700 font-medium">
									{s.status}
								</span>
								<span className="font-bold text-gray-900">
									{s.count}
								</span>
							</div>
						))}
					</div>
				</div>

				<div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
					<h3 className="text-base font-bold text-gray-900">
						Overdue Invoices Aging
					</h3>
					<div className="space-y-3">
						{agingBreakdown.length === 0 ? (
							<p className="text-xs text-gray-400">No overdue invoices.</p>
						) : (
							agingBreakdown.map((a, idx) => (
								<div
									key={a.range || idx}
									className="flex justify-between items-center text-sm border-b border-gray-100 pb-2"
								>
									<span className="text-gray-700 font-medium">
										{a.range || "Current"}
									</span>
									<span className="font-bold text-rose-600">
										{formatCurrency(a.amountPaise ?? a.amountInPaise ?? 0)} ({a.count ?? 0})
									</span>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export const Dashboard = DashboardPage;
