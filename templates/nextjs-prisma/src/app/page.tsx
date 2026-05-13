import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <h1 className="text-5xl font-bold tracking-tight">{{DISPLAY_NAME}}</h1>
      <p className="mt-4 max-w-xl text-lg text-slate-400">
        A production-ready SaaS starter with Next.js App Router, Prisma, Stripe, auth, and admin panel. Generated with create-saas-starter.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="rounded-md bg-indigo-500 px-5 py-2.5 font-medium hover:bg-indigo-400">
          Get started
        </Link>
        <Link href="/login" className="rounded-md border border-slate-700 px-5 py-2.5 font-medium hover:bg-slate-800">
          Log in
        </Link>
        <Link href="/pricing" className="rounded-md border border-slate-700 px-5 py-2.5 font-medium hover:bg-slate-800">
          Pricing
        </Link>
      </div>
    </main>
  );
}
