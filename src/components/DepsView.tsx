import { useEffect, useState } from 'react';
import type { DepSummary, ProjectConfig, SafeUpdateResult } from '../types';

interface Props {
  onOpenProject: (id: string) => void;
}

export default function DepsView({ onOpenProject }: Props) {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DepSummary | null>>({});
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [busyId, setBusyId] = useState<string>('');
  const [resultModal, setResultModal] = useState<{ name: string; result: SafeUpdateResult } | null>(null);
  const [confirmFor, setConfirmFor] = useState<ProjectConfig | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const runOne = async (p: ProjectConfig) => {
    setBusyId(p.id);
    try {
      const s = await window.devdash.deps.runNow(p.id);
      setSummaries((cur) => ({ ...cur, [p.id]: s ?? null }));
    } finally {
      setBusyId('');
    }
  };

  const safeUpdate = async (p: ProjectConfig) => {
    setConfirmFor(null);
    setBusyId(p.id);
    try {
      const result = await window.devdash.deps.safeUpdate(p.id);
      setResultModal({ name: p.name, result });
      const s = await window.devdash.deps.runNow(p.id);
      setSummaries((cur) => ({ ...cur, [p.id]: s ?? null }));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Dependencies</h1>
          <p className="text-xs text-dash-mute">
            Outdated + audit + engine checks. Safe update applies patches/minors and audit fixes, then verifies with build.
          </p>
        </div>
        <button onClick={runAll} disabled={runningAll} className="btn-primary" title="Re-scan all projects">
          {runningAll ? 'Scanning…' : 'Scan all'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-dash-mute">Loading…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {projects.map((p) => {
              const s = summaries[p.id];
              const totalAudit = s?.audit?.total ?? 0;
              const highRisk = (s?.audit?.high ?? 0) + (s?.audit?.critical ?? 0);
              const engineBad = s?.engine && !s.engine.ok;
              const open = expanded[p.id];
              return (
                <div key={p.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-dash-text">{p.name}</h3>
                        {engineBad && (
                          <span
                            className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-red-400"
                            title={`Requires Node ${s?.engine?.required}, installed ${s?.engine?.installed}`}
                          >
                            engine mismatch
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-dash-mute">
                        {s ? `Last scan ${new Date(s.runAt).toLocaleString()}` : 'No scan yet'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <Pill color="err" label={`${s?.majorCount ?? 0} major`} dim={!s?.majorCount} title="Breaking version bumps. Manual review." />
                      <Pill color="warn" label={`${s?.minorCount ?? 0} minor`} dim={!s?.minorCount} title="New features. Usually safe." />
                      <Pill color="ok" label={`${s?.patchCount ?? 0} patch`} dim={!s?.patchCount} title="Bug fixes. Safe." />
                      <Pill
                        color={highRisk > 0 ? 'err' : totalAudit > 0 ? 'warn' : 'ok'}
                        label={`${totalAudit} audit`}
                        dim={!totalAudit}
                        title={
                          s?.audit
                            ? `low ${s.audit.low} · moderate ${s.audit.moderate} · high ${s.audit.high} · critical ${s.audit.critical}`
                            : 'No audit data'
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn-soft"
                      onClick={() => setExpanded((cur) => ({ ...cur, [p.id]: !cur[p.id] }))}
                      title={open ? 'Hide package list' : 'Show outdated packages'}
                    >
                      {open ? 'Hide details' : 'Details'}
                    </button>
                    <button
                      className="btn-soft disabled:opacity-40"
                      disabled={busyId === p.id}
                      onClick={() => onOpenProject(p.id)}
                      title="Open project"
                    >
                      Open
                    </button>
                    <button
                      className="btn-soft disabled:opacity-40"
                      disabled={busyId === p.id}
                      onClick={() => runOne(p)}
                      title="Re-scan this project"
                    >
                      {busyId === p.id ? 'Working…' : 'Rescan'}
                    </button>
                    <button
                      className="btn-primary disabled:opacity-40"
                      disabled={busyId === p.id || (!s?.patchCount && !s?.minorCount && !totalAudit)}
                      onClick={() => setConfirmFor(p)}
                      title="Apply patches + minors + audit fixes, then verify with build"
                    >
                      Safe update
                    </button>
                  </div>

                  {open && s && (
                    <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-dash-line/60 bg-dash-bg/40">
                      {s.packages.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-dash-mute">All deps current.</p>
                      ) : (
                        <table className="w-full text-[11px]">
                          <thead className="text-dash-mute">
                            <tr className="border-b border-dash-line/60">
                              <th className="px-2 py-1 text-left font-normal">Package</th>
                              <th className="px-2 py-1 text-left font-normal">Current</th>
                              <th className="px-2 py-1 text-left font-normal">Wanted</th>
                              <th className="px-2 py-1 text-left font-normal">Latest</th>
                              <th className="px-2 py-1 text-left font-normal">Bump</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.packages.map((pkg) => (
                              <tr key={pkg.name} className="border-b border-dash-line/30 last:border-0">
                                <td className="px-2 py-1 font-mono text-dash-text">{pkg.name}</td>
                                <td className="px-2 py-1 font-mono text-dash-mute">{pkg.current}</td>
                                <td className="px-2 py-1 font-mono text-dash-mute">{pkg.wanted}</td>
                                <td className="px-2 py-1 font-mono text-dash-mute">{pkg.latest}</td>
                                <td className="px-2 py-1">
                                  <BumpPill type={pkg.type} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmFor(null)}>
          <div className="w-full max-w-md rounded-lg border border-dash-line bg-dash-panel p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-dash-text">Safe update {confirmFor.name}?</h2>
            <ul className="mt-3 space-y-1 text-xs text-dash-mute">
              <li>· Backs up package.json + lockfile</li>
              <li>· Runs <code className="font-mono">npm update</code> (semver-safe patches/minors)</li>
              <li>· Runs <code className="font-mono">npm audit fix</code> (non-breaking)</li>
              <li>· Verifies with <code className="font-mono">npm run build</code></li>
              <li>· Auto-rollback on build failure</li>
            </ul>
            <p className="mt-3 text-[11px] text-dash-warn">Major version bumps are skipped. Review those manually.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-soft" onClick={() => setConfirmFor(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => safeUpdate(confirmFor)}>Run safe update</button>
            </div>
          </div>
        </div>
      )}

      {resultModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setResultModal(null)}>
          <div className="w-full max-w-2xl rounded-lg border border-dash-line bg-dash-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-dash-line px-4 py-3">
              <h2 className="text-sm font-semibold text-dash-text">
                {resultModal.result.ok ? '✅ Safe update done' : resultModal.result.rolledBack ? '↩ Rolled back' : '❌ Failed'} · {resultModal.name}
              </h2>
              <button onClick={() => setResultModal(null)} className="rounded p-1 text-dash-mute hover:text-dash-text">×</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4 text-xs">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded bg-dash-indigo/20 px-2 py-0.5 text-dash-indigoBright">{resultModal.result.updated?.length ?? 0} updated</span>
                <span className="rounded bg-dash-ok/20 px-2 py-0.5 text-dash-ok">{resultModal.result.auditFixed ?? 0} audit fixes</span>
                {resultModal.result.buildOk === true && <span className="rounded bg-dash-ok/20 px-2 py-0.5 text-dash-ok">build ✓</span>}
                {resultModal.result.buildOk === false && <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-400">build ✗</span>}
                {resultModal.result.rolledBack && <span className="rounded bg-dash-warn/20 px-2 py-0.5 text-dash-warn">rolled back</span>}
              </div>
              {resultModal.result.error && (
                <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-400">{resultModal.result.error}</div>
              )}
              <div className="mb-3">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-dash-mute">Steps</div>
                <ul className="space-y-0.5 text-dash-text">
                  {resultModal.result.steps.map((s, i) => (
                    <li key={i} className="font-mono text-[11px]">· {s}</li>
                  ))}
                </ul>
              </div>
              {resultModal.result.updated && resultModal.result.updated.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-dash-mute">Updates</div>
                  <pre className="max-h-40 overflow-y-auto rounded border border-dash-line/60 bg-dash-bg/40 p-2 font-mono text-[10px] text-dash-text">
                    {resultModal.result.updated.join('\n')}
                  </pre>
                </div>
              )}
              {resultModal.result.buildOutput && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-dash-mute">Build output (tail)</div>
                  <pre className="max-h-40 overflow-y-auto rounded border border-dash-line/60 bg-dash-bg/40 p-2 font-mono text-[10px] text-dash-mute whitespace-pre-wrap">
                    {resultModal.result.buildOutput}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-dash-line px-4 py-3">
              <button className="btn-primary" onClick={() => setResultModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({
  color,
  label,
  dim,
  title,
}: {
  color: 'ok' | 'err' | 'warn';
  label: string;
  dim?: boolean;
  title?: string;
}) {
  const map = {
    ok: 'bg-dash-ok/20 text-dash-ok',
    err: 'bg-dash-err/20 text-dash-err',
    warn: 'bg-dash-warn/20 text-dash-warn',
  };
  return (
    <span
      title={title}
      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${map[color]} ${dim ? 'opacity-40' : ''}`}
    >
      {label}
    </span>
  );
}

function BumpPill({ type }: { type: 'major' | 'minor' | 'patch' | 'other' }) {
  const map = {
    major: 'bg-dash-err/20 text-dash-err',
    minor: 'bg-dash-warn/20 text-dash-warn',
    patch: 'bg-dash-ok/20 text-dash-ok',
    other: 'bg-dash-mute/20 text-dash-mute',
  } as const;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${map[type]}`}>{type}</span>;
}
