import React, { useEffect, useState } from "react";
import {
	Package,
	Search,
	Plus,
	Eye,
	Edit2,
	X,
	Layers,
	ChevronLeft,
	ChevronRight,
	Trash2,
	CheckCircle,
	XCircle,
} from "lucide-react";
import type { Product, ProductVariant } from "../types";
import {
	getProducts,
	createProduct,
	updateProduct,
	toggleProductStatus,
} from "../services/api";
import { formatCurrency, formatDate } from "../utils/format";

export const Products: React.FC = () => {
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalProducts, setTotalProducts] = useState(0);

	// Modals
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [editingProduct, setEditProduct] = useState<Product | null>(null);
	const [viewingProduct, setViewProduct] = useState<Product | null>(null);

	// Form State
	const [formData, setFormData] = useState({
		name: "",
		description: "",
		category: "SaaS",
		basePriceInRupees: "",
		isActive: true,
	});

	// Variants Form State
	const [variants, setVariants] = useState<
		{
			name: string;
			sku: string;
			priceInRupees: string;
			isActive: boolean;
		}[]
	>([{ name: "Standard", sku: "STD-01", priceInRupees: "", isActive: true }]);

	const fetchProductList = async () => {
		setLoading(true);
		try {
			const res = await getProducts(page, 8, search, categoryFilter);
			setProducts(res.data);
			setTotalPages(res.totalPages);
			setTotalProducts(res.total);
		} catch (err) {
			console.error("Failed to load products:", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchProductList();
	}, [page, search, categoryFilter]);

	const handleOpenAdd = () => {
		setFormData({
			name: "",
			description: "",
			category: "SaaS",
			basePriceInRupees: "",
			isActive: true,
		});
		setVariants([
			{ name: "Standard", sku: "", priceInRupees: "", isActive: true },
		]);
		setIsAddModalOpen(true);
	};

	const handleOpenEdit = (p: Product) => {
		setEditProduct(p);
		setFormData({
			name: p.name,
			description: p.description,
			category: p.category,
			basePriceInRupees: (p.basePriceInPaise / 100).toString(),
			isActive: p.isActive,
		});
		setVariants(
			p.variants.map((v) => ({
				name: v.name,
				sku: v.sku,
				priceInRupees: (v.priceInPaise / 100).toString(),
				isActive: v.isActive,
			})),
		);
	};

	const handleAddVariantRow = () => {
		setVariants([
			...variants,
			{ name: "", sku: "", priceInRupees: "", isActive: true },
		]);
	};

	const handleRemoveVariantRow = (index: number) => {
		if (variants.length === 1) return;
		setVariants(variants.filter((_, i) => i !== index));
	};

	const handleVariantChange = (
		index: number,
		field: string,
		value: string | boolean,
	) => {
		const updated = [...variants];
		updated[index] = { ...updated[index], [field]: value };
		setVariants(updated);
	};

	const handleToggleStatus = async (id: string) => {
		try {
			await toggleProductStatus(id);
			fetchProductList();
		} catch (err) {
			console.error("Failed to toggle status:", err);
		}
	};

	const handleSubmitAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const basePriceInPaise = Math.round(
				parseFloat(formData.basePriceInRupees || "0") * 100,
			);
			const parsedVariants: ProductVariant[] = variants.map((v, i) => ({
				id: `var_${Date.now()}_${i}`,
				name: v.name || "Default Variant",
				sku: v.sku || `SKU-${i + 1}`,
				priceInPaise: Math.round(
					parseFloat(v.priceInRupees || "0") * 100,
				),
				isActive: v.isActive,
			}));

			await createProduct({
				name: formData.name,
				description: formData.description,
				category: formData.category,
				status: formData.isActive ? "active" : "inactive",
				basePriceInPaise: Math.round(
					parseFloat(formData.basePriceInRupees || "0") * 100,
				),
				variants: (formData as any).variants || [],
				isActive: formData.isActive,
			});

			setIsAddModalOpen(false);
			fetchProductList();
		} catch (err) {
			console.error("Failed to create product:", err);
		}
	};

	const handleSubmitEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingProduct) return;
		try {
			const basePriceInPaise = Math.round(
				parseFloat(formData.basePriceInRupees || "0") * 100,
			);
			const parsedVariants: ProductVariant[] = variants.map((v, i) => ({
				id: editingProduct.variants[i]?.id || `var_${Date.now()}_${i}`,
				name: v.name,
				sku: v.sku,
				priceInPaise: Math.round(
					parseFloat(v.priceInRupees || "0") * 100,
				),
				isActive: v.isActive,
			}));

			await updateProduct(editingProduct.id, {
				name: formData.name,
				description: formData.description,
				category: formData.category,
				basePriceInPaise,
				variants: parsedVariants,
				isActive: formData.isActive,
			});

			setEditProduct(null);
			fetchProductList();
		} catch (err) {
			console.error("Failed to update product:", err);
		}
	};

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			{/* Page Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">
						Product Management
					</h1>
					<p className="text-sm text-slate-500">
						Configure software products, manage pricing tiers, and
						maintain product variants.
					</p>
				</div>
				<button
					onClick={handleOpenAdd}
					className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-sm transition cursor-pointer"
				>
					<Plus className="w-4 h-4" /> Create Product
				</button>
			</div>

			{/* Filter & Search Bar */}
			<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
				<div className="relative w-full md:w-96">
					<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Search products by name or category..."
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
						Category:
					</span>
					<select
						value={categoryFilter}
						onChange={(e) => {
							setCategoryFilter(e.target.value);
							setPage(1);
						}}
						className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					>
						<option value="all">All Categories</option>
						<option value="SaaS">SaaS</option>
						<option value="Add-on">Add-on</option>
						<option value="Services">Services</option>
					</select>
				</div>
			</div>

			{/* Products Directory Table */}
			<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				{loading ? (
					<div className="p-12 text-center text-slate-500">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
						<p className="text-sm">Loading product catalog...</p>
					</div>
				) : products.length === 0 ? (
					<div className="p-12 text-center">
						<Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
						<h3 className="text-base font-semibold text-slate-800">
							No Products Found
						</h3>
						<p className="text-sm text-slate-500 mt-1">
							Try adjusting your filter or create a new product
							offering.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm text-slate-600">
							<thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
								<tr>
									<th className="py-3 px-4">Product Name</th>
									<th className="py-3 px-4">Category</th>
									<th className="py-3 px-4">Base Price</th>
									<th className="py-3 px-4">Variants</th>
									<th className="py-3 px-4">Status</th>
									<th className="py-3 px-4">Created Date</th>
									<th className="py-3 px-4 text-right">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{products.map((p) => (
									<tr
										key={p.id}
										className="hover:bg-slate-50/80 transition"
									>
										<td className="py-3.5 px-4">
											<div className="font-semibold text-slate-900">
												{p.name}
											</div>
											<div className="text-xs text-slate-400 line-clamp-1">
												{p.description}
											</div>
										</td>
										<td className="py-3.5 px-4">
											<span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">
												{p.category}
											</span>
										</td>
										<td className="py-3.5 px-4 font-bold text-slate-900">
											{formatCurrency(p.basePriceInPaise)}
										</td>
										<td className="py-3.5 px-4">
											<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
												<Layers className="w-3 h-3" />{" "}
												{p.variants.length} Variants
											</span>
										</td>
										<td className="py-3.5 px-4">
											<button
												onClick={() =>
													handleToggleStatus(p.id)
												}
												className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase cursor-pointer transition ${
													p.isActive
														? "bg-emerald-50 text-emerald-700 border border-emerald-200"
														: "bg-rose-50 text-rose-700 border border-rose-200"
												}`}
											>
												{p.isActive ? (
													<>
														<CheckCircle className="w-3 h-3" />{" "}
														Active
													</>
												) : (
													<>
														<XCircle className="w-3 h-3" />{" "}
														Inactive
													</>
												)}
											</button>
										</td>
										<td className="py-3.5 px-4 text-slate-500">
											{formatDate(p.createdAt)}
										</td>
										<td className="py-3.5 px-4 text-right">
											<div className="inline-flex items-center gap-1">
												<button
													onClick={() =>
														setViewProduct(p)
													}
													title="View Details & Variants"
													className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer"
												>
													<Eye className="w-4 h-4" />
												</button>
												<button
													onClick={() =>
														handleOpenEdit(p)
													}
													title="Edit Product"
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
				{!loading && products.length > 0 && (
					<div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
						<div>
							Showing{" "}
							<span className="font-semibold text-slate-700">
								{products.length}
							</span>{" "}
							of{" "}
							<span className="font-semibold text-slate-700">
								{totalProducts}
							</span>{" "}
							products
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

			{/* ADD / EDIT PRODUCT MODAL */}
			{(isAddModalOpen || editingProduct) && (
				<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
						<div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
							<h2 className="text-lg font-bold text-slate-900">
								{editingProduct
									? "Edit Product"
									: "Create New Product"}
							</h2>
							<button
								onClick={() => {
									setIsAddModalOpen(false);
									setEditProduct(null);
								}}
								className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<form
							onSubmit={
								editingProduct
									? handleSubmitEdit
									: handleSubmitAdd
							}
							className="p-6 space-y-6 overflow-y-auto"
						>
							{/* Product Basic Info */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Product Name *
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
										placeholder="e.g. Brightloop CRM"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Category *
									</label>
									<select
										value={formData.category}
										onChange={(e) =>
											setFormData({
												...formData,
												category: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
									>
										<option value="SaaS">SaaS</option>
										<option value="Add-on">Add-on</option>
										<option value="Services">
											Services
										</option>
									</select>
								</div>

								<div className="md:col-span-2">
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Description
									</label>
									<textarea
										rows={2}
										value={formData.description}
										onChange={(e) =>
											setFormData({
												...formData,
												description: e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="Brief description of product features..."
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
										Base Price (in ₹) *
									</label>
									<input
										required
										type="number"
										step="0.01"
										min="0"
										value={formData.basePriceInRupees}
										onChange={(e) =>
											setFormData({
												...formData,
												basePriceInRupees:
													e.target.value,
											})
										}
										className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="2999"
									/>
								</div>

								<div className="flex items-center gap-2 pt-6">
									<input
										type="checkbox"
										id="isActiveCheck"
										checked={formData.isActive}
										onChange={(e) =>
											setFormData({
												...formData,
												isActive: e.target.checked,
											})
										}
										className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
									/>
									<label
										htmlFor="isActiveCheck"
										className="text-sm font-medium text-slate-700 cursor-pointer"
									>
										Product Active for Subscriptions
									</label>
								</div>
							</div>

							{/* Dynamic Product Variants Builder */}
							<div className="border-t border-slate-200 pt-4">
								<div className="flex items-center justify-between mb-3">
									<div>
										<h3 className="text-sm font-bold text-slate-900">
											Product Variants & Pricing
										</h3>
										<p className="text-xs text-slate-500">
											Define tiers (e.g. Starter, Pro,
											Enterprise)
										</p>
									</div>
									<button
										type="button"
										onClick={handleAddVariantRow}
										className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
									>
										<Plus className="w-3.5 h-3.5" /> Add
										Variant Tier
									</button>
								</div>

								<div className="space-y-3">
									{variants.map((v, idx) => (
										<div
											key={idx}
											className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
										>
											<div className="md:col-span-4">
												<input
													type="text"
													required
													placeholder="Variant Name (e.g. Pro)"
													value={v.name}
													onChange={(e) =>
														handleVariantChange(
															idx,
															"name",
															e.target.value,
														)
													}
													className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
												/>
											</div>
											<div className="md:col-span-3">
												<input
													type="text"
													required
													placeholder="SKU Code"
													value={v.sku}
													onChange={(e) =>
														handleVariantChange(
															idx,
															"sku",
															e.target.value,
														)
													}
													className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 uppercase"
												/>
											</div>
											<div className="md:col-span-4">
												<input
													type="number"
													step="0.01"
													required
													placeholder="Price (₹)"
													value={v.priceInRupees}
													onChange={(e) =>
														handleVariantChange(
															idx,
															"priceInRupees",
															e.target.value,
														)
													}
													className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
												/>
											</div>
											<div className="md:col-span-1 text-right">
												<button
													type="button"
													disabled={
														variants.length === 1
													}
													onClick={() =>
														handleRemoveVariantRow(
															idx,
														)
													}
													className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition cursor-pointer"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Form Actions */}
							<div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
								<button
									type="button"
									onClick={() => {
										setIsAddModalOpen(false);
										setEditProduct(null);
									}}
									className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 transition cursor-pointer"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition cursor-pointer"
								>
									{editingProduct
										? "Save Product"
										: "Create Product"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* DETAIL MODAL */}
			{viewingProduct && (
				<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
						<div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
									<Package className="w-5 h-5" />
								</div>
								<div>
									<h2 className="text-lg font-bold text-slate-900">
										{viewingProduct.name}
									</h2>
									<span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
										{viewingProduct.category}
									</span>
								</div>
							</div>
							<button
								onClick={() => setViewProduct(null)}
								className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="p-6 space-y-6 overflow-y-auto">
							<div>
								<p className="text-xs font-semibold text-slate-500 uppercase">
									Description
								</p>
								<p className="text-sm text-slate-700 mt-1">
									{viewingProduct.description ||
										"No description available."}
								</p>
							</div>

							<div>
								<h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
									<Layers className="w-4 h-4 text-indigo-600" />{" "}
									Configured Product Variants
								</h3>

								<div className="space-y-2">
									{viewingProduct.variants.map((v) => (
										<div
											key={v.id}
											className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
										>
											<div>
												<p className="font-bold text-slate-900">
													{v.name}
												</p>
												<p className="text-slate-400 font-mono text-[11px]">
													SKU: {v.sku}
												</p>
											</div>
											<div className="text-right">
												<p className="font-bold text-slate-900 text-sm">
													{formatCurrency(
														v.priceInPaise,
													)}
												</p>
												<span
													className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
														v.isActive
															? "bg-emerald-100 text-emerald-800"
															: "bg-rose-100 text-rose-800"
													}`}
												>
													{v.isActive
														? "Active"
														: "Disabled"}
												</span>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export const ProductsPage = Products;
