import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      nav('/login?reset=ok');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">Set new password</h1>
      {!token ? (
        <p className="mt-4 text-sm text-red-400">Missing reset token. Use the link from your email.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <input type="password" className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2" placeholder="New password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button disabled={busy} className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm text-slate-400">
        <Link to="/login" className="text-emerald-400">Back to sign in</Link>
      </p>
    </div>
  );
}
