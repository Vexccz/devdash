import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs uppercase tracking-wider text-slate-300">
        Built with create-saas-starter
      </span>
      <h1 className="mt-6 text-4xl font-bold sm:text-6xl">
        {{DISPLAY_NAME}}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-400">
        Your SaaS, ready in minutes. Auth, payments, and admin scaffolding wired up.
      </p>
      <div className="mt-8 flex gap-3">
        <Link to="/register" className="rounded-md bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 hover:bg-emerald-400">
          Get started
        </Link>
        <Link to="/pricing" className="rounded-md border border-slate-700 px-5 py-2.5 font-medium text-slate-200 hover:border-slate-500">
          Pricing
        </Link>
      </div>
      <div className="mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <Feature title="Auth" body="JWT, bcrypt, register/login, protected routes." />
        <Feature title="Payments" body="Stripe Checkout + webhook ready." />
        <Feature title="Deploy" body="Vercel + Render configs included." />
      </div>
    </main>
  );
}

function Feature({ title, body }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-left">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{body}</p>
    </div>
  );
}
