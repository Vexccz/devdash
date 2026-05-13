import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken } from './api.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const me = await api('/api/auth/me');
      setUser(me.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (email, password) => {
    const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (email, password, name) => {
    const res = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    setToken('');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
