import { useEffect, useState } from 'react';
import type { UptimeSummary, ProjectConfig } from '../types';

interface Props {
  onOpenProject: (id: string) => void;
}

export default function UptimeView({ onOpenProject }: Props) {
  const [summaries, setSummaries] = useState<UptimeSummary[]>([]);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const [sums, prjs] = await Promise.all([
      window.devdash.uptime.all(),
      window.devdash.projects.list(),
    ]);
    setSummaries(sums);
    setProjects(prjs);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const sums = await window.devdash.uptime.runNow();
      setSummaries(sums);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Uptime</h1>
          <p className="text-xs text-dash-mute">
            Live URLs monitored {summaries.length === 1 ? '' : '·'} scheduled checks run in the background
          </p>
        </div>
        <button onClick={runNow} disabled={running} className="btn-primary">
          {running ? 'Checking…' : 'Run checks now'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-dash-mute">Loading…</div>
        ) : summaries.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">
            No projects with a live URL yet. Add one in the Projects tab to monitor it.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {summaries.map((s) => {
              const project = projects.find((p) => p.id === s.projectId);
              if (!project) return null;
              return (
                <div
                  key={s.projectId}
                  onClick={() => onOpenProject(s.projectId)}
                  className="card cursor-pointer p-4 transition hover:border-dash-indigo/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          s.latestOk === true
                            ? 'bg-dash-ok'
                            : s.latestOk === false
                            ? 'bg-dash-err'
                            : 'bg-dash-mute'
                        }`}
                      />
                      <h3 className="text-sm font-semibold text-dash-text">{project.name}</h3>
                    </div>
                    <span className="text-[11px] text-dash-mute">{s.uptimePct24h}% up 24h</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-dash-indigoBright">{s.url ?? '—'}</p>
                  <Sparkline
                    points={s.samples.map((x) => x.latencyMs)}
                    fails={s.samples.map((x) => x.ok === 0)}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-dash-mute">
                    <span>avg {s.avgLatencyMs ?? '—'}ms</span>
                    <span>
                      {s.latestCheckedAt ? new Date(s.latestCheckedAt).toLocaleTimeString() : '—'}
                    </span>
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

function Sparkline({ points, fails }: { points: number[]; fails: boolean[] }) {
  if (points.length === 0) return <div className="h-10 text-[10px] text-dash-mute">no samples</div>;
  const max = Math.max(1, ...points);
  const min = Math.min(...points);
  const w = 300;
  const h = 40;
  const step = w / Math.max(points.length - 1, 1);
  const pts = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / Math.max(1, max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-10 w-full">
      <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="1.5" />
      {fails.map((f, i) =>
        f ? <circle key={i} cx={(i * step).toFixed(1)} cy={h - 2} r="1.8" fill="#ef4444" /> : null
      )}
    </svg>
  );
}
