'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || 'Login failed');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-3xl font-bold">Log in</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button disabled={busy} className="w-full rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-50">
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm text-slate-400">
        <Link href="/register" className="hover:text-white">Create account</Link>
        <Link href="/forgot-password" className="hover:text-white">Forgot password?</Link>
      </div>
    </main>
  );
}
