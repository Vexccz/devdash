import { net } from 'electron';
import { loadConfig } from './config';

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest?: string;
}

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function listModels(): Promise<{ ok: boolean; models?: OllamaModel[]; error?: string }> {
  const cfg = loadConfig();
  const base = cfg.settings.ollamaBaseUrl || 'http://localhost:11434';
  const apiKey = cfg.settings.ollamaApiKey || '';
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(`${base}/api/tags`, { method: 'GET', headers });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { models?: OllamaModel[] };
    return { ok: true, models: data.models ?? [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Ollama unreachable' };
  }
}

export interface ChatStreamOptions {
  model: string;
  messages: OllamaMessage[];
  temperature?: number;
  systemPrompt?: string;
  onChunk: (chunk: string) => void;
  onDone: (fullResponse: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(opts: ChatStreamOptions): Promise<void> {
  const cfg = loadConfig();
  const base = cfg.settings.ollamaBaseUrl || 'http://localhost:11434';
  const apiKey = cfg.settings.ollamaApiKey || '';

  const msgs: OllamaMessage[] = [];
  if (opts.systemPrompt && opts.systemPrompt.trim()) {
    msgs.push({ role: 'system', content: opts.systemPrompt });
  }
  msgs.push(...opts.messages);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages: msgs,
        stream: true,
        options: opts.temperature !== undefined ? { temperature: opts.temperature } : undefined,
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      opts.onError(`HTTP ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
          };
          if (obj.message?.content) {
            full += obj.message.content;
            opts.onChunk(obj.message.content);
          }
          if (obj.done) {
            opts.onDone(full);
            return;
          }
        } catch {
          /* skip malformed line */
        }
      }
    }
    opts.onDone(full);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      opts.onDone('');
      return;
    }
    opts.onError(err?.message || 'Stream failed');
  }
}
