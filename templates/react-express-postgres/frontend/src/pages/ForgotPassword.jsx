import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setDone(true);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">Reset password</h1>
      {done ? (
        <p className="mt-4 text-sm text-slate-300">If that email exists, a reset link was sent. Check your inbox.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <input className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button disabled={busy} className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm text-slate-400">
        <Link to="/login" className="text-emerald-400">Back to sign in</Link>
      </p>
    </div>
  );
}
