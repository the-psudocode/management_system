import React, { useEffect, useState } from "react";
import {
	Users,
	Search,
	Plus,
	Eye,
	Edit2,
	X,
	Mail,
	Phone,
	Building,
	MapPin,
	FileText,
	CreditCard,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import type { Customer, Subscription, Invoice } from "../types";
import {
	getCustomers,
	createCustomer,
	updateCustomer,
	getCustomerSubscriptions,
	getCustomerInvoices,
} from "../services/api";
import {
	formatDate,
	formatCurrency,
	getStatusBadgeClass,
} from "../utils/format";

export const Customers: React.FC = () => {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalCustomers, setTotalCustomers] = useState(0);

	// Modals
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [editingCustomer, setEditCustomer] = useState<Customer | null>(null);
	const [viewingCustomer, setViewCustomer] = useState<Customer | null>(null);
	const [customerSubs, setCustomerSubs] = useState<Subscription[]>([]);
	const [customerInvs, setCustomerInvs] = useState<Invoice[]>([]);
	const [detailLoading, setDetailLoading] = useState(false);

	// Form State
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		phone: "",
		company: "",
		address: "",
		city: "",
		state: "",
		pincode: "",
		gstin: "",
		status: "active" as "active" | "inactive",
	});

	const fetchCustomerList = async () => {
		setLoading(true);
		try {
			const res = await getCustomers(page, 8, search, statusFilter);
			setCustomers(res.data);
			setTotalPages(res.totalPages);
			setTotalCustomers(res.total);
		} catch (err) {
			console.error("Failed to load customers:", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchCustomerList();
	}, [page, search, statusFilter]);

	const handleOpenAdd = () => {
		setFormData({
			name: "",
			email: "",
			phone: "",
			company: "",
			address: "",
			city: "",
			state: "",
			pincode: "",
			gstin: "",
			status: "active",
		});
		setIsAddModalOpen(true);
	};

	const handleOpenEdit = (c: Customer) => {
		setEditCustomer(c);
		setFormData({
			name: c.name,
			email: c.email,
			phone: c.phone,
			company: c.company,
			address: c.address,
			city: c.city,
			state: c.state,
			pincode: c.pincode,
			gstin: c.gstin,
			status: c.status,
		});
	};

	const handleOpenView = async (c: Customer) => {
		setViewCustomer(c);
		setDetailLoading(true);
		try {
			const [subs, invs] = await Promise.all([
				getCustomerSubscriptions(c.id),
				getCustomerInvoices(c.id),
			]);
			setCustomerSubs(subs);
			setCustomerInvs(invs);
		} catch (err) {
			console.error("Error loading customer relations:", err);
		} finally {
			setDetailLoading(false);
		}
	};

	const handleSubmitAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await createCustomer(formData);
			setIsAddModalOpen(false);
			fetchCustomerList();
		} catch (err) {
			console.error("Failed to create customer:", err);
		}
	};

	const handleSubmitEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingCustomer) return;
		try {
			await updateCustomer(editingCustomer.id, formData);
			setEditCustomer(null);
			fetchCustomerList();
		} catch (err) {
			console.error("Failed to update customer:", err);
		}
	};

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			{/* Page Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">
						Customer Management
					</h1>
					<p className="text-sm text-slate-500">
						Manage customer accounts, view profiles, and monitor
						active subscriptions.
					</p>
				</div>
				<button
					onClick={handleOpenAdd}
					className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-sm transition cursor-pointer"
				>
					<Plus className="w-4 h-4" /> Add Customer
				</button>
			</div>

			{/* Filter & Search Bar */}
			<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
				<div className="relative w-full md:w-96">
					<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Search by name, email, company, city..."
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
						<option value="all">All Customers</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
				</div>
			</div>

			{/* Table Container */}
			<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				{loading ? (
					<div className="p-12 text-center text-slate-500">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
						<p className="text-sm">Loading customer directory...</p>
					</div>
				) : customers.length === 0 ? (
					<div className="p-12 text-center">
						<Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
						<h3 className="text-base font-semibold text-slate-800">
							No Customers Found
						</h3>
						<p className="text-sm text-slate-500 mt-1">
							Try adjusting your search criteria or add a new
							customer account.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm text-slate-600">
							<thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
								<tr>
									<th className="py-3 px-4">
										Customer / Email
									</th>
									<th className="py-3 px-4">Company</th>
									<th className="py-3 px-4">Phone</th>
									<th className="py-3 px-4">Location</th>
									<th className="py-3 px-4">Status</th>
									<th className="py-3 px-4">Created Date</th>
									<th className="py-3 px-4 text-right">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{customers.map((c) => (
									<tr
										key={c.id}
										className="hover:bg-slate-50/80 transition"
									>
										<td className="py-3.5 px-4">
											<div className="font-semibold text-slate-900">
												{c.name}
											</div>
											<div className="text-xs text-slate-400">
												{c.email}
											</div>
										</td>
										<td className="py-3.5 px-4 font-medium text-slate-700">
											{c.company}
										</td>
										<td className="py-3.5 px-4 text-slate-600">
											{c.phone}
										</td>
										<td className="py-3.5 px-4 text-slate-600">
											{c.city}, {c.state}
										</td>
										<td className="py-3.5 px-4">
											<span
												className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${getStatusBadgeClass(
													c.status,
												)}`}
											>
												{c.status}
											</span>
										</td>
										<td className="py-3.5 px-4 text-slate-500">
											{formatDate(c.createdAt)}
										</td>
										<td className="py-3.5 px-4 text-right">
											<div className="inline-flex items-center gap-1">
												<button
													onClick={() =>
														handleOpenView(c)
													}
													title="View Profile"
													className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer"
												>
													<Eye className="w-4 h-4" />
												</button>
												<button
													onClick={() =>
														handleOpenEdit(c)
													}
													title="Edit Customer"
													className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
												>
													<Edit2 className="w-4 h-4" />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination Footer */}
				{!loading && customers.length > 0 && (
					<div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
						<div>
							Showing{" "}
							<span className="font-semibold text-slate-700">
								{customers.length}
							</span>{" "}
							of{" "}
							<span className="font-semibold text-slate-700">
								{totalCustomers}
							</span>{" "}
							customers
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

			{/* ADD / EDIT MODAL */}
			{(isAddModalOpen || editingCustomer) && (
				<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
						<div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
							<h2 className="text-lg font-bold text-slate-900">
								{editingCustomer
									? "Edit Customer"
									: "Add New Customer"}
							</h2>
							<button
								onClick={() => {
									setIsAddModalOpen(false);
									setEditCustomer(null);
								}}
								className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<form
							onSubmit={
								editingCustomer
									? handleSubmitEdit
									: handleSubmitAdd
							}
							className="p-6 space-y-4 overflow-y-auto"
						>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Full Name *
									</label>
									<input
										required
										type="text"
										value={formData.name}
										onChange={(e) =>
											setFormData({
												...formData,
												name: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="e.g. Rajesh Kumar"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Email Address *
									</label>
									<input
										required
										type="email"
										value={formData.email}
										onChange={(e) =>
											setFormData({
												...formData,
												email: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="rajesh@techstart.in"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Phone Number *
									</label>
									<input
										required
										type="text"
										value={formData.phone}
										onChange={(e) =>
											setFormData({
												...formData,
												phone: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="+91 98765 43210"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Company Name *
									</label>
									<input
										required
										type="text"
										value={formData.company}
										onChange={(e) =>
											setFormData({
												...formData,
												company: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="TechStart Solutions"
									/>
								</div>

								<div className="md:col-span-2">
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Street Address
									</label>
									<input
										type="text"
										value={formData.address}
										onChange={(e) =>
											setFormData({
												...formData,
												address: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="42, MG Road, Koramangala"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										City
									</label>
									<input
										type="text"
										value={formData.city}
										onChange={(e) =>
											setFormData({
												...formData,
												city: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="Bengaluru"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										State
									</label>
									<input
										type="text"
										value={formData.state}
										onChange={(e) =>
											setFormData({
												...formData,
												state: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="Karnataka"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Pincode
									</label>
									<input
										type="text"
										value={formData.pincode}
										onChange={(e) =>
											setFormData({
												...formData,
												pincode: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="560034"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										GSTIN
									</label>
									<input
										type="text"
										value={formData.gstin}
										onChange={(e) =>
											setFormData({
												...formData,
												gstin: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="29ABCDE1234F1Z5"
									/>
								</div>

								{editingCustomer && (
									<div>
										<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
											Status
										</label>
										<select
											value={formData.status}
											onChange={(e) =>
												setFormData({
													...formData,
													status: e.target.value as
														| "active"
														| "inactive",
												})
											}
											className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										>
											<option value="active">
												Active
											</option>
											<option value="inactive">
												Inactive
											</option>
										</select>
									</div>
								)}
							</div>

							<div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
								<button
									type="button"
									onClick={() => {
										setIsAddModalOpen(false);
										setEditCustomer(null);
									}}
									className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 transition cursor-pointer"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition cursor-pointer"
								>
									{editingCustomer
										? "Save Changes"
										: "Create Customer"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* DETAIL VIEW MODAL */}
			{viewingCustomer && (
				<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
						<div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-lg">
									{viewingCustomer.name.charAt(0)}
								</div>
								<div>
									<h2 className="text-lg font-bold text-slate-900">
										{viewingCustomer.name}
									</h2>
									<p className="text-xs text-slate-500">
										{viewingCustomer.company}
									</p>
								</div>
							</div>
							<button
								onClick={() => setViewCustomer(null)}
								className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="p-6 space-y-6 overflow-y-auto">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
								<div className="flex items-center gap-2 text-slate-700">
									<Mail className="w-4 h-4 text-slate-400" />
									<span>{viewingCustomer.email}</span>
								</div>
								<div className="flex items-center gap-2 text-slate-700">
									<Phone className="w-4 h-4 text-slate-400" />
									<span>{viewingCustomer.phone}</span>
								</div>
								<div className="flex items-center gap-2 text-slate-700">
									<Building className="w-4 h-4 text-slate-400" />
									<span>
										GSTIN:{" "}
										{viewingCustomer.gstin ||
											"Not Provided"}
									</span>
								</div>
								<div className="flex items-center gap-2 text-slate-700">
									<MapPin className="w-4 h-4 text-slate-400" />
									<span>
										{viewingCustomer.address},{" "}
										{viewingCustomer.city},{" "}
										{viewingCustomer.state} -{" "}
										{viewingCustomer.pincode}
									</span>
								</div>
							</div>

							<div>
								<h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
									<CreditCard className="w-4 h-4 text-indigo-600" />{" "}
									Active Subscriptions
								</h3>
								{detailLoading ? (
									<p className="text-xs text-slate-400">
										Loading subscriptions...
									</p>
								) : customerSubs.length === 0 ? (
									<p className="text-xs text-slate-400 italic">
										No subscriptions found for this
										customer.
									</p>
								) : (
									<div className="space-y-2">
										{customerSubs.map((s) => (
											<div
												key={s.id}
												className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
											>
												<div>
													<p className="font-semibold text-slate-800">
														{s.planName}
													</p>
													<p className="text-slate-400">
														Next Billing:{" "}
														{formatDate(
															s.nextBillingDate,
														)}
													</p>
												</div>
												<div className="text-right">
													<span
														className={`px-2 py-0.5 rounded-full font-semibold uppercase ${getStatusBadgeClass(
															s.status,
														)}`}
													>
														{s.status}
													</span>
													<p className="font-bold text-slate-900 mt-1">
														{formatCurrency(
															s.amountInPaise,
														)}
													</p>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							<div>
								<h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
									<FileText className="w-4 h-4 text-indigo-600" />{" "}
									Invoice History
								</h3>
								{detailLoading ? (
									<p className="text-xs text-slate-400">
										Loading invoices...
									</p>
								) : customerInvs.length === 0 ? (
									<p className="text-xs text-slate-400 italic">
										No invoices generated yet.
									</p>
								) : (
									<div className="space-y-2">
										{customerInvs.map((inv) => (
											<div
												key={inv.id}
												className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
											>
												<div>
													<p className="font-semibold text-slate-800">
														{inv.invoiceNumber}
													</p>
													<p className="text-slate-400">
														Due:{" "}
														{formatDate(
															inv.dueDate,
														)}
													</p>
												</div>
												<div className="text-right">
													<span
														className={`px-2 py-0.5 rounded-full font-semibold uppercase ${getStatusBadgeClass(
															inv.status,
														)}`}
													>
														{inv.status}
													</span>
													<p className="font-bold text-slate-900 mt-1">
														{formatCurrency(
															inv.totalInPaise,
														)}
													</p>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
