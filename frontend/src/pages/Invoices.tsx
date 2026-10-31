// frontend/src/pages/Invoices.tsx
import React, { useState, useEffect } from "react";
import {
	FileText,
	Search,
	Filter,
	Plus,
	Eye,
	DollarSign,
	CheckCircle2,
	AlertCircle,
	Clock,
	X,
	Printer,
} from "lucide-react";
import { apiService } from "../services/api";
import type { Invoice, Customer, Payment } from "../types";
import {
	formatCurrency,
	formatDate,
	getStatusBadgeClass,
} from "../utils/format";

export const InvoicesPage: React.FC = () => {
	const [invoices, setInvoices] = useState<Invoice[]>([]);
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");

	// Selected Invoice Detail View
	const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(
		null,
	);
	const [invoicePayments, setInvoicePayments] = useState<Payment[]>([]);

	// Record Payment Modal
	const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
	const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
	const [paymentAmountRupees, setPaymentAmountRupees] = useState<string>("");
	const [paymentMethod, setPaymentMethod] =
		useState<Payment["paymentMethod"]>("upi");
	const [paymentRef, setPaymentRef] = useState<string>("");
	const [paymentSubmitting, setPaymentSubmitting] = useState(false);
	const [paymentError, setPaymentError] = useState<string | null>(null);

	// Create Invoice Modal
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [selectedCustomerId, setSelectedCustomerId] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [lineItems, setLineItems] = useState<
		Array<{
			description: string;
			quantity: number;
			unitPriceRupees: string;
		}>
	>([
		{
			description: "SaaS Platform License",
			quantity: 1,
			unitPriceRupees: "4999",
		},
	]);
	const [createSubmitting, setCreateSubmitting] = useState(false);

	useEffect(() => {
		fetchData();
	}, [statusFilter, searchQuery]);

	const fetchData = async () => {
		setLoading(true);
		try {
			const [invData, custData] = await Promise.all([
				apiService.getInvoices(statusFilter, undefined, searchQuery),
				apiService.getCustomers(),
			]);
			setInvoices(invData);
			setCustomers(custData);
		} catch (err) {
			console.error("Failed to load invoices:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleOpenDetail = async (invoice: Invoice) => {
		setSelectedInvoice(invoice);
		try {
			const payments = await apiService.getPaymentsByInvoiceId(
				invoice.id,
			);
			setInvoicePayments(payments);
		} catch (err) {
			console.error("Failed to load payments for invoice", err);
		}
	};

	const handleOpenRecordPayment = (invoice: Invoice) => {
		setPaymentInvoice(invoice);
		setPaymentAmountRupees((invoice.balanceDuePaise / 100).toString());
		setPaymentRef(`UTR-${Math.floor(10000000 + Math.random() * 90000000)}`);
		setPaymentError(null);
		setIsPaymentModalOpen(true);
	};

	const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!paymentInvoice) return;

		const amountPaise = Math.round(parseFloat(paymentAmountRupees) * 100);
		if (isNaN(amountPaise) || amountPaise <= 0) {
			setPaymentError("Please enter a valid positive payment amount.");
			return;
		}

		if (amountPaise > paymentInvoice.balanceDuePaise) {
			setPaymentError(
				`Payment amount cannot exceed balance due (${formatCurrency(paymentInvoice.balanceDuePaise)})`,
			);
			return;
		}

		setPaymentSubmitting(true);
		setPaymentError(null);
		try {
			const { invoice: updatedInv } = await apiService.recordPayment({
				invoiceId: paymentInvoice.id,
				amountPaise,
				paymentMethod,
				referenceNumber: paymentRef,
			});

			setIsPaymentModalOpen(false);
			setPaymentInvoice(null);
			fetchData();

			if (selectedInvoice && selectedInvoice.id === updatedInv.id) {
				setSelectedInvoice(updatedInv);
				const payments = await apiService.getPaymentsByInvoiceId(
					updatedInv.id,
				);
				setInvoicePayments(payments);
			}
		} catch (err: any) {
			setPaymentError(err.message || "Failed to record payment");
		} finally {
			setPaymentSubmitting(false);
		}
	};

	const handleAddLineItem = () => {
		setLineItems([
			...lineItems,
			{ description: "", quantity: 1, unitPriceRupees: "0" },
		]);
	};

	const handleRemoveLineItem = (index: number) => {
		if (lineItems.length === 1) return;
		setLineItems(lineItems.filter((_, i) => i !== index));
	};

	const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedCustomerId || !dueDate) return;

		setCreateSubmitting(true);
		try {
			const items = lineItems.map((item) => ({
				description: item.description || "Custom Item",
				quantity: Math.max(1, Number(item.quantity)),
				unitPricePaise: Math.round(
					parseFloat(item.unitPriceRupees || "0") * 100,
				),
			}));

			await apiService.createInvoice({
				customerId: selectedCustomerId,
				dueDate,
				items,
			});

			setIsCreateModalOpen(false);
			setSelectedCustomerId("");
			setDueDate("");
			setLineItems([
				{
					description: "SaaS Platform License",
					quantity: 1,
					unitPriceRupees: "4999",
				},
			]);
			fetchData();
		} catch (err) {
			console.error("Failed to create invoice", err);
		} finally {
			setCreateSubmitting(false);
		}
	};

	const totalInvoiced = invoices.reduce((acc, i) => acc + i.totalPaise, 0);
	const totalPaid = invoices.reduce((acc, i) => acc + i.paidAmountPaise, 0);
	const totalOutstanding = invoices.reduce(
		(acc, i) => acc + i.balanceDuePaise,
		0,
	);
	const overdueCount = invoices.filter((i) => i.status === "overdue").length;

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">
						Invoice Management
					</h1>
					<p className="text-sm text-gray-500">
						Track invoices, issue billing records, and process
						payments
					</p>
				</div>
				<button
					onClick={() => setIsCreateModalOpen(true)}
					className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm shadow-sm"
				>
					<Plus className="w-4 h-4 mr-2" />
					Create Invoice
				</button>
			</div>

			{/* Metric Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
						<span>Total Invoiced</span>
						<FileText className="w-4 h-4 text-indigo-500" />
					</div>
					<div className="text-2xl font-bold text-gray-900">
						{formatCurrency(totalInvoiced)}
					</div>
					<div className="text-xs text-gray-400 mt-1">
						{invoices.length} invoices
					</div>
				</div>

				<div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
						<span>Total Collected</span>
						<CheckCircle2 className="w-4 h-4 text-emerald-500" />
					</div>
					<div className="text-2xl font-bold text-emerald-600">
						{formatCurrency(totalPaid)}
					</div>
					<div className="text-xs text-emerald-600 mt-1 font-medium">
						{totalInvoiced > 0
							? `${Math.round((totalPaid / totalInvoiced) * 100)}% collection rate`
							: "0%"}
					</div>
				</div>

				<div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
						<span>Outstanding</span>
						<Clock className="w-4 h-4 text-amber-500" />
					</div>
					<div className="text-2xl font-bold text-amber-600">
						{formatCurrency(totalOutstanding)}
					</div>
					<div className="text-xs text-amber-600 mt-1 font-medium">
						Pending collection
					</div>
				</div>

				<div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex justify-between items-center text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
						<span>Overdue</span>
						<AlertCircle className="w-4 h-4 text-rose-500" />
					</div>
					<div className="text-2xl font-bold text-rose-600">
						{overdueCount}
					</div>
					<div className="text-xs text-rose-500 mt-1 font-medium">
						Needs follow-up
					</div>
				</div>
			</div>

			{/* Filter Bar */}
			<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
				<div className="relative flex-1 max-w-md w-full">
					<Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
					<input
						type="text"
						placeholder="Search invoice number or customer..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					/>
				</div>

				<div className="flex items-center space-x-3 w-full sm:w-auto">
					<Filter className="w-4 h-4 text-gray-400" />
					<span className="text-xs font-medium text-gray-500 uppercase">
						Status:
					</span>
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
					>
						<option value="all">All Invoices</option>
						<option value="draft">Draft</option>
						<option value="sent">Sent</option>
						<option value="paid">Paid</option>
						<option value="partially_paid">Partially Paid</option>
						<option value="overdue">Overdue</option>
						<option value="void">Void</option>
					</select>
				</div>
			</div>

			{/* Invoice Table */}
			<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
				{loading ? (
					<div className="p-12 text-center text-gray-500">
						Loading invoices...
					</div>
				) : invoices.length === 0 ? (
					<div className="p-12 text-center text-gray-500">
						No invoices found matching criteria.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm text-gray-600">
							<thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
								<tr>
									<th className="px-6 py-3 font-semibold">
										Invoice #
									</th>
									<th className="px-6 py-3 font-semibold">
										Customer
									</th>
									<th className="px-6 py-3 font-semibold">
										Issue Date
									</th>
									<th className="px-6 py-3 font-semibold">
										Due Date
									</th>
									<th className="px-6 py-3 font-semibold">
										Total
									</th>
									<th className="px-6 py-3 font-semibold">
										Balance Due
									</th>
									<th className="px-6 py-3 font-semibold">
										Status
									</th>
									<th className="px-6 py-3 font-semibold text-right">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{invoices.map((inv) => (
									<tr
										key={inv.id}
										className="hover:bg-gray-50 transition"
									>
										<td className="px-6 py-4 font-semibold text-indigo-600 font-mono">
											{inv.invoiceNumber}
										</td>
										<td className="px-6 py-4">
											<div className="font-medium text-gray-900">
												{inv.customerName}
											</div>
											<div className="text-xs text-gray-400">
												{inv.customerEmail}
											</div>
										</td>
										<td className="px-6 py-4 text-gray-500">
											{formatDate(inv.issueDate)}
										</td>
										<td className="px-6 py-4 text-gray-500">
											{formatDate(inv.dueDate)}
										</td>
										<td className="px-6 py-4 font-medium text-gray-900">
											{formatCurrency(inv.totalPaise)}
										</td>
										<td className="px-6 py-4 font-semibold text-amber-600">
											{inv.balanceDuePaise === 0
												? "₹0.00"
												: formatCurrency(
														inv.balanceDuePaise,
													)}
										</td>
										<td className="px-6 py-4">
											<span
												className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${getStatusBadgeClass(inv.status)}`}
											>
												{inv.status.replace("_", " ")}
											</span>
										</td>
										<td className="px-6 py-4 text-right space-x-2">
											<button
												onClick={() =>
													handleOpenDetail(inv)
												}
												title="View Invoice"
												className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
											>
												<Eye className="w-4 h-4" />
											</button>
											{inv.balanceDuePaise > 0 &&
												inv.status !== "void" && (
													<button
														onClick={() =>
															handleOpenRecordPayment(
																inv,
															)
														}
														className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition border border-emerald-200"
													>
														<DollarSign className="w-3.5 h-3.5 mr-0.5" />
														Pay
													</button>
												)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Selected Invoice Detail Modal */}
			{selectedInvoice && (
				<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto relative">
						<div className="flex justify-between items-start border-b border-gray-100 pb-4">
							<div>
								<span
									className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize mb-2 ${getStatusBadgeClass(selectedInvoice.status)}`}
								>
									{selectedInvoice.status.replace("_", " ")}
								</span>
								<h2 className="text-2xl font-bold font-mono text-gray-900">
									{selectedInvoice.invoiceNumber}
								</h2>
							</div>
							<div className="flex items-center space-x-2">
								<button
									onClick={() => window.print()}
									className="inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
								>
									<Printer className="w-3.5 h-3.5 mr-1" />
									Print
								</button>
								<button
									onClick={() => setSelectedInvoice(null)}
									className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
								>
									<X className="w-5 h-5" />
								</button>
							</div>
						</div>

						{/* Billed To */}
						<div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl text-sm">
							<div>
								<div className="text-xs uppercase text-gray-400 font-semibold mb-1">
									Billed To
								</div>
								<div className="font-semibold text-gray-900">
									{selectedInvoice.customerName}
								</div>
								<div className="text-xs text-gray-500">
									{selectedInvoice.customerEmail}
								</div>
							</div>
							<div className="text-right">
								<div className="text-xs uppercase text-gray-400 font-semibold mb-1">
									Dates
								</div>
								<div>
									Issued:{" "}
									<span className="font-medium text-gray-900">
										{formatDate(selectedInvoice.issueDate)}
									</span>
								</div>
								<div>
									Due:{" "}
									<span className="font-medium text-gray-900">
										{formatDate(selectedInvoice.dueDate)}
									</span>
								</div>
							</div>
						</div>

						{/* Line Items */}
						<div>
							<h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
								Line Items
							</h4>
							<table className="w-full text-sm">
								<thead className="bg-gray-100 text-gray-600 text-xs">
									<tr>
										<th className="p-2 text-left">
											Description
										</th>
										<th className="p-2 text-center">Qty</th>
										<th className="p-2 text-right">
											Price
										</th>
										<th className="p-2 text-right">
											Total
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100">
									{(selectedInvoice.items || []).map((item: any) => (
										<tr key={item.id}>
											<td className="p-2 font-medium text-gray-900">
												{item.description}
											</td>
											<td className="p-2 text-center text-gray-600">
												{item.quantity}
											</td>
											<td className="p-2 text-right text-gray-600">
												{formatCurrency(
													item.unitPricePaise,
												)}
											</td>
											<td className="p-2 text-right font-medium text-gray-900">
												{formatCurrency(
													item.totalPaise,
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Math Breakdown */}
						<div className="flex justify-end border-t border-gray-100 pt-3">
							<div className="w-60 space-y-1.5 text-sm">
								<div className="flex justify-between text-gray-600">
									<span>Subtotal:</span>
									<span>
										{formatCurrency(
											selectedInvoice.subtotalPaise,
										)}
									</span>
								</div>
								<div className="flex justify-between text-gray-600">
									<span>GST (18%):</span>
									<span>
										{formatCurrency(
											selectedInvoice.taxPaise,
										)}
									</span>
								</div>
								<div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
									<span>Total Amount:</span>
									<span>
										{formatCurrency(
											selectedInvoice.totalPaise,
										)}
									</span>
								</div>
								<div className="flex justify-between text-emerald-600 font-medium">
									<span>Amount Paid:</span>
									<span>
										{formatCurrency(
											selectedInvoice.paidAmountPaise,
										)}
									</span>
								</div>
								<div className="flex justify-between text-rose-600 font-bold border-t border-dashed border-gray-200 pt-1">
									<span>Balance Due:</span>
									<span>
										{formatCurrency(
											selectedInvoice.balanceDuePaise,
										)}
									</span>
								</div>
							</div>
						</div>

						{/* Recorded Payments */}
						{invoicePayments.length > 0 && (
							<div className="border-t border-gray-100 pt-3">
								<h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
									Payment Receipts
								</h4>
								<div className="space-y-2">
									{invoicePayments.map((p) => (
										<div
											key={p.id}
											className="flex justify-between items-center bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-100 text-xs"
										>
											<div>
												<div className="font-semibold text-emerald-900 capitalize">
													{p.paymentMethod.replace(
														"_",
														" ",
													)}
												</div>
												<div className="text-emerald-700 font-mono">
													Ref: {p.referenceNumber}
												</div>
											</div>
											<div className="text-right">
												<div className="font-bold text-emerald-800 text-sm">
													{formatCurrency(
														p.amountPaise,
													)}
												</div>
												<div className="text-emerald-600">
													{formatDate(p.paymentDate)}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Record Payment Modal */}
			{isPaymentModalOpen && paymentInvoice && (
				<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
						<div className="flex justify-between items-center border-b border-gray-100 pb-3">
							<h3 className="text-lg font-bold text-gray-900">
								Record Payment
							</h3>
							<button
								onClick={() => setIsPaymentModalOpen(false)}
								className="text-gray-400 hover:text-gray-600"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-900">
							<div>
								Invoice:{" "}
								<strong className="font-mono">
									{paymentInvoice.invoiceNumber}
								</strong>
							</div>
							<div>
								Customer:{" "}
								<strong>{paymentInvoice.customerName}</strong>
							</div>
							<div>
								Balance Due:{" "}
								<strong className="text-rose-600">
									{formatCurrency(
										paymentInvoice.balanceDuePaise,
									)}
								</strong>
							</div>
						</div>

						{paymentError && (
							<div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
								{paymentError}
							</div>
						)}

						<form
							onSubmit={handleRecordPaymentSubmit}
							className="space-y-4"
						>
							<div>
								<label className="block text-xs font-medium text-gray-700 mb-1">
									Payment Amount (INR ₹)
								</label>
								<div className="relative">
									<span className="absolute left-3 top-2 text-gray-500 font-semibold">
										₹
									</span>
									<input
										type="number"
										step="0.01"
										required
										value={paymentAmountRupees}
										onChange={(e) =>
											setPaymentAmountRupees(
												e.target.value,
											)
										}
										className="pl-7 w-full border border-gray-300 rounded-lg p-2 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-medium text-gray-700 mb-1">
									Payment Method
								</label>
								<select
									value={paymentMethod}
									onChange={(e) =>
										setPaymentMethod(
											e.target
												.value as Payment["paymentMethod"],
										)
									}
									className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
								>
									<option value="upi">
										UPI (GPay / PhonePe / Paytm)
									</option>
									<option value="credit_card">
										Credit / Debit Card
									</option>
									<option value="bank_transfer">
										Bank Transfer (NEFT/RTGS)
									</option>
									<option value="net_banking">
										Net Banking
									</option>
									<option value="cash">Cash</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-medium text-gray-700 mb-1">
									Transaction Ref / UTR #
								</label>
								<input
									type="text"
									required
									value={paymentRef}
									onChange={(e) =>
										setPaymentRef(e.target.value)
									}
									className="w-full border border-gray-300 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
								/>
							</div>

							<div className="flex justify-end space-x-3 pt-2">
								<button
									type="button"
									onClick={() => setIsPaymentModalOpen(false)}
									className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={paymentSubmitting}
									className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
								>
									{paymentSubmitting
										? "Recording..."
										: "Confirm Payment"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Create Invoice Modal */}
			{isCreateModalOpen && (
				<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
						<div className="flex justify-between items-center border-b border-gray-100 pb-3">
							<h3 className="text-lg font-bold text-gray-900">
								Create New Invoice
							</h3>
							<button
								onClick={() => setIsCreateModalOpen(false)}
								className="text-gray-400 hover:text-gray-600"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<form
							onSubmit={handleCreateInvoiceSubmit}
							className="space-y-4"
						>
							<div>
								<label className="block text-xs font-medium text-gray-700 mb-1">
									Customer
								</label>
								<select
									required
									value={selectedCustomerId}
									onChange={(e) =>
										setSelectedCustomerId(e.target.value)
									}
									className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
								>
									<option value="">
										Select a Customer...
									</option>
									{customers.map((c) => (
										<option key={c.id} value={c.id}>
											{c.name} ({c.email})
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xs font-medium text-gray-700 mb-1">
									Due Date
								</label>
								<input
									type="date"
									required
									value={dueDate}
									onChange={(e) => setDueDate(e.target.value)}
									className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
								/>
							</div>

							{/* Dynamic Line Items */}
							<div className="space-y-3">
								<div className="flex justify-between items-center">
									<label className="text-xs font-semibold text-gray-700 uppercase">
										Line Items
									</label>
									<button
										type="button"
										onClick={handleAddLineItem}
										className="text-xs text-indigo-600 font-medium hover:underline"
									>
										+ Add Item
									</button>
								</div>

								{lineItems.map((item, idx) => (
									<div
										key={idx}
										className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg"
									>
										<input
											type="text"
											placeholder="Description"
											required
											value={item.description}
											onChange={(e) => {
												const copy = [...lineItems];
												copy[idx].description =
													e.target.value;
												setLineItems(copy);
											}}
											className="flex-1 border border-gray-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
										/>
										<input
											type="number"
											min="1"
											placeholder="Qty"
											required
											value={item.quantity}
											onChange={(e) => {
												const copy = [...lineItems];
												copy[idx].quantity = Number(
													e.target.value,
												);
												setLineItems(copy);
											}}
											className="w-16 border border-gray-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
										/>
										<input
											type="number"
											step="0.01"
											placeholder="₹ Price"
											required
											value={item.unitPriceRupees}
											onChange={(e) => {
												const copy = [...lineItems];
												copy[idx].unitPriceRupees =
													e.target.value;
												setLineItems(copy);
											}}
											className="w-24 border border-gray-300 rounded p-1.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
										/>
										{lineItems.length > 1 && (
											<button
												type="button"
												onClick={() =>
													handleRemoveLineItem(idx)
												}
												className="text-rose-500 hover:text-rose-700 p-1"
											>
												<X className="w-4 h-4" />
											</button>
										)}
									</div>
								))}
							</div>

							<div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
								<button
									type="button"
									onClick={() => setIsCreateModalOpen(false)}
									className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={createSubmitting}
									className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
								>
									{createSubmitting
										? "Creating..."
										: "Issue Invoice"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
