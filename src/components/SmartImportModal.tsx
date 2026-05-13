import { useState } from 'react';
import type { ProjectInspection } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function SmartImportModal({ open, onClose, onImported }: Props) {
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parent, setParent] = useState<string | null>(null);
  const [results, setResults] = useState<ProjectInspection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await window.devdash.projects.scanParent();
      if (!res.parent) {
        setScanning(false);
        return;
      }
      setParent(res.parent);
      setResults(res.projects);
      // Default: select all that have a github remote OR a deploy match
      const defaultSel = new Set<string>();
      for (const r of res.projects) {
        if (r.githubUrl || r.deployId) defaultSel.add(r.path);
      }
      setSelected(defaultSel);
    } catch (err: any) {
      setError(err?.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const toggle = (path: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const importSelected = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const picks = results.filter((r) => selected.has(r.path));
      const payload = picks.map((r) => ({
        name: r.name,
        path: r.path,
        githubUrl: r.githubUrl,
        liveUrl: r.liveUrl,
        deployProvider: (r.deployProvider || 'none') as any,
        deployId: r.deployId,
      }));
      const res = await window.devdash.projects.importMany(payload);
      alert(`Imported ${res.added} of ${res.total} projects.`);
      onImported();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-dash-line bg-dash-panel">
        <header className="flex items-center justify-between border-b border-dash-line px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Smart import</h3>
            <p className="text-[11px] text-dash-mute">
              Pick a parent folder. DevDash scans each repo for git remote, framework, and matching
              Vercel/Render project.
            </p>
          </div>
          <button onClick={onClose} className="text-dash-mute hover:text-dash-text">
            ×
          </button>
        </header>

        <div className="border-b border-dash-line px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={scan}
              disabled={scanning}
              className="rounded-md bg-dash-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-dash-indigoBright disabled:opacity-50"
            >
              {scanning ? 'Scanning...' : parent ? 'Pick another folder' : 'Pick parent folder'}
            </button>
            {parent && (
              <span className="truncate font-mono text-[11px] text-dash-mute">{parent}</span>
            )}
          </div>
          {error && (
            <p className="mt-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {results.length === 0 && !scanning && (
            <div className="flex h-32 items-center justify-center text-sm text-dash-mute">
              Pick a parent folder to begin. Example: <code className="ml-1">C:\Users\zafra</code>
            </div>
          )}
          {results.length > 0 && (
            <div className="space-y-1">
              <div className="mb-2 flex items-center justify-between text-[11px] text-dash-mute">
                <span>
                  Found {results.length} projects. {selected.size} selected.
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelected(new Set(results.map((r) => r.path)))}
                    className="hover:text-dash-text"
                  >
                    Select all
                  </button>
                  <button onClick={() => setSelected(new Set())} className="hover:text-dash-text">
                    Clear
                  </button>
                </div>
              </div>
              {results.map((r) => {
                const isSel = selected.has(r.path);
                return (
                  <label
                    key={r.path}
                    className={`flex cursor-pointer gap-3 rounded border p-2 text-xs ${
                      isSel ? 'border-dash-indigo/60 bg-dash-indigo/10' : 'border-dash-line'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(r.path)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-dash-text">{r.name}</span>
                        {r.framework && (
                          <span className="rounded bg-dash-panel2 px-1.5 py-0.5 text-[10px] text-dash-mute">
                            {r.framework}
                          </span>
                        )}
                        {r.deployMatchedBy === 'vercel-api' && (
                          <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-white">
                            Vercel
                          </span>
                        )}
                        {r.deployMatchedBy === 'render-api' && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            Render
                          </span>
                        )}
                        {r.envHints?.missingKeys ? (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                            {r.envHints.missingKeys} env missing
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate font-mono text-[10px] text-dash-mute">{r.path}</div>
                      {r.githubUrl && (
                        <div className="truncate text-[10px] text-dash-mute">{r.githubUrl}</div>
                      )}
                      {r.liveUrl && (
                        <div className="truncate text-[10px] text-emerald-400">{r.liveUrl}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-dash-line px-4 py-3">
          <span className="text-[11px] text-dash-mute">
            Existing projects (by path) are skipped automatically.
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-dash-line px-3 py-1 text-xs hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={importSelected}
              disabled={selected.size === 0 || importing}
              className="rounded bg-dash-indigo px-3 py-1 text-xs text-white hover:bg-dash-indigoBright disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${selected.size}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
