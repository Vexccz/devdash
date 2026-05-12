import { useEffect, useState } from 'react';

interface Props {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export default function DiffViewerModal({ projectId, projectName, onClose }: Props) {
  const [mode, setMode] = useState<'unstaged' | 'staged'>('unstaged');
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    setError('');
    window.devdash.projects
      .gitDiff(projectId, mode === 'staged')
      .then((res) => {
        if (res.ok) {
          setDiff(res.diff || '');
        } else {
          setError(res.error || 'Diff failed');
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, mode]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-lg border border-dash-line bg-dash-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-dash-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-dash-text">Diff viewer</h2>
            <p className="text-[10px] text-dash-mute">{projectName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-dash-line">
              <button
                onClick={() => setMode('unstaged')}
                className={`px-3 py-1 text-[11px] ${
                  mode === 'unstaged'
                    ? 'bg-dash-indigo/20 text-dash-indigoBright'
                    : 'text-dash-mute hover:text-dash-text'
                }`}
              >
                Unstaged
              </button>
              <button
                onClick={() => setMode('staged')}
                className={`px-3 py-1 text-[11px] ${
                  mode === 'staged'
                    ? 'bg-dash-indigo/20 text-dash-indigoBright'
                    : 'text-dash-mute hover:text-dash-text'
                }`}
              >
                Staged
              </button>
            </div>
            <button onClick={onClose} className="rounded p-1 text-dash-mute hover:bg-white/5 hover:text-dash-text">
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-dash-mute">Loading diff...</div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-red-400">{error}</div>
          ) : (
            <pre className="m-0 overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
              {diff.split('\n').map((line, i) => {
                let cls = 'text-dash-text';
                if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-emerald-400 bg-emerald-500/5';
                else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400 bg-red-500/5';
                else if (line.startsWith('@@')) cls = 'text-dash-indigoBright';
                else if (line.startsWith('diff ') || line.startsWith('+++') || line.startsWith('---') || line.startsWith('index ')) cls = 'text-dash-mute font-semibold';
                return (
                  <div key={i} className={cls}>
                    {line || ' '}
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
