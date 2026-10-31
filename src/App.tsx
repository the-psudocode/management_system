import { Dashboard } from "./pages/Dashboard";

export function App() {
	return (
		<div className="min-h-screen bg-slate-50">
			<nav className="bg-white border-b border-slate-200 px-6 py-3">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
							B
						</div>
						<span className="font-bold text-slate-900">
							Brightloop Billing
						</span>
					</div>
					<span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
						Admin Dashboard
					</span>
				</div>
			</nav>
			<Dashboard />
		</div>
	);
}

export default App;
