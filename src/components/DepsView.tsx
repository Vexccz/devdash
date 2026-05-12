import { useEffect, useState } from 'react';
import type { DepSummary, ProjectConfig } from '../types';

interface Props {
  onOpenProject: (id: string) => void;
}

export default function DepsView({ onOpenProject }: Props) {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DepSummary | null>>({});
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);

  const load = async () => {
    const prjs = await window.devdash.projects.list();
    setProjects(prjs);
    const out: Record<string, DepSummary | null> = {};
    for (const p of prjs) out[p.id] = await window.devdash.deps.latest(p.id);
    setSummaries(out);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const runAll = async () => {
    setRunningAll(true);
    try {
      for (const p of projects) {
        const s = await window.devdash.deps.runNow(p.id);
        setSummaries((cur) => ({ ...cur, [p.id]: s ?? null }));
      }
    } finally {
      setRunningAll(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Dependencies</h1>
          <p className="text-xs text-dash-mute">
            `npm outdated` across all registered Node projects. Weekly auto-run + manual.
          </p>
        </div>
        <button onClick={runAll} disabled={runningAll} className="btn-primary">
          {runningAll ? 'Running all…' : 'Run all now'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-dash-mute">Loading…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {projects.map((p) => {
              const s = summaries[p.id];
              return (
                <div
                  key={p.id}
                  onClick={() => onOpenProject(p.id)}
                  className="card flex cursor-pointer items-center justify-between p-4 transition hover:border-dash-indigo/60"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-dash-text">{p.name}</h3>
                    <p className="text-[11px] text-dash-mute">
                      {s ? `Last run ${new Date(s.runAt).toLocaleString()}` : 'No report yet'}
                    </p>
                  </div>
                  <div className="flex gap-2 text-[11px]">
                    <Pill
                      color="err"
                      label={`${s?.majorCount ?? 0} major`}
                      dim={!s?.majorCount}
                    />
                    <Pill
                      color="warn"
                      label={`${s?.minorCount ?? 0} minor`}
                      dim={!s?.minorCount}
                    />
                    <Pill
                      color="ok"
                      label={`${s?.patchCount ?? 0} patch`}
                      dim={!s?.patchCount}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({
  color,
  label,
  dim,
}: {
  color: 'ok' | 'err' | 'warn';
  label: string;
  dim?: boolean;
}) {
  const map = {
    ok: 'bg-dash-ok/20 text-dash-ok',
    err: 'bg-dash-err/20 text-dash-err',
    warn: 'bg-dash-warn/20 text-dash-warn',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${map[color]} ${
        dim ? 'opacity-40' : ''
      }`}
    >
      {label}
    </span>
  );
}
