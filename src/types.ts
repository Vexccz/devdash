export type DeployProvider = 'vercel' | 'render' | 'none';

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  githubUrl?: string;
  liveUrl?: string;
  deployProvider: DeployProvider;
  deployId?: string;
}

export interface GitInfo {
  ok: boolean;
  path: string;
  branch?: string;
  ahead?: number;
  behind?: number;
  dirty?: boolean;
  modifiedCount?: number;
  stagedCount?: number;
  untrackedCount?: number;
  lastCommit?: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
  };
  devPort?: number | null;
  devScript?: string | null;
  error?: string;
}

export interface ProjectStatus {
  project: ProjectConfig;
  git: GitInfo;
}

export type DeployStatus = 'queued' | 'building' | 'ready' | 'error' | 'canceled' | 'unknown';

export interface DeployItem {
  projectId: string;
  projectName: string;
  provider: 'vercel' | 'render';
  id: string;
  status: DeployStatus;
  rawStatus: string;
  target: 'production' | 'preview' | 'unknown';
  createdAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  url?: string;
  dashboardUrl?: string;
  updatedAt?: number;
}

export interface AppSettings {
  vercelToken: string;
  renderToken: string;
  pollIntervalMinutes: number;
  darkMode: boolean;
  autoLaunch: boolean;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  body?: string;
}

declare global {
  interface Window {
    devdash: {
      projects: {
        list: () => Promise<ProjectConfig[]>;
        status: (id: string, fetchRemote?: boolean) => Promise<ProjectStatus | { error: string }>;
        statusAll: (fetchRemote?: boolean) => Promise<ProjectStatus[]>;
        add: (input: Omit<ProjectConfig, 'id'>) => Promise<ProjectConfig[]>;
        update: (id: string, patch: Partial<ProjectConfig>) => Promise<ProjectConfig[]>;
        remove: (id: string) => Promise<ProjectConfig[]>;
        pickFolder: () => Promise<string | null>;
        openFolder: (path: string) => Promise<{ ok: boolean; error?: string }>;
        openInVSCode: (path: string) => Promise<{ ok: boolean; error?: string }>;
        runDev: (id: string) => Promise<{ ok: boolean; error?: string }>;
        pull: (id: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
      };
      deploys: {
        list: () => Promise<{ items: DeployItem[]; errors: { projectId: string; error: string }[] }>;
        refresh: () => Promise<{ items: DeployItem[]; errors: { projectId: string; error: string }[] }>;
        onUpdate: (cb: (payload: { items: DeployItem[]; errors: { projectId: string; error: string }[]; manual: boolean }) => void) => () => void;
        onToast: (cb: (payload: { type: 'success' | 'error'; title: string; projectId: string }) => void) => () => void;
      };
      settings: {
        get: () => Promise<AppSettings>;
        update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      };
      app: {
        version: () => Promise<string>;
        configPath: () => Promise<string>;
        openLogs: () => Promise<string>;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      window: {
        minimize: () => Promise<void>;
        maximizeToggle: () => Promise<void>;
        close: () => Promise<void>;
      };
    };
  }
}

export {};
