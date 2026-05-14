import { useState } from 'react';

interface Props {
  templates: Array<{ id: string; label: string; description: string }>;
  onClose: () => void;
}

interface CompareResult {
  templateA: { id: string; files: string[]; fileCount: number; lineCount: number };
  templateB: { id: string; files: string[]; fileCount: number; lineCount: number };
  onlyInA: string[];
  onlyInB: string[];
  common: string[];
}

export default function TemplateCompare({ templates, onClose }: Props) {
  const [idA, setIdA] = useState(templates[0]?.id || '');
  const [idB, setIdB] = useState(templates[1]?.id || '');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const compare = async () => {
    if (!idA || !idB) return;
    if (idA === idB) { setError('Pick two different templates.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    const res = await window.devdash.scaffold.compareTemplates(idA, idB);
    if ('error' in res) {
      setError(res.error);
    } else {
      setResult(res as CompareResult);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl border border-dash-line bg-dash-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-dash-line px-4 py-3">
          <h3 className="text-sm font-semibold text-dash-text">Compare Templates</h3>
          <button onClick={onClose} className="text-dash-mute hover:text-dash-text text-lg leading-none">&times;</button>
        </div>

        <div className="p-4">
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-dash-mute">Template A</label>
              <select
                value={idA}
                onChange={(e) => setIdA(e.target.value)}
                className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <span className="text-dash-mute text-xs pb-1.5">vs</span>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-dash-mute">Template B</label>
              <select
                value={idB}
                onChange={(e) => setIdB(e.target.value)}
                className="mt-1 w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-xs text-dash-text"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <button onClick={compare} disabled={loading} className="btn-primary text-xs px-3 py-1.5">
              {loading ? 'Comparing...' : 'Compare'}
            </button>
          </div>

          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

          {result && (
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg border border-dash-line bg-dash-bg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-dash-mute mb-1">
                    {templates.find((t) => t.id === result.templateA.id)?.label || result.templateA.id}
                  </p>
                  <p className="text-xs text-dash-text">{result.templateA.fileCount} files · {result.templateA.lineCount.toLocaleString()} lines</p>
                </div>
                <div className="rounded-lg border border-dash-line bg-dash-bg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-dash-mute mb-1">
                    {templates.find((t) => t.id === result.templateB.id)?.label || result.templateB.id}
                  </p>
                  <p className="text-xs text-dash-text">{result.templateB.fileCount} files · {result.templateB.lineCount.toLocaleString()} lines</p>
                </div>
              </div>

              {/* Diff sections */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-red-400 mb-1">
                    Only in A ({result.onlyInA.length})
                  </h4>
                  <div className="rounded-lg border border-dash-line bg-dash-bg p-2 max-h-48 overflow-y-auto">
                    {result.onlyInA.length === 0 ? (
                      <p className="text-[10px] text-dash-mute">None</p>
                    ) : (
                      result.onlyInA.map((f, i) => (
                        <div key={i} className="text-[10px] font-mono text-red-400 truncate">{f}</div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-dash-ok mb-1">
                    Common ({result.common.length})
                  </h4>
                  <div className="rounded-lg border border-dash-line bg-dash-bg p-2 max-h-48 overflow-y-auto">
                    {result.common.length === 0 ? (
                      <p className="text-[10px] text-dash-mute">None</p>
                    ) : (
                      result.common.map((f, i) => (
                        <div key={i} className="text-[10px] font-mono text-dash-text truncate">{f}</div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-blue-400 mb-1">
                    Only in B ({result.onlyInB.length})
                  </h4>
                  <div className="rounded-lg border border-dash-line bg-dash-bg p-2 max-h-48 overflow-y-auto">
                    {result.onlyInB.length === 0 ? (
                      <p className="text-[10px] text-dash-mute">None</p>
                    ) : (
                      result.onlyInB.map((f, i) => (
                        <div key={i} className="text-[10px] font-mono text-blue-400 truncate">{f}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
