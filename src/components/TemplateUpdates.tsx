import { useEffect, useState } from 'react';

interface UpdateInfo {
  projectId: string;
  projectName: string;
  templateId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  changes: string[];
}

interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  content?: string;
}

export default function TemplateUpdates() {
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [diffProject, setDiffProject] = useState<string | null>(null);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<{ projectId: string; ok: boolean; applied?: number; error?: string } | null>(null);

  const loadUpdates = async () => {
    setLoading(true);
    const res = await window.devdash.template.checkUpdates();
    setUpdates(res);
    setLoading(false);
  };

  useEffect(() => {
    void loadUpdates();
  }, []);

  const viewDiff = async (projectId: string) => {
    setDiffProject(projectId);
    setDiffLoading(true);
    setDiffFiles([]);
    const res = await window.devdash.template.viewDiff(projectId);
    if ('error' in res) {
      setDiffFiles([]);
    } else {
      setDiffFiles(res.files as unknown as DiffFile[]);
    }
    setDiffLoading(false);
  };

  const applyUpdate = async (projectId: string) => {
    setApplyResult(null);
    const res = await window.devdash.template.applyUpdate(projectId);
    setApplyResult({ projectId, ...res });
    void loadUpdates();
  };

  const statusColor = (status: string) => {
    if (status === 'added') return 'text-green-400';
    if (status === 'modified') return 'text-yellow-400';
    if (status === 'deleted') return 'text-red-400';
    return 'text-dash-mute';
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dash-text">Template Updates</h2>
        <button
          onClick={loadUpdates}
          disabled={loading}
          className="rounded border border-dash-line px-2 py-1 text-xs text-dash-mute hover:text-dash-text disabled:opacity-40"
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {!loading && updates.length === 0 && (
        <div className="rounded border border-dash-line bg-dash-panel/40 p-4 text-center">
          <p className="text-xs text-dash-mute">No projects with template tracking found.</p>
          <p className="text-[10px] text-dash-mute mt-1">Projects scaffolded with DevDash will automatically track their template version.</p>
        </div>
      )}

      {updates.map((u) => (
        <div key={u.projectId} className="rounded border border-dash-line bg-dash-panel/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-medium text-dash-text">{u.projectName}</p>
              <p className="text-[10px] text-dash-mute">
                Template: {u.templateId} · v{u.currentVersion}
                {u.hasUpdate && <span className="text-yellow-400 ml-1">→ v{u.latestVersion}</span>}
              </p>
            </div>
            {u.hasUpdate ? (
              <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] text-yellow-400">Update available</span>
            ) : (
              <span className="rounded-full bg-green-400/10 px-2 py-0.5 text-[10px] text-green-400">Up to date</span>
            )}
          </div>

          {u.hasUpdate && u.changes.length > 0 && (
            <div className="mb-2 text-[10px] text-dash-mute">
              {u.changes.slice(0, 5).map((c, i) => (
                <p key={i}>• {c}</p>
              ))}
              {u.changes.length > 5 && <p>...and {u.changes.length - 5} more</p>}
            </div>
          )}

          {u.hasUpdate && (
            <div className="flex gap-2">
              <button
                onClick={() => viewDiff(u.projectId)}
                className="rounded border border-dash-line px-2 py-1 text-xs text-dash-mute hover:text-dash-text"
              >
                View Diff
              </button>
              <button
                onClick={() => applyUpdate(u.projectId)}
                className="rounded bg-dash-indigo/20 border border-dash-indigo/40 px-2 py-1 text-xs text-dash-indigoBright hover:bg-dash-indigo/30"
              >
                Apply Update
              </button>
            </div>
          )}

          {applyResult && applyResult.projectId === u.projectId && (
            <div className={`mt-2 rounded p-2 text-xs ${applyResult.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {applyResult.ok ? `Applied ${applyResult.applied} file(s). Check for conflict markers.` : applyResult.error}
            </div>
          )}
        </div>
      ))}

      {/* Diff modal */}
      {diffProject && (
        <div className="rounded border border-dash-line bg-dash-panel/60 p-3 mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-dash-text">Template Diff</p>
            <button onClick={() => setDiffProject(null)} className="text-xs text-dash-mute hover:text-dash-text">Close</button>
          </div>
          {diffLoading && <p className="text-xs text-dash-mute">Loading diff...</p>}
          {!diffLoading && diffFiles.length === 0 && <p className="text-xs text-dash-mute">No differences found.</p>}
          {!diffLoading && diffFiles.length > 0 && (
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {diffFiles.map((f, i) => (
                <details key={i} className="group">
                  <summary className="cursor-pointer text-xs flex items-center gap-2 py-1 hover:bg-white/5 rounded px-1">
                    <span className={`font-mono uppercase text-[10px] ${statusColor(f.status)}`}>{f.status}</span>
                    <span className="text-dash-text font-mono">{f.path}</span>
                  </summary>
                  {f.content && (
                    <pre className="mt-1 ml-4 max-h-32 overflow-auto rounded bg-black/30 p-2 text-[10px] text-dash-mute whitespace-pre-wrap">
                      {f.content}
                    </pre>
                  )}
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
