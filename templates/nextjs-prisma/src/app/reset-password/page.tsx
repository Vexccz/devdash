'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || 'Reset failed');
      return;
    }
    router.push('/login');
  };

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-3xl font-bold">Reset password</h1>
      {!token ? (
        <p className="mt-4 text-red-400">Missing or invalid token.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button disabled={busy} className="w-full rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-50">
            {busy ? 'Saving…' : 'Reset password'}
          </button>
        </form>
      )}
    </main>
  );
}
