import { useEffect, useState } from 'react';

interface SyncStatus {
  enabled: boolean;
  lastSynced: string | null;
  status: 'idle' | 'syncing' | 'error' | 'offline';
  error?: string;
}

export default function CloudSync() {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ enabled: false, lastSynced: null, status: 'idle' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      const s = await window.devdash.settings.get();
      setSupabaseUrl((s as any).supabaseUrl || '');
      setSupabaseKey((s as any).supabaseAnonKey || '');
      setEnabled(!!(s as any).syncEnabled);
      const st = await window.devdash.sync.status();
      setStatus(st as unknown as SyncStatus);
    })();
  }, []);

  const handleConfigure = async () => {
    setBusy(true);
    setMessage('');
    const res = await window.devdash.sync.configure(supabaseUrl, supabaseKey, enabled);
    setStatus(res as unknown as SyncStatus);
    setMessage('Configuration saved.');
    setBusy(false);
  };

  const handlePush = async () => {
    setBusy(true);
    setMessage('');
    const res = await window.devdash.sync.push();
    if (res.ok) {
      setMessage('Pushed successfully.');
    } else {
      setMessage(`Push failed: ${res.error}`);
    }
    const st = await window.devdash.sync.status();
    setStatus(st as unknown as SyncStatus);
    setBusy(false);
  };

  const handlePull = async () => {
    setBusy(true);
    setMessage('');
    const res = await window.devdash.sync.pull();
    if (res.ok) {
      setMessage(res.merged ? 'Pulled and merged remote changes.' : 'Already up to date.');
    } else {
      setMessage(`Pull failed: ${res.error}`);
    }
    const st = await window.devdash.sync.status();
    setStatus(st as unknown as SyncStatus);
    setBusy(false);
  };

  const statusIndicator = () => {
    switch (status.status) {
      case 'idle': return <span className="inline-block w-2 h-2 rounded-full bg-green-400" />;
      case 'syncing': return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />;
      case 'error': return <span className="inline-block w-2 h-2 rounded-full bg-red-400" />;
      case 'offline': return <span className="inline-block w-2 h-2 rounded-full bg-dash-mute/40" />;
      default: return null;
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <h2 className="text-sm font-semibold text-dash-text">Cloud Sync</h2>

      {/* Status */}
      <div className="flex items-center gap-2 rounded border border-dash-line bg-dash-panel/40 px-3 py-2">
        {statusIndicator()}
        <span className="text-xs text-dash-text capitalize">{status.status}</span>
        {status.lastSynced && (
          <span className="text-[10px] text-dash-mute ml-auto">
            Last synced: {new Date(status.lastSynced).toLocaleString()}
          </span>
        )}
        {status.error && <span className="text-[10px] text-red-400 ml-2">{status.error}</span>}
      </div>

      {/* Configuration */}
      <div className="flex flex-col gap-3 rounded border border-dash-line bg-dash-panel/40 p-3">
        <p className="text-xs font-medium text-dash-text">Supabase Configuration</p>
        <p className="text-[10px] text-dash-mute">
          Create a table named <code className="bg-black/30 px-1 rounded">devdash_sync</code> with columns:
          id (text, PK), payload (text), updated_at (timestamptz).
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-dash-mute">Supabase URL</label>
          <input
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
            placeholder="https://your-project.supabase.co"
            className="rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text placeholder:text-dash-mute/50 outline-none focus:border-dash-indigo"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-dash-mute">Anon Key</label>
          <input
            value={supabaseKey}
            onChange={(e) => setSupabaseKey(e.target.value)}
            type="password"
            placeholder="eyJ..."
            className="rounded border border-dash-line bg-dash-panel px-3 py-2 text-xs text-dash-text placeholder:text-dash-mute/50 outline-none focus:border-dash-indigo"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-dash-text">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-dash-indigo"
          />
          Enable auto-sync
        </label>

        <button
          onClick={handleConfigure}
          disabled={busy}
          className="self-start rounded bg-dash-indigo/20 border border-dash-indigo/40 px-3 py-1.5 text-xs text-dash-indigoBright hover:bg-dash-indigo/30 disabled:opacity-40"
        >
          Save Configuration
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handlePush}
          disabled={busy || !supabaseUrl || !supabaseKey}
          className="rounded border border-dash-line px-3 py-1.5 text-xs text-dash-mute hover:text-dash-text disabled:opacity-40"
        >
          ↑ Push
        </button>
        <button
          onClick={handlePull}
          disabled={busy || !supabaseUrl || !supabaseKey}
          className="rounded border border-dash-line px-3 py-1.5 text-xs text-dash-mute hover:text-dash-text disabled:opacity-40"
        >
          ↓ Pull
        </button>
      </div>

      {message && (
        <div className={`rounded border px-3 py-2 text-xs ${
          message.includes('failed') ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-green-500/30 bg-green-500/10 text-green-400'
        }`}>
          {message}
        </div>
      )}

      {/* Info */}
      <div className="rounded border border-dash-line bg-dash-panel/20 p-3 text-[10px] text-dash-mute">
        <p className="font-medium text-dash-text text-xs mb-1">How it works</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Syncs project list and non-sensitive settings across devices</li>
          <li>Tokens and API keys are never synced</li>
          <li>Uses last-write-wins conflict resolution</li>
          <li>Auto-syncs on config changes when enabled (5s debounce)</li>
        </ul>
      </div>
    </div>
  );
}
