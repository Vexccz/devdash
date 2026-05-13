import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [stripeStatus, setStripeStatus] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const s = await api('/api/payments/status');
        setStripeStatus(s);
      } catch (ex) {
        setErr(ex.message);
      }
    })();
  }, []);

  const upgrade = async () => {
    try {
      const res = await api('/api/payments/checkout', { method: 'POST' });
      window.location.href = res.url;
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const portal = async () => {
    try {
      const res = await api('/api/payments/portal', { method: 'POST' });
      window.location.href = res.url;
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome{user?.name ? ', ' + user.name : ''}</h1>
          <p className="text-sm text-slate-400">{user?.email}</p>
        </div>
        <button onClick={logout} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500">
          Sign out
        </button>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Plan</div>
          <div className="mt-1 text-xl font-semibold capitalize">{user?.plan}</div>
          {user?.subscriptionStatus && (
            <div className="mt-1 text-xs text-slate-400">Status: {user.subscriptionStatus}</div>
          )}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Role</div>
          <div className="mt-1 text-xl font-semibold capitalize">{user?.role}</div>
        </div>
      </section>

      <section className="mt-8 flex flex-wrap gap-2">
        {user?.role === 'admin' && (
          <Link to="/admin" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20">
            Admin panel
          </Link>
        )}
        {stripeStatus?.enabled ? (
          user?.plan === 'pro' ? (
            <button onClick={portal} className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:border-slate-500">
              Manage subscription
            </button>
          ) : (
            <button onClick={upgrade} className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400">
              Upgrade to Pro
            </button>
          )
        ) : (
          <Link to="/pricing" className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:border-slate-500">
            Pricing
          </Link>
        )}
      </section>

      {err && <p className="mt-6 text-sm text-red-400">{err}</p>}
    </main>
  );
}
