import { useEffect, useState } from 'react';
import type { DbTarget, DbHealthResult, DbKind, ProjectConfig } from '../types';

function formatLatency(ms: number): string {
  return `${ms}ms`;
}

function formatTime(ts: number | null): string {
  if (!ts) return 'never';
  return new Date(ts).toLocaleTimeString();
}

function mask(url: string): string {
  if (!url) return '';
  // mongodb+srv://user:pass@host → mongodb+srv://user:***@host
  return url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}

export default function DbHealthView() {
  const [targets, setTargets] = useState<DbTarget[]>([]);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [results, setResults] = useState<Record<string, DbHealthResult>>({});
  const [editing, setEditing] = useState<Partial<DbTarget> | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const loadAll = async () => {
    const [list, projs] = await Promise.all([
      window.devdash.dbhealth.list(),
      window.devdash.projects.list(),
    ]);
    setTargets(list);
    setProjects(projs);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  const ping = async (id: string) => {
    setLoading((s) => ({ ...s, [id]: true }));
    try {
      const res = await window.devdash.dbhealth.ping(id);
      setResults((r) => ({ ...r, [id]: res }));
    } finally {
      setLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const pingAll = async () => {
    for (const t of targets) await ping(t.id);
  };

  const save = async () => {
    if (!editing?.projectId || !editing.url || !editing.kind || !editing.label) return;
    await window.devdash.dbhealth.save({
      id: editing.id,
      projectId: editing.projectId!,
      kind: (editing.kind as DbKind) || 'mongodb',
      label: editing.label!,
      url: editing.url!,
    });
    setEditing(null);
    await loadAll();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this database target?')) return;
    await window.devdash.dbhealth.delete(id);
    await loadAll();
  };

  const openNew = () => {
    setEditing({
      projectId: projects[0]?.id ?? '',
      kind: 'mongodb',
      label: '',
      url: '',
    });
  };

  const autoDetect = async () => {
    if (projects.length === 0) return;
    const results: string[] = [];
    for (const p of projects) {
      const r = await window.devdash.dbhealth.autoDetect(p.id);
      if (r.added.length) {
        results.push(`${p.name}: +${r.added.length}`);
      }
    }
    await loadAll();
    if (results.length === 0) {
      alert('No new database URLs found in env files.');
    } else {
      alert(`Auto-detected:\n${results.join('\n')}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Database health</h2>
          <p className="text-xs text-dash-mute">Ping MongoDB and Postgres connections per project.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={autoDetect}
            disabled={projects.length === 0}
            className="rounded-md border border-dash-line px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
            title="Scan env files for MONGODB_URI / DATABASE_URL etc"
          >
            Auto-detect from env
          </button>
          <button
            onClick={pingAll}
            disabled={targets.length === 0}
            className="rounded-md border border-dash-line px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
          >
            Ping all
          </button>
          <button
            onClick={openNew}
            className="rounded-md bg-dash-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-dash-indigoBright"
          >
            + New target
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {targets.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-dash-line text-sm text-dash-mute">
            No DB targets configured yet.
          </div>
        ) : (
          <div className="space-y-2">
            {targets.map((t) => {
              const r = results[t.id];
              const busy = loading[t.id];
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-dash-line bg-dash-panel/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-dash-indigo/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dash-indigoBright">
                          {t.kind}
                        </span>
                        <span className="text-sm font-medium">{t.label}</span>
                        <span className="text-[11px] text-dash-mute">{projectName(t.projectId)}</span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-dash-mute">
                        {mask(t.url)}
                      </div>
                      {r && (
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              r.ok
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {r.ok ? 'UP' : 'DOWN'}
                          </span>
                          <span className="text-dash-mute">{formatLatency(r.latencyMs)}</span>
                          {r.version && (
                            <span className="truncate text-dash-mute">
                              v{r.version.split(' ')[0].slice(0, 20)}
                            </span>
                          )}
                          <span className="text-dash-mute">
                            @ {formatTime(r.checkedAt)}
                          </span>
                          {r.error && (
                            <span className="truncate text-red-400">
                              {r.error.slice(0, 120)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => ping(t.id)}
                        disabled={busy}
                        className="rounded border border-dash-line px-2 py-0.5 text-[11px] hover:bg-white/5 disabled:opacity-50"
                      >
                        {busy ? 'Pinging...' : 'Ping'}
                      </button>
                      <button
                        onClick={() => setEditing({ ...t })}
                        className="rounded border border-dash-line px-2 py-0.5 text-[11px] hover:bg-white/5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => del(t.id)}
                        className="rounded border border-red-500/40 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-dash-line bg-dash-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">
              {editing.id ? 'Edit DB target' : 'New DB target'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-dash-mute">Project</label>
                <select
                  value={editing.projectId || ''}
                  onChange={(e) => setEditing({ ...editing, projectId: e.target.value })}
                  className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-dash-mute">Label</label>
                <input
                  value={editing.label || ''}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                  placeholder="Production MongoDB"
                />
              </div>
              <div>
                <label className="block text-[11px] text-dash-mute">Kind</label>
                <select
                  value={editing.kind || 'mongodb'}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value as DbKind })}
                  className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 text-sm"
                >
                  <option value="mongodb">MongoDB</option>
                  <option value="postgres">Postgres</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-dash-mute">Connection URL</label>
                <input
                  value={editing.url || ''}
                  onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                  className="mt-1 w-full rounded border border-dash-line bg-dash-bg px-2 py-1 font-mono text-xs"
                  placeholder="mongodb+srv://user:pass@cluster/db"
                  type="password"
                />
                <p className="mt-1 text-[10px] text-dash-mute">
                  Stored locally in config.json. Use read-only user when possible.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded border border-dash-line px-3 py-1 text-xs hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded bg-dash-indigo px-3 py-1 text-xs text-white hover:bg-dash-indigoBright"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
