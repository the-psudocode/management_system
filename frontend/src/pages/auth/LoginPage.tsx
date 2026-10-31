import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleDollarSign, AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import { loginWithEmail } from "../../services/firebase";

export function LoginPage() {
	const [email, setEmail] = useState("admin@brightloop.io");
	const [password, setPassword] = useState("Password123!");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			await loginWithEmail(email, password);
			navigate("/dashboard");
		} catch (err: any) {
			console.error("Firebase authentication error:", err);
			setError(
				err?.message || "Authentication failed. Please verify your email and password.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
			<div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
				{/* Logo */}
				<div className="flex items-center gap-3 mb-8">
					<div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-600/30">
						<CircleDollarSign size={28} />
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">Brightloop</h1>
						<p className="text-xs text-slate-400 font-medium">
							Subscription Billing Engine
						</p>
					</div>
				</div>

				<div className="mb-6">
					<h2 className="text-xl font-semibold text-white">Welcome back</h2>
					<p className="text-sm text-slate-400 mt-1">
						Sign in to your Brightloop Billing administrator portal.
					</p>
				</div>

				{error && (
					<div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-start gap-3">
						<AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
						<span>{error}</span>
					</div>
				)}

				<form onSubmit={handleLogin} className="space-y-5">
					<div>
						<label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
							Email Address
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
								<Mail size={18} />
							</div>
							<input
								type="email"
								className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
								placeholder="admin@brightloop.io"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
							Password
						</label>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
								<Lock size={18} />
							</div>
							<input
								type="password"
								className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
								placeholder="••••••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>
					</div>

					<div className="flex items-center justify-between text-xs text-slate-400">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								defaultChecked
								className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
							/>
							<span>Remember session</span>
						</label>
						<span className="text-indigo-400 hover:text-indigo-300 transition cursor-pointer">
							Admin recovery
						</span>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 text-sm cursor-pointer"
					>
						{loading ? (
							<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
						) : (
							<>
								<span>Sign In</span>
								<ArrowRight size={16} />
							</>
						)}
					</button>
				</form>

				<div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
					<p className="text-xs text-slate-500">
						Protected by Firebase Authentication & Neon Lakebase Postgres
					</p>
				</div>
			</div>
		</div>
	);
}

export default LoginPage;
