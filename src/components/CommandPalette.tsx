import { useEffect, useMemo, useState } from 'react';
import type { ProjectConfig } from '../types';

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<unknown>;
  score?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projects: ProjectConfig[];
  onOpenProject: (id: string, tab?: 'overview' | 'logs' | 'env' | 'time' | 'deps' | 'heatmap' | 'screenshots' | 'release') => void;
  onSwitchTab: (tab: 'projects' | 'deploys' | 'uptime' | 'time' | 'deps' | 'settings') => void;
}

function fuzzy(query: string, candidate: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (c.includes(q)) return 10 + (q.length / c.length);
  // sequential char match
  let i = 0;
  let matches = 0;
  for (const ch of c) {
    if (ch === q[i]) {
      matches++;
      i++;
      if (i >= q.length) break;
    }
  }
  if (matches === q.length) return 1 + matches / c.length;
  return 0;
}

export default function CommandPalette({ open, onClose, projects, onOpenProject, onSwitchTab }: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
  }, [open]);

  const actions: PaletteAction[] = useMemo(() => {
    const acts: PaletteAction[] = [];
    // Global
    acts.push({
      id: 'go:projects',
      label: 'Go: Projects',
      hint: 'Tab',
      run: () => onSwitchTab('projects'),
    });
    acts.push({ id: 'go:deploys', label: 'Go: Deploys', hint: 'Tab', run: () => onSwitchTab('deploys') });
    acts.push({ id: 'go:uptime', label: 'Go: Uptime', hint: 'Tab', run: () => onSwitchTab('uptime') });
    acts.push({ id: 'go:time', label: 'Go: Time', hint: 'Tab', run: () => onSwitchTab('time') });
    acts.push({ id: 'go:deps', label: 'Go: Deps', hint: 'Tab', run: () => onSwitchTab('deps') });
    acts.push({ id: 'go:settings', label: 'Go: Settings', hint: 'Tab', run: () => onSwitchTab('settings') });

    for (const p of projects) {
      acts.push({
        id: `open:${p.id}`,
        label: `${p.name}: Open detail`,
        run: () => onOpenProject(p.id, 'overview'),
      });
      acts.push({
        id: `dev:${p.id}`,
        label: `${p.name}: Run dev server (managed)`,
        run: async () => {
          await window.devdash.devserver.start(p.id);
          onOpenProject(p.id, 'logs');
        },
      });
      acts.push({
        id: `logs:${p.id}`,
        label: `${p.name}: Open logs`,
        run: () => onOpenProject(p.id, 'logs'),
      });
      acts.push({
        id: `env:${p.id}`,
        label: `${p.name}: Open env`,
        run: () => onOpenProject(p.id, 'env'),
      });
      acts.push({
        id: `folder:${p.id}`,
        label: `${p.name}: Open folder`,
        run: () => window.devdash.projects.openFolder(p.path),
      });
      acts.push({
        id: `vscode:${p.id}`,
        label: `${p.name}: Open in VS Code`,
        run: () => window.devdash.projects.openInVSCode(p.path),
      });
      if (p.githubUrl) {
        acts.push({
          id: `gh:${p.id}`,
          label: `${p.name}: Open GitHub`,
          run: () => window.devdash.shell.openExternal(p.githubUrl!),
        });
      }
      if (p.liveUrl) {
        acts.push({
          id: `live:${p.id}`,
          label: `${p.name}: Open live URL`,
          run: () => window.devdash.shell.openExternal(p.liveUrl!),
        });
      }
      acts.push({
        id: `pull:${p.id}`,
        label: `${p.name}: Git pull`,
        run: async () => {
          await window.devdash.projects.pull(p.id);
        },
      });
      acts.push({
        id: `release:${p.id}`,
        label: `${p.name}: Release`,
        run: () => onOpenProject(p.id, 'release'),
      });
      acts.push({
        id: `deps:${p.id}`,
        label: `${p.name}: Run deps check`,
        run: async () => {
          await window.devdash.deps.runNow(p.id);
          onOpenProject(p.id, 'deps');
        },
      });
      acts.push({
        id: `heatmap:${p.id}`,
        label: `${p.name}: Commit heatmap`,
        run: () => onOpenProject(p.id, 'heatmap'),
      });
    }
    return acts;
  }, [projects, onOpenProject, onSwitchTab]);

  const results = useMemo(() => {
    const scored = actions.map((a) => ({ a, score: fuzzy(query.trim(), a.label) }));
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((s) => s.a);
  }, [actions, query]);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    if (!open) return;
    const h = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = results[index];
        if (pick) {
          onClose();
          await pick.run();
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, results, index, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 pt-24 backdrop-blur-sm">
      <div className="w-[520px] overflow-hidden rounded-lg border border-dash-line bg-dash-panel shadow-glow">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type project + action, e.g. 'scoreku dev'"
          className="w-full border-b border-dash-line bg-transparent px-4 py-3 text-sm text-dash-text placeholder-dash-mute focus:outline-none"
        />
        <ul className="max-h-[360px] overflow-y-auto">
          {results.length === 0 && (
            <li className="px-4 py-3 text-xs text-dash-mute">No actions match.</li>
          )}
          {results.map((r, i) => (
            <li
              key={r.id}
              onMouseEnter={() => setIndex(i)}
              onClick={async () => {
                onClose();
                await r.run();
              }}
              className={`cursor-pointer px-4 py-2 text-sm ${
                i === index
                  ? 'bg-dash-indigo/20 text-dash-indigoBright'
                  : 'text-dash-text hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{r.label}</span>
                {r.hint && (
                  <span className="text-[10px] uppercase tracking-wider text-dash-mute">
                    {r.hint}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-dash-line px-4 py-2 text-[10px] text-dash-mute">
          ↑/↓ navigate · Enter run · Esc close
        </div>
      </div>
    </div>
  );
}
