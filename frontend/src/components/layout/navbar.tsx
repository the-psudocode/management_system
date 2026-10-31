import { Search, Bell, Menu, LogOut } from "lucide-react";
import type { AuthProfile } from "../../types";

function Navbar({ profile, onMenuClick, onLogout }: { profile: AuthProfile; onMenuClick: () => void; onLogout: () => void }) {
	const initial = (profile.name || profile.email || "B").slice(0, 1).toUpperCase();
	return <header className="app-topbar sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-stone-200/80 bg-[#fffefa]/95 px-4 backdrop-blur md:px-8">
		<div className="flex items-center gap-3">
			<button type="button" aria-label="Open navigation" onClick={onMenuClick} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 md:hidden"><Menu size={20} /></button>
			<div><h2 className="text-sm font-bold text-stone-900 md:text-base">Good to see you, {profile.name?.split(" ")[0] || "there"} <span aria-hidden="true">👋</span></h2><p className="text-xs text-stone-500">Here’s what’s happening in your subscription business.</p></div>
		</div>
		<div className="flex items-center gap-2 md:gap-4">
			<label className="hidden items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 sm:flex"><Search size={15} className="text-stone-400" /><input aria-label="Search" type="search" placeholder="Search workspace..." className="w-36 bg-transparent text-xs outline-none placeholder:text-stone-400 md:w-48" /><kbd className="hidden rounded border border-stone-200 px-1 text-[9px] text-stone-400 lg:inline">⌘ K</kbd></label>
			<button type="button" aria-label="Notifications" className="relative rounded-full p-2 text-stone-500 hover:bg-stone-100"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#7d946f]" /></button>
			<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dfe8d8] text-xs font-bold text-[#344a35]">{initial}</span>
			<button type="button" onClick={onLogout} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50" aria-label="Log out">
				<LogOut size={15} /><span className="hidden sm:inline">Log out</span>
			</button>
		</div>
	</header>;
}

export default Navbar;
