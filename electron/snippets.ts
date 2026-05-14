import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface Snippet {
  id: string;
  title: string;
  language: string;
  code: string;
  tags: string[];
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

function snippetsPath(): string {
  return path.join(app.getPath('userData'), 'snippets.json');
}

function readAll(): Snippet[] {
  const p = snippetsPath();
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Snippet[];
  } catch {
    return [];
  }
}

function writeAll(snippets: Snippet[]): void {
  fs.writeFileSync(snippetsPath(), JSON.stringify(snippets, null, 2), 'utf-8');
}

export function listSnippets(filter?: { language?: string; tag?: string; search?: string; projectId?: string }): Snippet[] {
  let snippets = readAll();
  if (filter?.language) {
    snippets = snippets.filter((s) => s.language.toLowerCase() === filter.language!.toLowerCase());
  }
  if (filter?.tag) {
    const t = filter.tag.toLowerCase();
    snippets = snippets.filter((s) => s.tags.some((tag) => tag.toLowerCase() === t));
  }
  if (filter?.projectId) {
    snippets = snippets.filter((s) => s.projectId === filter.projectId || !s.projectId);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    snippets = snippets.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        s.language.toLowerCase().includes(q)
    );
  }
  return snippets;
}

export function getSnippet(id: string): Snippet | null {
  const snippets = readAll();
  return snippets.find((s) => s.id === id) ?? null;
}

export function saveSnippet(input: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Snippet {
  const snippets = readAll();
  const now = Date.now();

  if (input.id) {
    const idx = snippets.findIndex((s) => s.id === input.id);
    if (idx >= 0) {
      snippets[idx] = { ...snippets[idx], ...input, id: input.id, updatedAt: now };
      writeAll(snippets);
      return snippets[idx];
    }
  }

  const snippet: Snippet = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: input.title,
    language: input.language,
    code: input.code,
    tags: input.tags || [],
    projectId: input.projectId,
    createdAt: now,
    updatedAt: now,
  };
  snippets.unshift(snippet);
  writeAll(snippets);
  return snippet;
}

export function deleteSnippet(id: string): { ok: boolean } {
  const snippets = readAll();
  const filtered = snippets.filter((s) => s.id !== id);
  if (filtered.length === snippets.length) return { ok: false };
  writeAll(filtered);
  return { ok: true };
}

export async function generateSnippet(description: string): Promise<{ ok: boolean; snippet?: Partial<Snippet>; error?: string }> {
  const { loadConfig } = await import('./config');
  const cfg = loadConfig();
  const { ollamaBaseUrl, ollamaApiKey, ollamaDefaultModel } = cfg.settings;

  if (!ollamaDefaultModel) {
    return { ok: false, error: 'No AI model configured. Set ollamaDefaultModel in settings.' };
  }

  const prompt = `Generate a code snippet based on this description: "${description}"

Return ONLY a JSON object with these fields:
- title: short descriptive title
- language: programming language (e.g. "typescript", "python", "go")
- code: the actual code snippet
- tags: array of relevant tags

Output ONLY valid JSON, no markdown wrapping.`;

  const baseUrl = (ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, '');
  const isOllama = baseUrl.includes('11434');
  const endpoint = isOllama ? `${baseUrl}/api/chat` : `${baseUrl}/v1/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ollamaApiKey) headers['Authorization'] = `Bearer ${ollamaApiKey}`;

  let body: any;
  if (isOllama) {
    body = { model: ollamaDefaultModel, messages: [{ role: 'user', content: prompt }], stream: false };
  } else {
    body = { model: ollamaDefaultModel, messages: [{ role: 'user', content: prompt }], temperature: 0.7 };
  }

  try {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `API error ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json() as any;
    let content = '';
    if (isOllama) {
      content = data?.message?.content || '';
    } else {
      content = data?.choices?.[0]?.message?.content || '';
    }

    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: 'AI did not return valid JSON.' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ok: true,
      snippet: {
        title: parsed.title || 'Generated snippet',
        language: parsed.language || 'text',
        code: parsed.code || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function insertIntoProject(snippetId: string, filePath: string): { ok: boolean; error?: string } {
  const snippet = getSnippet(snippetId);
  if (!snippet) return { ok: false, error: 'Snippet not found' };

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');
      fs.writeFileSync(filePath, existing + '\n' + snippet.code + '\n', 'utf-8');
    } else {
      fs.writeFileSync(filePath, snippet.code + '\n', 'utf-8');
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
