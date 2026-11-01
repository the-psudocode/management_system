import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
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
import { StaffManagement } from "./pages/StaffManagement";
import { AdminBillingSettings } from "./pages/AdminBillingSettings";
import { CustomerBillingPage, CustomerProfilePage, CustomerSubscriptionsPage } from "./pages/CustomerWorkspacePages";
import { SubscriptionRequests } from "./pages/SubscriptionRequests";
import { Accounts } from "./pages/Accounts";
import { getCurrentUserProfile } from "./services/api";

function PublicOnlyRoute({ children }: { children: ReactNode }) {
	const [checking, setChecking] = useState(() => Boolean(localStorage.getItem("brightloop_token")));
	const [destination, setDestination] = useState<string | null>(null);

	useEffect(() => {
		if (!localStorage.getItem("brightloop_token")) {
			setChecking(false);
			return;
		}

		let active = true;
		getCurrentUserProfile()
			.then((profile) => {
				if (active) setDestination(profile.role === "customer" ? "/portal" : "/dashboard");
			})
			.catch(() => undefined)
			.finally(() => { if (active) setChecking(false); });
		return () => { active = false; };
	}, []);

	if (checking) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f2] text-sm font-medium text-stone-500">Checking your session…</div>;
	if (destination) return <Navigate to={destination} replace />;
	return <>{children}</>;
}

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />
				<Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
				<Route path="/admin/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
				<Route path="/staff/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
				<Route path="/staff/signup" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
				<Route path="/customer/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
				<Route path="/customer/signup" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
				<Route path="/register" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
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
					<Route path="subscription-requests" element={<SubscriptionRequests />} />
					<Route path="accounts" element={<Accounts />} />
					<Route path="staff-management" element={<StaffManagement />} />
					<Route path="billing-rules" element={<AdminBillingSettings />} />
					<Route path="portal" element={<Portal />} />
					<Route path="portal/catalog" element={<Portal catalogOnly />} />
					<Route path="portal/profile" element={<CustomerProfilePage />} />
					<Route path="portal/subscriptions" element={<CustomerSubscriptionsPage />} />
					<Route path="portal/billing" element={<CustomerBillingPage />} />
				</Route>
				<Route path="*" element={<Navigate to="/dashboard" replace />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
