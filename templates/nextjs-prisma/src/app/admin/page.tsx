'use client';

import { useEffect, useState } from 'react';

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
  createdAt: string;
};
type Stats = { totalUsers: number; proUsers: number; adminUsers: number; newLast24h: number; conversionRate: number };

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState('');

  const load = async () => {
    const [s, u] = await Promise.all([
      fetch('/api/admin/stats').then((r) => r.json()),
      fetch(`/api/admin/users?q=${encodeURIComponent(q)}`).then((r) => r.json()),
    ]);
    setStats(s);
    setUsers(u.users || []);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = async (id: string, body: Partial<{ role: string; plan: string; name: string }>) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    void load();
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">Admin</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        {stats &&
          [
            { label: 'Total users', value: stats.totalUsers },
            { label: 'Pro users', value: stats.proUsers },
            { label: 'Admins', value: stats.adminUsers },
            { label: 'New (24h)', value: stats.newLast24h },
            { label: 'Conversion %', value: stats.conversionRate },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs uppercase text-slate-400">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </div>
          ))}
      </div>

      <div className="mt-8 flex gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name" className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2" />
        <button onClick={load} className="rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400">Search</button>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Plan</th>
            <th className="px-3 py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate-800">
              <td className="px-3 py-2">{u.email}</td>
              <td className="px-3 py-2">{u.name || '—'}</td>
              <td className="px-3 py-2">
                <select value={u.role} onChange={(e) => update(u.id, { role: e.target.value })} className="rounded-md bg-slate-900 px-2 py-1">
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <select value={u.plan} onChange={(e) => update(u.id, { plan: e.target.value })} className="rounded-md bg-slate-900 px-2 py-1">
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                </select>
              </td>
              <td className="px-3 py-2 text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
