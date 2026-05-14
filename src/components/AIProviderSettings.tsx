import { useEffect, useState } from 'react';
import type { AppSettings } from '../types';

interface ProviderDef {
  id: string;
  name: string;
  models: string[];
  requiresKey: boolean;
  baseUrl: string;
}

export default function AIProviderSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [providers, setProviders] = useState<ProviderDef[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; provider: string; model: string; error?: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        window.devdash.settings.get(),
        window.devdash.ai.providers(),
      ]);
      setSettings(s);
      setProviders(p);
    })();
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const next = await window.devdash.settings.update(patch);
    setSettings(next);
    setSavedAt(Date.now());
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await window.devdash.ai.test();
    setTestResult(result);
    setTesting(false);
  };

  if (!settings) {
    return <div className="p-4 text-sm text-dash-mute">Loading…</div>;
  }

  const activeProviderId = settings.aiProvider || 'ollama';
  const activeDef = providers.find((p) => p.id === activeProviderId) || providers[0];

  const getApiKeyField = (): { value: string; field: keyof AppSettings } | null => {
    switch (activeProviderId) {
      case 'openai': return { value: settings.openaiApiKey || '', field: 'openaiApiKey' };
      case 'anthropic': return { value: settings.anthropicApiKey || '', field: 'anthropicApiKey' };
      case 'google': return { value: settings.googleApiKey || '', field: 'googleApiKey' };
      case 'groq': return { value: settings.groqApiKey || '', field: 'groqApiKey' };
      case 'together': return { value: settings.togetherApiKey || '', field: 'togetherApiKey' };
      case 'custom': return { value: settings.customAiApiKey || '', field: 'customAiApiKey' };
      default: return null;
    }
  };

  const keyInfo = getApiKeyField();

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-dash-text">AI Provider</h2>
      <p className="mb-3 text-[10px] text-dash-mute">
        Choose which AI provider to use for code generation, suggestions, and chat features.
        Ollama runs locally for free. Cloud providers require an API key.
      </p>

      <div className="flex flex-col gap-3 text-xs">
        {/* Provider selector */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-dash-mute">Provider</span>
          <select
            value={activeProviderId}
            onChange={(e) => update({ aiProvider: e.target.value as AppSettings['aiProvider'] })}
            className="rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-[11px] text-dash-text"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        {/* Model selector */}
        {activeProviderId !== 'custom' && activeDef && activeDef.models.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-dash-mute">Model</span>
            <select
              value={settings.ollamaDefaultModel || ''}
              onChange={(e) => update({ ollamaDefaultModel: e.target.value })}
              className="rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 text-[11px] text-dash-text"
            >
              <option value="">Select a model…</option>
              {activeDef.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-[10px] text-dash-mute">
              {activeProviderId === 'ollama'
                ? 'Make sure this model is pulled locally via `ollama pull <model>`.'
                : 'Select the model to use for AI features.'}
            </span>
          </label>
        )}

        {/* Custom provider fields */}
        {activeProviderId === 'custom' && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-dash-mute">Base URL</span>
              <input
                type="text"
                value={settings.customAiBaseUrl || ''}
                onChange={(e) => update({ customAiBaseUrl: e.target.value })}
                placeholder="https://your-api.example.com"
                className="rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
              />
              <span className="text-[10px] text-dash-mute">
                Must be OpenAI-compatible (supports /v1/chat/completions).
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-dash-mute">Model name</span>
              <input
                type="text"
                value={settings.customAiModel || ''}
                onChange={(e) => update({ customAiModel: e.target.value })}
                placeholder="my-model-name"
                className="rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
              />
            </label>
          </>
        )}

        {/* API key field (for providers that need it, or custom) */}
        {keyInfo && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-dash-mute">API Key</span>
            <div className="flex items-center gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInfo.value}
                onChange={(e) => update({ [keyInfo.field]: e.target.value })}
                placeholder="sk-..."
                className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="rounded border border-dash-line px-2 py-1 text-[10px] text-dash-mute hover:text-dash-text"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="text-[10px] text-dash-mute">
              {activeProviderId === 'openai' && 'Get your key at platform.openai.com/api-keys'}
              {activeProviderId === 'anthropic' && 'Get your key at console.anthropic.com/settings/keys'}
              {activeProviderId === 'google' && 'Get your key at aistudio.google.com/apikey'}
              {activeProviderId === 'groq' && 'Get your key at console.groq.com/keys'}
              {activeProviderId === 'together' && 'Get your key at api.together.xyz/settings/api-keys'}
              {activeProviderId === 'custom' && 'API key for your custom endpoint (optional).'}
            </span>
          </label>
        )}

        {/* Ollama-specific: base URL */}
        {activeProviderId === 'ollama' && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-dash-mute">Ollama Base URL</span>
            <input
              type="text"
              value={settings.ollamaBaseUrl}
              onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-[11px] text-dash-text"
            />
            <span className="text-[10px] text-dash-mute">
              Default: <code className="rounded bg-dash-bg px-1">http://localhost:11434</code>
            </span>
          </label>
        )}

        {/* Test connection */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-md border border-dash-line bg-dash-bg px-3 py-1.5 text-[11px] font-medium text-dash-text hover:border-indigo-500/50 hover:text-indigo-400 disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>

          {testResult && (
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${testResult.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {testResult.ok
                ? `Connected · ${testResult.provider} / ${testResult.model}`
                : testResult.error || 'Connection failed'}
            </span>
          )}
        </div>

        {savedAt > 0 && Date.now() - savedAt < 2500 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-400 self-start">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Saved
          </span>
        )}
      </div>
    </section>
  );
}
