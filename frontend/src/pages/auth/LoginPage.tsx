import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
	AlertCircle,
	ArrowRight,
	Building2,
	CheckCircle2,
	CircleDollarSign,
	Lock,
	Mail,
	Phone,
	ShieldCheck,
	UserCheck,
	UserRound,
} from "lucide-react";
import { apiService } from "../../services/api";

export function LoginPage() {
	const [searchParams] = useSearchParams();
	const [mode, setMode] = useState<"login" | "signup">(
		searchParams.get("mode") === "signup" ? "signup" : "login"
	);
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [phone, setPhone] = useState("");
	const [role, setRole] = useState<"admin" | "staff" | "customer">("customer");
	const [email, setEmail] = useState("admin@brightloop.io");
	const [password, setPassword] = useState("Password123!");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const navigate = useNavigate();

	const fillDemo = (demoEmail: string, demoRole: "admin" | "staff" | "customer") => {
		setMode("login");
		setEmail(demoEmail);
		setPassword("Password123!");
		setError(null);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccessMsg(null);

		try {
			if (mode === "signup") {
				const res = await apiService.signup({
					name: name.trim(),
					email: email.trim(),
					password,
					role,
					companyName: companyName.trim() || undefined,
					phone: phone.trim() || undefined,
				});
				setSuccessMsg("Account created successfully! Redirecting...");
				setTimeout(() => {
					navigate("/dashboard");
				}, 600);
			} else {
				const res = await apiService.login(email.trim(), password);
				setSuccessMsg("Signed in successfully! Redirecting...");
				setTimeout(() => {
					navigate("/dashboard");
				}, 400);
			}
		} catch (err: any) {
			console.error("Authentication error:", err);
			setError(
				err?.message ||
					(mode === "signup"
						? "Could not create account. Please check your information."
						: "Authentication failed. Please verify your credentials.")
			);
		} finally {
			setLoading(false);
		}
	};

	const switchMode = (newMode: "login" | "signup") => {
		setMode(newMode);
		setError(null);
		setSuccessMsg(null);
		if (newMode === "signup") {
			setEmail("");
			setPassword("");
		} else {
			setEmail("admin@brightloop.io");
			setPassword("Password123!");
		}
	};

	const inputClass =
		"w-full rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
	const iconClass = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400";

	return (
		<main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
			<div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-10">
				{/* Top Branding */}
				<div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/80">
					<div className="flex items-center gap-3">
						<div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-600/30">
							<CircleDollarSign size={26} />
						</div>
						<div>
							<h1 className="text-xl font-bold tracking-tight">Brightloop Billing</h1>
							<p className="text-xs text-slate-400 font-medium">Subscription Billing Engine</p>
						</div>
					</div>

					{/* Mode Tabs */}
					<div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800">
						<button
							type="button"
							onClick={() => switchMode("login")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
								mode === "login"
									? "bg-indigo-600 text-white shadow"
									: "text-slate-400 hover:text-white"
							}`}
						>
							Sign In
						</button>
						<button
							type="button"
							onClick={() => switchMode("signup")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
								mode === "signup"
									? "bg-indigo-600 text-white shadow"
									: "text-slate-400 hover:text-white"
							}`}
						>
							Sign Up
						</button>
					</div>
				</div>

				{/* Title / Description */}
				<div className="mb-6">
					<h2 className="text-2xl font-bold text-white tracking-tight">
						{mode === "login" ? "Sign in to your account" : "Create a new account"}
					</h2>
					<p className="text-xs text-slate-400 mt-1.5">
						{mode === "login"
							? "Enter your credentials or choose a quick demo account below."
							: "Fill in the details below to register a new user in Brightloop Billing."}
					</p>
				</div>

				{/* Demo Credentials Quick-Select (Only on Sign In) */}
				{mode === "login" && (
					<div className="mb-6 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
						<div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-400">
							<ShieldCheck size={14} className="text-indigo-400" />
							<span>Instant Demo Login (1-click fill):</span>
						</div>
						<div className="grid grid-cols-3 gap-2">
							<button
								type="button"
								onClick={() => fillDemo("admin@brightloop.io", "admin")}
								className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 hover:text-white transition text-center border border-slate-700"
							>
								👑 Admin
							</button>
							<button
								type="button"
								onClick={() => fillDemo("staff.operations@brightloop.io", "staff")}
								className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 hover:text-white transition text-center border border-slate-700"
							>
								🛠️ Staff
							</button>
							<button
								type="button"
								onClick={() => fillDemo("customer1@acme.corp", "customer")}
								className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 hover:text-white transition text-center border border-slate-700"
							>
								🏢 Customer
							</button>
						</div>
					</div>
				)}

				{/* Alerts */}
				{error && (
					<div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-3">
						<AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
						<span>{error}</span>
					</div>
				)}

				{successMsg && (
					<div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-3">
						<CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
						<span>{successMsg}</span>
					</div>
				)}

				{/* Main Form */}
				<form onSubmit={handleSubmit} className="space-y-4">
					{mode === "signup" && (
						<>
							<div>
								<label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
									Full Name *
								</label>
								<div className="relative">
									<UserRound size={17} className={iconClass} />
									<input
										type="text"
										className={`${inputClass} pl-10`}
										placeholder="e.g. John Doe"
										value={name}
										onChange={(e) => setName(e.target.value)}
										required
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
									Account Role *
								</label>
								<div className="grid grid-cols-3 gap-2">
									<button
										type="button"
										onClick={() => setRole("admin")}
										className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
											role === "admin"
												? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
												: "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
										}`}
									>
										Admin
									</button>
									<button
										type="button"
										onClick={() => setRole("staff")}
										className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
											role === "staff"
												? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
												: "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
										}`}
									>
										Staff
									</button>
									<button
										type="button"
										onClick={() => setRole("customer")}
										className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
											role === "customer"
												? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
												: "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
										}`}
									>
										Customer
									</button>
								</div>
							</div>

							<div>
								<label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
									Company Name (Optional)
								</label>
								<div className="relative">
									<Building2 size={17} className={iconClass} />
									<input
										type="text"
										className={`${inputClass} pl-10`}
										placeholder="e.g. Acme Corporation"
										value={companyName}
										onChange={(e) => setCompanyName(e.target.value)}
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
									Phone Number (Optional)
								</label>
								<div className="relative">
									<Phone size={17} className={iconClass} />
									<input
										type="tel"
										className={`${inputClass} pl-10`}
										placeholder="e.g. +91 98765 43210"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
									/>
								</div>
							</div>
						</>
					)}

					<div>
						<label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
							Email Address *
						</label>
						<div className="relative">
							<Mail size={17} className={iconClass} />
							<input
								type="email"
								className={`${inputClass} pl-10`}
								placeholder="name@company.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
							Password *
						</label>
						<div className="relative">
							<Lock size={17} className={iconClass} />
							<input
								type="password"
								className={`${inputClass} pl-10`}
								placeholder={mode === "signup" ? "At least 6 characters" : "Password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={6}
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition duration-150 mt-2"
					>
						{loading
							? "Please wait..."
							: mode === "login"
							? "Sign In to Brightloop"
							: "Create Account & Sign In"}
						{!loading && <ArrowRight size={17} />}
					</button>
				</form>

				{/* Switch Mode Footer */}
				<div className="mt-6 pt-5 border-t border-slate-800 text-center">
					<p className="text-xs text-slate-400">
						{mode === "login" ? "Don't have an account? " : "Already registered? "}
						<button
							type="button"
							onClick={() => switchMode(mode === "login" ? "signup" : "login")}
							className="font-semibold text-indigo-400 hover:text-indigo-300 ml-1 underline underline-offset-2"
						>
							{mode === "login" ? "Sign up now" : "Sign in here"}
						</button>
					</p>
				</div>
			</div>
		</main>
	);
}

export default LoginPage;
