import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface ScaffoldHistoryEntry {
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

function historyPath(): string {
  return path.join(app.getPath('userData'), 'scaffoldhistory.json');
}

function readHistory(): ScaffoldHistoryEntry[] {
  const p = historyPath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw) as ScaffoldHistoryEntry[];
  } catch {
    return [];
  }
}

function writeHistory(entries: ScaffoldHistoryEntry[]): void {
  const p = historyPath();
  fs.writeFileSync(p, JSON.stringify(entries, null, 2), 'utf-8');
}

export function addHistoryEntry(entry: Omit<ScaffoldHistoryEntry, 'id'>): ScaffoldHistoryEntry {
  const entries = readHistory();
  const full: ScaffoldHistoryEntry = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  };
  entries.unshift(full);
  // Keep max 200 entries
  if (entries.length > 200) entries.length = 200;
  writeHistory(entries);
  return full;
}

export function getHistory(): ScaffoldHistoryEntry[] {
  return readHistory();
}

export function clearHistory(): void {
  writeHistory([]);
}
