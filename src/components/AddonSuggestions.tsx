import { useEffect, useState, useMemo } from 'react';

interface Addon {
  id: string;
  name: string;
  description: string;
  category: string;
  packages: { backend?: string[]; frontend?: string[] };
  envVars?: string[];
  difficulty: string;
  estimatedTime: string;
  recommended?: string[];
}

interface Props {
  template: string;
  onAddonsChange: (ids: string[]) => void;
}

const CATEGORIES = ['auth','payments','database','messaging','analytics','security','devops','ui','api','storage','ai','testing','monitoring'];

const CATEGORY_LABELS: Record<string, string> = {
  auth: 'Authentication', payments: 'Payments', database: 'Database',
  messaging: 'Messaging', analytics: 'Analytics', security: 'Security',
  devops: 'DevOps', ui: 'UI Components', api: 'API', storage: 'Storage',
  ai: 'AI / ML', testing: 'Testing', monitoring: 'Monitoring',
};

export default function AddonSuggestions({ template, onAddonsChange }: Props) {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [recommended, setRecommended] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!template) return;
    void (async () => {
      const list = await window.devdash.addons.forTemplate(template);
      setAddons(list);
      const rec = await window.devdash.addons.recommended(template);
      setRecommended(new Set(rec.map(r => r.id)));
    })();
  }, [template]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      onAddonsChange([...next]);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = addons;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.includes(q));
    }
    if (categoryFilter) list = list.filter(a => a.category === categoryFilter);
    return list;
  }, [addons, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, Addon[]> = {};
    for (const a of filtered) {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    }
    return map;
  }, [filtered]);

  const totalTime = useMemo(() => {
    let mins = 0;
    for (const a of addons) {
      if (!selected.has(a.id)) continue;
      const m = a.estimatedTime.match(/(\d+)\s*(hour|min)/);
      if (m) mins += parseInt(m[1]) * (m[2] === 'hour' ? 60 : 1);
    }
    if (mins >= 60) return `${Math.floor(mins/60)}h ${mins%60}m`;
    return `${mins}m`;
  }, [selected, addons]);

  const diffBadge = (d: string) => {
    if (d === 'easy') return <span className="inline-block w-2 h-2 rounded-full bg-green-400" title="Easy" />;
    if (d === 'medium') return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" title="Medium" />;
    return <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Hard" />;
  };

  if (!template || addons.length === 0) return null;

  return (
    <div className="mt-3 border border-dash-line rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-dash-card border-b border-dash-line flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-dash-mute">Add-ons ({selected.size} selected{selected.size > 0 ? ` · ~${totalTime}` : ''})</h4>
      </div>
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search add-ons..."
          className="w-full rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-xs text-dash-text"
        />
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setCategoryFilter(null)} className={`px-2 py-0.5 rounded text-[10px] ${!categoryFilter ? 'bg-dash-indigoBright text-white' : 'bg-dash-bg text-dash-mute border border-dash-line'}`}>All</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c === categoryFilter ? null : c)} className={`px-2 py-0.5 rounded text-[10px] ${categoryFilter === c ? 'bg-dash-indigoBright text-white' : 'bg-dash-bg text-dash-mute border border-dash-line'}`}>{CATEGORY_LABELS[c]}</button>
          ))}
        </div>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="border border-dash-line rounded-md overflow-hidden">
            <button onClick={() => toggleCategory(cat)} className="w-full px-2 py-1.5 flex items-center justify-between bg-dash-bg text-xs font-medium text-dash-text hover:bg-dash-card">
              <span>{CATEGORY_LABELS[cat] || cat} ({items.length})</span>
              <span className="text-dash-mute">{collapsed.has(cat) ? '+' : '-'}</span>
            </button>
            {!collapsed.has(cat) && (
              <div className="divide-y divide-dash-line">
                {items.map(a => (
                  <label key={a.id} className="flex items-start gap-2 px-2 py-1.5 hover:bg-dash-bg/50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {diffBadge(a.difficulty)}
                        <span className="text-xs text-dash-text font-medium truncate">{a.name}</span>
                        {recommended.has(a.id) && <span className="px-1 py-0 rounded text-[9px] bg-dash-ok/20 text-dash-ok">Recommended</span>}
                        <span className="text-[10px] text-dash-mute ml-auto flex-shrink-0">{a.estimatedTime}</span>
                      </div>
                      <p className="text-[10px] text-dash-mute truncate">{a.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
