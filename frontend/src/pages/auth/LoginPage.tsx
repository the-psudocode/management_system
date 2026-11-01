import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	Building2,
	CheckCircle2,
	CircleDollarSign,
	Lock,
	Mail,
	Phone,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { apiService } from "../../services/api";

type Audience = "admin" | "staff" | "customer";
type AuthMode = "login" | "signup";

function modeFromLocation(pathname: string, search: string): AuthMode {
	return pathname.endsWith("/signup") || pathname === "/register" || (pathname === "/login" && new URLSearchParams(search).get("mode") === "signup")
		? "signup"
		: "login";
}

export function LoginPage() {
	const location = useLocation();
	const navigate = useNavigate();
	const audience: Audience = location.pathname.startsWith("/admin/") ? "admin" : location.pathname.startsWith("/staff/") ? "staff" : "customer";
	const audienceTitle = audience === "admin" ? "Administrator" : audience === "staff" ? "Staff" : "Customer";
	const [mode, setMode] = useState<AuthMode>(() => modeFromLocation(location.pathname, location.search));
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	useEffect(() => {
		setMode(modeFromLocation(location.pathname, location.search));
	}, [location.pathname, location.search]);

	const fillDemo = (demoEmail: string, demoAudience?: "customer" | "staff") => {
		setMode("login");
		if (demoAudience && audience !== demoAudience) navigate(`/${demoAudience}/login`, { replace: true });
		setEmail(demoEmail);
		setPassword("Brightloop@2026");
		setError(null);
		setSuccessMsg(null);
	};

	const changeAudience = (nextAudience: "customer" | "staff") => {
		setError(null);
		setSuccessMsg(null);
		setEmail("");
		setPassword("");
		setConfirmPassword("");
		navigate(`/${nextAudience}/${mode}`, { replace: true });
	};

	const switchMode = (nextMode: AuthMode) => {
		if (audience === "admin") return;
		setMode(nextMode);
		setError(null);
		setSuccessMsg(null);
		setEmail("");
		setPassword("");
		setConfirmPassword("");
		navigate(`/${audience}/${nextMode === "signup" ? "signup" : "login"}`, { replace: true });
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setLoading(true);
		setError(null);
		setSuccessMsg(null);

		try {
			let result: any;
			if (mode === "signup") {
				if (audience === "admin") throw new Error("Administrator accounts cannot be created here.");
				if (password !== confirmPassword) throw new Error("Your passwords do not match.");
								result = await apiService.signup({
					name: name.trim(),
					email: email.trim(),
					password,
					role: audience,
					companyName: companyName.trim() || undefined,
					phone: phone.trim() || undefined,
				});
								if (result?.pendingEmailVerification) {
									setSuccessMsg(`Check ${email.trim()} for the verification link. After verifying, sign in here to activate your staff account.`);
									return;
								}
				setSuccessMsg("Account created successfully! Redirecting…");
			} else {
				result = await apiService.login(email.trim(), password, audience);
				setSuccessMsg("Signed in successfully! Redirecting…");
			}

			const actualRole = String(result?.user?.role || "").toLowerCase();
			if (mode === "login" && actualRole !== "admin" && actualRole !== audience) {
				throw new Error(`This account is registered as ${actualRole}. Please use the ${actualRole} sign-in page.`);
			}
			const destination = actualRole === "customer" ? "/portal" : "/dashboard";
			setTimeout(() => navigate(destination, { replace: true }), mode === "signup" ? 600 : 400);
		} catch (cause: any) {
			console.error("Authentication error:", cause);
			setError(cause?.message || (mode === "signup" ? "Could not create account. Please check your information." : "Authentication failed. Please verify your credentials."));
		} finally {
			setLoading(false);
		}
	};

	const inputClass = "w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#71866b] focus:ring-4 focus:ring-[#71866b]/10";
	const iconClass = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400";
	const switchAudience = (next: "customer" | "staff") => (
		<button
			key={next}
			type="button"
			aria-pressed={audience === next}
			onClick={() => changeAudience(next)}
			className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-bold transition ${audience === next ? "bg-[#263b2d] text-white shadow-sm" : "text-stone-600 hover:bg-white/70 hover:text-stone-950"}`}
		>
			{next === "customer" ? "Customer" : "Staff"}
		</button>
	);

	return (
		<main className="auth-page min-h-screen bg-[#f6f7f2] p-3 text-stone-950 sm:p-5 lg:p-8">
			<div className="auth-frame mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1180px] overflow-hidden rounded-[28px] border border-stone-200/80 bg-white shadow-[0_25px_80px_rgba(36,48,34,.09)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[.85fr_1.15fr]">
				<section className="auth-welcome relative flex min-h-[220px] flex-col justify-between overflow-hidden bg-[#eff2eb] p-6 sm:p-9 lg:min-h-full lg:p-12">
					<div className="auth-orb auth-orb-one" />
					<div className="auth-orb auth-orb-two" />
					<Link to="/" className="relative z-10 inline-flex w-fit items-center gap-2 text-xs font-semibold text-stone-600 transition hover:text-[#263b2d]">
						<ArrowLeft size={15} /> Back to home
					</Link>
					<div className="relative z-10 my-8 max-w-md lg:my-0 lg:self-center">
						<div className="mb-7 flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/80 bg-white/75 text-[#526d4f] shadow-sm">
							<CircleDollarSign size={38} strokeWidth={1.55} />
						</div>
						<p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#60775c]">BrightLoop subscription billing</p>
						<h1 className="text-3xl font-bold tracking-[-.04em] sm:text-4xl">{mode === "login" ? `Welcome back, ${audienceTitle}` : `Get started as a ${audience}`}</h1>
						<p className="mt-3 max-w-sm text-sm leading-6 text-stone-600">
							{mode === "login" ? "Sign in to manage subscriptions, customers, invoices, and payments." : audience === "customer" ? "Create a customer account to explore billing plans and manage your subscriptions." : "Create a staff account to manage customers, subscriptions, invoices, and payments."}
						</p>
					</div>
					<p className="relative z-10 hidden text-[11px] font-medium text-stone-500 lg:block">One clear workspace for recurring revenue.</p>
				</section>

				<section className="flex items-center justify-center px-5 py-7 sm:px-10 sm:py-9 lg:px-14">
					<div className="w-full max-w-[440px]">
						<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
							<Link to="/" aria-label="BrightLoop home" className="inline-flex items-center rounded-md focus:outline-none focus:ring-2 focus:ring-[#71866b]/30">
								<img src="/logo.png" alt="BrightLoop Subscription & Billing Platform" className="h-10 w-[200px] object-cover mix-blend-multiply" />
							</Link>
							{audience !== "admin" && <p className="text-xs text-stone-500">
								{mode === "login" ? "New here?" : "Already have an account?"}{" "}
								<button type="button" onClick={() => switchMode(mode === "login" ? "signup" : "login")} className="font-bold text-[#344a35] underline underline-offset-2 hover:text-[#526d4f]">
									{mode === "login" ? "Create account" : "Sign in"}
								</button>
							</p>}
						</div>

						<div className="mb-5">
							<p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#60775c]">Your workspace</p>
							<h2 className="text-[26px] font-bold tracking-[-.04em]">{mode === "login" ? `${audienceTitle} sign in` : `Create a ${audience} account`}</h2>
								<p className="mt-1 text-sm text-stone-500">{mode === "login" ? "Use your account email and password to continue." : audience === "staff" ? "Staff accounts require an invitation from a BrightLoop administrator." : "Choose your workspace, then enter your details to create an account."}</p>
						</div>

						{audience !== "admin" && <div className="mb-5 flex rounded-xl border border-stone-200 bg-[#f1f3ed] p-1" aria-label="Choose account type">
							{switchAudience("customer")}
							{switchAudience("staff")}
						</div>}
						{audience !== "admin" && <p className="-mt-3 mb-4 text-[11px] text-stone-500">Admin accounts can sign in from either workspace.</p>}
						{audience === "admin" && <p className="mb-5 rounded-xl border border-[#dce5d8] bg-[#f4f7f1] px-3.5 py-3 text-xs leading-5 text-[#425b3f]">Admins can also sign in from either the Customer or Staff workspace.</p>}

						{error && <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
						{successMsg && <div role="status" className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" /><span>{successMsg}</span></div>}

						{mode === "login" && <div className="mb-4 rounded-xl border border-stone-200 bg-[#fafbf8] p-3">
							<div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-stone-600"><ShieldCheck size={14} className="text-[#60775c]" />Demo sign-in</div>
							<div className="flex flex-wrap gap-1.5">
								<button type="button" onClick={() => fillDemo("admin@brightloop.io")} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:border-[#bdcbb7] hover:bg-[#f2f5ef]">Admin</button>
								<button type="button" onClick={() => fillDemo("staff.operations@brightloop.io", "staff")} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:border-[#bdcbb7] hover:bg-[#f2f5ef]">Staff</button>
								<button type="button" onClick={() => fillDemo("customer1@acme.corp", "customer")} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:border-[#bdcbb7] hover:bg-[#f2f5ef]">Customer</button>
							</div>
							<p className="mt-2 text-[10px] text-stone-500">Demo password: <span className="font-semibold text-stone-600">Brightloop@2026</span></p>
						</div>}

						<form onSubmit={handleSubmit} className="space-y-3.5">
							{mode === "signup" && <>
								<div><label htmlFor="signup-name" className="mb-1.5 block text-[11px] font-bold text-stone-600">Full name</label><div className="relative"><UserRound size={17} className={iconClass} /><input id="signup-name" autoComplete="name" className={inputClass} placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} required /></div></div>
								{audience === "customer" && <>
									<div><label htmlFor="signup-company" className="mb-1.5 block text-[11px] font-bold text-stone-600">Company <span className="font-normal text-stone-400">(optional)</span></label><div className="relative"><Building2 size={17} className={iconClass} /><input id="signup-company" autoComplete="organization" className={inputClass} placeholder="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></div></div>
									<div><label htmlFor="signup-phone" className="mb-1.5 block text-[11px] font-bold text-stone-600">Phone <span className="font-normal text-stone-400">(optional)</span></label><div className="relative"><Phone size={17} className={iconClass} /><input id="signup-phone" type="tel" autoComplete="tel" className={inputClass} placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} /></div></div>
								</>}
							</>}
							<div><label htmlFor="account-email" className="mb-1.5 block text-[11px] font-bold text-stone-600">Email address</label><div className="relative"><Mail size={17} className={iconClass} /><input id="account-email" type="email" autoComplete="email" className={inputClass} placeholder={audience === "staff" ? "Work email address" : "Email address"} value={email} onChange={(event) => setEmail(event.target.value)} required /></div></div>
							<div><label htmlFor="account-password" className="mb-1.5 block text-[11px] font-bold text-stone-600">Password</label><div className="relative"><Lock size={17} className={iconClass} /><input id="account-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputClass} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></div></div>
							{mode === "signup" && <div><label htmlFor="account-confirm-password" className="mb-1.5 block text-[11px] font-bold text-stone-600">Confirm password</label><div className="relative"><Lock size={17} className={iconClass} /><input id="account-confirm-password" type="password" autoComplete="new-password" className={inputClass} placeholder="Re-enter your password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} /></div></div>}
							<button type="submit" disabled={loading} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#263b2d] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#344d39] disabled:opacity-60">{loading ? "Please wait…" : mode === "login" ? "Sign in" : `Create ${audience} account`}{!loading && <ArrowRight size={16} />}</button>
						</form>

						<div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-stone-500">
							<Link to="/admin/login" className="font-semibold text-stone-600 underline underline-offset-2 hover:text-[#263b2d]">Administrator sign in</Link>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}

export default LoginPage;
