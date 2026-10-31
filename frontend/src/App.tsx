import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/mainlayout";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { Customers } from "./pages/customers/Customers";
import { Products } from "./pages/products/Products";
import { Subscriptions } from "./pages/Subscriptions";
import { InvoicesPage } from "./pages/Invoices";
import { LoginPage } from "./pages/auth/LoginPage";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route path="/" element={<MainLayout />}>
					<Route index element={<Navigate to="/dashboard" replace />} />
					<Route path="dashboard" element={<Dashboard />} />
					<Route path="customers" element={<Customers />} />
					<Route path="products" element={<Products />} />
					<Route path="subscriptions" element={<Subscriptions />} />
					<Route path="invoices" element={<InvoicesPage />} />
				</Route>
				<Route path="*" element={<Navigate to="/dashboard" replace />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
