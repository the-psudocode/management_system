import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Repeat,
  FileText,
  CircleDollarSign,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Customers", path: "/customers", icon: Users },
  { name: "Products", path: "/products", icon: Package },
  { name: "Subscriptions", path: "/subscriptions", icon: Repeat },
  { name: "Invoices", path: "/invoices", icon: FileText },
];

function Sidebar() {
  return (
    <aside className="flex min-h-screen w-64 flex-col bg-slate-950 px-4 py-6 text-white">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="rounded-xl bg-indigo-600 p-2">
          <CircleDollarSign size={25} />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-wide">Brightloop</h1>
          <p className="text-xs text-slate-400">Billing Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Main Menu
        </p>

        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 pt-5">
        <p className="px-2 text-xs text-slate-500">Brightloop Billing © 2026</p>
      </div>
    </aside>
  );
}

export default Sidebar;
