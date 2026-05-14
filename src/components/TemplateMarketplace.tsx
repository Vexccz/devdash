import { useEffect, useState } from 'react';

export interface MarketplaceEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  stars: number;
  downloads: number;
  githubUrl: string;
  tags: string[];
}

interface Props {
  onUse: (githubUrl: string) => void;
}

export default function TemplateMarketplace({ onUse }: Props) {
  const [entries, setEntries] = useState<MarketplaceEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await window.devdash.scaffold.marketplace();
        setEntries(data);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allTags = Array.from(new Set(entries.flatMap((e) => e.tags))).sort();

  const filtered = entries.filter((e) => {
    const matchesSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.author.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !selectedTag || e.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const formatCount = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
  };

  if (loading) {
    return <p className="px-2 py-3 text-xs text-dash-mute">Loading marketplace...</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-xs text-dash-text placeholder:text-dash-mute"
        />
        <select
          value={selectedTag ?? ''}
          onChange={(e) => setSelectedTag(e.target.value || null)}
          className="rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-xs text-dash-text"
        >
          <option value="">All tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-xs text-dash-mute">No templates found.</p>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-lg border border-dash-line bg-dash-bg p-2.5 hover:border-dash-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-dash-text">{entry.name}</span>
                  <span className="text-[10px] text-dash-mute">by {entry.author}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-dash-mute">{entry.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {entry.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-dash-accent/10 px-1.5 py-0.5 text-[9px] text-dash-accent"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-[10px] text-dash-mute">⭐ {formatCount(entry.stars)}</span>
                  <span className="text-[10px] text-dash-mute">↓ {formatCount(entry.downloads)}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => onUse(entry.githubUrl)}
                  className="btn-soft text-[10px]"
                >
                  Use
                </button>
                <button
                  onClick={() => window.devdash.shell.openExternal(entry.githubUrl)}
                  className="text-[10px] text-dash-mute hover:text-dash-text"
                >
                  GitHub ↗
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
