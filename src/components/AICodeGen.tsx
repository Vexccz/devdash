import { useEffect, useRef, useState } from 'react';

interface FileOperation {
  action: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
}

interface HistoryEntry {
  id: string;
  projectPath: string;
  prompt: string;
  operations: FileOperation[];
  appliedAt?: string;
  createdAt: string;
}

export default function AICodeGen() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<FileOperation[] | null>(null);
  const [logs, setLogs] = useState<Array<{ stream: string; line: string; ts: number }>>([]);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const logsEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      const list = await window.devdash.projects.list();
      setProjects(list);
      if (list[0]) setSelectedProject(list[0].path);
    })();
    const off = window.devdash.aigen.onLog((e: any) => {
      setLogs((cur) => [...cur.slice(-299), e]);
    });
    return off;
  }, []);

  useEffect(() => {
    logsEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs.length]);

  const loadHistory = async () => {
    const h = await window.devdash.aigen.history();
    setHistory(h as unknown as HistoryEntry[]);
  };

  const handlePreview = async () => {
    if (!prompt.trim() || !selectedProject) return;
    setBusy(true);
    setError('');
    setPreview(null);
    setLogs([]);
    const res = await window.devdash.aigen.preview({ projectPath: selectedProject, prompt });
    setBusy(false);
    if (res.ok) {
      setPreview(res.operations as unknown as FileOperation[]);
    } else {
      setError(res.error || 'Preview failed');
    }
  };

  const handleApply = async () => {
    if (!prompt.trim() || !selectedProject) return;
    setBusy(true);
    setError('');
    setPreview(null);
    setLogs([]);
    const res = await window.devdash.aigen.run({ projectPath: selectedProject, prompt });
    setBusy(false);
    if (res.ok) {
      setPreview(res.operations as unknown as FileOperation[]);
      void loadHistory();
    } else {
      setError(res.error || 'Generation failed');
    }
  };

  const actionColor = (action: string) => {
    if (action === 'create') return 'text-green-400';
    if (action === 'modify') return 'text-yellow-400';
    if (action === 'delete') return 'text-red-400';
    return 'text-dash-mute';
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dash-text">AI Code Generator</h2>
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) void loadHistory(); }}
          className="rounded border border-dash-line px-2 py-1 text-xs text-dash-mute hover:text-dash-text"
        >
          {showHistory ? 'Hide History' : 'History'}
        </button>
      </div>

      {showHistory && (
        <div className="max-h-48 overflow-y-auto rounded border border-dash-line bg-dash-panel/40 p-3">
          {history.length === 0 && <p className="text-xs text-dash-mute">No history yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="mb-2 border-b border-dash-line pb-2 last:border-0 last:pb-0">
              <p className="text-xs text-dash-text">{h.prompt}</p>
              <p className="text-[10px] text-dash-mute">
                {h.operations.length} ops · {h.appliedAt ? 'Applied' : 'Preview only'} · {new Date(h.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Project selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-dash-mute">Project</label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text outline-none focus:border-dash-indigo"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.path}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Prompt */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-dash-mute">Feature description</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Add Google OAuth login with session management..."
          rows={4}
          className="resize-none rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text placeholder:text-dash-mute/50 outline-none focus:border-dash-indigo"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={busy || !prompt.trim() || !selectedProject}
          className="rounded bg-dash-panel border border-dash-line px-4 py-2 text-xs text-dash-text hover:bg-white/5 disabled:opacity-40"
        >
          {busy ? 'Thinking...' : 'Preview (Dry Run)'}
        </button>
        <button
          onClick={handleApply}
          disabled={busy || !prompt.trim() || !selectedProject}
          className="rounded bg-dash-indigo/20 border border-dash-indigo/40 px-4 py-2 text-xs text-dash-indigoBright hover:bg-dash-indigo/30 disabled:opacity-40"
        >
          {busy ? 'Generating...' : 'Apply Changes'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Preview / Results */}
      {preview && preview.length > 0 && (
        <div className="rounded border border-dash-line bg-dash-panel/40 p-3">
          <p className="mb-2 text-xs font-medium text-dash-text">{preview.length} file operation(s):</p>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {preview.map((op, i) => (
              <details key={i} className="group">
                <summary className="cursor-pointer text-xs flex items-center gap-2 py-1 hover:bg-white/5 rounded px-1">
                  <span className={`font-mono uppercase text-[10px] ${actionColor(op.action)}`}>{op.action}</span>
                  <span className="text-dash-text font-mono">{op.path}</span>
                </summary>
                {op.content && (
                  <pre className="mt-1 ml-4 max-h-40 overflow-auto rounded bg-black/30 p-2 text-[10px] text-dash-mute whitespace-pre-wrap">
                    {op.content.slice(0, 2000)}{op.content.length > 2000 ? '\n...(truncated)' : ''}
                  </pre>
                )}
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="rounded border border-dash-line bg-black/30 p-2 max-h-40 overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className={`text-[10px] font-mono ${l.stream === 'stderr' ? 'text-red-400' : l.stream === 'system' ? 'text-dash-mute' : 'text-green-400'}`}>
              {l.line}
            </div>
          ))}
          <div ref={logsEnd} />
        </div>
      )}
    </div>
  );
}
