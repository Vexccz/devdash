import { useEffect, useState } from 'react';
import type { ProjectConfig, TimeSummary } from '../types';

interface Props {
  onOpenProject: (id: string) => void;
}

export default function TimeView({ onOpenProject }: Props) {
  const [summaries, setSummaries] = useState<TimeSummary[]>([]);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [active, setActive] = useState<{ projectId: string; startedAt: number } | null>(null);

  const load = async () => {
    const [sums, prjs, act] = await Promise.all([
      window.devdash.time.summary(null, 7),
      window.devdash.projects.list(),
      window.devdash.time.active(),
    ]);
    setSummaries(sums);
    setProjects(prjs);
    setActive(act);
  };

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  const todayAll = summaries.reduce((a, s) => a + s.todayMs, 0);
  const weekAll = summaries.reduce((a, s) => a + s.weekMs, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Time</h1>
          <p className="text-xs text-dash-mute">
            Auto-tracked per project on detail open. Idle timeout configurable in Settings.
          </p>
        </div>
        {active && (
          <div className="rounded-md border border-dash-indigo/40 bg-dash-indigo/10 px-3 py-1.5 text-[11px] text-dash-indigoBright">
            Timing: {projects.find((p) => p.id === active.projectId)?.name ?? active.projectId} ·{' '}
            {humanMs(Date.now() - active.startedAt)}
          </div>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Today" value={humanMs(todayAll)} />
        <SummaryCard label="This week" value={humanMs(weekAll)} />
        <SummaryCard label="Active projects" value={String(summaries.filter((s) => s.weekMs > 0).length)} />
        <SummaryCard
          label="Most-worked"
          value={
            summaries
              .slice()
              .sort((a, b) => b.weekMs - a.weekMs)[0]
              ?.projectId
              ? projects.find((p) => p.id === summaries.slice().sort((a, b) => b.weekMs - a.weekMs)[0].projectId)?.name ?? '—'
              : '—'
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {summaries.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">
            No time logged yet. Open a project detail to start tracking.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {summaries
              .slice()
              .sort((a, b) => b.weekMs - a.weekMs)
              .map((s) => {
                const project = projects.find((p) => p.id === s.projectId);
                if (!project) return null;
                const max = Math.max(1, ...s.days.map((d) => d.ms));
                return (
                  <div
                    key={s.projectId}
                    onClick={() => onOpenProject(s.projectId)}
                    className="card cursor-pointer p-4 transition hover:border-dash-indigo/60"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-dash-text">{project.name}</h3>
                      <span className="text-[11px] text-dash-mute">{humanMs(s.weekMs)} this week</span>
                    </div>
                    <div className="mt-3 flex h-20 items-end gap-1.5">
                      {s.days.map((d) => (
                        <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex h-full w-full items-end">
                            <div
                              title={`${d.day}: ${humanMs(d.ms)}`}
                              className="w-full rounded-t bg-dash-indigo/70"
                              style={{
                                height: `${(d.ms / max) * 100}%`,
                                minHeight: d.ms > 0 ? '3px' : '0',
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-dash-mute">{d.day.slice(-2)}</span>
                        </div>
                      ))}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wider text-dash-mute">{label}</div>
      <div className="mt-1 font-mono text-xl text-dash-text">{value}</div>
    </div>
  );
}

function humanMs(ms: number): string {
  if (!ms) return '0m';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h >= 1) return `${h}h ${m % 60}m`;
  if (m >= 1) return `${m}m`;
  return `${s}s`;
}
