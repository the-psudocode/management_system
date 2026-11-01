import { useEffect, useState } from "react";
import { UserPlus, Users, UserX } from "lucide-react";
import { deactivateStaffMember, getStaffMembers, inviteStaffMember } from "../services/api";

type StaffAccount = { id: string; name: string; email: string; role: string; status: string; createdAt: string };

export function StaffManagement() {
	const [staff, setStaff] = useState<StaffAccount[]>([]);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	async function loadStaff() {
		setLoading(true);
		setError("");
		try {
			const result: any = await getStaffMembers();
			setStaff(Array.isArray(result) ? result : result?.data || []);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Unable to load staff accounts.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { void loadStaff(); }, []);

	async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError("");
		setNotice("");
		try {
			await inviteStaffMember({ name: name.trim(), email: email.trim() });
			setName("");
			setEmail("");
			setNotice("Invitation created. Share the invited email with the staff member so they can register and verify it.");
			await loadStaff();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Unable to create staff invitation.");
		} finally {
			setSaving(false);
		}
	}

	async function deactivate(id: string) {
		setError("");
		setNotice("");
		try {
			await deactivateStaffMember(id);
			setNotice("Staff account deactivated.");
			await loadStaff();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Unable to deactivate this account.");
		}
	}

	return <section className="mx-auto max-w-6xl space-y-6">
		<header><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#60775c]">Administrator controls</p><h1 className="mt-1 text-2xl font-bold text-stone-900">Staff Management</h1><p className="mt-1 text-sm text-stone-500">Create staff invitations and deactivate access. Only an administrator can manage staff accounts.</p></header>
		{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
		{notice && <p role="status" className="rounded-xl border border-[#dce5d8] bg-[#edf1e9] p-3 text-sm text-[#425b3f]">{notice}</p>}
		<div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
			<form onSubmit={(event) => void submitInvite(event)} className="h-fit space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<div className="flex items-center gap-2"><span className="rounded-lg bg-[#e9eee5] p-2 text-[#425b3f]"><UserPlus size={18}/></span><h2 className="font-semibold">Invite staff member</h2></div>
				<label className="block"><span className="text-xs font-semibold text-stone-700">Name</span><input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-[#71866b] focus:outline-none" /></label>
				<label className="block"><span className="text-xs font-semibold text-stone-700">Work email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-[#71866b] focus:outline-none" /></label>
				<p className="text-xs leading-5 text-stone-500">The person must sign up from the Staff page with this email and verify their email address before the account becomes active.</p>
				<button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#263b2d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#344d39] disabled:opacity-60">{saving ? "Creating invitation…" : "Create invitation"}</button>
			</form>
			<div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
				<div className="flex items-center justify-between border-b border-stone-100 px-5 py-4"><div className="flex items-center gap-2"><Users size={18} className="text-[#526d4f]"/><h2 className="font-semibold">Staff accounts</h2></div><span className="rounded-full bg-[#e9eee5] px-2.5 py-1 text-xs font-semibold text-[#425b3f]">{staff.length}</span></div>
				{loading ? <p className="p-6 text-sm text-stone-500">Loading staff accounts…</p> : staff.length === 0 ? <p className="p-6 text-sm text-stone-500">No staff accounts have been invited.</p> : <ul className="divide-y divide-stone-100">{staff.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-semibold text-stone-900">{member.name}</p><p className="mt-0.5 text-xs text-stone-500">{member.email}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold capitalize text-violet-800 ring-1 ring-inset ring-violet-200">{member.role || "staff"}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${member.status === "active" ? "bg-emerald-100 text-emerald-800" : member.status === "invited" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>{member.status}</span>{member.status !== "inactive" && <button type="button" onClick={() => void deactivate(member.id)} title="Deactivate staff account" className="rounded-lg border border-rose-200 p-2 text-rose-700 hover:bg-rose-50"><UserX size={15}/></button>}</div></li>)}</ul>}
			</div>
		</div>
	</section>;
}

export default StaffManagement;
