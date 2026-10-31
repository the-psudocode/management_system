import { Search, Bell, ChevronDown } from "lucide-react";

function Navbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
      {/* Page title */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          Brightloop Billing
        </h2>
        <p className="text-sm text-slate-500">
          Manage your business subscriptions
        </p>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-36 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
        >
          <Bell size={21} />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
            A
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">Admin User</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>

          <ChevronDown size={17} className="text-slate-400" />
        </div>
      </div>
    </header>
  );
}

export default Navbar;
