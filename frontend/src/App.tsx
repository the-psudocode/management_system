import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/mainlayout";
import Dashboard from "./pages/dashboard/Dashboard";
import Customers from "./pages/customers/Customers";
import Products from "./pages/products/Products";
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
          <Route path="customers" element={<Customers />} />
          <Route path="products" element={<Products />} />
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
