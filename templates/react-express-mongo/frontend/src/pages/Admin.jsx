import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  const load = async () => {
    setBusy(true);
    try {
      const [s, u] = await Promise.all([api('/api/admin/stats'), api(`/api/admin/users?q=${encodeURIComponent(q)}`)]);
      setStats(s);
      setUsers(u.users);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const setPlan = async (id, plan) => {
    try {
      await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ plan }) });
      void load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const setRole = async (id, role) => {
    try {
      await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      void load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <Link to="/dashboard" className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500">
          ← Dashboard
        </Link>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total users" value={stats?.totalUsers ?? '—'} />
        <Stat label="Pro users" value={stats?.proUsers ?? '—'} />
        <Stat label="New (24h)" value={stats?.newLast24h ?? '—'} />
        <Stat label="Conversion" value={stats ? `${stats.conversionRate}%` : '—'} />
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Users</h2>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search email/name"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
            />
            <button onClick={load} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500">
              Search
            </button>
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left font-normal">Email</th>
                <th className="px-3 py-2 text-left font-normal">Name</th>
                <th className="px-3 py-2 text-left font-normal">Role</th>
                <th className="px-3 py-2 text-left font-normal">Plan</th>
                <th className="px-3 py-2 text-left font-normal">Created</th>
              </tr>
            </thead>
            <tbody>
              {busy && users.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No users.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="border-t border-slate-800">
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2 text-slate-300">{u.name || '—'}</td>
                    <td className="px-3 py-2">
                      <select value={u.role} onChange={(e) => setRole(u._id, e.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={u.plan} onChange={(e) => setPlan(u._id, e.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs">
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
