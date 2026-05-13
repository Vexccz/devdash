'use client';

import { useEffect, useState } from 'react';

export default function PricingPage() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/payments/status')
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)));
  }, []);

  const upgrade = async () => {
    setBusy(true);
    const res = await fetch('/api/payments/checkout', { method: 'POST' });
    const data = await res.json();
    setBusy(false);
    if (data.url) window.location.href = data.url;
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="text-xl font-semibold">Free</h3>
          <p className="mt-2 text-3xl font-bold">$0<span className="text-base font-normal text-slate-400">/mo</span></p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>· Access basic features</li>
            <li>· Community support</li>
          </ul>
        </div>
        <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/5 p-6">
          <h3 className="text-xl font-semibold">Pro</h3>
          <p className="mt-2 text-3xl font-bold">$9<span className="text-base font-normal text-slate-400">/mo</span></p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>· All free features</li>
            <li>· Priority support</li>
            <li>· Advanced analytics</li>
          </ul>
          <button
            disabled={!enabled || busy}
            onClick={upgrade}
            className="mt-6 w-full rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-40"
          >
            {!enabled ? 'Stripe not configured' : busy ? 'Redirecting…' : 'Upgrade to Pro'}
          </button>
        </div>
      </div>
    </main>
  );
}
