import fs from 'node:fs';
import path from 'node:path';

export type FrameworkId =
  | 'vite'
  | 'next'
  | 'expo'
  | 'flutter'
  | 'uvicorn'
  | 'fastapi'
  | 'react-native'
  | 'node'
  | 'unknown';

export interface FrameworkInfo {
  id: FrameworkId;
  label: string;
  command: string;
  args: string[];
  port: number | null;
  localUrl: string | null;
  cwd: string;
}

function safeReadJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function firstExisting(dir: string, names: string[]): string | null {
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parsePortFromScript(script: string): number | null {
  const m = script.match(/--?port[=\s]+(\d{2,5})|-p\s+(\d{2,5})/);
  if (m) return Number(m[1] ?? m[2]);
  return null;
}

function parsePortFromViteConfig(dir: string): number | null {
  const p = firstExisting(dir, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']);
  if (!p) return null;
  try {
    const txt = fs.readFileSync(p, 'utf-8');
    const m = txt.match(/port\s*:\s*(\d{2,5})/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export function detectFramework(dir: string): FrameworkInfo {
  const fallback: FrameworkInfo = {
    id: 'unknown',
    label: 'unknown',
    command: 'npm',
    args: ['run', 'dev'],
    port: null,
    localUrl: null,
    cwd: dir,
  };

  if (!fs.existsSync(dir)) return fallback;

  // Flutter
  if (fs.existsSync(path.join(dir, 'pubspec.yaml'))) {
    return {
      id: 'flutter',
      label: 'Flutter',
      command: 'flutter',
      args: ['run', '-d', 'chrome'],
      port: null,
      localUrl: null,
      cwd: dir,
    };
  }

  // Python projects
  const hasPyProject =
    fs.existsSync(path.join(dir, 'pyproject.toml')) ||
    fs.existsSync(path.join(dir, 'requirements.txt'));

  if (hasPyProject) {
    // Check for FastAPI / Uvicorn signals
    try {
      const req = path.join(dir, 'requirements.txt');
      let txt = '';
      if (fs.existsSync(req)) txt = fs.readFileSync(req, 'utf-8');
      const pyproj = path.join(dir, 'pyproject.toml');
      if (fs.existsSync(pyproj)) txt += '\n' + fs.readFileSync(pyproj, 'utf-8');
      if (/fastapi|uvicorn/i.test(txt)) {
        // pick main file heuristic
        const entry = firstExisting(dir, ['main.py', 'app.py', 'server.py']);
        const target = entry ? `${path.basename(entry, '.py')}:app` : 'main:app';
        return {
          id: 'uvicorn',
          label: 'FastAPI/Uvicorn',
          command: 'python',
          args: ['-m', 'uvicorn', target, '--reload', '--port', '8000'],
          port: 8000,
          localUrl: 'http://localhost:8000',
          cwd: dir,
        };
      }
    } catch {
      /* ignore */
    }
  }

  // Node-based
  const pkg = safeReadJson(path.join(dir, 'package.json'));
  if (!pkg) return fallback;
  const scripts: Record<string, string> = pkg.scripts ?? {};
  const deps: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  const devScript = scripts.dev ?? scripts.start ?? null;
  const scriptPort = devScript ? parsePortFromScript(devScript) : null;

  if (deps['expo'] || /expo\s+start/.test(devScript ?? '')) {
    return {
      id: 'expo',
      label: 'Expo',
      command: 'npx',
      args: ['expo', 'start'],
      port: scriptPort ?? 8081,
      localUrl: `http://localhost:${scriptPort ?? 8081}`,
      cwd: dir,
    };
  }

  if (deps['react-native']) {
    return {
      id: 'react-native',
      label: 'React Native',
      command: 'npx',
      args: ['react-native', 'start'],
      port: 8081,
      localUrl: 'http://localhost:8081',
      cwd: dir,
    };
  }

  if (deps['next'] || /next\s+dev/.test(devScript ?? '')) {
    return {
      id: 'next',
      label: 'Next.js',
      command: 'npm',
      args: ['run', 'dev'],
      port: scriptPort ?? 3000,
      localUrl: `http://localhost:${scriptPort ?? 3000}`,
      cwd: dir,
    };
  }

  if (deps['vite'] || /vite/.test(devScript ?? '')) {
    const port = scriptPort ?? parsePortFromViteConfig(dir) ?? 5173;
    return {
      id: 'vite',
      label: 'Vite',
      command: 'npm',
      args: ['run', 'dev'],
      port,
      localUrl: `http://localhost:${port}`,
      cwd: dir,
    };
  }

  if (devScript) {
    return {
      id: 'node',
      label: 'Node',
      command: 'npm',
      args: ['run', devScript === scripts.start && !scripts.dev ? 'start' : 'dev'],
      port: scriptPort,
      localUrl: scriptPort ? `http://localhost:${scriptPort}` : null,
      cwd: dir,
    };
  }

  return fallback;
}
