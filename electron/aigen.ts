import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { loadConfig } from './config';
import { chat as aiChat, AIMessage } from './aiprovider';

export interface FileOperation {
  action: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
}

export interface AiGenOptions {
  projectPath: string;
  prompt: string;
  dryRun?: boolean;
}

export interface AiGenResult {
  ok: boolean;
  operations: FileOperation[];
  error?: string;
}

export interface AiGenHistoryEntry {
  id: string;
  projectPath: string;
  prompt: string;
  operations: FileOperation[];
  appliedAt?: string;
  createdAt: string;
}

type LogEvent = { stream: 'stdout' | 'stderr' | 'system'; line: string; ts: number };

const emitter = new EventEmitter();
let historyStore: AiGenHistoryEntry[] = [];

export function bindBroadcast(window: () => BrowserWindow | null): void {
  emitter.on('log', (e: LogEvent) => {
    const w = window();
    if (!w || w.isDestroyed()) return;
    w.webContents.send('aigen:log', e);
  });
}

function emit(stream: LogEvent['stream'], line: string) {
  emitter.emit('log', { stream, line, ts: Date.now() } as LogEvent);
}

function buildFileTree(dir: string, prefix = '', depth = 3): string[] {
  if (depth <= 0) return [];
  const lines: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv']);
  const filtered = entries.filter((e) => !skip.has(e.name)).slice(0, 60);
  for (const entry of filtered) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      lines.push(`${rel}/`);
      lines.push(...buildFileTree(path.join(dir, entry.name), rel, depth - 1));
    } else {
      lines.push(rel);
    }
  }
  return lines;
}

function readKeyFiles(projectPath: string): string {
  const keyFiles = ['package.json', 'tsconfig.json', '.env.example', 'README.md'];
  const parts: string[] = [];
  for (const f of keyFiles) {
    const fp = path.join(projectPath, f);
    if (fs.existsSync(fp)) {
      try {
        const content = fs.readFileSync(fp, 'utf-8').slice(0, 3000);
        parts.push(`--- ${f} ---\n${content}`);
      } catch { /* skip */ }
    }
  }
  return parts.join('\n\n');
}

function parseOperations(raw: string): FileOperation[] {
  // Try to extract JSON array from the response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (op: any) =>
        op &&
        typeof op.action === 'string' &&
        ['create', 'modify', 'delete'].includes(op.action) &&
        typeof op.path === 'string'
    );
  } catch {
    return [];
  }
}

export async function runAiGen(opts: AiGenOptions): Promise<AiGenResult> {
  const { projectPath, prompt, dryRun } = opts;
  const cfg = loadConfig();

  if (!fs.existsSync(projectPath)) {
    return { ok: false, operations: [], error: 'Project path does not exist.' };
  }

  emit('system', `Scanning project structure: ${projectPath}`);
  const tree = buildFileTree(projectPath);
  const keyContent = readKeyFiles(projectPath);

  const systemPrompt = `You are a code generator. Given a project structure and a feature request, output a JSON array of file operations: [{action: 'create'|'modify'|'delete', path: string, content?: string}]. Paths are relative to the project root. For 'modify', provide the full new file content. Only output the JSON array, no other text.`;

  const userMessage = `Project structure:\n${tree.join('\n')}\n\nKey files:\n${keyContent}\n\nFeature request: ${prompt}`;

  emit('system', `Sending request to AI provider...`);

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    const result = await aiChat(messages, { temperature: cfg.settings.ollamaTemperature ?? 0.7 });

    if (!result.ok) {
      return { ok: false, operations: [], error: result.error || 'AI request failed' };
    }

    const responseText = result.content;

    emit('system', 'Parsing AI response...');
    const operations = parseOperations(responseText);

    if (operations.length === 0) {
      emit('stderr', 'AI returned no valid operations. Raw response logged.');
      return { ok: false, operations: [], error: 'AI did not return valid file operations. Try rephrasing your prompt.' };
    }

    emit('system', `Got ${operations.length} file operation(s).`);

    if (!dryRun) {
      emit('system', 'Applying changes...');
      applyOperations(projectPath, operations);
      emit('system', 'All changes applied.');

      // Save to history
      const entry: AiGenHistoryEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        projectPath,
        prompt,
        operations,
        appliedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      historyStore.unshift(entry);
      if (historyStore.length > 50) historyStore = historyStore.slice(0, 50);
    } else {
      emit('system', 'Dry run complete — no changes applied.');
      const entry: AiGenHistoryEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        projectPath,
        prompt,
        operations,
        createdAt: new Date().toISOString(),
      };
      historyStore.unshift(entry);
      if (historyStore.length > 50) historyStore = historyStore.slice(0, 50);
    }

    return { ok: true, operations };
  } catch (err: any) {
    return { ok: false, operations: [], error: err?.message || 'Network error connecting to AI.' };
  }
}

function applyOperations(projectPath: string, operations: FileOperation[]) {
  for (const op of operations) {
    const fullPath = path.resolve(projectPath, op.path);
    // Safety: ensure path is within project
    if (!fullPath.startsWith(path.resolve(projectPath))) {
      emit('stderr', `Skipping unsafe path: ${op.path}`);
      continue;
    }

    if (op.action === 'delete') {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        emit('stdout', `Deleted: ${op.path}`);
      }
    } else if (op.action === 'create' || op.action === 'modify') {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, op.content || '', 'utf-8');
      emit('stdout', `${op.action === 'create' ? 'Created' : 'Modified'}: ${op.path}`);
    }
  }
}

export function getHistory(): AiGenHistoryEntry[] {
  return historyStore;
}
