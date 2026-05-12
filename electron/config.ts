import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

export type DeployProvider = 'vercel' | 'render' | 'none';

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  githubUrl?: string;
  liveUrl?: string;
  deployProvider: DeployProvider;
  /** Vercel projectId or Render serviceId depending on provider */
  deployId?: string;
  sentryDsn?: string;
  sentryOrgSlug?: string;
  sentryProjectSlug?: string;
  logsFolder?: string;
  errorThresholdPerDay?: number;
}

export interface AppConfig {
  projects: ProjectConfig[];
  settings: {
    vercelToken: string;
    renderToken: string;
    pollIntervalMinutes: number;
    darkMode: boolean;
    autoLaunch: boolean;
    uptimeIntervalMinutes: number;
    uptimeEnabled: boolean;
    bundleWatchEnabled: boolean;
    depsCheckEnabled: boolean;
    screenshotsEnabled: boolean;
    screenshotHour: number;
    sentryAuthToken: string;
    idleTimeoutMinutes: number;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  projects: [],
  settings: {
    vercelToken: '',
    renderToken: '',
    pollIntervalMinutes: 5,
    darkMode: true,
    autoLaunch: false,
    uptimeIntervalMinutes: 5,
    uptimeEnabled: true,
    bundleWatchEnabled: true,
    depsCheckEnabled: true,
    screenshotsEnabled: false,
    screenshotHour: 9,
    sentryAuthToken: '',
    idleTimeoutMinutes: 2,
  },
};

const SEED_PROJECTS: ProjectConfig[] = [
  {
    id: 'fyp',
    name: 'FYP: Malaysia News Sentiment',
    path: 'C:\\Users\\zafra\\.gemini\\antigravity\\scratch\\malaysia-news-sentiment',
    githubUrl: 'https://github.com/Vexccz/malaysia-news-sentiment',
    liveUrl: 'https://malaysia-news-sentiment.vercel.app',
    deployProvider: 'vercel',
  },
  {
    id: 'scoreku',
    name: 'ScoreKu',
    path: 'C:\\Users\\zafra\\scoreku',
    githubUrl: 'https://github.com/Vexccz/scoreku',
    liveUrl: 'https://frontend-kappa-six-83.vercel.app',
    deployProvider: 'vercel',
  },
  {
    id: 'statusmy',
    name: 'StatusMy',
    path: 'C:\\Users\\zafra\\statusmy',
    githubUrl: 'https://github.com/Vexccz/statusmy',
    deployProvider: 'none',
  },
  {
    id: 'ai-research-engine',
    name: 'AI Research Engine',
    path: 'C:\\Users\\zafra\\ai-research-engine',
    githubUrl: 'https://github.com/Vexccz/ai-research-engine',
    liveUrl: 'https://ai-research-engine-wine.vercel.app',
    deployProvider: 'vercel',
  },
  {
    id: 'expense-tracker',
    name: 'ExpenseTracker',
    path: 'C:\\Users\\zafra\\expense-tracker',
    deployProvider: 'none',
  },
];

function configDir(): string {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function configPath(): string {
  return path.join(configDir(), 'config.json');
}

export function cacheDbPath(): string {
  return path.join(configDir(), 'cache.db');
}

export function logsPath(): string {
  return path.join(configDir(), 'logs');
}

export function screenshotsDir(): string {
  const dir = path.join(configDir(), 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const p = configPath();
  if (!fs.existsSync(p)) {
    const seeded: AppConfig = {
      ...DEFAULT_CONFIG,
      projects: SEED_PROJECTS.map((pr) => ({ ...pr })),
    };
    saveConfig(seeded);
    cached = seeded;
    return seeded;
  }
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const merged: AppConfig = {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      settings: { ...DEFAULT_CONFIG.settings, ...(parsed.settings ?? {}) },
    };
    cached = merged;
    return merged;
  } catch (err) {
    console.error('loadConfig failed, using defaults:', err);
    cached = { ...DEFAULT_CONFIG };
    return cached;
  }
}

export function saveConfig(cfg: AppConfig): AppConfig {
  cached = cfg;
  const p = configPath();
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8');
  return cfg;
}

export function addProject(input: Omit<ProjectConfig, 'id'> & { id?: string }): AppConfig {
  const cfg = loadConfig();
  const id =
    input.id ??
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  cfg.projects.push({ ...input, id });
  return saveConfig(cfg);
}

export function updateProject(id: string, patch: Partial<ProjectConfig>): AppConfig {
  const cfg = loadConfig();
  cfg.projects = cfg.projects.map((p) => (p.id === id ? { ...p, ...patch, id: p.id } : p));
  return saveConfig(cfg);
}

export function removeProject(id: string): AppConfig {
  const cfg = loadConfig();
  cfg.projects = cfg.projects.filter((p) => p.id !== id);
  return saveConfig(cfg);
}

export function updateSettings(patch: Partial<AppConfig['settings']>): AppConfig {
  const cfg = loadConfig();
  cfg.settings = { ...cfg.settings, ...patch };
  return saveConfig(cfg);
}
