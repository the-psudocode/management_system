import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BadgeCheck, ChartNoAxesCombined, Check, CreditCard, FileText, Layers3, Menu, UsersRound } from "lucide-react";

const features = [
	{ icon: Layers3, title: "Flexible plans", description: "Create recurring plans that fit the way your customers work." },
	{ icon: CreditCard, title: "Automated billing", description: "Keep invoices, payments, and renewals organized in one place." },
	{ icon: UsersRound, title: "Customer portal", description: "Give customers a clear view of their subscriptions and account." },
];

export function LandingPage() {
	return <div className="landing-page min-h-screen overflow-hidden bg-[#fafaf7] text-stone-950">
		<header className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-5 md:px-10">
			<Link to="/" className="flex items-center gap-2">
			<img src="/logo.png" alt="BrightLoop Logo" className="h-14 w-[260px] object-cover mix-blend-multiply" />
			</Link>
			<nav className="hidden items-center gap-8 text-xs font-semibold text-stone-600 md:flex"><a href="#features" className="hover:text-stone-950">Products</a><a href="#features" className="hover:text-stone-950">Solutions</a><a href="#features" className="hover:text-stone-950">Pricing</a><a href="#features" className="hover:text-stone-950">Resources</a></nav>
			<div className="flex items-center gap-2"><Link className="rounded-full px-3 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100" to="/customer/signup">Create account</Link><Link className="inline-flex items-center gap-2 rounded-full bg-[#263b2d] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#344d39]" to="/login">Login <ArrowRight size={14} /></Link><button className="ml-1 rounded-lg p-2 text-stone-700 md:hidden" aria-label="Open menu"><Menu size={18} /></button></div>
		</header>

		<main>
			<section className="landing-hero relative mx-auto grid max-w-[1320px] items-center gap-8 px-5 pb-8 pt-5 md:grid-cols-[.95fr_1.05fr] md:px-10 md:pb-10 md:pt-7">
				<div className="pointer-events-none absolute -left-40 top-64 h-96 w-96 rounded-full bg-[#eaf0e5] blur-3xl" />
				<div className="relative z-10">
					<div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e5e8de] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#3a4c39]"><BadgeCheck size={14} /> Subscription management platform</div>
					<h1 className="max-w-[530px] text-[36px] font-bold leading-[1.06] tracking-[-.05em] sm:text-[44px] lg:text-[54px]">Subscription billing, all in one clear workspace.</h1>
					<p className="mt-4 max-w-lg text-sm leading-6 text-stone-600">Set up flexible plans, manage customer subscriptions, and keep quotations, invoices, and payments connected from one place.</p>
					<div className="mt-5 flex flex-wrap gap-3"><Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-[#263b2d] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#263b2d]/15 hover:bg-[#344d39]">Login <ArrowRight size={16} /></Link><a href="#features" className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-800 hover:bg-stone-50"><Layers3 size={16} /> Explore features</a></div>
					<p className="mt-4 text-xs text-stone-500">New here? <Link to="/customer/signup" className="font-bold text-[#344a35] underline underline-offset-2 hover:text-[#526d4f]">Create an account</Link></p>
					<div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-stone-500"><span className="inline-flex items-center gap-1.5"><Check size={13} className="text-[#536c50]" />Simple setup</span><span className="inline-flex items-center gap-1.5"><Check size={13} className="text-[#536c50]" />Automated billing</span><span className="inline-flex items-center gap-1.5"><Check size={13} className="text-[#536c50]" />Customer self-service</span></div>
				</div>

				<div className="relative z-10 mx-auto w-full max-w-[530px]">
					<div className="absolute -inset-5 rounded-[34px] bg-gradient-to-br from-[#e7ede1] via-[#f6f6ed] to-[#e4eadf] blur-xl" />
					<div className="relative rotate-[1deg] rounded-[26px] border border-white bg-white/90 p-4 shadow-[0_28px_80px_rgba(42,54,42,.14)] sm:p-5">
						<div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e9eee5] text-[#344a35]"><Layers3 size={14}/></span><div><p className="text-[10px] font-bold text-stone-800">Billing workspace</p><p className="text-[8px] text-stone-400">Subscription overview</p></div></div><div className="flex items-center gap-2"><span className="rounded-full bg-[#eef2e9] px-3 py-1 text-[10px] font-bold text-[#52664f]">Sample workspace</span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dfe8d8] text-[8px] font-bold text-[#52664f]">BL</span></div></div>
						<div className="grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[142px_1fr]">
							<div className="space-y-2 border-r border-stone-100 pr-3"><p className="mb-3 px-2 text-[9px] font-bold uppercase tracking-widest text-stone-400">Menu</p>{[[ChartNoAxesCombined,"Dashboard"],[UsersRound,"Customers"],[Layers3,"Subscriptions"],[FileText,"Invoices"],[CreditCard,"Payments"]].map(([Icon,label]: any,index)=><div key={label} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[9px] font-semibold ${index===0?"bg-[#e9eee5] text-[#344a35]":"text-stone-500"}`}><Icon size={13}/>{label}</div>)}</div>
							<div><h2 className="text-base font-extrabold tracking-tight">Dashboard</h2><p className="mt-1 text-[9px] text-stone-500">Your billing at a glance</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-stone-100 bg-[#fffefa] p-3"><p className="text-[8px] font-semibold text-stone-500">Active subscriptions</p><strong className="mt-1 block text-lg">2,496</strong><span className="text-[8px] font-bold text-[#6c8a63]">↗ 8.1%</span></div><div className="rounded-xl border border-stone-100 bg-[#fffefa] p-3"><p className="text-[8px] font-semibold text-stone-500">Monthly revenue</p><strong className="mt-1 block text-lg">₹4,99,000</strong><span className="text-[8px] font-bold text-[#6c8a63]">↗ 6.2%</span></div></div><div className="mt-3 rounded-xl border border-stone-100 p-3"><div className="flex items-center justify-between"><p className="text-[9px] font-bold">Revenue overview</p><span className="text-[8px] text-stone-400">Last 6 months</span></div><svg viewBox="0 0 360 105" className="mt-3 h-24 w-full" role="img" aria-label="Revenue trend rising over six months"><defs><linearGradient id="landingChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#91a687" stopOpacity=".35"/><stop offset="100%" stopColor="#91a687" stopOpacity="0"/></linearGradient></defs><path d="M0 85 C30 77 38 82 65 70 S100 75 126 60 S165 67 195 48 S234 57 260 38 S300 47 326 25 S345 25 360 12 V105 H0Z" fill="url(#landingChartFill)"/><path d="M0 85 C30 77 38 82 65 70 S100 75 126 60 S165 67 195 48 S234 57 260 38 S300 47 326 25 S345 25 360 12" fill="none" stroke="#526d4f" strokeWidth="3"/></svg></div></div>
						</div>
						<div className="mt-3 flex items-center justify-between rounded-xl bg-[#f5f6f1] p-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-white p-2 text-[#526d4f]"><ArrowUpRight size={14}/></span><span className="text-[9px] font-semibold">Revenue is trending up</span></div><span className="text-[9px] font-bold text-[#526d4f]">+12.4%</span></div>
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-[1320px] px-5 pb-12 md:px-10"><div className="border-y border-stone-200/80 py-6 text-center"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-stone-400">Your billing workflow, connected</p><div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-semibold text-stone-600"><span>Flexible plans</span><span>Customer subscriptions</span><span>Recurring invoices</span><span>Payment tracking</span></div></div></section>

			<section id="features" className="mx-auto grid max-w-[1320px] gap-4 px-5 pb-20 md:grid-cols-3 md:px-10">{features.map(({icon:Icon,title,description})=><article key={title} className="rounded-2xl border border-stone-200/80 bg-white/80 p-5 shadow-[0_8px_24px_rgba(30,40,30,.03)]"><span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf1e9] text-[#3c563d]"><Icon size={19}/></span><h3 className="text-sm font-extrabold">{title}</h3><p className="mt-2 text-xs leading-5 text-stone-500">{description}</p></article>)}</section>
		</main>
		<footer className="flex flex-wrap items-center justify-center gap-x-3 border-t border-stone-200/80 px-5 py-5 text-center text-[11px] text-stone-500">© 2026 Brightloop Billing · Built for teams that run on recurring revenue</footer>
	</div>;
}

export default LandingPage;
