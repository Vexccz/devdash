import { useEffect, useState } from 'react';
import type { AppSettings } from '../types';

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [version, setVersion] = useState<string>('');
  const [configPath, setConfigPath] = useState<string>('');
  const [showVercel, setShowVercel] = useState(false);
  const [showRender, setShowRender] = useState(false);
  const [savedAt, setSavedAt] = useState<number>(0);
  const [vercelTest, setVercelTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [renderTest, setRenderTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingVercel, setTestingVercel] = useState(false);
  const [testingRender, setTestingRender] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, v, p] = await Promise.all([
        window.devdash.settings.get(),
        window.devdash.app.version(),
        window.devdash.app.configPath(),
      ]);
      setSettings(s);
      setVersion(v);
      setConfigPath(p);
    })();
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const next = await window.devdash.settings.update(patch);
    setSettings(next);
    setSavedAt(Date.now());
  };

  const testToken = async (provider: 'vercel' | 'render') => {
    if (provider === 'vercel') {
      setTestingVercel(true);
      const result = await window.devdash.settings.testToken('vercel');
      setVercelTest(result);
      setTestingVercel(false);
    } else {
      setTestingRender(true);
      const result = await window.devdash.settings.testToken('render');
      setRenderTest(result);
      setTestingRender(false);
    }
  };

  if (!settings) {
    return <div className="p-4 text-sm text-dash-mute">Loading settings…</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Settings</h1>
          <p className="text-xs text-dash-mute">Changes save automatically as you type.</p>
        </div>
        {savedAt > 0 && Date.now() - savedAt < 2500 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Saved
          </span>
        )}
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-dash-text">API tokens</h2>
        <div className="flex flex-col gap-3">
          <TokenField
            label="Vercel API token"
            hint="Create at vercel.com/account/tokens (scope: Read deployments)"
            value={settings.vercelToken}
            show={showVercel}
            onToggleShow={() => setShowVercel((s) => !s)}
            onChange={(v) => update({ vercelToken: v })}
            onTest={() => testToken('vercel')}
            testing={testingVercel}
            testResult={vercelTest}
          />
          <TokenField
            label="Render API token"
            hint="Create at dashboard.render.com/u/account/api-keys"
            value={settings.renderToken}
            show={showRender}
            onToggleShow={() => setShowRender((s) => !s)}
            onChange={(v) => update({ renderToken: v })}
            onTest={() => testToken('render')}
            testing={testingRender}
            testResult={renderTest}
          />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-dash-text">Polling & background jobs</h2>
        <div className="flex flex-col gap-3 text-xs">
          <label className="flex items-center gap-3">
            <span className="w-48 text-dash-mute">Deploy poll interval</span>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.pollIntervalMinutes}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n >= 1 && n <= 120) update({ pollIntervalMinutes: n });
              }}
              className="w-20 rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-center font-mono text-sm text-dash-text"
            />
            <span className="text-dash-mute">minutes</span>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-48 text-dash-mute">Uptime check interval</span>
            <input
              type="number"
              min={1}
              max={60}
              value={settings.uptimeIntervalMinutes}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n >= 1 && n <= 60) update({ uptimeIntervalMinutes: n });
              }}
              className="w-20 rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-center font-mono text-sm text-dash-text"
            />
            <span className="text-dash-mute">minutes</span>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-48 text-dash-mute">Task timer idle timeout</span>
            <input
              type="number"
              min={1}
              max={60}
              value={settings.idleTimeoutMinutes}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n >= 1 && n <= 60) update({ idleTimeoutMinutes: n });
              }}
              className="w-20 rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-center font-mono text-sm text-dash-text"
            />
            <span className="text-dash-mute">minutes</span>
          </label>
          <Toggle
            label="Uptime monitoring"
            description="Periodic HTTP GET on each project's live URL."
            value={settings.uptimeEnabled}
            onChange={(v) => update({ uptimeEnabled: v })}
          />
          <Toggle
            label="Bundle size watch"
            description="Records dist/ size on mtime change, tracks delta vs 7-day avg."
            value={settings.bundleWatchEnabled}
            onChange={(v) => update({ bundleWatchEnabled: v })}
          />
          <Toggle
            label="Weekly dependency check"
            description="Runs `npm outdated` on each Node project every Monday at 09:00."
            value={settings.depsCheckEnabled}
            onChange={(v) => update({ depsCheckEnabled: v })}
          />
          <Toggle
            label="Daily screenshot capture"
            description="Uses Electron headless BrowserWindow to snap each live URL daily."
            value={settings.screenshotsEnabled}
            onChange={(v) => update({ screenshotsEnabled: v })}
          />
          <label className="flex items-center gap-3">
            <span className="w-48 text-dash-mute">Screenshot hour (24h)</span>
            <input
              type="number"
              min={0}
              max={23}
              value={settings.screenshotHour}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n >= 0 && n <= 23) update({ screenshotHour: n });
              }}
              className="w-20 rounded-md border border-dash-line bg-dash-bg px-2 py-1 text-center font-mono text-sm text-dash-text"
            />
          </label>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-dash-text">Error budget (Sentry)</h2>
        <div className="flex flex-col gap-2 text-xs">
          <TokenField
            label="Sentry auth token"
            hint="Optional. Needed to pull per-day error counts for projects with a Sentry DSN."
            value={settings.sentryAuthToken}
            show={false}
            onToggleShow={() => {}}
            onChange={(v) => update({ sentryAuthToken: v })}
          />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-dash-text">Appearance & startup</h2>
        <div className="flex flex-col gap-2 text-xs">
          <Toggle
            label="Dark mode"
            description="DevDash is dark-only for now; toggle persists for future light theme."
            value={settings.darkMode}
            onChange={(v) => update({ darkMode: v })}
          />
          <Toggle
            label="Launch on Windows startup"
            description="Adds DevDash to login items."
            value={settings.autoLaunch}
            onChange={(v) => update({ autoLaunch: v })}
          />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-dash-text">About</h2>
        <div className="flex flex-col gap-2 text-xs">
          <InfoRow label="Version" value={version || '—'} />
          <InfoRow label="Config file" value={configPath} mono />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => window.devdash.app.openLogs()}
              className="rounded-md border border-dash-line bg-dash-panel/60 px-3 py-1.5 text-[11px] text-dash-text hover:border-dash-indigo/60"
            >
              Open logs folder
            </button>
            <button
              onClick={() =>
                window.devdash.shell.openExternal('https://github.com/Vexccz/devdash')
              }
              className="rounded-md border border-dash-line bg-dash-panel/60 px-3 py-1.5 text-[11px] text-dash-text hover:border-dash-indigo/60"
            >
              GitHub repo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TokenField({
  label,
  hint,
  value,
  show,
  onToggleShow,
  onChange,
  onTest,
  testing,
  testResult,
}: {
  label: string;
  hint: string;
  value: string;
  show: boolean;
  onToggleShow: () => void;
  onChange: (v: string) => void;
  onTest?: () => void;
  testing?: boolean;
  testResult?: { ok: boolean; message: string } | null;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[10px] uppercase tracking-wider text-dash-mute">{label}</span>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="paste token here"
          className="flex-1 rounded-md border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-xs text-dash-text"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="rounded-md border border-dash-line bg-dash-panel/60 px-3 text-[11px] text-dash-text hover:border-dash-indigo/60"
        >
          {show ? 'Hide' : 'Show'}
        </button>
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={!value || testing}
            className="rounded-md border border-dash-indigo/40 bg-dash-indigo/10 px-3 text-[11px] font-medium text-dash-indigo hover:bg-dash-indigo/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
        )}
      </div>
      <span className="text-[10px] text-dash-mute">{hint}</span>
      {testResult && (
        <div
          className={`mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] ${
            testResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${testResult.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {testResult.message}
        </div>
      )}
    </label>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md bg-dash-bg/40 px-3 py-2 hover:bg-dash-bg/70">
      <div>
        <div className="text-dash-text">{label}</div>
        {description && <div className="text-[10px] text-dash-mute">{description}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        className={`flex h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition ${
          value ? 'bg-dash-indigo' : 'bg-dash-line'
        }`}
      >
        <div
          className={`h-4 w-4 transform rounded-full bg-white transition ${
            value ? 'translate-x-4' : ''
          }`}
        />
      </div>
    </label>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-dash-mute">{label}</span>
      <span className={`truncate text-right text-dash-text ${mono ? 'font-mono text-[11px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
