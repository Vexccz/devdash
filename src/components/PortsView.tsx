import { useEffect, useMemo, useState } from 'react';
import type { PortEntry } from '../types';

interface Props {
  onOpenProject: (id: string) => void;
}

export default function PortsView({ onOpenProject }: Props) {
  const [entries, setEntries] = useState<PortEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [busyPid, setBusyPid] = useState<number>(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await window.devdash.ports.list();
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Failed to list ports');
      return;
    }
    setEntries(res.entries);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        String(e.port).includes(q) ||
        e.processName.toLowerCase().includes(q) ||
        String(e.pid).includes(q) ||
        (e.projectName ?? '').toLowerCase().includes(q)
    );
  }, [entries, filter]);

  const kill = async (e: PortEntry) => {
    if (e.isDevDashManaged) {
      if (!confirm(`${e.projectName ?? 'A DevDash dev server'} (port ${e.port}) is managed by DevDash. Stop the dev server from the project view instead. Force kill anyway?`)) return;
    } else {
      if (!confirm(`Kill ${e.processName || 'process'} (PID ${e.pid}) holding port ${e.port}?`)) return;
    }
    setBusyPid(e.pid);
    const res = await window.devdash.ports.kill(e.pid);
    setBusyPid(0);
    setMsg({
      ok: res.ok,
      text: res.ok ? `Killed PID ${e.pid} on port ${e.port}` : res.error || 'Kill failed',
    });
    void load();
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Ports</h1>
          <p className="text-xs text-dash-mute">
            Listening TCP/UDP ports + the process holding each one. Conflicts with DevDash projects highlighted.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter port / process / project"
            className="rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-xs text-dash-text"
          />
          <button onClick={load} disabled={loading} className="btn-soft">
            {loading ? 'Scanning…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">{error}</div>
      )}
      {msg && (
        <div
          className={`mb-3 rounded px-3 py-2 text-[11px] ${
            msg.ok
              ? 'border border-dash-ok/30 bg-dash-ok/10 text-dash-ok'
              : 'border border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-4">
        {loading && entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">Scanning ports…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">No matches.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="text-dash-mute">
                <tr className="border-b border-dash-line/60">
                  <th className="px-3 py-2 text-left font-normal">Port</th>
                  <th className="px-3 py-2 text-left font-normal">Process</th>
                  <th className="px-3 py-2 text-left font-normal">PID</th>
                  <th className="px-3 py-2 text-left font-normal">Project</th>
                  <th className="px-3 py-2 text-left font-normal">Address</th>
                  <th className="px-3 py-2 text-right font-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={`${e.port}-${e.pid}`} className="border-b border-dash-line/30 last:border-0 hover:bg-white/5">
                    <td className="px-3 py-2 font-mono text-dash-indigoBright">{e.port}</td>
                    <td className="px-3 py-2 font-mono text-dash-text">{e.processName || <span className="italic text-dash-mute">—</span>}</td>
                    <td className="px-3 py-2 font-mono text-dash-mute">{e.pid}</td>
                    <td className="px-3 py-2">
                      {e.projectName ? (
                        <button
                          onClick={() => e.projectId && onOpenProject(e.projectId)}
                          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                            e.isDevDashManaged
                              ? 'bg-dash-ok/20 text-dash-ok'
                              : 'bg-dash-warn/20 text-dash-warn'
                          }`}
                          title={
                            e.isDevDashManaged
                              ? 'Started by DevDash'
                              : 'Project port match (foreign process holding it)'
                          }
                        >
                          {e.isDevDashManaged ? '✓ ' : '⚠ '}
                          {e.projectName}
                        </button>
                      ) : (
                        <span className="text-dash-mute">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-dash-mute">{e.localAddress}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                        disabled={busyPid === e.pid}
                        onClick={() => kill(e)}
                        title="Kill the process holding this port"
                      >
                        {busyPid === e.pid ? 'Killing…' : 'Kill'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
