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
