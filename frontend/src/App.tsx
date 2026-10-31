import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/mainlayout";
import { Dashboard } from "./pages/Dashboard";
import { Customers } from "./pages/Customers";
import { Products } from "./pages/Products";
import { Subscriptions } from "./pages/Subscriptions";
import { Invoices } from "./pages/Invoices";
import { Plans } from "./pages/Plans";
import { Quotations } from "./pages/Quotations";
import { Payments } from "./pages/Payments";
import { Portal } from "./pages/Portal";
import { LoginPage } from "./pages/auth/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { PreviewPage } from "./pages/PreviewPage";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/preview" element={import.meta.env.DEV ? <PreviewPage /> : <Navigate to="/" replace />} />
				<Route path="/" element={<MainLayout />}>
					<Route path="dashboard" element={<Dashboard />} />
					<Route path="customers" element={<Customers />} />
					<Route path="products" element={<Products />} />
					<Route path="plans" element={<Plans />} />
					<Route path="quotations" element={<Quotations />} />
					<Route path="subscriptions" element={<Subscriptions />} />
					<Route path="invoices" element={<Invoices />} />
					<Route path="payments" element={<Payments />} />
					<Route path="portal" element={<Portal />} />
					<Route path="portal/catalog" element={<Portal catalogOnly />} />
				</Route>
				<Route path="*" element={<Navigate to="/dashboard" replace />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
