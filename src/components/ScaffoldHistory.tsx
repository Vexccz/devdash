import { useEffect, useState } from 'react';

interface HistoryEntry {
  id: string;
  date: string;
  template: string;
  projectName: string;
  targetDir: string;
  deployStatus: 'none' | 'vercel' | 'render' | 'both';
  durationMs: number;
  options: {
    useStripe: boolean;
    install: boolean;
    gitInit: boolean;
    gitHubPush: boolean;
    uiKit?: string;
    envPreset?: string;
    structure?: string;
    postHooks?: string[];
    autoOpenVSCode?: boolean;
  };
}

interface Props {
  onReScaffold: (entry: HistoryEntry) => void;
}

export default function ScaffoldHistory({ onReScaffold }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    void loadHistory();
  }, []);

  const loadHistory = async () => {
    const data = await window.devdash.scaffold.history();
    setEntries(data || []);
  };

  const clearHistory = async () => {
    await window.devdash.scaffold.clearHistory();
    setEntries([]);
  };

  const uniqueTemplates = [...new Set(entries.map((e) => e.template))];

  const filtered = entries
    .filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        if (!e.projectName.toLowerCase().includes(q) && !e.template.toLowerCase().includes(q) && !e.targetDir.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterTemplate && e.template !== filterTemplate) return false;
      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortDesc ? db - da : da - db;
    });

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-dash-mute">Scaffold History</h3>
        {entries.length > 0 && (
          <button onClick={clearHistory} className="text-[10px] text-red-400 hover:text-red-300">
            Clear all
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-dash-mute">No scaffold history yet. Generate a project to see it here.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history..."
              className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-xs text-dash-text"
            />
            <select
              value={filterTemplate}
              onChange={(e) => setFilterTemplate(e.target.value)}
              className="rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-xs text-dash-text"
            >
              <option value="">All templates</option>
              {uniqueTemplates.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => setSortDesc(!sortDesc)}
              className="btn-soft text-[10px]"
              title={sortDesc ? 'Newest first' : 'Oldest first'}
            >
              {sortDesc ? '↓ New' : '↑ Old'}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-dash-line bg-dash-bg px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-dash-text truncate">{entry.projectName}</span>
                    <span className="text-[10px] text-dash-mute">{entry.template}</span>
                    {entry.deployStatus !== 'none' && (
                      <span className="text-[10px] text-dash-ok">● {entry.deployStatus}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-dash-mute">
                      {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-dash-mute">· {formatDuration(entry.durationMs)}</span>
                    <span className="text-[10px] text-dash-mute font-mono truncate max-w-[200px]">{entry.targetDir}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 ml-2">
                  <button
                    onClick={() => window.devdash.projects.openFolder(entry.targetDir)}
                    className="btn-soft text-[10px]"
                    title="Open folder"
                  >
                    📂
                  </button>
                  <button
                    onClick={() => onReScaffold(entry)}
                    className="btn-soft text-[10px]"
                    title="Re-scaffold with same options"
                  >
                    ↻
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-dash-mute">{filtered.length} of {entries.length} entries</p>
        </>
      )}
    </div>
  );
}
