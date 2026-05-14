import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <form action="/api/auth/signout" method="POST">
            <button className="text-sm text-gray-400 hover:text-white transition">Sign Out</button>
          </form>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-gray-300">Welcome back, <span className="font-semibold text-white">{session.user.name || session.user.email}</span></p>
          <p className="text-sm text-gray-500 mt-2">This is your protected dashboard.</p>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h3 className="text-sm font-medium text-gray-400">Plan</h3>
            <p className="text-lg font-bold mt-1">Free</p>
            <Link href="/pricing" className="text-xs text-indigo-400 hover:underline">Upgrade</Link>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h3 className="text-sm font-medium text-gray-400">Usage</h3>
            <p className="text-lg font-bold mt-1">0 / 100</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h3 className="text-sm font-medium text-gray-400">Status</h3>
            <p className="text-lg font-bold mt-1 text-green-400">Active</p>
          </div>
        </div>
      </div>
    </main>
  );
}
