import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Package, Repeat, FileText, ClipboardList, CreditCard, Layers, UserRound, X, Settings2, ReceiptText, CircleUserRound, ClipboardCheck, UsersRound } from "lucide-react";
import type { UserRole } from "../../types";

const navigation = [
	{ name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
	{ name: "Customers", path: "/customers", icon: Users },
	{ name: "Subscriptions", path: "/subscriptions", icon: Repeat },
	{ name: "Products", path: "/products", icon: Package },
	{ name: "Plans", path: "/plans", icon: Layers },
	{ name: "Quotations", path: "/quotations", icon: ClipboardList },
	{ name: "Invoices", path: "/invoices", icon: FileText },
	{ name: "Payments", path: "/payments", icon: CreditCard },
];

function Sidebar({ role, open = false, onClose }: { role: UserRole; open?: boolean; onClose?: () => void }) {
	const requestQueue = { name: "Subscription Requests", path: "/subscription-requests", icon: ClipboardCheck };
	const items = role === "customer" ? [
		{ name: "My Dashboard", path: "/portal", icon: UserRound },
		{ name: "Explore services", path: "/portal/catalog", icon: Layers },
		{ name: "Subscribed plans", path: "/portal/subscriptions", icon: Repeat },
		{ name: "Billing & payments", path: "/portal/billing", icon: ReceiptText },
		{ name: "Profile", path: "/portal/profile", icon: CircleUserRound },
	] : role === "admin" ? [
		navigation[0], { name: "Account Directory", path: "/accounts", icon: UsersRound }, requestQueue, ...navigation.slice(2),
		{ name: "Staff Management", path: "/staff-management", icon: Users },
		{ name: "Billing Rules", path: "/billing-rules", icon: Settings2 },
	] : [navigation[0], requestQueue, ...navigation.slice(1)];
	return <>
		{open && <button aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-40 bg-stone-950/30 md:hidden" />}
		<aside aria-label="Workspace navigation" onKeyDown={(event) => { if (event.key === "Escape") onClose?.(); }} className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-[256px] flex-col border-r border-stone-200/80 bg-[#fffefa] px-4 py-5 transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
			<div className="mb-6 flex items-center justify-between px-1">
				<NavLink to="/" className="flex items-center gap-2" onClick={onClose}>
					<img src="/logo.png" alt="BrightLoop Subscription & Billing Platform" className="h-11 w-[205px] object-cover mix-blend-multiply" />
				</NavLink>
				<button type="button" aria-label="Close menu" onClick={onClose} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 md:hidden"><X size={18} /></button>
			</div>
			<p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-stone-400">Workspace</p>
			<nav className="flex-1 space-y-1">
				{items.map(({ name, path, icon: Icon }) => <NavLink key={path} to={path} end onClick={onClose} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71866b] focus-visible:ring-offset-2 ${isActive ? "bg-[#e9eee5] text-[#263b2d]" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"}`}>
					<Icon size={17} strokeWidth={1.9} /><span>{name}</span>
				</NavLink>)}
			</nav>
			<div className="mt-6 border-t border-stone-200 px-2 pt-4">
				<div className="flex items-center gap-3 rounded-xl p-2">
					<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dfe8d8] text-xs font-bold text-[#344a35]">{role === "customer" ? "AC" : role === "staff" ? "ST" : "AD"}</span>
					<div><p className="text-xs font-bold capitalize text-stone-800">{role === "customer" ? "Customer" : role === "staff" ? "Operations staff" : "Administrator"}</p><p className="text-[10px] text-stone-500">BrightLoop workspace</p></div>
				</div>
			</div>
		</aside>
	</>;
}

export default Sidebar;
