import React, { useEffect, useState } from "react";
import {
	Repeat,
	Search,
	Plus,
	Eye,
	X,
	Play,
	Pause,
	StopCircle,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import type {
	Subscription,
	Customer,
	SubscriptionPlan,
	SubscriptionStatus,
} from "../types";
import {
	getSubscriptions,
	createSubscription,
	updateSubscriptionStatus,
	getCustomers,
	getPlans,
} from "../services/api";
import {
	formatCurrency,
	formatDate,
	getStatusBadgeClass,
} from "../utils/format";

export const Subscriptions: React.FC = () => {
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalSubscriptions, setTotalSubscriptions] = useState(0);

	// Modals & Dropdown options
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [viewingSub, setViewingSub] = useState<Subscription | null>(null);
	const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
	const [planOptions, setPlanOptions] = useState<SubscriptionPlan[]>([]);

	// Form State
	const [formData, setFormData] = useState({
		customerId: "",
		planId: "",
		status: "draft" as SubscriptionStatus,
		startDate: new Date().toISOString().split("T")[0],
	});

	const fetchSubscriptionList = async () => {
		setLoading(true);
		try {
			const res = await getSubscriptions(page, 8, search, statusFilter);
			setSubscriptions(res.data);
			setTotalPages(res.totalPages);
			setTotalSubscriptions(res.total);
		} catch (err) {
			console.error("Failed to load subscriptions:", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchSubscriptionList();
	}, [page, search, statusFilter]);

	const handleOpenAdd = async () => {
		try {
			const [custRes, plansRes] = await Promise.all([
				getCustomers(1, 100),
				getPlans(),
			]);
			setCustomerOptions(custRes.data);
			setPlanOptions(plansRes);

			setFormData({
				customerId: custRes.data[0]?.id || "",
				planId: plansRes[0]?.id || "",
				status: "draft",
				startDate: new Date().toISOString().split("T")[0],
			});
			setIsAddModalOpen(true);
		} catch (err) {
			console.error("Failed to prepare creation modal:", err);
		}
	};

	const handleStatusChange = async (
		id: string,
		newStatus: SubscriptionStatus,
	) => {
		try {
			await updateSubscriptionStatus(id, newStatus);
			fetchSubscriptionList();
		} catch (err) {
			console.error("Failed to transition status:", err);
		}
	};

	const handleSubmitAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const selectedCustomer = customerOptions.find(
				(c) => c.id === formData.customerId,
			);
			const selectedPlan = planOptions.find(
				(p) => p.id === formData.planId,
			);

			if (!selectedCustomer || !selectedPlan) return;

			// Calculate Next Billing Date based on interval
			const start = new Date(formData.startDate);
			const nextBilling = new Date(start);
			if (selectedPlan.billingInterval === "monthly") {
				nextBilling.setMonth(nextBilling.getMonth() + 1);
			} else if (selectedPlan.billingInterval === "quarterly") {
				nextBilling.setMonth(nextBilling.getMonth() + 3);
			} else if (selectedPlan.billingInterval === "yearly") {
				nextBilling.setFullYear(nextBilling.getFullYear() + 1);
			}

			await createSubscription({
				customerId: selectedCustomer.id,
				customerName: selectedCustomer.company || selectedCustomer.name,
				planId: selectedPlan.id,
				planName: selectedPlan.name,
				status: formData.status,
				startDate: formData.startDate,
				endDate: null,
				nextBillingDate: nextBilling.toISOString().split("T")[0],
				billingInterval: selectedPlan.billingInterval,
				amountInPaise: selectedPlan.priceInPaise,
			});

			setIsAddModalOpen(false);
			fetchSubscriptionList();
		} catch (err) {
			console.error("Failed to create subscription:", err);
		}
	};

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			{/* Page Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">
						Subscription Lifecycle
					</h1>
					<p className="text-sm text-slate-500">
						Monitor active subscriptions, perform status
						transitions, and schedule recurring billing.
					</p>
				</div>
				<button
					onClick={handleOpenAdd}
					className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-sm transition cursor-pointer"
				>
					<Plus className="w-4 h-4" /> Create Subscription
				</button>
			</div>

			{/* Filter & Search Bar */}
			<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
				<div className="relative w-full md:w-96">
					<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Search by customer name or plan..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
					/>
				</div>

				<div className="flex items-center gap-3 w-full md:w-auto justify-end">
					<span className="text-xs font-semibold text-slate-500 uppercase">
						Status:
					</span>
					<select
						value={statusFilter}
						onChange={(e) => {
							setStatusFilter(e.target.value);
							setPage(1);
						}}
						className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					>
						<option value="all">All Statuses</option>
						<option value="active">Active</option>
						<option value="draft">Draft</option>
						<option value="paused">Paused</option>
						<option value="confirmed">Confirmed</option>
						<option value="closed">Closed</option>
					</select>
				</div>
			</div>

			{/* Subscription Directory Table */}
			<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				{loading ? (
					<div className="p-12 text-center text-slate-500">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
						<p className="text-sm">
							Loading subscription lifecycle data...
						</p>
					</div>
				) : subscriptions.length === 0 ? (
					<div className="p-12 text-center">
						<Repeat className="w-12 h-12 mx-auto text-slate-300 mb-3" />
						<h3 className="text-base font-semibold text-slate-800">
							No Subscriptions Found
						</h3>
						<p className="text-sm text-slate-500 mt-1">
							Try adjusting your search criteria or create a new
							subscription.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm text-slate-600">
							<thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
								<tr>
									<th className="py-3 px-4">Customer</th>
									<th className="py-3 px-4">Plan Name</th>
									<th className="py-3 px-4">
										Billing Interval
									</th>
									<th className="py-3 px-4">
										Recurring Price
									</th>
									<th className="py-3 px-4">
										Next Billing Date
									</th>
									<th className="py-3 px-4">Status</th>
									<th className="py-3 px-4 text-right">
										Lifecycle Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{subscriptions.map((s) => (
									<tr
										key={s.id}
										className="hover:bg-slate-50/80 transition"
									>
										<td className="py-3.5 px-4 font-semibold text-slate-900">
											{s.customerName}
										</td>
										<td className="py-3.5 px-4 text-slate-700 font-medium">
											{s.planName}
										</td>
										<td className="py-3.5 px-4 capitalize text-slate-600">
											<span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-semibold">
												{s.billingInterval}
											</span>
										</td>
										<td className="py-3.5 px-4 font-bold text-slate-900">
											{formatCurrency(s.amountInPaise)}
										</td>
										<td className="py-3.5 px-4 text-slate-600">
											{s.nextBillingDate
												? formatDate(s.nextBillingDate)
												: "—"}
										</td>
										<td className="py-3.5 px-4">
											<span
												className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${getStatusBadgeClass(
													s.status,
												)}`}
											>
												{s.status}
											</span>
										</td>
										<td className="py-3.5 px-4 text-right">
											<div className="inline-flex items-center gap-1">
												<button
													onClick={() =>
														setViewingSub(s)
													}
													title="View Subscription Details"
													className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer"
												>
													<Eye className="w-4 h-4" />
												</button>

												{/* Transition Actions */}
												{s.status !== "active" &&
													s.status !== "closed" && (
														<button
															onClick={() =>
																handleStatusChange(
																	s.id,
																	"active",
																)
															}
															title="Activate Subscription"
															className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition cursor-pointer"
														>
															<Play className="w-4 h-4" />
														</button>
													)}

												{s.status === "active" && (
													<button
														onClick={() =>
															handleStatusChange(
																s.id,
																"paused",
															)
														}
														title="Pause Subscription"
														className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition cursor-pointer"
													>
														<Pause className="w-4 h-4" />
													</button>
												)}

												{s.status !== "closed" && (
													<button
														onClick={() =>
															handleStatusChange(
																s.id,
																"closed",
															)
														}
														title="Close / Cancel Subscription"
														className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
													>
														<StopCircle className="w-4 h-4" />
													</button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination Footer */}
				{!loading && subscriptions.length > 0 && (
					<div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
						<div>
							Showing{" "}
							<span className="font-semibold text-slate-700">
								{subscriptions.length}
							</span>{" "}
							of{" "}
							<span className="font-semibold text-slate-700">
								{totalSubscriptions}
							</span>{" "}
							subscriptions
						</div>
						<div className="flex items-center gap-2">
							<button
								disabled={page === 1}
								onClick={() =>
									setPage((p) => Math.max(1, p - 1))
								}
								className="p-1.5 border border-slate-300 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>
							<span className="font-medium text-slate-700">
								Page {page} of {totalPages}
							</span>
							<button
								disabled={page === totalPages}
								onClick={() =>
									setPage((p) => Math.min(totalPages, p + 1))
								}
								className="p-1.5 border border-slate-300 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}
			</div>

			{/* CREATE SUBSCRIPTION MODAL */}
			{isAddModalOpen && (
				<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
						<div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
							<h2 className="text-lg font-bold text-slate-900">
								Create New Subscription
							</h2>
							<button
								onClick={() => setIsAddModalOpen(false)}
								className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<form
							onSubmit={handleSubmitAdd}
							className="p-6 space-y-4"
						>
							<div>
								<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
									Select Customer *
								</label>
								<select
									required
									value={formData.customerId}
									onChange={(e) =>
										setFormData({
											...formData,
											customerId: e.target.value,
										})
									}
									className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
								>
									{customerOptions.map((c) => (
										<option key={c.id} value={c.id}>
											{c.company
												? `${c.company} (${c.name})`
												: c.name}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
									Select Subscription Plan *
								</label>
								<select
									required
									value={formData.planId}
									onChange={(e) =>
										setFormData({
											...formData,
											planId: e.target.value,
										})
									}
									className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
								>
									{planOptions.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name} —{" "}
											{formatCurrency(p.priceInPaise)} /{" "}
											{p.billingInterval}
										</option>
									))}
								</select>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Start Date *
									</label>
									<input
										required
										type="date"
										value={formData.startDate}
										onChange={(e) =>
											setFormData({
												...formData,
												startDate: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Initial Status
									</label>
									<select
										value={formData.status}
										onChange={(e) =>
											setFormData({
												...formData,
												status: e.target
													.value as SubscriptionStatus,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
									>
										<option value="draft">Draft</option>
										<option value="quotation">
											Quotation
										</option>
										<option value="confirmed">
											Confirmed
										</option>
										<option value="active">Active</option>
									</select>
								</div>
							</div>

							<div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
								<button
									type="button"
									onClick={() => setIsAddModalOpen(false)}
									className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 transition cursor-pointer"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition cursor-pointer"
								>
									Create Subscription
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* DETAIL MODAL */}
			{viewingSub && (
				<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
						<div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
									<Repeat className="w-5 h-5" />
								</div>
								<div>
									<h2 className="text-lg font-bold text-slate-900">
										{viewingSub.planName}
									</h2>
									<p className="text-xs text-slate-500">
										{viewingSub.customerName}
									</p>
								</div>
							</div>
							<button
								onClick={() => setViewingSub(null)}
								className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="p-6 space-y-4 text-xs">
							<div className="flex justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
								<span className="text-slate-500">
									Subscription ID
								</span>
								<span className="font-mono font-bold text-slate-800">
									{viewingSub.id}
								</span>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
									<span className="text-slate-400 block mb-1">
										Billing Interval
									</span>
									<span className="font-bold text-slate-800 capitalize">
										{viewingSub.billingInterval}
									</span>
								</div>

								<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
									<span className="text-slate-400 block mb-1">
										Price / Cycle
									</span>
									<span className="font-bold text-slate-900">
										{formatCurrency(
											viewingSub.amountInPaise,
										)}
									</span>
								</div>

								<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
									<span className="text-slate-400 block mb-1">
										Start Date
									</span>
									<span className="font-semibold text-slate-800">
										{formatDate(viewingSub.startDate)}
									</span>
								</div>

								<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
									<span className="text-slate-400 block mb-1">
										Next Billing Date
									</span>
									<span className="font-semibold text-slate-800">
										{formatDate(viewingSub.nextBillingDate)}
									</span>
								</div>
							</div>

							<div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
								<span className="text-slate-500 font-medium">
									Lifecycle Status
								</span>
								<span
									className={`px-2.5 py-0.5 rounded-full font-semibold uppercase ${getStatusBadgeClass(
										viewingSub.status,
									)}`}
								>
									{viewingSub.status}
								</span>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export const SubscriptionsPage = Subscriptions;
