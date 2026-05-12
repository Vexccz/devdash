import { useEffect, useMemo, useState } from 'react';
import type { BundleSizeRow, DepSummary, ProjectConfig, ProjectStatus, UptimeSummary } from '../types';
import AddProjectModal from './AddProjectModal';
import QuickCommitModal from './QuickCommitModal';
import DiffViewerModal from './DiffViewerModal';
import PRListModal from './PRListModal';

interface Props {
  onOpenProject: (id: string, tab?: 'overview' | 'logs' | 'env' | 'time' | 'deps' | 'heatmap' | 'screenshots' | 'release') => void;
}

export default function ProjectsView({ onOpenProject }: Props) {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [editing, setEditing] = useState<ProjectConfig | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastFetchAt, setLastFetchAt] = useState<number>(0);
  const [uptime, setUptime] = useState<Record<string, UptimeSummary>>({});
  const [depSummaries, setDepSummaries] = useState<Record<string, DepSummary | null>>({});
  const [bundleLatest, setBundleLatest] = useState<Record<string, BundleSizeRow | null>>({});
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [quickCommitFor, setQuickCommitFor] = useState<{ id: string; name: string } | null>(null);
  const [diffFor, setDiffFor] = useState<{ id: string; name: string } | null>(null);
  const [prsFor, setPrsFor] = useState<{ id: string; name: string } | null>(null);

  const load = async (fetchRemote = false) => {
    setLoading(true);
    try {
      const list = await window.devdash.projects.statusAll(fetchRemote);
      setStatuses(list);
      if (fetchRemote) setLastFetchAt(Date.now());

      const sums = await window.devdash.uptime.all();
      const map: Record<string, UptimeSummary> = {};
      for (const s of sums) map[s.projectId] = s;
      setUptime(map);

      const dep: Record<string, DepSummary | null> = {};
      const bundle: Record<string, BundleSizeRow | null> = {};
      for (const s of list) {
        dep[s.project.id] = await window.devdash.deps.latest(s.project.id);
        const hist = await window.devdash.bundle.history(s.project.id);
        bundle[s.project.id] = hist[0] ?? null;
      }
      setDepSummaries(dep);
      setBundleLatest(bundle);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
    const off = window.devdash.devserver.onStatus(() => void load(false));
    return () => off();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this project from DevDash? (Files on disk are NOT deleted.)')) return;
    await window.devdash.projects.remove(id);
    void load(false);
  };

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const st of statuses) {
      (st.project.tags ?? []).forEach((t) => s.add(t));
    }
    return Array.from(s).sort();
  }, [statuses]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filteredStatuses = useMemo(() => {
    if (selectedTags.size === 0) return statuses;
    return statuses.filter((s) => {
      const tags = s.project.tags ?? [];
      return tags.some((t) => selectedTags.has(t));
    });
  }, [statuses, selectedTags]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Projects</h1>
          <p className="text-xs text-dash-mute">
            {statuses.length} project{statuses.length === 1 ? '' : 's'} registered
            {lastFetchAt ? ` · fetched ${new Date(lastFetchAt).toLocaleTimeString()}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-soft"
          >
            {refreshing ? 'Fetching…' : 'Refresh + git fetch'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary"
          >
            + Add project
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-dash-mute">Filter</span>
          <button
            onClick={() => setSelectedTags(new Set())}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              selectedTags.size === 0
                ? 'border-dash-indigo/60 bg-dash-indigo/20 text-dash-indigoBright'
                : 'border-dash-line text-dash-mute hover:text-dash-text'
            }`}
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${
                selectedTags.has(t)
                  ? 'border-dash-indigo/60 bg-dash-indigo/20 text-dash-indigoBright'
                  : 'border-dash-line text-dash-mute hover:text-dash-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && statuses.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">Loading projects…</div>
        ) : statuses.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">
            No projects yet. Click "+ Add project" to register your first one.
          </div>
        ) : filteredStatuses.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">
            No projects match the selected tags.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2">
            {filteredStatuses.map((s) => (
              <ProjectCard
                key={s.project.id}
                data={s}
                uptime={uptime[s.project.id] ?? null}
                deps={depSummaries[s.project.id] ?? null}
                bundle={bundleLatest[s.project.id] ?? null}
                onEdit={() => setEditing(s.project)}
                onRemove={() => handleDelete(s.project.id)}
                onAction={() => void load(false)}
                onOpen={(tab) => onOpenProject(s.project.id, tab)}
                onQuickCommit={() => setQuickCommitFor({ id: s.project.id, name: s.project.name })}
                onOpenDiff={() => setDiffFor({ id: s.project.id, name: s.project.name })}
                onOpenPRs={() => setPrsFor({ id: s.project.id, name: s.project.name })}
              />
            ))}
          </div>
        )}
      </div>

      {(showAdd || editing) && (
        <AddProjectModal
          initial={editing ?? undefined}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditing(null);
            void load(false);
          }}
        />
      )}

      {quickCommitFor && (
        <QuickCommitModal
          projectId={quickCommitFor.id}
          projectName={quickCommitFor.name}
          onClose={() => setQuickCommitFor(null)}
          onSuccess={() => {
            setQuickCommitFor(null);
            void load(false);
          }}
        />
      )}

      {diffFor && (
        <DiffViewerModal
          projectId={diffFor.id}
          projectName={diffFor.name}
          onClose={() => setDiffFor(null)}
        />
      )}

      {prsFor && (
        <PRListModal
          projectId={prsFor.id}
          projectName={prsFor.name}
          onClose={() => setPrsFor(null)}
        />
      )}
    </div>
  );
}

function ProjectCard({
  data,
  uptime,
  deps,
  bundle,
  onEdit,
  onRemove,
  onAction,
  onOpen,
  onQuickCommit,
  onOpenDiff,
  onOpenPRs,
}: {
  data: ProjectStatus;
  uptime: UptimeSummary | null;
  deps: DepSummary | null;
  bundle: BundleSizeRow | null;
  onEdit: () => void;
  onRemove: () => void;
  onAction: () => void;
  onOpen: (tab?: 'overview' | 'logs' | 'env' | 'time' | 'deps' | 'heatmap' | 'screenshots' | 'release') => void;
  onQuickCommit: () => void;
  onOpenDiff: () => void;
  onOpenPRs: () => void;
}) {
  const { project, git, framework, devserver } = data;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runAction = async (name: string, fn: () => Promise<any>) => {
    setBusy(name);
    setMessage(null);
    try {
      const res = await fn();
      if (res && typeof res === 'object' && 'ok' in res && !res.ok) {
        setMessage(`${name} failed: ${res.error ?? 'unknown error'}`);
      } else if (res && typeof res === 'object' && 'output' in res && res.output) {
        setMessage(res.output);
      }
      onAction();
    } catch (err) {
      setMessage(`${name} failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
      if (message) setTimeout(() => setMessage(null), 4000);
    }
  };

  const open = (url?: string) => {
    if (!url) return;
    void window.devdash.shell.openExternal(url);
  };

  const statusDot = (() => {
    if (!git.ok) return <span className="h-2 w-2 rounded-full bg-dash-err" title={git.error ?? 'error'} />;
    if (git.dirty) return <span className="h-2 w-2 rounded-full bg-dash-warn" title="Uncommitted changes" />;
    return <span className="h-2 w-2 rounded-full bg-dash-ok" title="Clean" />;
  })();

  const uptimeDot = uptime?.latestOk === false ? (
    <span title="Live URL down" className="h-2 w-2 rounded-full bg-dash-err" />
  ) : uptime?.latestOk === true ? (
    <span title="Live URL up" className="h-2 w-2 rounded-full bg-dash-ok" />
  ) : null;

  const depBadge = deps && deps.majorCount > 0 ? (
    <span className="rounded bg-dash-err/20 px-1.5 py-0.5 text-[10px] uppercase text-dash-err">
      {deps.majorCount} major
    </span>
  ) : deps && deps.minorCount > 0 ? (
    <span className="rounded bg-dash-warn/20 px-1.5 py-0.5 text-[10px] uppercase text-dash-warn">
      {deps.minorCount} minor
    </span>
  ) : null;

  const devManagedRunning = devserver?.running;
  const frameworkLabel = framework?.label ?? 'unknown';

  return (
    <div className="card flex flex-col gap-3 p-4 shadow-card transition">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => onOpen('overview')} className="min-w-0 flex-1 cursor-pointer text-left">
          <div className="flex flex-wrap items-center gap-2">
            {statusDot}
            <h3 className="truncate text-sm font-semibold text-dash-text">{project.name}</h3>
            <span className="rounded bg-dash-panel2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-dash-mute">
              {frameworkLabel}
            </span>
            {project.deployProvider !== 'none' && (
              <span className="rounded bg-dash-indigo/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-dash-indigoBright">
                {project.deployProvider}
              </span>
            )}
            {uptimeDot}
            {depBadge}
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-dash-mute" title={project.path}>
            {project.path}
          </p>
        </button>
        <div className="flex shrink-0 gap-1">
          <IconBtn title="Edit" onClick={onEdit}>
            ✎
          </IconBtn>
          <IconBtn title="Remove" onClick={onRemove}>
            ×
          </IconBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Field label="Branch">
          <span className="font-mono">{git.branch ?? '—'}</span>
        </Field>
        <Field label="Ahead / Behind">
          <span className="font-mono">
            {git.ok ? `↑${git.ahead ?? 0} ↓${git.behind ?? 0}` : '—'}
          </span>
        </Field>
        <Field label="Changes">
          {git.ok ? (
            git.dirty ? (
              <span className="text-dash-warn">
                {git.modifiedCount ?? 0}M · {git.stagedCount ?? 0}S · {git.untrackedCount ?? 0}U
              </span>
            ) : (
              <span className="text-dash-ok">clean</span>
            )
          ) : (
            <span className="text-dash-err">{git.error ?? 'unavailable'}</span>
          )}
        </Field>
        <Field label="Dev server">
          {devManagedRunning ? (
            <button
              onClick={() => framework?.localUrl && open(framework.localUrl)}
              className="font-mono text-dash-ok hover:underline"
              title={framework?.localUrl ?? 'running'}
            >
              ● :{framework?.port ?? '…'}
            </button>
          ) : (
            <span className="font-mono text-dash-mute">
              {framework?.port ? `:${framework.port}` : '—'}
            </span>
          )}
        </Field>
      </div>

      <div className="rounded-md border border-dash-line bg-dash-bg/50 px-3 py-2 text-[11px]">
        {git.lastCommit ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-dash-panel2 px-1.5 py-0.5 font-mono text-[10px] text-dash-indigoBright">
                {git.lastCommit.shortHash}
              </span>
              <span className="truncate text-dash-text">{git.lastCommit.message}</span>
            </div>
            <div className="mt-1 text-dash-mute">
              {git.lastCommit.author} · {formatRelative(new Date(git.lastCommit.date).getTime())}
              {bundle && <span> · bundle {humanSize(bundle.sizeBytes)}</span>}
            </div>
          </div>
        ) : (
          <span className="text-dash-mute">No commit data</span>
        )}
      </div>

      {message && (
        <div className="rounded-md border border-dash-line bg-dash-panel/60 px-3 py-1.5 text-[11px] text-dash-text">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {devManagedRunning ? (
          <ActionBtn
            disabled={busy !== null}
            onClick={() => runAction('Stop dev', () => window.devdash.devserver.stop(project.id))}
          >
            ■ Stop
          </ActionBtn>
        ) : (
          <ActionBtn
            disabled={busy !== null || framework?.id === 'unknown'}
            onClick={() => runAction('Run dev', () => window.devdash.devserver.start(project.id))}
          >
            ▶ Run
          </ActionBtn>
        )}
        <ActionBtn disabled={busy !== null} onClick={() => onOpen('logs')}>
          📜 Logs
        </ActionBtn>
        <ActionBtn disabled={busy !== null} onClick={() => onOpen('env')}>
          🔐 Env
        </ActionBtn>
        <ActionBtn
          disabled={busy !== null}
          onClick={() => runAction('Open folder', () => window.devdash.projects.openFolder(project.path))}
        >
          📂 Folder
        </ActionBtn>
        <ActionBtn
          disabled={busy !== null}
          onClick={() => runAction('Open VS Code', () => window.devdash.projects.openInVSCode(project.path))}
        >
          💻 VS Code
        </ActionBtn>
        <ActionBtn disabled={!project.githubUrl} onClick={() => open(project.githubUrl)}>
          🐙 GitHub
        </ActionBtn>
        <ActionBtn disabled={!project.liveUrl} onClick={() => open(project.liveUrl)}>
          🌐 Live
        </ActionBtn>
        <ActionBtn
          disabled={busy !== null || !git.ok}
          onClick={() => runAction('Git pull', () => window.devdash.projects.pull(project.id))}
        >
          ⇣ Pull
        </ActionBtn>
        <ActionBtn
          disabled={busy !== null || !git.ok}
          onClick={onQuickCommit}
        >
          ✓ Commit
        </ActionBtn>
        <ActionBtn
          disabled={busy !== null || !git.ok}
          onClick={onOpenDiff}
        >
          □ Diff
        </ActionBtn>
        <ActionBtn
          disabled={busy !== null || !project.githubUrl}
          onClick={onOpenPRs}
        >
          🔀 PRs
        </ActionBtn>
        {project.deployProvider !== 'none' && project.deployId && (
          <ActionBtn
            disabled={busy !== null}
            onClick={() =>
              runAction('Redeploy', async () => {
                if (!confirm(`Trigger a redeploy on ${project.deployProvider}?`)) return { ok: true };
                return window.devdash.deploys.trigger(project.id);
              })
            }
          >
            🚀 Redeploy
          </ActionBtn>
        )}
        <ActionBtn disabled={busy !== null} onClick={() => onOpen('release')}>
          🏷 Release
        </ActionBtn>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-dash-mute">{label}</div>
      <div className="text-dash-text">{children}</div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn-soft">
      {children}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1 text-dash-mute hover:bg-white/5 hover:text-dash-text"
    >
      {children}
    </button>
  );
}

function formatRelative(timestamp: number): string {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
