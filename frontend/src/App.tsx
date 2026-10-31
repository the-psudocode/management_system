import React, { useState } from "react";
import {
	LayoutDashboard,
	Users,
	Package,
	RefreshCw,
	FileText,
} from "lucide-react";
import { DashboardPage } from "./pages/Dashboard";
import { CustomersPage } from "./pages/Customers";
import { ProductsPage } from "./pages/Products";
import { SubscriptionsPage } from "./pages/Subscriptions";
import { InvoicesPage } from "./pages/Invoices";

type Tab = "dash" | "cust" | "prod" | "sub" | "inv";

export function App() {
	const [activeTab, setActiveTab] = useState<Tab>("dash");

	return (
		<div className="min-h-screen bg-gray-50 flex flex-col">
			<header className="bg-slate-900 text-white p-4">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<span className="font-bold text-xl">
						Brightloop Billing
					</span>
					<nav className="flex space-x-4">
						<button
							onClick={() => setActiveTab("dash")}
							className={`p-2 rounded ${activeTab === "dash" ? "bg-indigo-600" : ""}`}
						>
							<LayoutDashboard className="w-5 h-5" />
						</button>
						<button
							onClick={() => setActiveTab("cust")}
							className={`p-2 rounded ${activeTab === "cust" ? "bg-indigo-600" : ""}`}
						>
							<Users className="w-5 h-5" />
						</button>
						<button
							onClick={() => setActiveTab("prod")}
							className={`p-2 rounded ${activeTab === "prod" ? "bg-indigo-600" : ""}`}
						>
							<Package className="w-5 h-5" />
						</button>
						<button
							onClick={() => setActiveTab("sub")}
							className={`p-2 rounded ${activeTab === "sub" ? "bg-indigo-600" : ""}`}
						>
							<RefreshCw className="w-5 h-5" />
						</button>
						<button
							onClick={() => setActiveTab("inv")}
							className={`p-2 rounded ${activeTab === "inv" ? "bg-indigo-600" : ""}`}
						>
							<FileText className="w-5 h-5" />
						</button>
					</nav>
				</div>
			</header>
			<main className="flex-1 max-w-7xl w-full mx-auto">
				{activeTab === "dash" && <DashboardPage />}
				{activeTab === "cust" && <CustomersPage />}
				{activeTab === "prod" && <ProductsPage />}
				{activeTab === "sub" && <SubscriptionsPage />}
				{activeTab === "inv" && <InvoicesPage />}
			</main>
		</div>
	);
}
export default App;
