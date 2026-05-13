import { Link } from 'react-router-dom';

export default function Pricing() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <h1 className="text-center text-3xl font-bold">Simple pricing</h1>
      <p className="mt-2 text-center text-slate-400">Switch up or cancel any time.</p>
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Free" price="$0" features={['Core features', 'Community support', 'Up to 3 projects']} cta={<Link to="/register" className="block w-full rounded-md border border-slate-700 px-4 py-2 text-center hover:border-slate-500">Start free</Link>} />
        <Card highlight title="Pro" price="$9 /mo" features={['Unlimited projects', 'Priority support', 'Advanced analytics']} cta={<Link to="/register" className="block w-full rounded-md bg-emerald-500 px-4 py-2 text-center font-medium text-slate-950 hover:bg-emerald-400">Get Pro</Link>} />
      </div>
    </main>
  );
}

function Card({ title, price, features, cta, highlight }) {
  return (
    <div className={`rounded-xl border p-6 ${highlight ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/40'}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-2 text-3xl font-bold">{price}</div>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        {features.map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>
      <div className="mt-6">{cta}</div>
    </div>
  );
}
