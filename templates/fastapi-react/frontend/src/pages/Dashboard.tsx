import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearTokens, isLoggedIn } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }
    api('/users/me').then(async (res) => {
      if (res.ok) {
        setUser(await res.json());
      } else {
        clearTokens();
        navigate('/login');
      }
      setLoading(false);
    });
  }, [navigate]);

  const logout = () => {
    clearTokens();
    navigate('/login');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-white transition">
            Sign Out
          </button>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-gray-300">
            Welcome back, <span className="font-semibold text-white">{user?.name || user?.email}</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">Role: {user?.role}</p>
        </div>
      </div>
    </main>
  );
}
