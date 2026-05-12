import { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownMessage from './MarkdownMessage';

interface ChatSummary {
  id: string;
  title: string;
  model: string | null;
  systemPrompt: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ChatMessage {
  id: number;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export default function ChatView() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [modelError, setModelError] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [input, setInput] = useState<string>('');
  const [streaming, setStreaming] = useState<boolean>(false);
  const [streamText, setStreamText] = useState<string>('');
  const streamIdRef = useRef<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<{ ollamaBaseUrl: string; ollamaDefaultModel: string; ollamaSystemPrompt: string; ollamaTemperature: number } | null>(null);

  const refreshChats = async () => {
    const list = await window.devdash.chats.list();
    setChats(list);
  };

  const loadModels = async () => {
    const res = await window.devdash.ollama.listModels();
    if (res.ok && res.models) {
      setModels(res.models);
      setModelError('');
    } else {
      setModels([]);
      setModelError(res.error || 'Ollama unreachable');
    }
  };

  useEffect(() => {
    (async () => {
      const s = await window.devdash.settings.get();
      setSettings({
        ollamaBaseUrl: s.ollamaBaseUrl,
        ollamaDefaultModel: s.ollamaDefaultModel,
        ollamaSystemPrompt: s.ollamaSystemPrompt,
        ollamaTemperature: s.ollamaTemperature ?? 0.7,
      });
      setSystemPrompt(s.ollamaSystemPrompt || '');
      setTemperature(s.ollamaTemperature ?? 0.7);
      if (s.ollamaDefaultModel) setCurrentModel(s.ollamaDefaultModel);
    })();
    void refreshChats();
    void loadModels();
  }, []);

  // Auto-select default model when models arrive
  useEffect(() => {
    if (!currentModel && models.length > 0) {
      setCurrentModel(models[0].name);
    }
  }, [models, currentModel]);

  useEffect(() => {
    if (!currentId) {
      setMessages([]);
      return;
    }
    (async () => {
      const msgs = await window.devdash.chats.messages(currentId);
      setMessages(msgs);
    })();
  }, [currentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText]);

  // Subscribe to stream events
  useEffect(() => {
    const offChunk = window.devdash.ollama.onChunk((p) => {
      if (p.streamId !== streamIdRef.current) return;
      setStreamText((prev) => prev + p.chunk);
    });
    const offDone = window.devdash.ollama.onDone((p) => {
      if (p.streamId !== streamIdRef.current) return;
      setStreaming(false);
      setStreamText('');
      // Refresh messages to pick up the assistant turn persisted by main
      if (currentId) {
        void window.devdash.chats.messages(currentId).then(setMessages);
      }
      void refreshChats();
    });
    const offError = window.devdash.ollama.onError((p) => {
      if (p.streamId !== streamIdRef.current) return;
      setStreaming(false);
      setStreamText('');
      alert(`Stream error: ${p.error}`);
    });
    return () => {
      offChunk();
      offDone();
      offError();
    };
  }, [currentId]);

  const newChat = async () => {
    const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await window.devdash.chats.create({
      id,
      title: 'New chat',
      model: currentModel || '',
      systemPrompt: systemPrompt || '',
    });
    await refreshChats();
    setCurrentId(id);
  };

  const deleteCurrentChat = async () => {
    if (!currentId) return;
    if (!confirm('Delete this chat?')) return;
    await window.devdash.chats.delete(currentId);
    setCurrentId(null);
    await refreshChats();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (!currentModel) {
      alert('Select a model first');
      return;
    }

    let chatId = currentId;
    if (!chatId) {
      chatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
      await window.devdash.chats.create({ id: chatId, title, model: currentModel, systemPrompt });
      setCurrentId(chatId);
      await refreshChats();
    } else if (messages.length === 0) {
      // First message in existing empty chat — set title
      const title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
      await window.devdash.chats.update(chatId, { title, model: currentModel });
    }

    await window.devdash.chats.addMessage({ chatId, role: 'user', content: text });
    const updated = await window.devdash.chats.messages(chatId);
    setMessages(updated);
    setInput('');

    const streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    streamIdRef.current = streamId;
    setStreamText('');
    setStreaming(true);

    const msgs = updated.map((m) => ({ role: m.role, content: m.content }));

    void window.devdash.ollama.chat({
      streamId,
      chatId,
      model: currentModel,
      messages: msgs,
      temperature,
      systemPrompt,
    });
  };

  const stop = () => {
    if (streamIdRef.current) {
      void window.devdash.ollama.stop(streamIdRef.current);
    }
  };

  const currentChat = useMemo(() => chats.find((c) => c.id === currentId) || null, [chats, currentId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Chat</h1>
          <p className="text-xs text-dash-mute">
            {modelError ? <span className="text-red-400">{modelError}</span> : settings ? `Ollama at ${settings.ollamaBaseUrl}` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={currentModel}
            onChange={(e) => setCurrentModel(e.target.value)}
            disabled={models.length === 0}
            className="rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-xs text-dash-text disabled:opacity-40"
          >
            <option value="">{models.length === 0 ? '(no models)' : 'Select model'}</option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <button onClick={() => void loadModels()} className="btn-soft" title="Refresh models">
            ↻
          </button>
          <button onClick={() => void newChat()} className="btn-primary">
            + New chat
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Chat history sidebar */}
        <div className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto rounded-md border border-dash-line bg-dash-panel/40 p-2">
          {chats.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-dash-mute">No chats yet</div>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCurrentId(c.id)}
                className={`flex flex-col items-start rounded px-2 py-1.5 text-left text-xs ${
                  c.id === currentId
                    ? 'bg-dash-indigo/20 text-dash-indigoBright'
                    : 'text-dash-text hover:bg-white/5'
                }`}
              >
                <span className="line-clamp-1 w-full">{c.title}</span>
                <span className="text-[9px] text-dash-mute">
                  {c.model || 'no model'} · {formatRelative(c.updatedAt)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Main chat area */}
        <div className="flex flex-1 min-w-0 flex-col rounded-md border border-dash-line bg-dash-panel/20">
          {currentChat && (
            <div className="flex items-center justify-between border-b border-dash-line px-3 py-2">
              <div className="min-w-0 flex-1 text-xs text-dash-text">
                <div className="truncate font-medium">{currentChat.title}</div>
                <div className="text-[10px] text-dash-mute">
                  {currentChat.model || 'no model'} · {messages.length} message{messages.length === 1 ? '' : 's'}
                </div>
              </div>
              <button
                onClick={() => void deleteCurrentChat()}
                className="rounded px-2 py-1 text-[10px] text-dash-mute hover:bg-red-500/10 hover:text-red-400"
              >
                Delete
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && !streaming && !currentChat && (
              <div className="flex h-full items-center justify-center text-center text-sm text-dash-mute">
                <div>
                  <p>Start a new chat or pick one from the sidebar.</p>
                  {modelError && (
                    <p className="mt-2 text-xs text-red-400">
                      {modelError}. Start Ollama: <code className="rounded bg-dash-bg px-1">ollama serve</code>
                    </p>
                  )}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} />
            ))}
            {streaming && streamText && <MessageBubble role="assistant" content={streamText} streaming />}
            {streaming && !streamText && (
              <div className="mb-3 text-xs text-dash-mute">
                <span className="inline-block animate-pulse">●●●</span> thinking...
              </div>
            )}
          </div>

          <div className="border-t border-dash-line p-3">
            <div className="mb-2 flex gap-2 text-[10px] text-dash-mute">
              <label className="flex items-center gap-1">
                Temp:
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-20"
                  disabled={streaming}
                />
                <span className="w-6 text-center font-mono">{temperature.toFixed(1)}</span>
              </label>
              <input
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="System prompt (optional)"
                disabled={streaming}
                className="flex-1 rounded border border-dash-line bg-dash-bg px-2 py-0.5 text-[10px] text-dash-text"
              />
            </div>
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type a message... (Ctrl+Enter to send)"
                rows={3}
                disabled={streaming}
                className="flex-1 rounded-md border border-dash-line bg-dash-bg px-3 py-2 text-xs text-dash-text"
              />
              {streaming ? (
                <button onClick={stop} className="btn-soft whitespace-nowrap">
                  ■ Stop
                </button>
              ) : (
                <button
                  onClick={() => void send()}
                  disabled={!input.trim() || !currentModel}
                  className="btn-primary whitespace-nowrap"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, content, streaming }: { role: string; content: string; streaming?: boolean }) {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  if (isSystem) {
    return (
      <div className="mb-3 rounded border border-dash-line/50 bg-dash-bg/40 px-3 py-2 text-[11px] italic text-dash-mute">
        <span className="text-[9px] uppercase tracking-wider">system</span>
        <div className="mt-1 whitespace-pre-wrap">{content}</div>
      </div>
    );
  }
  return (
    <div className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-dash-indigo/20 text-dash-text'
            : 'bg-dash-bg/60 text-dash-text border border-dash-line'
        }`}
      >
        <div className="mb-1 text-[9px] uppercase tracking-wider text-dash-mute">
          {role}
          {streaming && <span className="ml-1 animate-pulse">●</span>}
        </div>
        {isUser ? (
          <div className="whitespace-pre-wrap text-xs leading-relaxed">{content}</div>
        ) : (
          <MarkdownMessage content={content} />
        )}
      </div>
    </div>
  );
}

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}
