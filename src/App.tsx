import React, { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Customers } from "./pages/Customers";
import { LayoutDashboard, Users } from "lucide-react";

export function App() {
	const [activeTab, setActiveTab] = useState<"dashboard" | "customers">(
		"dashboard",
	);

	return (
		<div className="min-h-screen bg-slate-50">
			<nav className="bg-white border-b border-slate-200 px-6 py-2.5 sticky top-0 z-40">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-6">
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
								B
							</div>
							<span className="font-bold text-slate-900 text-lg">
								Brightloop Billing
							</span>
						</div>

						<div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
							<button
								onClick={() => setActiveTab("dashboard")}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
									activeTab === "dashboard"
										? "bg-white text-indigo-600 shadow-xs"
										: "text-slate-600 hover:text-slate-900"
								}`}
							>
								<LayoutDashboard className="w-3.5 h-3.5" />{" "}
								Dashboard
							</button>
							<button
								onClick={() => setActiveTab("customers")}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
									activeTab === "customers"
										? "bg-white text-indigo-600 shadow-xs"
										: "text-slate-600 hover:text-slate-900"
								}`}
							>
								<Users className="w-3.5 h-3.5" /> Customers
							</button>
						</div>
					</div>

					<span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
						Dev 2 Feature Mode
					</span>
				</div>
			</nav>

			<main>
				{activeTab === "dashboard" && <Dashboard />}
				{activeTab === "customers" && <Customers />}
			</main>
		</div>
	);
}

export default App;
