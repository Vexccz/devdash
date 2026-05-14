import { useEffect, useRef, useState } from 'react';
import type {
  BundleSizeRow,
  ChangelogResult,
  DepSummary,
  EnvEntry,
  EnvFileDetail,
  EnvFileSummary,
  ErrorBudget,
  GitInfo,
  HeatmapResult,
  LogLine,
  ProjectConfig,
  ReleaseProgress,
  ScreenshotRow,
  TimeSummary,
  UptimeSummary,
  BumpKind,
} from '../types';
import QuickCommitModal from './QuickCommitModal';
import DiffViewerModal from './DiffViewerModal';

type DetailTab = 'overview' | 'logs' | 'env' | 'time' | 'deps' | 'heatmap' | 'screenshots' | 'release' | 'team' | 'mobile';

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
    { id: 'team', label: 'Team' },
    { id: 'mobile', label: 'Mobile' },
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
        className="flex h-[85vh] w-[90vw] max-w-[1100px] flex-col overflow-hidden rounded-lg border border-dash-line bg-dash-panel shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-dash-line px-4 py-3">
          <div className="min-w-0">
            <nav className="mb-1 flex items-center gap-1 text-[11px] text-dash-mute">
              <button
                onClick={onClose}
                className="hover:text-dash-text"
                aria-label="Back to projects"
              >
                Projects
              </button>
              <span className="text-dash-line">/</span>
              <span className="truncate text-dash-text">{project.name}</span>
              <span className="text-dash-line">/</span>
              <span className="capitalize text-dash-mute">{tab}</span>
            </nav>
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
          {tab === 'team' && <TeamTab project={project} />}
          {tab === 'mobile' && <MobileTab project={project} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ project, onAction }: { project: ProjectConfig; onAction: () => void }) {
  const [uptime, setUptime] = useState<UptimeSummary | null>(null);
  const [bundle, setBundle] = useState<BundleSizeRow[]>([]);
  const [errBudget, setErrBudget] = useState<ErrorBudget | null>(null);
  const [git, setGit] = useState<GitInfo | null>(null);
  const [gitBusy, setGitBusy] = useState<string>('');
  const [gitMsg, setGitMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showCommit, setShowCommit] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const loadGit = async (fetchRemote = false) => {
    const res = (await window.devdash.projects.status(project.id, fetchRemote)) as unknown as
      | (GitInfo & { error?: string })
      | { error: string };
    if (res && !('error' in res && !('ok' in res))) {
      setGit(res as GitInfo);
    }
  };

  useEffect(() => {
    void (async () => {
      if (project.liveUrl) setUptime(await window.devdash.uptime.project(project.id));
      setBundle(await window.devdash.bundle.history(project.id));
      setErrBudget(await window.devdash.uptime.errors(project.id));
      await loadGit(false);
    })();
  }, [project.id]);

  const doPull = async () => {
    setGitBusy('pull');
    setGitMsg(null);
    const res = await window.devdash.projects.pull(project.id);
    setGitBusy('');
    if (res.ok) {
      setGitMsg({ kind: 'ok', text: res.output || 'Pulled' });
      await loadGit(true);
    } else {
      setGitMsg({ kind: 'err', text: res.error || 'Pull failed' });
    }
    setTimeout(() => setGitMsg(null), 4000);
  };

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

        <section className="card p-4 col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-dash-mute">
              Git
            </h3>
            <button
              onClick={() => {
                void loadGit(true);
                onAction();
              }}
              title="Refresh git status (fetches remote)"
              className="text-[10px] text-dash-mute hover:text-dash-text"
            >
              ↻ Refresh
            </button>
          </div>
          {!git || !git.ok ? (
            <p className="text-xs text-dash-mute">{git?.error || 'Not a git repo or path missing.'}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-dash-indigo/20 px-2 py-0.5 font-mono text-dash-indigoBright">
                  {git.branch || 'detached'}
                </span>
                {!!git.ahead && (
                  <span className="rounded bg-dash-ok/20 px-2 py-0.5 text-dash-ok" title="Commits ahead of remote">
                    ↑ {git.ahead}
                  </span>
                )}
                {!!git.behind && (
                  <span className="rounded bg-dash-warn/20 px-2 py-0.5 text-dash-warn" title="Commits behind remote">
                    ↓ {git.behind}
                  </span>
                )}
                {git.dirty ? (
                  <span className="rounded bg-dash-warn/20 px-2 py-0.5 text-dash-warn">
                    {(git.modifiedCount || 0) + (git.stagedCount || 0) + (git.untrackedCount || 0)} changes
                  </span>
                ) : (
                  <span className="rounded bg-dash-ok/20 px-2 py-0.5 text-dash-ok">clean</span>
                )}
                {git.dirty && (
                  <span className="text-[10px] text-dash-mute">
                    {git.modifiedCount || 0} modified · {git.stagedCount || 0} staged · {git.untrackedCount || 0} untracked
                  </span>
                )}
              </div>

              {git.lastCommit && (
                <div className="rounded border border-dash-line/60 bg-dash-bg/40 px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-dash-mute">{git.lastCommit.shortHash}</span>
                    <span className="text-dash-text">{git.lastCommit.message}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-dash-mute">
                    {git.lastCommit.author} · {git.lastCommit.date}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary disabled:opacity-40"
                  disabled={!git.dirty}
                  title={git.dirty ? 'Stage, commit, and push changes' : 'No changes to commit'}
                  onClick={() => {
                    setShowCommit(true);
                    onAction();
                  }}
                >
                  💾 Commit
                </button>
                <button
                  className="btn-soft disabled:opacity-40"
                  disabled={gitBusy === 'pull'}
                  title="Pull latest commits from remote"
                  onClick={() => {
                    void doPull();
                    onAction();
                  }}
                >
                  {gitBusy === 'pull' ? 'Pulling…' : '⬇ Pull'}
                </button>
                <button
                  className="btn-soft disabled:opacity-40"
                  disabled={!git.dirty}
                  title={git.dirty ? 'View unstaged diff' : 'No changes'}
                  onClick={() => {
                    setShowDiff(true);
                    onAction();
                  }}
                >
                  👁 Diff
                </button>
                <button
                  className="btn-soft disabled:opacity-40"
                  disabled={!project.githubUrl}
                  title="Open repo on GitHub"
                  onClick={() => {
                    open(project.githubUrl);
                    onAction();
                  }}
                >
                  🐙 Open repo
                </button>
              </div>

              {gitMsg && (
                <div
                  className={`rounded-md border px-3 py-2 text-[11px] ${
                    gitMsg.kind === 'ok'
                      ? 'border-dash-ok/30 bg-dash-ok/10 text-dash-ok'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  {gitMsg.text}
                </div>
              )}
            </div>
          )}
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

      {showCommit && (
        <QuickCommitModal
          projectId={project.id}
          projectName={project.name}
          onClose={() => setShowCommit(false)}
          onSuccess={() => {
            setShowCommit(false);
            void loadGit(true);
          }}
        />
      )}

      {showDiff && (
        <DiffViewerModal
          projectId={project.id}
          projectName={project.name}
          onClose={() => setShowDiff(false)}
        />
      )}
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
  const [showSync, setShowSync] = useState(false);

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
          {(project.deployProvider === 'vercel' || project.deployProvider === 'render') && (
            <button
              className="btn-soft"
              onClick={() => setShowSync(true)}
              title={`Compare local env vs ${project.deployProvider} and push missing keys`}
            >
              ↕ Sync {project.deployProvider}
            </button>
          )}
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
      {showSync && (
        <EnvSyncModal project={project} onClose={() => setShowSync(false)} />
      )}
    </div>
  );
}

function EnvSyncModal({ project, onClose }: { project: ProjectConfig; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [items, setItems] = useState<Array<{ key: string; localValue: string | null; remoteValue: string | null; status: 'only-local' | 'only-remote' | 'match' | 'differ' }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{ pushed: string[]; failed: Array<{ key: string; error: string }>; error?: string } | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await window.devdash.env.syncCompare(project.id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Compare failed');
      return;
    }
    setItems(res.items);
    const preselect: Record<string, boolean> = {};
    for (const it of res.items) {
      if (it.status === 'only-local' || it.status === 'differ') preselect[it.key] = true;
    }
    setSelected(preselect);
  };

  useEffect(() => {
    void load();
  }, [project.id]);

  const selectedKeys = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);

  const doPush = async () => {
    if (selectedKeys.length === 0) return;
    if (!confirm(`Push ${selectedKeys.length} key(s) to ${project.deployProvider}?`)) return;
    setPushing(true);
    const res = await window.devdash.env.syncPush(project.id, selectedKeys);
    setPushing(false);
    setResult({ pushed: res.pushed, failed: res.failed, error: res.error });
    void load();
  };

  const truncate = (s: string | null) => {
    if (s === null) return <span className="italic text-dash-mute">—</span>;
    if (s.length > 40) return <span>{s.slice(0, 40)}…</span>;
    return <span>{s}</span>;
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-lg border border-dash-line bg-dash-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-dash-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-dash-text">Env sync · {project.name}</h2>
            <p className="text-[10px] text-dash-mute">
              Local {`(.env.production || .env || .env.example)`} vs {project.deployProvider}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-dash-mute hover:text-dash-text">×</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 text-xs">
          {loading && <div className="py-8 text-center text-dash-mute">Comparing…</div>}
          {error && !loading && (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-400">{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="py-8 text-center text-dash-mute">No env vars found locally or remotely.</div>
          )}
          {!loading && !error && items.length > 0 && (
            <table className="w-full text-[11px]">
              <thead className="text-dash-mute">
                <tr className="border-b border-dash-line/60">
                  <th className="px-2 py-1 text-left font-normal">
                    <input
                      type="checkbox"
                      checked={selectedKeys.length > 0 && selectedKeys.length === items.filter((i) => i.status !== 'only-remote' && i.status !== 'match').length}
                      onChange={(e) => {
                        const next: Record<string, boolean> = {};
                        if (e.target.checked) {
                          for (const it of items) if (it.status === 'only-local' || it.status === 'differ') next[it.key] = true;
                        }
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th className="px-2 py-1 text-left font-normal">Key</th>
                  <th className="px-2 py-1 text-left font-normal">Local</th>
                  <th className="px-2 py-1 text-left font-normal">Remote</th>
                  <th className="px-2 py-1 text-left font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const canPush = it.status === 'only-local' || it.status === 'differ';
                  const isRevealed = reveal[it.key];
                  const color = {
                    'only-local': 'bg-dash-warn/20 text-dash-warn',
                    differ: 'bg-dash-err/20 text-dash-err',
                    'only-remote': 'bg-dash-indigo/20 text-dash-indigoBright',
                    match: 'bg-dash-ok/20 text-dash-ok',
                  }[it.status];
                  return (
                    <tr key={it.key} className="border-b border-dash-line/30 last:border-0">
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          disabled={!canPush}
                          checked={!!selected[it.key]}
                          onChange={(e) => setSelected((cur) => ({ ...cur, [it.key]: e.target.checked }))}
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-dash-indigoBright">{it.key}</td>
                      <td className="px-2 py-1 font-mono text-dash-text">
                        {it.localValue === null ? (
                          <span className="italic text-dash-mute">—</span>
                        ) : isRevealed ? (
                          truncate(it.localValue)
                        ) : (
                          <span className="text-dash-mute">••••••</span>
                        )}
                      </td>
                      <td className="px-2 py-1 font-mono text-dash-text">
                        {it.remoteValue === null ? (
                          <span className="italic text-dash-mute">—</span>
                        ) : isRevealed ? (
                          truncate(it.remoteValue)
                        ) : (
                          <span className="text-dash-mute">••••••</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${color}`}>{it.status}</span>
                        <button
                          className="ml-2 text-[10px] text-dash-mute hover:text-dash-text"
                          onClick={() => setReveal((cur) => ({ ...cur, [it.key]: !cur[it.key] }))}
                        >
                          {isRevealed ? 'Hide' : 'Reveal'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {result && (
            <div className="mt-3 rounded-md border border-dash-line/60 bg-dash-bg/40 p-3 text-[11px]">
              <div className="font-semibold text-dash-text">
                {result.failed.length === 0 && !result.error ? '✅ Pushed' : '⚠ Partial'}
              </div>
              <div className="mt-1 text-dash-mute">Pushed: {result.pushed.length ? result.pushed.join(', ') : 'none'}</div>
              {result.failed.length > 0 && (
                <div className="mt-1 text-red-400">
                  Failed:
                  <ul className="ml-4 list-disc">
                    {result.failed.map((f) => (
                      <li key={f.key}>{f.key}: {f.error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.error && <div className="mt-1 text-red-400">{result.error}</div>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-dash-line px-4 py-3">
          <div className="text-[11px] text-dash-mute">
            {selectedKeys.length} selected
          </div>
          <div className="flex gap-2">
            <button className="btn-soft" onClick={onClose}>Close</button>
            <button className="btn-soft" onClick={load} disabled={loading}>Refresh</button>
            <button
              className="btn-primary disabled:opacity-40"
              disabled={pushing || selectedKeys.length === 0}
              onClick={doPush}
              title="Push selected local values to the provider"
            >
              {pushing ? 'Pushing…' : `Push to ${project.deployProvider}`}
            </button>
          </div>
        </div>
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
            <img src={lightboxData} alt="" className="max-h-full max-w-full rounded-md shadow-2xl" />
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

function TeamTab({ project }: { project: ProjectConfig }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<{ collaborators: Array<{ login: string; avatarUrl: string; htmlUrl: string; role: string }>; invitations: Array<{ id: number; invitee: string; inviteeAvatar: string; permissions: string; createdAt: string; htmlUrl: string }> } | null>(null);
  const [username, setUsername] = useState('');
  const [permission, setPermission] = useState<'admin' | 'maintain' | 'write' | 'triage' | 'pull'>('write');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await window.devdash.collab.list(project.id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Failed to load collaborators');
      setData(null);
      return;
    }
    setData({ collaborators: res.collaborators, invitations: res.invitations });
  };

  useEffect(() => {
    void load();
  }, [project.id]);

  const invite = async () => {
    if (!username.trim()) {
      setMsg({ ok: false, text: 'Enter a GitHub username' });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await window.devdash.collab.invite(project.id, username.trim(), permission);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.ok ? res.message || 'Invited' : res.error || 'Invite failed' });
    if (res.ok) {
      setUsername('');
      void load();
    }
  };

  const remove = async (login: string) => {
    if (!confirm(`Remove ${login} from ${project.name}?`)) return;
    setBusy(true);
    const res = await window.devdash.collab.remove(project.id, login);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.ok ? res.message || 'Removed' : res.error || 'Remove failed' });
    if (res.ok) void load();
  };

  const cancelInvite = async (id: number, invitee: string) => {
    if (!confirm(`Cancel pending invitation for ${invitee}?`)) return;
    setBusy(true);
    const res = await window.devdash.collab.cancelInvite(project.id, id);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.ok ? res.message || 'Cancelled' : res.error || 'Cancel failed' });
    if (res.ok) void load();
  };

  if (!project.githubUrl) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-dash-text">No GitHub URL configured.</p>
          <p className="mt-1 text-[11px] text-dash-mute">Add a `githubUrl` to this project to manage collaborators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-dash-text">Collaborators</h3>
          <p className="text-[11px] text-dash-mute">{project.githubUrl}</p>
        </div>
        <button className="btn-soft" onClick={load} disabled={loading} title="Reload from GitHub">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">{error}</div>
      )}

      <section className="card mb-3 p-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">Invite</h4>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="GitHub username"
            className="flex-1 min-w-[180px] rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-xs text-dash-text"
          />
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as any)}
            className="rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text"
            title="Permission level"
          >
            <option value="pull">Read (pull)</option>
            <option value="triage">Triage</option>
            <option value="write">Write (push)</option>
            <option value="maintain">Maintain</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn-primary disabled:opacity-40" disabled={busy || !username.trim()} onClick={invite}>
            {busy ? 'Working…' : 'Invite'}
          </button>
        </div>
        {msg && (
          <div
            className={`mt-2 rounded-md px-3 py-1.5 text-[11px] ${
              msg.ok
                ? 'border border-dash-ok/30 bg-dash-ok/10 text-dash-ok'
                : 'border border-red-500/30 bg-red-500/10 text-red-400'
            }`}
          >
            {msg.text}
          </div>
        )}
      </section>

      {data && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section className="card p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">
              Collaborators ({data.collaborators.length})
            </h4>
            {data.collaborators.length === 0 ? (
              <p className="text-xs text-dash-mute">No collaborators yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.collaborators.map((c) => (
                  <li key={c.login} className="flex items-center gap-2 rounded border border-dash-line/60 bg-dash-bg/40 px-2 py-1.5">
                    <img src={c.avatarUrl} alt={c.login} className="h-6 w-6 rounded-full" />
                    <button
                      onClick={() => window.devdash.shell.openExternal(c.htmlUrl)}
                      className="text-xs text-dash-text hover:text-dash-indigoBright"
                    >
                      @{c.login}
                    </button>
                    <span className="ml-auto rounded bg-dash-indigo/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-dash-indigoBright">
                      {c.role}
                    </span>
                    <button
                      className="text-[10px] text-dash-mute hover:text-red-400"
                      onClick={() => remove(c.login)}
                      title={`Remove ${c.login}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-mute">
              Pending invites ({data.invitations.length})
            </h4>
            {data.invitations.length === 0 ? (
              <p className="text-xs text-dash-mute">No pending invitations.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-2 rounded border border-dash-line/60 bg-dash-bg/40 px-2 py-1.5">
                    <img src={inv.inviteeAvatar} alt={inv.invitee} className="h-6 w-6 rounded-full" />
                    <div className="min-w-0">
                      <div className="text-xs text-dash-text">@{inv.invitee}</div>
                      <div className="text-[10px] text-dash-mute">{inv.permissions} · {new Date(inv.createdAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      className="ml-auto text-[10px] text-dash-mute hover:text-red-400"
                      onClick={() => cancelInvite(inv.id, inv.invitee)}
                      title="Cancel invite"
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function MobileTab({ project }: { project: ProjectConfig }) {
  const [info, setInfo] = useState<{
    isCapacitor: boolean;
    capacitorVersion?: string;
    androidFolder: boolean;
    appId?: string;
    appName?: string;
    webDir?: string;
    error?: string;
  } | null>(null);
  const [java, setJava] = useState<{
    ok: boolean;
    installed?: string;
    major?: number;
    required?: number;
    compatible?: boolean;
    hint?: string;
    error?: string;
  } | null>(null);
  const [flavor, setFlavor] = useState<'debug' | 'release'>('debug');
  const [runWebBuild, setRunWebBuild] = useState(true);
  const [runSync, setRunSync] = useState(true);
  const [copyToDownloads, setCopyToDownloads] = useState(true);
  const [building, setBuilding] = useState(false);
  const [logs, setLogs] = useState<Array<{ stream: string; line: string; ts: number }>>([]);
  const [result, setResult] = useState<{ ok: boolean; apkPath?: string; copiedTo?: string; durationMs?: number; error?: string } | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      const det = await window.devdash.capacitor.detect(project.id);
      setInfo(det);
      if (det.isCapacitor) {
        const j = await window.devdash.capacitor.detectJava(det.capacitorVersion);
        setJava(j);
      }
      setBuilding(await window.devdash.capacitor.isBuilding(project.id));
    })();
  }, [project.id]);

  useEffect(() => {
    const off = window.devdash.capacitor.onLog((e) => {
      if (e.projectId !== project.id) return;
      setLogs((cur) => [...cur.slice(-499), { stream: e.stream, line: e.line, ts: e.ts }]);
    });
    return off;
  }, [project.id]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs.length]);

  const startBuild = async () => {
    setBuilding(true);
    setResult(null);
    setLogs([{ stream: 'system', line: `Starting ${flavor} build…`, ts: Date.now() }]);
    const res = await window.devdash.capacitor.buildApk({
      id: project.id,
      flavor,
      runWebBuild,
      runSync,
      outputToDownloads: copyToDownloads,
    });
    setBuilding(false);
    setResult(res);
  };

  if (!info) {
    return <div className="p-8 text-center text-sm text-dash-mute">Detecting Capacitor…</div>;
  }

  if (!info.isCapacitor) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="text-sm text-dash-text">Not a Capacitor project.</p>
          <p className="mt-1 text-[11px] text-dash-mute">Install <code className="font-mono">@capacitor/core</code> and run <code className="font-mono">npx cap init</code>, then <code className="font-mono">npx cap add android</code>.</p>
        </div>
      </div>
    );
  }

  const javaOk = java?.compatible === true;
  const javaWarn = java && !java.compatible;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 overflow-y-auto p-4" style={{ flex: '0 0 auto' }}>
        <div className="grid grid-cols-2 gap-3">
          <section className="card p-3">
            <h3 className="mb-1 text-[10px] uppercase tracking-wider text-dash-mute">App</h3>
            <div className="text-xs text-dash-text">
              <div><span className="text-dash-mute">Name:</span> {info.appName || '—'}</div>
              <div><span className="text-dash-mute">ID:</span> <span className="font-mono">{info.appId || '—'}</span></div>
              <div><span className="text-dash-mute">Web dir:</span> <span className="font-mono">{info.webDir || '—'}</span></div>
              <div><span className="text-dash-mute">Capacitor:</span> {info.capacitorVersion || '—'}</div>
              <div><span className="text-dash-mute">android/:</span> {info.androidFolder ? '✓ present' : '✗ missing'}</div>
            </div>
          </section>
          <section className={`card p-3 ${javaWarn ? 'border-dash-warn/40' : ''}`}>
            <h3 className="mb-1 text-[10px] uppercase tracking-wider text-dash-mute">Java</h3>
            {!java ? (
              <p className="text-xs text-dash-mute">Checking…</p>
            ) : !java.ok ? (
              <>
                <p className="text-xs text-red-400">Java not detected.</p>
                <p className="mt-1 text-[10px] text-dash-mute">{java.hint}</p>
              </>
            ) : (
              <div className="text-xs text-dash-text">
                <div><span className="text-dash-mute">Installed:</span> {java.installed} {javaOk && <span className="text-dash-ok">✓</span>}</div>
                <div><span className="text-dash-mute">Required:</span> JDK {java.required}</div>
                {javaWarn && <div className="mt-1 text-[10px] text-dash-warn">{java.hint}</div>}
              </div>
            )}
          </section>
        </div>

        <section className="card p-3">
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-dash-mute">Build APK</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-dash-text">
            <label className="flex items-center gap-1.5">
              <span className="text-dash-mute">Flavor</span>
              <select
                value={flavor}
                onChange={(e) => setFlavor(e.target.value as 'debug' | 'release')}
                className="rounded-md border border-dash-line bg-dash-bg px-2 py-1"
              >
                <option value="debug">debug</option>
                <option value="release">release</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5" title="Run npm run build before assembling">
              <input type="checkbox" checked={runWebBuild} onChange={(e) => setRunWebBuild(e.target.checked)} />
              Web build
            </label>
            <label className="flex items-center gap-1.5" title="Run npx cap sync android">
              <input type="checkbox" checked={runSync} onChange={(e) => setRunSync(e.target.checked)} />
              cap sync
            </label>
            <label className="flex items-center gap-1.5" title="Copy resulting APK to your Downloads folder">
              <input type="checkbox" checked={copyToDownloads} onChange={(e) => setCopyToDownloads(e.target.checked)} />
              Copy to Downloads
            </label>
            <button
              className="btn-primary disabled:opacity-40"
              disabled={building || !info.androidFolder}
              onClick={startBuild}
              title={info.androidFolder ? 'Build APK' : 'Run `npx cap add android` first'}
            >
              {building ? 'Building…' : `Build ${flavor} APK`}
            </button>
          </div>
          {result && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-[11px] ${
                result.ok
                  ? 'border border-dash-ok/30 bg-dash-ok/10 text-dash-ok'
                  : 'border border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {result.ok ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>✅ Built in {Math.round((result.durationMs ?? 0) / 1000)}s</span>
                  {result.apkPath && (
                    <button
                      className="btn-soft text-[10px]"
                      onClick={() => result.apkPath && window.devdash.capacitor.openApkFolder(result.apkPath)}
                    >
                      Show in folder
                    </button>
                  )}
                  {result.copiedTo && (
                    <button
                      className="btn-soft text-[10px]"
                      onClick={() => result.copiedTo && window.devdash.capacitor.openApkFolder(result.copiedTo)}
                      title={result.copiedTo}
                    >
                      Open Downloads copy
                    </button>
                  )}
                </div>
              ) : (
                <span>❌ {result.error}</span>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="min-h-0 flex-1 border-t border-dash-line">
        <div className="flex items-center justify-between border-b border-dash-line px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-dash-mute">Build log ({logs.length})</span>
          <button className="text-[10px] text-dash-mute hover:text-dash-text" onClick={() => setLogs([])}>Clear</button>
        </div>
        <div className="h-full overflow-y-auto p-2 font-mono text-[10px]">
          {logs.length === 0 ? (
            <p className="px-2 py-1 text-dash-mute">Build output will appear here…</p>
          ) : (
            <>
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.stream === 'stderr'
                      ? 'text-red-400'
                      : l.stream === 'system'
                      ? 'text-dash-indigoBright'
                      : 'text-dash-text'
                  }
                >
                  {l.line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
