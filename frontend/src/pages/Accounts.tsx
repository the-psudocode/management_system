import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck, UserRound, Users, UsersRound } from "lucide-react";
import { changeAccountRole, getCustomers, getStaffMembers } from "../services/api";
import type { Customer } from "../types";
import { formatDate } from "../utils/format";

type AccountRow = { id: string; name: string; email: string; role: "customer" | "staff"; status: string; createdAt: string; organization: string };
const rolePill = (role: AccountRow["role"]) => role === "staff" ? "bg-violet-50 text-violet-800 ring-violet-200" : "bg-[#edf1e9] text-[#425b3f] ring-[#dce5d8]";

export function Accounts() {
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [roleDrafts, setRoleDrafts] = useState<Record<string, "customer" | "staff">>({});
	const [savingId, setSavingId] = useState<string | null>(null);
	const pageSize = 12;

	const loadAccounts = useCallback(async () => {
		setLoading(true); setError("");
		try {
			const firstPage = await getCustomers(1, 100);
			const otherPageRequests = Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) => getCustomers(index + 2, 100));
			const [otherPages, rawStaff] = await Promise.all([Promise.all(otherPageRequests), getStaffMembers()]);
			const customers = [...firstPage.data, ...otherPages.flatMap((result) => result.data)];
			const customerAccounts: AccountRow[] = customers.map((customer: Customer) => ({ id: customer.userId || customer.id, name: customer.name, email: customer.email, role: "customer", status: customer.status, createdAt: customer.createdAt, organization: customer.company || "Individual account" }));
			const staffRecords = Array.isArray(rawStaff) ? rawStaff : (rawStaff as any)?.data || [];
			const staffAccounts: AccountRow[] = staffRecords.map((member: any) => ({ id: member.id, name: member.name || "Invited staff", email: member.email, role: "staff", status: member.status, createdAt: member.createdAt, organization: "BrightLoop Operations" }));
			setAccounts([...customerAccounts, ...staffAccounts].sort((left, right) => left.name.localeCompare(right.name)));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load account directory.");
		} finally { setLoading(false); }
	}, []);

	useEffect(() => { void loadAccounts(); }, [loadAccounts]);

	async function saveRole(account: AccountRow) {
		const role = roleDrafts[account.id] || account.role;
		if (role === account.role || account.status === "invited") return;
		const confirmed = window.confirm(`Change ${account.name}'s role from ${account.role} to ${role}? Their workspace permissions will change the next time they sign in.`);
		if (!confirmed) return;
		setSavingId(account.id); setError(""); setNotice("");
		try {
			await changeAccountRole(account.id, role);
			setRoleDrafts((current) => { const next = { ...current }; delete next[account.id]; return next; });
			setNotice(`${account.name}'s account role is now ${role}.`);
			await loadAccounts();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not update this account role.");
		} finally { setSavingId(null); }
	}

	const filtered = useMemo(() => accounts.filter((account) => {
		const text = `${account.name} ${account.email} ${account.organization}`.toLowerCase();
		return text.includes(search.trim().toLowerCase()) && (roleFilter === "all" || account.role === roleFilter) && (statusFilter === "all" || account.status === statusFilter);
	}), [accounts, search, roleFilter, statusFilter]);
	const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
	const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
	const customersCount = accounts.filter((account) => account.role === "customer").length;
	const staffCount = accounts.filter((account) => account.role === "staff").length;

	return <section className="mx-auto max-w-6xl space-y-5 p-1 md:p-2">
		<header><p className="text-xs font-bold uppercase tracking-[.16em] text-[#60775c]">Administrator controls</p><h1 className="mt-1 text-2xl font-bold text-stone-900">Account directory</h1><p className="mt-1 text-sm text-stone-500">View customer and staff accounts together, with their assigned workspace roles.</p></header>
		{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
		<div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-stone-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-stone-600">All accounts</span><Users size={17} className="text-stone-500"/></div><p className="mt-2 text-2xl font-bold">{accounts.length}</p></div><div className="rounded-2xl border border-stone-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-stone-600">Customers</span><UserRound size={17} className="text-[#526d4f]"/></div><p className="mt-2 text-2xl font-bold">{customersCount}</p></div><div className="rounded-2xl border border-stone-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-stone-600">Staff</span><UsersRound size={17} className="text-violet-700"/></div><p className="mt-2 text-2xl font-bold">{staffCount}</p></div></div>
		<div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"><label className="relative w-full md:max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, email, or organization" className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#71866b] focus:bg-white"/></label><div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-stone-500">ROLE</label><select aria-label="Filter by account role" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><option value="all">All roles</option><option value="customer">Customer</option><option value="staff">Staff</option></select><label className="ml-1 text-xs font-semibold text-stone-500">STATUS</label><select aria-label="Filter by account status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="inactive">Inactive</option></select></div></div>
		<div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-stone-100 px-5 py-4"><h2 className="font-bold text-stone-900">Accounts</h2><span className="text-xs text-stone-500">{filtered.length} matching</span></div>{loading ? <p className="p-10 text-center text-sm text-stone-500">Loading account directory…</p> : pageRows.length === 0 ? <div className="p-10 text-center"><ShieldCheck size={26} className="mx-auto text-stone-400"/><p className="mt-2 text-sm font-semibold text-stone-700">No accounts match these filters</p><p className="mt-1 text-xs text-stone-500">Try a different search or role filter.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-[#f7f8f4] text-xs font-bold uppercase tracking-wider text-stone-500"><tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Current role</th><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th><th className="px-5 py-3 text-right">Role / actions</th></tr></thead><tbody className="divide-y divide-stone-100">{pageRows.map((account) => { const draftRole = roleDrafts[account.id] || account.role; const roleChanged = draftRole !== account.role; return <tr key={`${account.role}-${account.id}`} className="hover:bg-stone-50/70"><td className="px-5 py-3.5"><p className="font-semibold text-stone-900">{account.name}</p><p className="text-xs text-stone-500">{account.email}</p></td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ring-inset ${rolePill(account.role)}`}>{account.role}</span></td><td className="px-5 py-3.5 text-stone-700">{account.organization}</td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${account.status === "active" ? "bg-emerald-50 text-emerald-700" : account.status === "invited" ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-600"}`}>{account.status}</span></td><td className="px-5 py-3.5 text-stone-500">{account.createdAt ? formatDate(account.createdAt) : "—"}</td><td className="px-5 py-3.5"><div className="flex items-center justify-end gap-2"><select aria-label={`Change ${account.name}'s role`} disabled={account.status === "invited" || savingId === account.id} value={draftRole} onChange={(event) => setRoleDrafts((current) => ({ ...current, [account.id]: event.target.value as "customer" | "staff" }))} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs capitalize disabled:bg-stone-100 disabled:text-stone-400"><option value="customer">Customer</option><option value="staff">Staff</option></select>{roleChanged ? <button type="button" disabled={savingId !== null} onClick={() => void saveRole(account)} className="rounded-lg bg-[#263b2d] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#344d39] disabled:opacity-50">{savingId === account.id ? "Saving…" : "Save"}</button> : <Link to={account.role === "staff" ? "/staff-management" : "/customers"} className="px-1 text-xs font-semibold text-[#425b3f] hover:underline">Manage</Link>}</div></td></tr>; })}</tbody></table></div>}{!loading && filtered.length > pageSize && <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3"><p className="text-xs text-stone-500">Page {page} of {pageCount}</p><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Next</button></div></div>}</div>
	</section>;
}

export default Accounts;
