'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    setDone(true);
  };

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-3xl font-bold">Forgot password</h1>
      <p className="mt-2 text-sm text-slate-400">Enter your email and we&apos;ll send a reset link.</p>
      {done ? (
        <p className="mt-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400">
          If that email exists, we&apos;ve sent a reset link. Check your inbox.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" />
          <button disabled={busy} className="w-full rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-50">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </main>
  );
}
