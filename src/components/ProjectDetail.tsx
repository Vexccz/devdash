import { useEffect, useRef, useState } from 'react';
import type {
  BundleSizeRow,
  ChangelogResult,
  DepSummary,
  EnvEntry,
  EnvFileDetail,
  EnvFileSummary,
  ErrorBudget,
  HeatmapResult,
  LogLine,
  ProjectConfig,
  ReleaseProgress,
  ScreenshotRow,
  TimeSummary,
  UptimeSummary,
  BumpKind,
} from '../types';

type DetailTab = 'overview' | 'logs' | 'env' | 'time' | 'deps' | 'heatmap' | 'screenshots' | 'release';

interface Props {
  project: ProjectConfig;
  initialTab?: DetailTab;
  allProjects: ProjectConfig[];
  onClose: () => void;
}

export default function ProjectDetail({ project, initialTab = 'overview', allProjects, onClose }: Props) {
  const [tab, setTab] = useState<DetailTab>(initialTab);

  // Track activity for idle timeout
  useEffect(() => {
    void window.devdash.time.enter(project.id);
    return () => {
      void window.devdash.time.leave(project.id);
    };
  }, [project.id]);

  const onAnyInteraction = () => {
    void window.devdash.time.touch(project.id);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'logs', label: 'Logs' },
    { id: 'env', label: 'Env' },
    { id: 'time', label: 'Time' },
    { id: 'deps', label: 'Deps' },
    { id: 'heatmap', label: 'Heatmap' },
    { id: 'screenshots', label: 'Shots' },
    { id: 'release', label: 'Release' },
  ];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm"
      onClick={onClose}
      onMouseMove={onAnyInteraction}
      onKeyDown={onAnyInteraction}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[85vh] w-[90vw] max-w-[1100px] flex-col overflow-hidden rounded-lg border border-dash-line bg-dash-panel shadow-glow"
      >
        <header className="flex items-center justify-between border-b border-dash-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-dash-text">{project.name}</h2>
            <p className="truncate font-mono text-[11px] text-dash-mute">{project.path}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-mute hover:bg-white/5 hover:text-dash-text"
          >
            ×
          </button>
        </header>

        <nav className="flex gap-1 border-b border-dash-line px-3 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                onAnyInteraction();
              }}
              className={`rounded-md px-3 py-1 text-xs transition ${
                tab === t.id
                  ? 'bg-dash-indigo/20 text-dash-indigoBright'
                  : 'text-dash-mute hover:text-dash-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-hidden">
          {tab === 'overview' && <OverviewTab project={project} onAction={onAnyInteraction} />}
          {tab === 'logs' && <LogsTab project={project} />}
          {tab === 'env' && <EnvTab project={project} allProjects={allProjects} />}
          {tab === 'time' && <TimeTab project={project} />}
          {tab === 'deps' && <DepsTab project={project} />}
          {tab === 'heatmap' && <HeatmapTab project={project} />}
          {tab === 'screenshots' && <ScreenshotsTab project={project} />}
          {tab === 'release' && <ReleaseTab project={project} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ project, onAction }: { project: ProjectConfig; onAction: () => void }) {
  const [uptime, setUptime] = useState<UptimeSummary | null>(null);
  const [bundle, setBundle] = useState<BundleSizeRow[]>([]);
  const [errBudget, setErrBudget] = useState<ErrorBudget | null>(null);

  useEffect(() => {
    void (async () => {
      if (project.liveUrl) setUptime(await window.devdash.uptime.project(project.id));
      setBundle(await window.devdash.bundle.history(project.id));
      setErrBudget(await window.devdash.uptime.errors(project.id));
    })();
  }, [project.id]);

  const open = (url?: string) => url && window.devdash.shell.openExternal(url);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3">
        <section className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">
            Links
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-soft"
              onClick={() => {
                void window.devdash.projects.openFolder(project.path);
                onAction();
              }}
            >
              📂 Folder
            </button>
            <button
              className="btn-soft"
              onClick={() => {
                void window.devdash.projects.openInVSCode(project.path);
                onAction();
              }}
            >
              💻 VS Code
            </button>
            <button
              className="btn-soft disabled:opacity-40"
              disabled={!project.githubUrl}
              onClick={() => {
                open(project.githubUrl);
                onAction();
              }}
            >
              🐙 GitHub
            </button>
            <button
              className="btn-soft disabled:opacity-40"
              disabled={!project.liveUrl}
              onClick={() => {
                open(project.liveUrl);
                onAction();
              }}
            >
              🌐 Live
            </button>
          </div>
        </section>

        <section className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">
            Uptime (24h)
          </h3>
          {project.liveUrl ? (
            uptime ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      uptime.latestOk === true ? 'bg-dash-ok' : uptime.latestOk === false ? 'bg-dash-err' : 'bg-dash-mute'
                    }`}
                  />
                  <span className="text-dash-text">
                    {uptime.latestOk === true ? 'OK' : uptime.latestOk === false ? 'DOWN' : 'no data'}
                  </span>
                  <span className="text-dash-mute">· {uptime.uptimePct24h}% up</span>
                </div>
                <Sparkline
                  points={uptime.samples.map((s) => s.latencyMs)}
                  fails={uptime.samples.map((s) => s.ok === 0)}
                />
                <div className="text-[11px] text-dash-mute">
                  avg {uptime.avgLatencyMs ?? '—'}ms · {uptime.samples.length} checks
                </div>
              </div>
            ) : (
              <p className="text-xs text-dash-mute">Collecting data…</p>
            )
          ) : (
            <p className="text-xs text-dash-mute">No live URL configured.</p>
          )}
        </section>

        <section className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">
            Bundle size (last builds)
          </h3>
          {bundle.length === 0 ? (
            <p className="text-xs text-dash-mute">
              No builds recorded yet. Run `npm run build` and come back.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-dash-text">
                <span className="font-mono">{humanSize(bundle[0].sizeBytes)}</span>
                {bundle[1] && (
                  <span
                    className={`font-mono text-[11px] ${
                      bundle[0].sizeBytes > bundle[1].sizeBytes
                        ? 'text-dash-warn'
                        : 'text-dash-ok'
                    }`}
                  >
                    Δ {humanSize(bundle[0].sizeBytes - bundle[1].sizeBytes)}
                  </span>
                )}
              </div>
              <Sparkline points={bundle.slice(0, 20).reverse().map((b) => b.sizeBytes)} />
            </div>
          )}
        </section>

        <section className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">
            Error budget (7d)
          </h3>
          {errBudget && errBudget.days.length ? (
            <>
              <div className="text-sm text-dash-text">
                {errBudget.days.reduce((a, d) => a + d.count, 0)} errors · source:{' '}
                <span className="text-dash-mute">{errBudget.source}</span>
              </div>
              <div className="mt-2 flex items-end gap-1 h-12">
                {errBudget.days.map((d) => {
                  const max = Math.max(1, ...errBudget.days.map((x) => x.count));
                  const pct = (d.count / max) * 100;
                  return (
                    <div
                      key={d.day}
                      title={`${d.day}: ${d.count}`}
                      className="flex-1 rounded-sm bg-dash-err/40"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-dash-mute">
              No error data. Add `sentryDsn` or a `logs/` folder to the project.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function LogsTab({ project }: { project: ProjectConfig }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    setLines(await window.devdash.devserver.logs(project.id));
    const s = await window.devdash.devserver.status(project.id);
    setRunning(s.running);
  };

  useEffect(() => {
    void refresh();
    const off1 = window.devdash.devserver.onLog((p) => {
      if (p.projectId !== project.id) return;
      setLines((prev) => [...prev.slice(-1999), p.line]);
    });
    const off2 = window.devdash.devserver.onStatus((p) => {
      if (p.projectId !== project.id) return;
      setRunning(p.running);
    });
    return () => {
      off1();
      off2();
    };
  }, [project.id]);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines, autoScroll]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await window.devdash.devserver.start(project.id);
      if (res.ok) setRunning(true);
    } finally {
      setStarting(false);
    }
  };
  const stop = async () => {
    await window.devdash.devserver.stop(project.id);
    setRunning(false);
  };

  const filtered = filter ? lines.filter((l) => l.line.toLowerCase().includes(filter.toLowerCase())) : lines;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-dash-line px-3 py-2">
        {running ? (
          <button className="btn-danger" onClick={stop}>
            ■ Kill
          </button>
        ) : (
          <button className="btn-primary" onClick={start} disabled={starting}>
            {starting ? 'Starting…' : '▶ Run dev'}
          </button>
        )}
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter lines…"
          className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-xs text-dash-text"
        />
        <label className="flex items-center gap-1 text-[11px] text-dash-mute">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          auto-scroll
        </label>
        <span className="text-[11px] text-dash-mute">
          {lines.length} lines · {running ? 'running' : 'stopped'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-black/30 p-3 font-mono text-[11px] leading-relaxed">
        {filtered.length === 0 ? (
          <div className="text-dash-mute">No output yet. Start the dev server.</div>
        ) : (
          filtered.map((l, i) => (
            <div
              key={i}
              className={
                l.level === 'error'
                  ? 'text-dash-err'
                  : l.level === 'warn'
                  ? 'text-dash-warn'
                  : l.stream === 'system'
                  ? 'text-dash-indigoBright'
                  : 'text-dash-text/90'
              }
            >
              {l.line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function EnvTab({ project, allProjects }: { project: ProjectConfig; allProjects: ProjectConfig[] }) {
  const [files, setFiles] = useState<EnvFileSummary[]>([]);
  const [selected, setSelected] = useState<string>('.env');
  const [detail, setDetail] = useState<EnvFileDetail | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState<string>('');
  const [cloneSourceFile, setCloneSourceFile] = useState<string>('.env');

  const reload = async () => {
    setFiles(await window.devdash.env.scan(project.id));
    setDetail(await window.devdash.env.read(project.id, selected));
  };

  useEffect(() => {
    void reload();
  }, [project.id, selected]);

  const save = async () => {
    if (!detail) return;
    const res = await window.devdash.env.write(project.id, detail.file, detail.entries);
    setSaveMsg(res.ok ? `Saved ${res.path}` : `Save failed: ${res.error}`);
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const clone = async () => {
    if (!cloneSource) return;
    const res = await window.devdash.env.clone(cloneSource, cloneSourceFile, project.id, selected, false);
    setSaveMsg(res.ok ? `Merged ${res.mergedCount} vars from ${cloneSource}` : `Clone failed: ${res.error}`);
    await reload();
  };

  const setEntry = (idx: number, patch: Partial<EnvEntry>) => {
    if (!detail) return;
    setDetail({
      ...detail,
      entries: detail.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-dash-line px-3 py-2">
        {files.map((f) => (
          <button
            key={f.file}
            onClick={() => setSelected(f.file)}
            className={`rounded-md border px-2 py-1 text-[11px] ${
              selected === f.file
                ? 'border-dash-indigo bg-dash-indigo/20 text-dash-indigoBright'
                : 'border-dash-line text-dash-mute hover:text-dash-text'
            } ${!f.exists ? 'opacity-50' : ''}`}
          >
            {f.file}
            {f.exists && <span className="ml-1 text-dash-mute">({f.varCount})</span>}
            {f.missingKeys.length > 0 && (
              <span className="ml-1 text-dash-warn">missing {f.missingKeys.length}</span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={cloneSource}
            onChange={(e) => setCloneSource(e.target.value)}
            className="rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-[11px] text-dash-text"
          >
            <option value="">Clone from…</option>
            {allProjects.filter((p) => p.id !== project.id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={cloneSourceFile}
            onChange={(e) => setCloneSourceFile(e.target.value)}
            className="rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-[11px] text-dash-text"
          >
            <option value=".env">.env</option>
            <option value=".env.local">.env.local</option>
            <option value=".env.production">.env.production</option>
            <option value=".env.example">.env.example</option>
          </select>
          <button className="btn-soft" onClick={clone} disabled={!cloneSource}>
            Copy
          </button>
          <button className="btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {saveMsg && (
          <div className="mb-2 rounded-md border border-dash-indigo/40 bg-dash-indigo/10 px-3 py-1.5 text-[11px] text-dash-text">
            {saveMsg}
          </div>
        )}
        {!detail || !detail.exists ? (
          <div className="py-8 text-center text-xs text-dash-mute">
            {selected} doesn't exist yet. Add a row and save to create it.
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          {detail?.entries.map((e, idx) => {
            const revealed = reveal[e.key];
            return (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={e.key}
                  onChange={(ev) => setEntry(idx, { key: ev.target.value })}
                  className="w-48 rounded-md border border-dash-line bg-dash-bg px-2 py-1 font-mono text-xs text-dash-indigoBright"
                />
                <input
                  type={revealed ? 'text' : 'password'}
                  value={e.value}
                  onChange={(ev) => setEntry(idx, { value: ev.target.value })}
                  className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1 font-mono text-xs text-dash-text"
                />
                <button
                  onClick={() => setReveal((r) => ({ ...r, [e.key]: !r[e.key] }))}
                  className="btn-soft text-[10px]"
                >
                  {revealed ? 'Hide' : 'Reveal'}
                </button>
                <button
                  onClick={() =>
                    detail &&
                    setDetail({
                      ...detail,
                      entries: detail.entries.filter((_, i) => i !== idx),
                    })
                  }
                  className="btn-soft text-[10px]"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={() =>
            detail &&
            setDetail({
              ...detail,
              exists: true,
              entries: [...detail.entries, { key: 'NEW_KEY', value: '' }],
            })
          }
          className="mt-3 btn-soft"
        >
          + Add row
        </button>
      </div>
    </div>
  );
}

function TimeTab({ project }: { project: ProjectConfig }) {
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  useEffect(() => {
    void (async () => {
      const all = await window.devdash.time.summary(project.id, 7);
      setSummary(all[0] ?? { projectId: project.id, todayMs: 0, weekMs: 0, days: [] });
    })();
  }, [project.id]);

  if (!summary) return <div className="p-4 text-xs text-dash-mute">Loading…</div>;
  const max = Math.max(1, ...summary.days.map((d) => d.ms));
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card label="Today" value={humanMs(summary.todayMs)} />
        <Card label="This week" value={humanMs(summary.weekMs)} />
      </div>
      <div className="card p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-mute">
          Daily breakdown
        </h3>
        <div className="flex h-32 items-end gap-2">
          {summary.days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-full w-full items-end">
                <div
                  title={`${d.day}: ${humanMs(d.ms)}`}
                  className="w-full rounded-t bg-dash-indigo/80"
                  style={{ height: `${(d.ms / max) * 100}%`, minHeight: d.ms > 0 ? '3px' : '0' }}
                />
              </div>
              <span className="text-[10px] text-dash-mute">{d.day.slice(-5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DepsTab({ project }: { project: ProjectConfig }) {
  const [summary, setSummary] = useState<DepSummary | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void (async () => {
      setSummary(await window.devdash.deps.latest(project.id));
    })();
  }, [project.id]);

  const run = async () => {
    setRunning(true);
    try {
      const out = await window.devdash.deps.runNow(project.id);
      setSummary(out);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-dash-line px-3 py-2">
        <button className="btn-primary" onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run `npm outdated`'}
        </button>
        {summary && (
          <span className="text-[11px] text-dash-mute">
            last run {new Date(summary.runAt).toLocaleString()}
          </span>
        )}
        {summary && (
          <div className="ml-auto flex gap-2 text-[11px]">
            <Pill color="err" label={`${summary.majorCount} major`} />
            <Pill color="warn" label={`${summary.minorCount} minor`} />
            <Pill color="ok" label={`${summary.patchCount} patch`} />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!summary && <div className="p-4 text-xs text-dash-mute">No report yet. Click Run.</div>}
        {summary && summary.packages.length === 0 && (
          <div className="p-4 text-xs text-dash-ok">All dependencies current ✨</div>
        )}
        {summary && summary.packages.length > 0 && (
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-dash-panel text-dash-mute">
              <tr>
                <th className="px-3 py-2">Package</th>
                <th className="px-3 py-2">Current</th>
                <th className="px-3 py-2">Wanted</th>
                <th className="px-3 py-2">Latest</th>
                <th className="px-3 py-2">Kind</th>
              </tr>
            </thead>
            <tbody>
              {summary.packages.map((p) => (
                <tr key={p.name} className="border-t border-dash-line">
                  <td className="px-3 py-1.5 font-mono text-dash-text">{p.name}</td>
                  <td className="px-3 py-1.5 font-mono text-dash-mute">{p.current}</td>
                  <td className="px-3 py-1.5 font-mono text-dash-text">{p.wanted}</td>
                  <td className="px-3 py-1.5 font-mono text-dash-indigoBright">{p.latest}</td>
                  <td className="px-3 py-1.5">
                    <Pill
                      color={
                        p.type === 'major' ? 'err' : p.type === 'minor' ? 'warn' : p.type === 'patch' ? 'ok' : 'mute'
                      }
                      label={p.type}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function HeatmapTab({ project }: { project: ProjectConfig }) {
  const [data, setData] = useState<HeatmapResult | null>(null);
  useEffect(() => {
    void (async () => {
      setData(await window.devdash.heatmap.build(project.id));
    })();
  }, [project.id]);

  if (!data) return <div className="p-4 text-xs text-dash-mute">Loading…</div>;
  const max = Math.max(1, ...data.days.map((d) => d.count));

  // 13 weeks x 7 days (approx 91 days)
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < data.days.length; i += 7) {
    weeks.push(data.days.slice(i, i + 7));
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Card label="Total commits" value={String(data.totalCommits)} />
        <Card label="Current streak" value={`${data.currentStreak}d`} />
        <Card label="Longest streak" value={`${data.longestStreak}d`} />
      </div>
      <div className="card p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-mute">
          Last 90 days
        </h3>
        <div className="flex gap-1">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {w.map((d) => {
                const intensity = d.count === 0 ? 0 : Math.min(1, d.count / max);
                const bg = d.count === 0
                  ? 'rgba(99,102,241,0.1)'
                  : `rgba(99,102,241,${0.25 + intensity * 0.75})`;
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.count} commits`}
                    style={{ backgroundColor: bg }}
                    className="h-3 w-3 rounded-sm"
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenshotsTab({ project }: { project: ProjectConfig }) {
  const [rows, setRows] = useState<ScreenshotRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<ScreenshotRow | null>(null);
  const [lightboxData, setLightboxData] = useState<string | null>(null);
  const [timelapse, setTimelapse] = useState<boolean>(false);

  const reload = async () => {
    setRows(await window.devdash.screenshots.list(project.id));
  };
  useEffect(() => {
    void reload();
  }, [project.id]);

  useEffect(() => {
    if (!lightbox) {
      setLightboxData(null);
      return;
    }
    void (async () => {
      setLightboxData(await window.devdash.shell.readFileAsDataUrl(lightbox.filePath));
    })();
  }, [lightbox?.id]);

  useEffect(() => {
    if (!timelapse || !rows.length) return;
    let i = rows.length - 1;
    const t = setInterval(() => {
      setLightbox(rows[i]);
      i--;
      if (i < 0) {
        setTimelapse(false);
        clearInterval(t);
      }
    }, 900);
    return () => clearInterval(t);
  }, [timelapse, rows]);

  const capture = async () => {
    setBusy(true);
    try {
      await window.devdash.screenshots.captureNow(project.id);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const prune = async () => {
    if (!confirm('Delete screenshots older than 30 days?')) return;
    await window.devdash.screenshots.removeOlderThan(project.id, 30);
    await reload();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-dash-line px-3 py-2">
        <button className="btn-primary" onClick={capture} disabled={busy || !project.liveUrl}>
          {busy ? 'Capturing…' : 'Capture now'}
        </button>
        <button className="btn-soft" onClick={() => setTimelapse(true)} disabled={!rows.length}>
          ▶ Timelapse
        </button>
        <button className="btn-soft" onClick={prune}>
          Prune old
        </button>
        {!project.liveUrl && (
          <span className="text-[11px] text-dash-warn">Set a live URL to enable captures.</span>
        )}
        <span className="ml-auto text-[11px] text-dash-mute">{rows.length} shots</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-dash-mute">No screenshots yet.</div>
        ) : (
          <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
            {rows.map((r) => (
              <ShotCard key={r.id} row={r} onOpen={() => setLightbox(r)} onDelete={async () => {
                await window.devdash.screenshots.remove(r.id);
                await reload();
              }} />
            ))}
          </div>
        )}
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setLightbox(null)}
        >
          {lightboxData ? (
            <img src={lightboxData} alt="" className="max-h-full max-w-full rounded-md shadow-glow" />
          ) : (
            <div className="text-dash-mute">Loading…</div>
          )}
        </div>
      )}
    </div>
  );
}

function ShotCard({ row, onOpen, onDelete }: { row: ScreenshotRow; onOpen: () => void; onDelete: () => void }) {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      setData(await window.devdash.shell.readFileAsDataUrl(row.filePath));
    })();
  }, [row.id]);

  return (
    <div className="card overflow-hidden">
      <button className="block w-full" onClick={onOpen}>
        {data ? (
          <img src={data} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-dash-bg text-[10px] text-dash-mute">
            loading…
          </div>
        )}
      </button>
      <div className="flex items-center justify-between p-2 text-[10px] text-dash-mute">
        <span>{new Date(row.capturedAt).toLocaleString()}</span>
        <button onClick={onDelete} className="text-dash-err hover:text-dash-err/80">
          delete
        </button>
      </div>
    </div>
  );
}

function ReleaseTab({ project }: { project: ProjectConfig }) {
  const [changelog, setChangelog] = useState<ChangelogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [bump, setBump] = useState<BumpKind>('patch');
  const [writeCl, setWriteCl] = useState<boolean>(true);
  const [push, setPush] = useState<boolean>(true);
  const [ghRelease, setGhRelease] = useState<boolean>(true);
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<ReleaseProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const gen = async () => {
    setLoading(true);
    try {
      const res = await window.devdash.changelog.generate(project.id);
      if ('error' in res) return;
      setChangelog(res);
      setBump(res.suggestedBump);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void gen();
  }, [project.id]);

  useEffect(() => {
    const off = window.devdash.release.onProgress((p) => setProgress(p));
    return () => off();
  }, []);

  const copyChangelog = async () => {
    if (!changelog) return;
    try {
      await navigator.clipboard.writeText(changelog.markdown);
      setCopyMsg('Copied');
      setTimeout(() => setCopyMsg(null), 2000);
    } catch (err) {
      setCopyMsg('Clipboard failed');
    }
  };

  const writeCLFile = async () => {
    if (!changelog) return;
    await window.devdash.changelog.write(project.id, changelog.markdown);
    setCopyMsg('Wrote CHANGELOG.md');
    setTimeout(() => setCopyMsg(null), 2000);
  };

  const release = async () => {
    setRunning(true);
    setProgress({ steps: [], currentVersion: null, nextVersion: null, finished: false });
    try {
      const res = await window.devdash.release.start(project.id, {
        bump,
        writeChangelog: writeCl,
        releaseNotes: notes,
        pushTags: push,
        createGithubRelease: ghRelease,
      });
      if ('error' in res) {
        setProgress({
          steps: [{ id: 'err', label: 'Error', status: 'error', detail: res.error }],
          currentVersion: null,
          nextVersion: null,
          finished: true,
        });
      } else {
        setProgress(res);
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b border-dash-line px-3 py-2">
        <button className="btn-soft" onClick={gen} disabled={loading}>
          {loading ? 'Generating…' : 'Regenerate changelog'}
        </button>
        <button className="btn-soft" onClick={copyChangelog} disabled={!changelog}>
          Copy
        </button>
        <button className="btn-soft" onClick={writeCLFile} disabled={!changelog}>
          Write CHANGELOG.md
        </button>
        {copyMsg && <span className="ml-2 text-[11px] text-dash-indigoBright">{copyMsg}</span>}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto border-r border-dash-line p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">
            Changelog preview
          </h3>
          {changelog ? (
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-dash-text">
              {changelog.markdown}
            </pre>
          ) : (
            <div className="text-xs text-dash-mute">No data.</div>
          )}
        </div>
        <div className="w-80 overflow-y-auto p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">
            Release
          </h3>
          <div className="space-y-2 text-xs">
            <div className="text-dash-mute">
              Current:{' '}
              <span className="font-mono text-dash-text">
                {changelog?.currentVersion ?? '—'}
              </span>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-dash-mute">Bump</span>
              <select
                value={bump}
                onChange={(e) => setBump(e.target.value as BumpKind)}
                className="rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-sm text-dash-text"
              >
                <option value="patch">patch</option>
                <option value="minor">minor</option>
                <option value="major">major</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-dash-text">
              <input type="checkbox" checked={writeCl} onChange={(e) => setWriteCl(e.target.checked)} />
              Write CHANGELOG.md
            </label>
            <label className="flex items-center gap-2 text-dash-text">
              <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
              git push + tags
            </label>
            <label className="flex items-center gap-2 text-dash-text">
              <input
                type="checkbox"
                checked={ghRelease}
                onChange={(e) => setGhRelease(e.target.checked)}
              />
              `gh release create` + upload dist/*.exe
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-dash-mute">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="rounded-md border border-dash-line bg-dash-bg px-2 py-1 font-mono text-xs text-dash-text"
                placeholder="Optional release notes (shown in GitHub release body)"
              />
            </label>
            <button className="btn-primary w-full" onClick={release} disabled={running}>
              {running ? 'Releasing…' : `Release v${changelog?.currentVersion ? changelog?.nextVersion ?? '?' : '?'}`}
            </button>
          </div>

          {progress && (
            <div className="mt-4 space-y-1.5 rounded-md border border-dash-line bg-dash-bg/40 p-2">
              {progress.steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      s.status === 'done'
                        ? 'bg-dash-ok'
                        : s.status === 'error'
                        ? 'bg-dash-err'
                        : s.status === 'running'
                        ? 'bg-dash-indigo animate-pulseSlow'
                        : s.status === 'skipped'
                        ? 'bg-dash-mute'
                        : 'bg-dash-line'
                    }`}
                  />
                  <span className="flex-1 text-dash-text">{s.label}</span>
                  {s.detail && <span className="text-dash-mute truncate max-w-[160px]">{s.detail}</span>}
                </div>
              ))}
              {progress.releaseUrl && (
                <button
                  onClick={() => window.devdash.shell.openExternal(progress.releaseUrl!)}
                  className="mt-2 text-[11px] text-dash-indigoBright hover:underline"
                >
                  Open release →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Shared tiny bits ---

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wider text-dash-mute">{label}</div>
      <div className="mt-1 font-mono text-xl text-dash-text">{value}</div>
    </div>
  );
}

function Pill({ color, label }: { color: 'ok' | 'err' | 'warn' | 'mute'; label: string }) {
  const map = {
    ok: 'bg-dash-ok/20 text-dash-ok',
    err: 'bg-dash-err/20 text-dash-err',
    warn: 'bg-dash-warn/20 text-dash-warn',
    mute: 'bg-dash-mute/20 text-dash-mute',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${map[color]}`}>
      {label}
    </span>
  );
}

function Sparkline({ points, fails }: { points: number[]; fails?: boolean[] }) {
  if (points.length === 0) return <div className="text-[10px] text-dash-mute">no samples</div>;
  const max = Math.max(1, ...points);
  const min = Math.min(...points);
  const w = 200;
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
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full">
      <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="1.5" />
      {fails?.map((f, i) =>
        f ? (
          <circle key={i} cx={(i * step).toFixed(1)} cy={h - 2} r="1.8" fill="#ef4444" />
        ) : null
      )}
    </svg>
  );
}

export function humanMs(ms: number): string {
  if (!ms) return '0m';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h >= 1) return `${h}h ${m % 60}m`;
  if (m >= 1) return `${m}m`;
  return `${s}s`;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
