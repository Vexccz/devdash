import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">{{DISPLAY_NAME}}</h1>
      <p className="text-gray-400 mb-8 text-center max-w-md">
        Production-ready SaaS starter with Auth.js, Prisma, Stripe, and Tailwind CSS.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="rounded-lg bg-indigo-600 px-6 py-2 font-medium hover:bg-indigo-500 transition">
          Sign In
        </Link>
        <Link href="/register" className="rounded-lg border border-gray-700 px-6 py-2 font-medium hover:bg-gray-800 transition">
          Register
        </Link>
      </div>
    </main>
  );
}
