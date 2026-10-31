import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/mainlayout";
import Dashboard from "./pages/dashboard/Dashboard";
import LoginPage from "./pages/auth/LoginPage";
import PlaceholderPage from "./components/common/PlaceholderPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected app routes inside shared layout */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route
            path="customers"
            element={
              <PlaceholderPage
                title="Customers"
                description="Manage your customer accounts, GSTIN details, and contact directory."
              />
            }
          />
          <Route
            path="products"
            element={
              <PlaceholderPage
                title="Products"
                description="Manage your product catalog, pricing tiers, and plan variants."
              />
            }
          />
          <Route
            path="subscriptions"
            element={
              <PlaceholderPage
                title="Subscriptions"
                description="Track, create, pause, and renew recurring customer subscriptions."
              />
            }
          />
          <Route
            path="invoices"
            element={
              <PlaceholderPage
                title="Invoices"
                description="Generate, review, and track invoices, tax calculations, and payment status."
              />
            }
          />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
