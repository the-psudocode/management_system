import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
	AlertCircle,
	ArrowRight,
	Building2,
	CheckCircle2,
	Infinity,
	Lock,
	Mail,
	Phone,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { apiService } from "../../services/api";

export function LoginPage() {
	const [searchParams] = useSearchParams();
	const [mode, setMode] = useState<"login" | "signup">(
		searchParams.get("mode") === "signup" ? "signup" : "login",
	);
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [phone, setPhone] = useState("");
	const [role, setRole] = useState<"admin" | "staff" | "customer">("customer");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const navigate = useNavigate();

	const fillDemo = (demoEmail: string) => {
		setMode("login");
		setEmail(demoEmail);
		setPassword("Password123!");
		setError(null);
		setSuccessMsg(null);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccessMsg(null);

		try {
			if (mode === "signup") {
				await apiService.signup({
					name: name.trim(),
					email: email.trim(),
					password,
					role,
					companyName: companyName.trim() || undefined,
					phone: phone.trim() || undefined,
				});
				setSuccessMsg("Account created successfully! Redirecting…");
				setTimeout(() => navigate("/dashboard"), 600);
			} else {
				await apiService.login(email.trim(), password);
				setSuccessMsg("Signed in successfully! Redirecting…");
				setTimeout(() => navigate("/dashboard"), 400);
			}
		} catch (err: any) {
			console.error("Authentication error:", err);
			setError(
				err?.message ||
					(mode === "signup"
						? "Could not create account. Please check your information."
						: "Authentication failed. Please verify your credentials."),
			);
		} finally {
			setLoading(false);
		}
	};

	const switchMode = (newMode: "login" | "signup") => {
		setMode(newMode);
		setError(null);
		setSuccessMsg(null);
		setEmail("");
		setPassword("");
	};

	const inputClass = "w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#71866b] focus:ring-4 focus:ring-[#71866b]/10";
	const iconClass = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400";
	const roleButton = (value: "admin" | "staff" | "customer", label: string) => (
		<button
			key={value}
			type="button"
			aria-pressed={role === value}
			onClick={() => setRole(value)}
			className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${role === value ? "border-[#aebda8] bg-[#edf1e9] text-[#344a35]" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
		>
			{label}
		</button>
	);

	return (
		<main className="auth-page min-h-screen bg-[#f6f7f2] p-3 text-stone-950 sm:p-5 lg:p-8">
			<div className="auth-frame mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1180px] overflow-hidden rounded-[28px] border border-stone-200/80 bg-white shadow-[0_25px_80px_rgba(36,48,34,.09)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[.9fr_1.1fr]">
				<section className="auth-welcome relative flex min-h-[230px] flex-col justify-between overflow-hidden bg-[#eff2eb] p-7 sm:p-10 lg:min-h-full lg:p-12">
					<div className="auth-orb auth-orb-one" />
					<div className="auth-orb auth-orb-two" />
					<Link to="/" className="relative z-10 flex w-fit items-center gap-2.5 text-stone-950">
						<Infinity size={31} strokeWidth={2.8} className="text-[#263b2d]" />
						<span className="text-xl font-extrabold tracking-tight">Brightloop</span>
					</Link>
					<div className="relative z-10 my-8 max-w-md lg:my-0">
						<p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#60775c]">Subscription billing</p>
						<h1 className="text-3xl font-bold tracking-[-.04em] sm:text-4xl">{mode === "login" ? "Welcome back" : "Welcome to Brightloop"}</h1>
						<p className="mt-3 max-w-sm text-sm leading-6 text-stone-600">
							{mode === "login" ? "Sign in to manage your subscriptions, customers and billing." : "Create an account to manage your subscriptions and invoices."}
						</p>
						<div className="auth-mark mt-8 flex h-32 w-32 items-center justify-center rounded-[28px] border border-white/80 bg-white/70 text-[#7d9275] shadow-[0_16px_35px_rgba(48,65,42,.09)] sm:h-40 sm:w-40">
							<Infinity size={66} strokeWidth={2.2} />
						</div>
					</div>
					<p className="relative z-10 hidden text-[11px] font-medium text-stone-500 lg:block">Subscriptions, billing and customer relationships in one place.</p>
				</section>

				<section className="flex items-center justify-center px-6 py-8 sm:px-10 lg:px-14">
					<div className="w-full max-w-[420px]">
						<div className="mb-7 flex items-start justify-between gap-4">
							<div>
								<p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#60775c]">Your workspace</p>
								<h2 className="text-[26px] font-bold tracking-[-.04em]">{mode === "login" ? "Sign in to Brightloop" : "Create your account"}</h2>
								<p className="mt-2 text-sm text-stone-500">{mode === "login" ? "Enter your credentials to continue." : "Enter your details to get started."}</p>
							</div>
							<div className="flex shrink-0 rounded-xl border border-stone-200 bg-[#f7f8f4] p-1">
								<button type="button" onClick={() => switchMode("login")} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${mode === "login" ? "bg-[#263b2d] text-white shadow-sm" : "text-stone-500 hover:text-stone-900"}`}>Sign in</button>
								<button type="button" onClick={() => switchMode("signup")} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${mode === "signup" ? "bg-[#263b2d] text-white shadow-sm" : "text-stone-500 hover:text-stone-900"}`}>Sign up</button>
							</div>
						</div>

						{error && <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
						{successMsg && <div role="status" className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" /><span>{successMsg}</span></div>}

						{mode === "login" && <div className="mb-5 rounded-2xl border border-stone-200 bg-[#fafbf8] p-3.5">
							<div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold text-stone-600"><ShieldCheck size={14} className="text-[#60775c]" />Demo accounts</div>
							<div className="grid grid-cols-3 gap-2">
								<button type="button" onClick={() => fillDemo("admin@brightloop.io")} className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-[10px] font-semibold text-stone-700 transition hover:border-[#bdcbb7] hover:bg-[#f2f5ef]">♛ Admin</button>
								<button type="button" onClick={() => fillDemo("staff.operations@brightloop.io")} className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-[10px] font-semibold text-stone-700 transition hover:border-[#bdcbb7] hover:bg-[#f2f5ef]">⚒ Staff</button>
								<button type="button" onClick={() => fillDemo("customer1@acme.corp")} className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-[10px] font-semibold text-stone-700 transition hover:border-[#bdcbb7] hover:bg-[#f2f5ef]">▦ Customer</button>
							</div>
						</div>}

						<form onSubmit={handleSubmit} className="space-y-3.5">
							{mode === "signup" && <>
								<div><label htmlFor="signup-name" className="mb-1.5 block text-[11px] font-bold text-stone-600">Full name</label><div className="relative"><UserRound size={17} className={iconClass} /><input id="signup-name" autoComplete="name" className={inputClass} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required /></div></div>
								<div><label className="mb-1.5 block text-[11px] font-bold text-stone-600">Account role</label><div className="grid grid-cols-3 gap-2">{roleButton("admin", "Admin")}{roleButton("staff", "Staff")}{roleButton("customer", "Customer")}</div></div>
								<div><label htmlFor="signup-company" className="mb-1.5 block text-[11px] font-bold text-stone-600">Company <span className="font-normal text-stone-400">(optional)</span></label><div className="relative"><Building2 size={17} className={iconClass} /><input id="signup-company" autoComplete="organization" className={inputClass} placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div></div>
								<div><label htmlFor="signup-phone" className="mb-1.5 block text-[11px] font-bold text-stone-600">Phone <span className="font-normal text-stone-400">(optional)</span></label><div className="relative"><Phone size={17} className={iconClass} /><input id="signup-phone" type="tel" autoComplete="tel" className={inputClass} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} /></div></div>
							</>}
							<div><label htmlFor="account-email" className="mb-1.5 block text-[11px] font-bold text-stone-600">Email address</label><div className="relative"><Mail size={17} className={iconClass} /><input id="account-email" type="email" autoComplete="email" className={inputClass} placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></div>
							<div><label htmlFor="account-password" className="mb-1.5 block text-[11px] font-bold text-stone-600">Password</label><div className="relative"><Lock size={17} className={iconClass} /><input id="account-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputClass} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div></div>
							{mode === "login" && <div className="flex items-center justify-between py-1 text-[11px] text-stone-500"><label className="flex items-center gap-2"><input type="checkbox" className="rounded border-stone-300 accent-[#344a35]" />Remember me</label><span className="font-semibold text-stone-600">Forgot password?</span></div>}
							<button type="submit" disabled={loading} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#263b2d] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#344d39] disabled:opacity-60">{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}{!loading && <ArrowRight size={16} />}</button>
						</form>

						<p className="mt-5 text-center text-xs text-stone-500">Protected workspace · <Link to="/" className="font-semibold text-stone-700 underline underline-offset-2">Back to home</Link></p>
					</div>
				</section>
			</div>
		</main>
	);
}

export default LoginPage;
