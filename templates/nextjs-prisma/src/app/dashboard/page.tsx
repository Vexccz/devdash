import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <form action="/api/auth/logout" method="post">
          <button className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">Log out</button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs uppercase text-slate-400">Email</p>
          <p className="mt-1 text-lg">{user.email}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs uppercase text-slate-400">Plan</p>
          <p className="mt-1 text-lg">{user.plan}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs uppercase text-slate-400">Role</p>
          <p className="mt-1 text-lg">{user.role}</p>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link href="/pricing" className="rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400">
          Upgrade plan
        </Link>
        {user.role === 'ADMIN' && (
          <Link href="/admin" className="rounded-md border border-slate-700 px-4 py-2 font-medium hover:bg-slate-800">
            Admin panel
          </Link>
        )}
      </div>
    </main>
  );
}
