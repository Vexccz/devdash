import { useEffect, useState } from 'react';
import type { ProjectConfig, ProjectStatus } from '../types';
import AddProjectModal from './AddProjectModal';

export default function ProjectsView() {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [editing, setEditing] = useState<ProjectConfig | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastFetchAt, setLastFetchAt] = useState<number>(0);

  const load = async (fetchRemote = false) => {
    setLoading(true);
    try {
      const list = await window.devdash.projects.statusAll(fetchRemote);
      setStatuses(list);
      if (fetchRemote) setLastFetchAt(Date.now());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
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
            className="rounded-md border border-dash-line bg-dash-panel px-3 py-1.5 text-xs text-dash-text hover:border-dash-indigo/60 disabled:opacity-50"
          >
            {refreshing ? 'Fetching…' : 'Refresh + git fetch'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-dash-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-dash-indigoBright"
          >
            + Add project
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && statuses.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">Loading projects…</div>
        ) : statuses.length === 0 ? (
          <div className="py-12 text-center text-sm text-dash-mute">
            No projects yet. Click "+ Add project" to register your first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2">
            {statuses.map((s) => (
              <ProjectCard
                key={s.project.id}
                data={s}
                onEdit={() => setEditing(s.project)}
                onRemove={() => handleDelete(s.project.id)}
                onAction={() => void load(false)}
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
    </div>
  );
}

function ProjectCard({
  data,
  onEdit,
  onRemove,
  onAction,
}: {
  data: ProjectStatus;
  onEdit: () => void;
  onRemove: () => void;
  onAction: () => void;
}) {
  const { project, git } = data;
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

  return (
    <div className="card flex flex-col gap-3 p-4 shadow-card transition">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {statusDot}
            <h3 className="truncate text-sm font-semibold text-dash-text">{project.name}</h3>
            {project.deployProvider !== 'none' && (
              <span className="rounded bg-dash-indigo/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-dash-indigoBright">
                {project.deployProvider}
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-dash-mute" title={project.path}>
            {project.path}
          </p>
        </div>
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
          <span className="font-mono">
            {git.devPort ? `:${git.devPort}` : git.devScript ?? '—'}
          </span>
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
          disabled={busy !== null}
          onClick={() => runAction('Run dev', () => window.devdash.projects.runDev(project.id))}
        >
          ▶ Dev
        </ActionBtn>
        <ActionBtn
          disabled={busy !== null || !git.ok}
          onClick={() => runAction('Git pull', () => window.devdash.projects.pull(project.id))}
        >
          ⇣ Pull
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
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-dash-line bg-dash-panel/60 px-2 py-1 text-[11px] text-dash-text hover:border-dash-indigo/60 hover:bg-dash-indigo/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
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
