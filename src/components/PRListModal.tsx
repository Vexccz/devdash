import { useEffect, useState } from 'react';

interface PR {
  number: number;
  title: string;
  author: { login: string };
  state: string;
  isDraft: boolean;
  mergeable: string;
  url: string;
  headRefName: string;
  updatedAt: string;
}

interface Props {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export default function PRListModal({ projectId, projectName, onClose }: Props) {
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    window.devdash.projects
      .prList(projectId)
      .then((res) => {
        if (res.ok && res.prs) setPrs(res.prs);
        else setError(res.error || 'Failed to load PRs');
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-dash-line bg-dash-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-dash-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-dash-text">Pull requests</h2>
            <p className="text-[10px] text-dash-mute">{projectName} · {prs.length} open</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-dash-mute hover:bg-white/5 hover:text-dash-text">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="p-6 text-center text-sm text-dash-mute">Loading...</div>
          ) : error ? (
            <div className="p-4 rounded-md border border-red-500/30 bg-red-500/10 text-[11px] text-red-400">
              {error}
              <div className="mt-2 text-dash-mute">Ensure the `gh` CLI is installed and authenticated: <code className="rounded bg-dash-bg px-1">gh auth login</code></div>
            </div>
          ) : prs.length === 0 ? (
            <div className="p-6 text-center text-sm text-dash-mute">No open pull requests</div>
          ) : (
            <div className="flex flex-col gap-2">
              {prs.map((pr) => (
                <button
                  key={pr.number}
                  onClick={() => window.devdash.shell.openExternal(pr.url)}
                  className="flex flex-col items-start rounded-md border border-dash-line bg-dash-bg/40 p-3 text-left hover:border-dash-indigo/60 hover:bg-dash-indigo/5"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="font-mono text-[10px] text-dash-mute">#{pr.number}</span>
                    <span className="flex-1 truncate text-xs font-medium text-dash-text">{pr.title}</span>
                    {pr.isDraft && (
                      <span className="rounded bg-dash-mute/20 px-1.5 py-0.5 text-[9px] uppercase text-dash-mute">Draft</span>
                    )}
                    {pr.mergeable === 'MERGEABLE' && !pr.isDraft && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] uppercase text-emerald-400">Ready</span>
                    )}
                    {pr.mergeable === 'CONFLICTING' && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] uppercase text-red-400">Conflict</span>
                    )}
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-dash-mute">
                    <span>@{pr.author.login}</span>
                    <span className="font-mono">{pr.headRefName}</span>
                    <span>{formatRelative(pr.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelative(isoTime: string): string {
  const diff = Date.now() - new Date(isoTime).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
