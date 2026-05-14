import { useState, useEffect, useRef } from 'react';

interface TestResult {
  templateId: string;
  installOk: boolean;
  buildOk: boolean;
  installDurationMs: number;
  buildDurationMs: number;
  totalDurationMs: number;
  error?: string;
}

interface LogEntry {
  templateId: string;
  stream: string;
  line: string;
  ts: number;
}

export default function TemplateTest() {
  const [templates, setTemplates] = useState<Array<{ id: string; label: string; description: string }>>([]);
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());
  const [testing, setTesting] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.devdash.scaffold.templates().then(setTemplates);
  }, []);

  useEffect(() => {
    const unsub = window.devdash.template.onTestLog((e) => {
      setLogs((prev) => [...prev.slice(-500), e]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const runTest = async (templateId: string) => {
    setTesting(templateId);
    setLogs([]);
    setShowLogs(templateId);
    try {
      const result = await window.devdash.template.test(templateId);
      setResults((prev) => new Map(prev).set(templateId, result));
    } finally {
      setTesting(null);
    }
  };

  const runAll = async () => {
    setTestingAll(true);
    setLogs([]);
    setShowLogs('all');
    try {
      const allResults = await window.devdash.template.testAll();
      const map = new Map<string, TestResult>();
      for (const r of allResults) map.set(r.templateId, r);
      setResults(map);
    } finally {
      setTestingAll(false);
    }
  };

  const filteredLogs = showLogs === 'all' ? logs : logs.filter((l) => l.templateId === showLogs);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-dash-text">Template Testing</h3>
        <button
          onClick={runAll}
          disabled={testingAll || !!testing}
          className="rounded bg-dash-indigo/20 px-3 py-1.5 text-xs font-medium text-dash-indigoBright hover:bg-dash-indigo/30 disabled:opacity-50"
        >
          {testingAll ? 'Testing All...' : 'Test All'}
        </button>
      </div>

      <div className="space-y-2">
        {templates.map((tpl) => {
          const result = results.get(tpl.id);
          const isRunning = testing === tpl.id || (testingAll && !result);
          return (
            <div
              key={tpl.id}
              className="flex items-center justify-between rounded-md border border-dash-line bg-dash-panel/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-dash-text">{tpl.label}</div>
                <div className="truncate text-[10px] text-dash-mute">{tpl.id}</div>
              </div>
              <div className="flex items-center gap-2">
                {result && (
                  <div className="flex gap-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        result.installOk
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {result.installOk ? 'Install ✓' : 'Install ✗'}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        result.buildOk
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {result.buildOk ? 'Build ✓' : 'Build ✗'}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] text-dash-mute">
                      {(result.totalDurationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                )}
                {isRunning && (
                  <span className="text-[10px] text-dash-indigoBright animate-pulse">Testing...</span>
                )}
                <button
                  onClick={() => runTest(tpl.id)}
                  disabled={!!testing || testingAll}
                  className="rounded bg-white/5 px-2 py-1 text-[10px] text-dash-mute hover:bg-white/10 hover:text-dash-text disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  onClick={() => setShowLogs(showLogs === tpl.id ? null : tpl.id)}
                  className="rounded bg-white/5 px-2 py-1 text-[10px] text-dash-mute hover:bg-white/10 hover:text-dash-text"
                >
                  Logs
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showLogs && filteredLogs.length > 0 && (
        <div className="rounded-md border border-dash-line bg-black/30 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] text-dash-mute">
              Logs {showLogs !== 'all' ? `(${showLogs})` : '(all)'}
            </span>
            <button
              onClick={() => setShowLogs(null)}
              className="text-[10px] text-dash-mute hover:text-dash-text"
            >
              Close
            </button>
          </div>
          <div ref={logRef} className="max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed">
            {filteredLogs.map((l, i) => (
              <div
                key={i}
                className={
                  l.stream === 'stderr'
                    ? 'text-red-400'
                    : l.stream === 'system'
                    ? 'text-dash-indigoBright'
                    : 'text-dash-mute'
                }
              >
                {l.line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
