import React, { useEffect, useState } from "react";
import {
	TrendingUp,
	Users,
	AlertTriangle,
	ArrowUpRight,
	DollarSign,
	PieChart as PieChartIcon,
} from "lucide-react";
import {
	ResponsiveContainer,
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
} from "recharts";
import type { DashboardSummary, DashboardAnalytics } from "../../types";
import { getDashboardSummary, getDashboardAnalytics } from "../../services/api";
import { formatCurrency } from "../../utils/format";

export const Dashboard: React.FC = () => {
	const [summary, setSummary] = useState<DashboardSummary | null>(null);
	const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchData() {
			try {
				const [sumData, anaData] = await Promise.all([
					getDashboardSummary(),
					getDashboardAnalytics(),
				]);
				setSummary(sumData);
				setAnalytics(anaData);
			} catch (error) {
				console.error("Error fetching dashboard data:", error);
			} finally {
				setLoading(false);
			}
		}
		fetchData();
	}, []);

	if (loading || !summary || !analytics) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
			</div>
		);
	}

	const chartData = analytics.revenueTrend.map((item) => ({
		...item,
		formattedRevenue: item.revenue / 100,
	}));

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
				<p className="text-sm text-slate-500">
					Overview of key revenue metrics, subscriptions, and outstanding payments.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
					<div className="flex justify-between items-start">
						<div>
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
								Monthly Recurring Revenue
							</p>
							<h3 className="text-2xl font-bold text-slate-900 mt-1">
								{formatCurrency(summary.mrrInPaise)}
							</h3>
						</div>
						<div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
							<TrendingUp className="w-5 h-5" />
						</div>
					</div>
					<div className="mt-3 flex items-center text-xs text-emerald-600">
						<ArrowUpRight className="w-4 h-4 mr-0.5" />
						<span className="font-semibold">+12.4%</span>
						<span className="text-slate-400 ml-1">from last month</span>
					</div>
				</div>

				<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
					<div className="flex justify-between items-start">
						<div>
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
								Annual Recurring Revenue
							</p>
							<h3 className="text-2xl font-bold text-slate-900 mt-1">
								{formatCurrency(summary.arrInPaise)}
							</h3>
						</div>
						<div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
							<DollarSign className="w-5 h-5" />
						</div>
					</div>
					<div className="mt-3 text-xs text-slate-500">
						Based on current active subscriptions
					</div>
				</div>

				<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
					<div className="flex justify-between items-start">
						<div>
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
								Active Subscriptions
							</p>
							<h3 className="text-2xl font-bold text-slate-900 mt-1">
								{summary.activeSubscriptions}
							</h3>
						</div>
						<div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
							<Users className="w-5 h-5" />
						</div>
					</div>
					<div className="mt-3 text-xs text-slate-500">
						{summary.newCustomersThisMonth} new accounts this month
					</div>
				</div>

				<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
					<div className="flex justify-between items-start">
						<div>
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
								Outstanding Overdue
							</p>
							<h3 className="text-2xl font-bold text-rose-600 mt-1">
								{formatCurrency(summary.outstandingInPaise)}
							</h3>
						</div>
						<div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
							<AlertTriangle className="w-5 h-5" />
						</div>
					</div>
					<div className="mt-3 text-xs text-rose-600 font-medium">
						{summary.overdueInvoices} overdue invoices require attention
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
					<div className="flex justify-between items-center mb-4">
						<div>
							<h2 className="text-base font-semibold text-slate-900">
								Revenue Growth Trend
							</h2>
							<p className="text-xs text-slate-500">
								Monthly recurring revenue trajectory
							</p>
						</div>
					</div>
					<div className="h-72 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={chartData}
								margin={{
									top: 10,
									right: 10,
									left: 0,
									bottom: 0,
								}}
							>
								<defs>
									<linearGradient
										id="colorRevenue"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="#4f46e5"
											stopOpacity={0.2}
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
									stroke="#94a3b8"
									fontSize={12}
								/>
								<YAxis
									stroke="#94a3b8"
									fontSize={12}
									tickFormatter={(val) => `₹${val / 1000}k`}
								/>
								<Tooltip
									formatter={(value: any) => [
										`₹${(Number(value) || 0).toLocaleString("en-IN")}`,
										"Revenue",
									]}
								/>
								<Area
									type="monotone"
									dataKey="formattedRevenue"
									stroke="#4f46e5"
									strokeWidth={2}
									fillOpacity={1}
									fill="url(#colorRevenue)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-base font-semibold text-slate-900">
								Subscription Status
							</h2>
							<PieChartIcon className="w-4 h-4 text-slate-400" />
						</div>

						<div className="space-y-4">
							<div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
								<span className="text-sm font-medium text-emerald-900">
									Active
								</span>
								<span className="text-base font-bold text-emerald-700">
									{analytics.subscriptionStats.active}
								</span>
							</div>
							<div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg border border-amber-100">
								<span className="text-sm font-medium text-amber-900">
									Paused
								</span>
								<span className="text-base font-bold text-amber-700">
									{analytics.subscriptionStats.paused}
								</span>
							</div>
							<div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
								<span className="text-sm font-medium text-slate-700">
									Draft
								</span>
								<span className="text-base font-bold text-slate-700">
									{analytics.subscriptionStats.draft}
								</span>
							</div>
							<div className="flex items-center justify-between p-3 bg-rose-50/50 rounded-lg border border-rose-100">
								<span className="text-sm font-medium text-rose-900">
									Closed
								</span>
								<span className="text-base font-bold text-rose-700">
									{analytics.subscriptionStats.closed}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
				<h2 className="text-base font-semibold text-slate-900 mb-1">
					Overdue Invoice Aging Analysis
				</h2>
				<p className="text-xs text-slate-500 mb-4">
					Uncollected revenue grouped by days overdue
				</p>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{analytics.overdueAging.map((bucket) => (
						<div
							key={bucket.range}
							className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between"
						>
							<div>
								<p className="text-xs font-semibold text-slate-500 uppercase">
									{bucket.range}
								</p>
								<p className="text-lg font-bold text-slate-900 mt-0.5">
									{formatCurrency(bucket.amountInPaise)}
								</p>
							</div>
							<span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-200 text-slate-700">
								{bucket.count} Invoices
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
