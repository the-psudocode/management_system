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
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-gray-500 font-medium">
					Loading executive dashboard...
				</div>
			</div>
		);
	}

	const chartData = (analytics.revenueHistory || []).map((item) => ({
		month: item.month,
		mrr: item.mrrPaise / 100,
		arr: item.arrPaise / 100,
	}));

	const mrrPaise = summary.mrrPaise ?? summary.mrrInPaise ?? 0;
	const arrPaise = summary.arrPaise ?? summary.arrInPaise ?? 0;
	const overdueAmount =
		summary.overdueAmountPaise ?? summary.outstandingInPaise ?? 0;
	const overdueCount =
		summary.overdueInvoicesCount ?? summary.overdueInvoices ?? 0;

	return (
		<div className="p-6 space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">
						Executive Billing Dashboard
					</h1>
					<p className="text-sm text-gray-500">
						Real-time revenue analytics & subscription health
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
						+8.4% from last month
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
					<div className="text-xs text-rose-600 mt-2 font-medium">
						{overdueCount} overdue invoices
					</div>
				</div>
			</div>

			<div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
				<h2 className="text-lg font-bold text-gray-900 mb-1">
					MRR Growth Trend
				</h2>
				<p className="text-xs text-gray-500 mb-6">
					Historical recurring revenue performance in INR (₹)
				</p>
				<div className="h-72 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={chartData}
							margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
						>
							<defs>
								<linearGradient
									id="mrrGradient"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor="#4f46e5"
										stopOpacity={0.8}
									/>
									<stop
										offset="95%"
										stopColor="#4f46e5"
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid
								strokeDasharray="3 3"
								vertical={false}
								stroke="#e2e8f0"
							/>
							<XAxis
								dataKey="month"
								stroke="#64748b"
								fontSize={12}
								tickLine={false}
							/>
							<YAxis
								stroke="#64748b"
								fontSize={12}
								tickLine={false}
								tickFormatter={(val) =>
									`₹${(val / 1000).toFixed(0)}k`
								}
							/>
							<Tooltip
								formatter={(value: any) => [
									`₹${Number(value).toLocaleString("en-IN")}`,
									"MRR",
								]}
							/>
							<Area
								type="monotone"
								dataKey="mrr"
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
						{(analytics.subscriptionsByStatus || []).map((s) => (
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
						{(analytics.agingOverdue || []).map((a) => (
							<div
								key={a.range}
								className="flex justify-between items-center text-sm border-b border-gray-100 pb-2"
							>
								<span className="text-gray-700 font-medium">
									{a.range}
								</span>
								<span className="font-bold text-rose-600">
									{formatCurrency(a.amountPaise)} ({a.count})
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};
