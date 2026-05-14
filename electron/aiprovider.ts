import { loadConfig } from './config';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  ok: boolean;
  content: string;
  model: string;
  provider: string;
  error?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  models: string[];
  requiresKey: boolean;
  baseUrl: string;
}

export const PROVIDERS: AIProvider[] = [
  { id: 'ollama', name: 'Ollama (Local)', models: ['llama3', 'codellama', 'mistral', 'deepseek-coder', 'qwen2.5-coder'], requiresKey: false, baseUrl: 'http://localhost:11434' },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini'], requiresKey: true, baseUrl: 'https://api.openai.com' },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], requiresKey: true, baseUrl: 'https://api.anthropic.com' },
  { id: 'google', name: 'Google (Gemini)', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'], requiresKey: true, baseUrl: 'https://generativelanguage.googleapis.com' },
  { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'], requiresKey: true, baseUrl: 'https://api.groq.com/openai' },
  { id: 'together', name: 'Together AI', models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'deepseek-ai/deepseek-coder-33b-instruct'], requiresKey: true, baseUrl: 'https://api.together.xyz' },
  { id: 'custom', name: 'Custom (OpenAI-compatible)', models: [], requiresKey: false, baseUrl: '' },
];

function getProviderConfig(): { provider: AIProvider; model: string; apiKey: string; baseUrl: string } {
  const cfg = loadConfig();
  const s = cfg.settings;
  const providerId = s.aiProvider || 'ollama';
  const providerDef = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];

  let model = '';
  let apiKey = '';
  let baseUrl = providerDef.baseUrl;

  switch (providerId) {
    case 'ollama':
      model = s.ollamaDefaultModel || 'llama3';
      apiKey = s.ollamaApiKey || '';
      baseUrl = (s.ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, '');
      break;
    case 'openai':
      model = s.ollamaDefaultModel || 'gpt-4o-mini';
      apiKey = s.openaiApiKey || '';
      break;
    case 'anthropic':
      model = s.ollamaDefaultModel || 'claude-sonnet-4-20250514';
      apiKey = s.anthropicApiKey || '';
      break;
    case 'google':
      model = s.ollamaDefaultModel || 'gemini-2.0-flash';
      apiKey = s.googleApiKey || '';
      break;
    case 'groq':
      model = s.ollamaDefaultModel || 'llama-3.3-70b-versatile';
      apiKey = s.groqApiKey || '';
      break;
    case 'together':
      model = s.ollamaDefaultModel || 'meta-llama/Llama-3-70b-chat-hf';
      apiKey = s.togetherApiKey || '';
      break;
    case 'custom':
      model = s.customAiModel || '';
      apiKey = s.customAiApiKey || '';
      baseUrl = (s.customAiBaseUrl || '').replace(/\/$/, '');
      break;
  }

  return { provider: providerDef, model, apiKey, baseUrl };
}

async function chatOllama(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<AIResponse> {
  const endpoint = `${baseUrl}/api/chat`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: false,
    options: {
      ...(options?.temperature != null ? { temperature: options.temperature } : {}),
      ...(options?.maxTokens != null ? { num_predict: options.maxTokens } : {}),
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, content: '', model, provider: 'ollama', error: `Ollama error ${res.status}: ${errText.slice(0, 200)}` };
  }

  const data = await res.json() as any;
  const content = data?.message?.content || '';
  return { ok: true, content, model, provider: 'ollama' };
}

async function chatOpenAICompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  providerId: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<AIResponse> {
  const endpoint = `${baseUrl}/v1/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const body: any = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (options?.temperature != null) body.temperature = options.temperature;
  if (options?.maxTokens != null) body.max_tokens = options.maxTokens;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, content: '', model, provider: providerId, error: `API error ${res.status}: ${errText.slice(0, 200)}` };
  }

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content || '';
  return { ok: true, content, model, provider: providerId };
}

async function chatAnthropic(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<AIResponse> {
  const endpoint = `${baseUrl}/v1/messages`;

  // Anthropic requires system message separate from messages array
  let systemPrompt: string | undefined;
  const filteredMessages: Array<{ role: string; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemPrompt = m.content;
    } else {
      filteredMessages.push({ role: m.role, content: m.content });
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const body: any = {
    model,
    messages: filteredMessages,
    max_tokens: options?.maxTokens || 4096,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (options?.temperature != null) body.temperature = options.temperature;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, content: '', model, provider: 'anthropic', error: `Anthropic error ${res.status}: ${errText.slice(0, 200)}` };
  }

  const data = await res.json() as any;
  const content = data?.content?.[0]?.text || '';
  return { ok: true, content, model, provider: 'anthropic' };
}

async function chatGoogle(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<AIResponse> {
  const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert messages to Google format
  let systemInstruction: string | undefined;
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemInstruction = m.content;
    } else {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }
  }

  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const generationConfig: any = {};
  if (options?.temperature != null) generationConfig.temperature = options.temperature;
  if (options?.maxTokens != null) generationConfig.maxOutputTokens = options.maxTokens;
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, content: '', model, provider: 'google', error: `Google error ${res.status}: ${errText.slice(0, 200)}` };
  }

  const data = await res.json() as any;
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { ok: true, content, model, provider: 'google' };
}

export async function chat(
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<AIResponse> {
  const { provider, model, apiKey, baseUrl } = getProviderConfig();

  if (!model) {
    return { ok: false, content: '', model: '', provider: provider.id, error: 'No AI model configured.' };
  }

  if (provider.requiresKey && !apiKey) {
    return { ok: false, content: '', model, provider: provider.id, error: `No API key configured for ${provider.name}.` };
  }

  try {
    let result: AIResponse;

    switch (provider.id) {
      case 'ollama':
        result = await chatOllama(baseUrl, model, apiKey, messages, options);
        break;
      case 'anthropic':
        result = await chatAnthropic(baseUrl, model, apiKey, messages, options);
        break;
      case 'google':
        result = await chatGoogle(baseUrl, model, apiKey, messages, options);
        break;
      case 'openai':
      case 'groq':
      case 'together':
      case 'custom':
        result = await chatOpenAICompatible(baseUrl, model, apiKey, messages, provider.id, options);
        break;
      default:
        result = await chatOllama(baseUrl, model, apiKey, messages, options);
    }

    // Fallback to Ollama if configured provider fails and it's not already Ollama
    if (!result.ok && provider.id !== 'ollama') {
      const cfg = loadConfig();
      const ollamaUrl = (cfg.settings.ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, '');
      const ollamaModel = cfg.settings.ollamaDefaultModel;
      if (ollamaModel) {
        try {
          const fallback = await chatOllama(ollamaUrl, ollamaModel, cfg.settings.ollamaApiKey || '', messages, options);
          if (fallback.ok) {
            return { ...fallback, error: `Fallback to Ollama (${provider.name} failed: ${result.error})` };
          }
        } catch {
          // Fallback also failed, return original error
        }
      }
    }

    return result;
  } catch (err: any) {
    return { ok: false, content: '', model, provider: provider.id, error: err?.message || 'AI request failed' };
  }
}

export function getActiveProvider(): { provider: AIProvider; model: string; configured: boolean } {
  const { provider, model, apiKey } = getProviderConfig();
  const configured = provider.id === 'ollama'
    ? !!model
    : (!!apiKey && !!model);
  return { provider, model, configured };
}

export function listProviders(): AIProvider[] {
  return PROVIDERS;
}

export interface StreamChatOptions {
  messages: AIMessage[];
  temperature?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const { provider, model, apiKey, baseUrl } = getProviderConfig();

  if (!model) { opts.onError('No AI model configured.'); return; }
  if (provider.requiresKey && !apiKey) { opts.onError(`No API key configured for ${provider.name}.`); return; }

  const messages: AIMessage[] = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  messages.push(...opts.messages);

  try {
    if (provider.id === 'ollama') {
      await streamOllama(baseUrl, model, apiKey, messages, opts);
    } else if (provider.id === 'anthropic') {
      await streamAnthropic(baseUrl, model, apiKey, messages, opts);
    } else if (provider.id === 'google') {
      // Google doesn't support streaming easily, use non-stream fallback
      const result = await chatGoogle(baseUrl, model, apiKey, messages, { temperature: opts.temperature });
      if (result.ok) { opts.onChunk(result.content); opts.onDone(result.content); }
      else { opts.onError(result.error || 'Google API error'); }
    } else {
      // OpenAI-compatible streaming (openai, groq, together, custom)
      await streamOpenAICompatible(baseUrl, model, apiKey, provider.id, messages, opts);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') { opts.onDone(''); return; }
    opts.onError(err?.message || 'Stream failed');
  }
}

async function streamOllama(baseUrl: string, model: string, apiKey: string, messages: AIMessage[], opts: StreamChatOptions): Promise<void> {
  const endpoint = `${baseUrl}/api/chat`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: messages.map(m => ({ role: m.role, content: m.content })), stream: true, options: { ...(opts.temperature != null ? { temperature: opts.temperature } : {}) } }),
    signal: opts.signal,
  });

  if (!res.ok) { opts.onError(`Ollama error ${res.status}`); return; }
  if (!res.body) { opts.onError('No response body'); return; }

  let full = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n').filter(l => l.trim())) {
      try {
        const json = JSON.parse(line);
        const chunk = json?.message?.content || '';
        if (chunk) { full += chunk; opts.onChunk(chunk); }
        if (json.done) { opts.onDone(full); return; }
      } catch { /* skip malformed */ }
    }
  }
  opts.onDone(full);
}

async function streamOpenAICompatible(baseUrl: string, model: string, apiKey: string, providerId: string, messages: AIMessage[], opts: StreamChatOptions): Promise<void> {
  const endpoint = `${baseUrl}/v1/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

  const body: any = { model, messages: messages.map(m => ({ role: m.role, content: m.content })), stream: true };
  if (opts.temperature != null) body.temperature = opts.temperature;

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: opts.signal });
  if (!res.ok) { const t = await res.text().catch(() => ''); opts.onError(`${providerId} error ${res.status}: ${t.slice(0, 200)}`); return; }
  if (!res.body) { opts.onError('No response body'); return; }

  let full = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const chunk = json?.choices?.[0]?.delta?.content || '';
          if (chunk) { full += chunk; opts.onChunk(chunk); }
        } catch { /* skip */ }
      }
    }
  }
  opts.onDone(full);
}

async function streamAnthropic(baseUrl: string, model: string, apiKey: string, messages: AIMessage[], opts: StreamChatOptions): Promise<void> {
  let systemPrompt: string | undefined;
  const filtered: Array<{ role: string; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'system') systemPrompt = m.content;
    else filtered.push({ role: m.role, content: m.content });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  const body: any = { model, messages: filtered, max_tokens: 4096, stream: true };
  if (systemPrompt) body.system = systemPrompt;
  if (opts.temperature != null) body.temperature = opts.temperature;

  const res = await fetch(`${baseUrl}/v1/messages`, { method: 'POST', headers, body: JSON.stringify(body), signal: opts.signal });
  if (!res.ok) { const t = await res.text().catch(() => ''); opts.onError(`Anthropic error ${res.status}: ${t.slice(0, 200)}`); return; }
  if (!res.body) { opts.onError('No response body'); return; }

  let full = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.type === 'content_block_delta') {
          const chunk = json.delta?.text || '';
          if (chunk) { full += chunk; opts.onChunk(chunk); }
        }
      } catch { /* skip */ }
    }
  }
  opts.onDone(full);
}

export async function testConnection(): Promise<{ ok: boolean; provider: string; model: string; error?: string }> {
  const { provider, model, apiKey, baseUrl } = getProviderConfig();

  if (!model) {
    return { ok: false, provider: provider.id, model: '', error: 'No model configured.' };
  }

  if (provider.requiresKey && !apiKey) {
    return { ok: false, provider: provider.id, model, error: `No API key set for ${provider.name}.` };
  }

  const testMessages: AIMessage[] = [{ role: 'user', content: 'Say "hello" in one word.' }];

  try {
    const result = await chat(testMessages, { temperature: 0, maxTokens: 10 });
    if (result.ok) {
      return { ok: true, provider: provider.id, model };
    }
    return { ok: false, provider: provider.id, model, error: result.error };
  } catch (err: any) {
    return { ok: false, provider: provider.id, model, error: err?.message || 'Connection test failed' };
  }
}
