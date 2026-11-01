import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./sidebar";
import Navbar from "./navbar";
import { apiService, getCurrentUserProfile } from "../../services/api";
import { logoutUser } from "../../services/firebase";
import type { AuthProfile } from "../../types";

function MainLayout() {
	const location = useLocation();
	const [profile, setProfile] = useState<AuthProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [menuOpen, setMenuOpen] = useState(false);
	const navigate = useNavigate();

	const handleLogout = async () => {
		apiService.logout();
		await logoutUser().catch(() => undefined);
		navigate("/login", { replace: true });
	};

	useEffect(() => {
		let active = true;
		getCurrentUserProfile().then((current) => { if (active) setProfile(current); })
			.catch(() => { if (active) setProfile(null); })
			.finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, []);

	if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f2] text-sm font-medium text-stone-500">Checking your session…</div>;
	if (!profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	const isPortalPath = location.pathname === "/portal" || location.pathname.startsWith("/portal/");
	if (profile.role === "customer" && !isPortalPath) return <Navigate to="/portal" replace />;
	if (profile.role !== "customer" && isPortalPath) return <Navigate to="/dashboard" replace />;
	if (profile.role !== "admin" && location.pathname === "/staff-management") return <Navigate to="/dashboard" replace />;
	if (profile.role !== "admin" && location.pathname === "/billing-rules") return <Navigate to="/dashboard" replace />;
	if (profile.role !== "admin" && location.pathname === "/accounts") return <Navigate to="/dashboard" replace />;

  return (
    <div className="app-shell flex min-h-screen bg-[#f6f7f2] text-stone-900">
      <Sidebar role={profile.role} open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar profile={profile} onMenuClick={() => setMenuOpen(true)} onLogout={() => void handleLogout()} />

        <main className="app-content min-w-0 flex-1 overflow-y-auto p-4 md:p-7 xl:px-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
