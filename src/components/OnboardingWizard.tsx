import { useState, useEffect } from 'react';
import type { ProjectInspection } from '../types';

interface Props {
  onComplete: () => void;
}

type Step = 'welcome' | 'tokens' | 'scan' | 'preferences' | 'done';

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [vercelToken, setVercelToken] = useState('');
  const [renderToken, setRenderToken] = useState('');
  const [vercelStatus, setVercelStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [renderStatus, setRenderStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState<'vercel' | 'render' | null>(null);

  const [scanResults, setScanResults] = useState<ProjectInspection[]>([]);
  const [scanParent, setScanParent] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [pollMin, setPollMin] = useState(5);
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    void (async () => {
      const s = await window.devdash.settings.get();
      setVercelToken(s.vercelToken || '');
      setRenderToken(s.renderToken || '');
      setTheme(s.theme || 'dark');
      setAutoLaunch(!!s.autoLaunch);
      setPollMin(s.pollIntervalMinutes || 5);
    })();
  }, []);

  const saveTokensIfChanged = async () => {
    await window.devdash.settings.update({
      vercelToken: vercelToken.trim(),
      renderToken: renderToken.trim(),
    });
  };

  const testToken = async (provider: 'vercel' | 'render') => {
    await saveTokensIfChanged();
    setTesting(provider);
    try {
      const res = await window.devdash.settings.testToken(provider);
      const setter = provider === 'vercel' ? setVercelStatus : setRenderStatus;
      setter({ ok: res.ok, msg: res.message });
    } finally {
      setTesting(null);
    }
  };

  const pickAndScan = async () => {
    setScanning(true);
    try {
      const res = await window.devdash.projects.scanParent();
      if (res.parent) {
        setScanParent(res.parent);
        setScanResults(res.projects);
        const defaultSel = new Set<string>();
        for (const r of res.projects) if (r.githubUrl || r.deployId) defaultSel.add(r.path);
        setSelected(defaultSel);
      }
    } finally {
      setScanning(false);
    }
  };

  const importSelected = async () => {
    if (selected.size === 0) {
      setStep('preferences');
      return;
    }
    setImporting(true);
    try {
      const picks = scanResults.filter((r) => selected.has(r.path));
      const payload = picks.map((r) => ({
        name: r.name,
        path: r.path,
        githubUrl: r.githubUrl,
        liveUrl: r.liveUrl,
        deployProvider: (r.deployProvider || 'none') as any,
        deployId: r.deployId,
      }));
      const res = await window.devdash.projects.importMany(payload);
      setImportedCount(res.added);
      setStep('preferences');
    } finally {
      setImporting(false);
    }
  };

  const finishWizard = async () => {
    await window.devdash.settings.update({
      theme,
      autoLaunch,
      pollIntervalMinutes: pollMin,
      onboardingComplete: true,
    });
    window.dispatchEvent(new Event('devdash:theme-changed'));
    onComplete();
  };

  const skipAll = async () => {
    await window.devdash.settings.update({ onboardingComplete: true });
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-dash-line bg-dash-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-dash-line px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Welcome to DevDash</h2>
            <p className="text-xs text-dash-mute">Quick setup. Skip any step you want.</p>
          </div>
          <div className="flex items-center gap-3">
            <StepDots current={step} />
            <button
              onClick={skipAll}
              className="text-[11px] text-dash-mute hover:text-dash-text"
            >
              Skip setup
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          {step === 'welcome' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dash-indigo/30 bg-dash-indigo/10 p-4">
                <h3 className="text-base font-semibold text-dash-indigoBright">
                  Solo dev companion for local + cloud projects
                </h3>
                <p className="mt-2 text-sm text-dash-mute">
                  DevDash watches your local repos, deploy status, uptime, and database health in
                  one place. This wizard takes 2 minutes and skips anything you don't need.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <FeatureCard title="Auto-import projects" body="Scan a folder, pick repos to track" />
                <FeatureCard title="Vercel + Render" body="Live deploy status without leaving DevDash" />
                <FeatureCard title="Uptime + DB health" body="Ping production endpoints automatically" />
                <FeatureCard title="Smart notifications" body="Failure alerts that aren't noisy" />
              </div>
            </div>
          )}

          {step === 'tokens' && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-1 text-sm font-semibold">API tokens (optional)</h3>
                <p className="text-xs text-dash-mute">
                  Add your Vercel and Render tokens so DevDash can match your repos to existing
                  deployments and show live deploy status. Leave empty if you don't use them.
                </p>
              </div>

              <TokenField
                label="Vercel token"
                helpUrl="https://vercel.com/account/tokens"
                value={vercelToken}
                onChange={setVercelToken}
                onTest={() => testToken('vercel')}
                testing={testing === 'vercel'}
                status={vercelStatus}
              />

              <TokenField
                label="Render token"
                helpUrl="https://dashboard.render.com/u/settings#api-keys"
                value={renderToken}
                onChange={setRenderToken}
                onTest={() => testToken('render')}
                testing={testing === 'render'}
                status={renderStatus}
              />
            </div>
          )}

          {step === 'scan' && (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1 text-sm font-semibold">Import your projects</h3>
                <p className="text-xs text-dash-mute">
                  Pick a parent folder. DevDash scans every subdirectory for git repos and matches
                  them to your Vercel/Render deployments.
                </p>
              </div>

              {!scanParent && (
                <button
                  onClick={pickAndScan}
                  disabled={scanning}
                  className="rounded-md bg-dash-indigo px-4 py-2 text-sm font-medium text-white hover:bg-dash-indigoBright disabled:opacity-50"
                >
                  {scanning ? 'Scanning...' : 'Pick parent folder'}
                </button>
              )}

              {scanParent && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="truncate font-mono text-[11px] text-dash-mute">
                      {scanParent}
                    </span>
                    <div className="flex gap-3 text-[11px] text-dash-mute">
                      <button
                        onClick={pickAndScan}
                        className="hover:text-dash-text"
                      >
                        Pick another
                      </button>
                      <button
                        onClick={() => setSelected(new Set(scanResults.map((r) => r.path)))}
                        className="hover:text-dash-text"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => setSelected(new Set())}
                        className="hover:text-dash-text"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {scanResults.length === 0 ? (
                      <div className="rounded border border-dash-line p-4 text-sm text-dash-mute">
                        No projects found in this folder.
                      </div>
                    ) : (
                      scanResults.map((r) => {
                        const isSel = selected.has(r.path);
                        return (
                          <label
                            key={r.path}
                            className={`flex cursor-pointer gap-3 rounded border p-2 text-xs ${
                              isSel ? 'border-dash-indigo/60 bg-dash-indigo/10' : 'border-dash-line'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => {
                                const next = new Set(selected);
                                if (next.has(r.path)) next.delete(r.path);
                                else next.add(r.path);
                                setSelected(next);
                              }}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">{r.name}</span>
                                {r.framework && (
                                  <span className="rounded bg-dash-panel2 px-1.5 py-0.5 text-[10px] text-dash-mute">
                                    {r.framework}
                                  </span>
                                )}
                                {r.deployMatchedBy === 'vercel-api' && (
                                  <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-white">
                                    Vercel
                                  </span>
                                )}
                                {r.deployMatchedBy === 'render-api' && (
                                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                                    Render
                                  </span>
                                )}
                              </div>
                              <div className="truncate font-mono text-[10px] text-dash-mute">
                                {r.path}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'preferences' && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-1 text-sm font-semibold">Preferences</h3>
                <p className="text-xs text-dash-mute">
                  Tweakable later in Settings. Sensible defaults below.
                </p>
              </div>

              <div>
                <label className="block text-xs text-dash-mute">Theme</label>
                <div className="mt-1 flex gap-2">
                  {(['dark', 'light', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`rounded border px-3 py-1.5 text-xs capitalize ${
                        theme === t
                          ? 'border-dash-indigo bg-dash-indigo/20 text-dash-indigoBright'
                          : 'border-dash-line hover:bg-white/5'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={autoLaunch}
                  onChange={(e) => setAutoLaunch(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">Auto-launch on startup</div>
                  <div className="text-[11px] text-dash-mute">
                    Start DevDash minimized to system tray when Windows boots.
                  </div>
                </div>
              </label>

              <div>
                <label className="block text-xs text-dash-mute">
                  Deploy poll interval ({pollMin} min)
                </label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={pollMin}
                  onChange={(e) => setPollMin(Number(e.target.value))}
                  className="mt-1 w-full"
                />
                <div className="flex justify-between text-[10px] text-dash-mute">
                  <span>1m (chatty)</span>
                  <span>30m (quiet)</span>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-4xl">✓</div>
              <h3 className="mt-3 text-lg font-semibold">You're set up</h3>
              <p className="mt-2 text-sm text-dash-mute">
                {importedCount > 0
                  ? `${importedCount} project${importedCount === 1 ? '' : 's'} imported. Ready to roll.`
                  : 'Skipped import. Add projects manually anytime from the Projects tab.'}
              </p>
              <p className="mt-4 text-[11px] text-dash-mute">
                Press <kbd className="rounded border border-dash-line px-1 font-mono">Ctrl</kbd>+
                <kbd className="ml-0.5 rounded border border-dash-line px-1 font-mono">K</kbd> to
                jump anywhere, or <kbd className="ml-0.5 rounded border border-dash-line px-1 font-mono">?</kbd>{' '}
                for the shortcut overlay.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-dash-line px-6 py-3">
          <BackButton step={step} setStep={setStep} />
          <NextButton
            step={step}
            setStep={setStep}
            scanning={scanning}
            importing={importing}
            scanResults={scanResults}
            saveTokens={saveTokensIfChanged}
            importSelected={importSelected}
            finishWizard={finishWizard}
          />
        </footer>
      </div>
    </div>
  );
}

function StepDots({ current }: { current: Step }) {
  const order: Step[] = ['welcome', 'tokens', 'scan', 'preferences', 'done'];
  const idx = order.indexOf(current);
  return (
    <div className="flex gap-1">
      {order.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 w-6 rounded-full transition ${
            i <= idx ? 'bg-dash-indigo' : 'bg-dash-line'
          }`}
        />
      ))}
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-dash-line bg-dash-panel/40 p-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-[11px] text-dash-mute">{body}</div>
    </div>
  );
}

function TokenField({
  label,
  helpUrl,
  value,
  onChange,
  onTest,
  testing,
  status,
}: {
  label: string;
  helpUrl: string;
  value: string;
  onChange: (v: string) => void;
  onTest: () => void;
  testing: boolean;
  status: { ok: boolean; msg: string } | null;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium">{label}</label>
        <button
          onClick={() => window.devdash.shell.openExternal(helpUrl)}
          className="text-[11px] text-dash-mute hover:text-dash-indigoBright"
        >
          Get token →
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-dash-line bg-dash-bg px-2 py-1.5 font-mono text-xs"
          placeholder="paste token here"
        />
        <button
          onClick={onTest}
          disabled={!value.trim() || testing}
          className="rounded border border-dash-line px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
      </div>
      {status && (
        <p
          className={`mt-1 text-[11px] ${
            status.ok ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}

function BackButton({ step, setStep }: { step: Step; setStep: (s: Step) => void }) {
  const order: Step[] = ['welcome', 'tokens', 'scan', 'preferences', 'done'];
  const idx = order.indexOf(step);
  if (idx === 0 || step === 'done') return <span />;
  return (
    <button
      onClick={() => setStep(order[idx - 1])}
      className="rounded border border-dash-line px-3 py-1.5 text-xs hover:bg-white/5"
    >
      Back
    </button>
  );
}

function NextButton({
  step,
  setStep,
  scanning,
  importing,
  scanResults,
  saveTokens,
  importSelected,
  finishWizard,
}: {
  step: Step;
  setStep: (s: Step) => void;
  scanning: boolean;
  importing: boolean;
  scanResults: ProjectInspection[];
  saveTokens: () => Promise<void>;
  importSelected: () => Promise<void>;
  finishWizard: () => Promise<void>;
}) {
  if (step === 'welcome') {
    return (
      <button
        onClick={() => setStep('tokens')}
        className="rounded bg-dash-indigo px-4 py-1.5 text-sm text-white hover:bg-dash-indigoBright"
      >
        Get started →
      </button>
    );
  }
  if (step === 'tokens') {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setStep('scan')}
          className="text-xs text-dash-mute hover:text-dash-text"
        >
          Skip
        </button>
        <button
          onClick={async () => {
            await saveTokens();
            setStep('scan');
          }}
          className="rounded bg-dash-indigo px-4 py-1.5 text-sm text-white hover:bg-dash-indigoBright"
        >
          Continue →
        </button>
      </div>
    );
  }
  if (step === 'scan') {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setStep('preferences')}
          className="text-xs text-dash-mute hover:text-dash-text"
        >
          Skip
        </button>
        <button
          onClick={importSelected}
          disabled={scanning || importing}
          className="rounded bg-dash-indigo px-4 py-1.5 text-sm text-white hover:bg-dash-indigoBright disabled:opacity-50"
        >
          {importing ? 'Importing...' : scanResults.length > 0 ? 'Import & continue →' : 'Continue →'}
        </button>
      </div>
    );
  }
  if (step === 'preferences') {
    return (
      <button
        onClick={() => setStep('done')}
        className="rounded bg-dash-indigo px-4 py-1.5 text-sm text-white hover:bg-dash-indigoBright"
      >
        Continue →
      </button>
    );
  }
  return (
    <button
      onClick={finishWizard}
      className="rounded bg-dash-indigo px-4 py-1.5 text-sm text-white hover:bg-dash-indigoBright"
    >
      Open dashboard
    </button>
  );
}
