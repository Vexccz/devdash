export type DeployProvider = 'vercel' | 'render' | 'none';

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  githubUrl?: string;
  liveUrl?: string;
  deployProvider: DeployProvider;
  deployId?: string;
  sentryDsn?: string;
  sentryOrgSlug?: string;
  sentryProjectSlug?: string;
  logsFolder?: string;
  errorThresholdPerDay?: number;
  tags?: string[];
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

export interface DevServerStatus {
  running: boolean;
  framework: FrameworkInfo | null;
  startedAt: number | null;
  exitCode: number | null;
}

export interface ProjectStatus {
  project: ProjectConfig;
  git: GitInfo;
  framework: FrameworkInfo;
  devserver: DevServerStatus;
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
  uptimeIntervalMinutes: number;
  uptimeEnabled: boolean;
  bundleWatchEnabled: boolean;
  depsCheckEnabled: boolean;
  screenshotsEnabled: boolean;
  screenshotHour: number;
  sentryAuthToken: string;
  idleTimeoutMinutes: number;
  ollamaBaseUrl: string;
  ollamaDefaultModel: string;
  ollamaSystemPrompt: string;
  ollamaTemperature: number;
  ollamaApiKey: string;
  theme: 'dark' | 'light' | 'system';
  onboardingComplete?: boolean;
  githubToken?: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  body?: string;
}

export interface LogLine {
  ts: number;
  stream: 'stdout' | 'stderr' | 'system';
  level: 'info' | 'warn' | 'error';
  line: string;
}

export interface UptimeSummary {
  projectId: string;
  url: string | null;
  latestOk: boolean | null;
  latestStatus: number | null;
  latestCheckedAt: number | null;
  uptimePct24h: number;
  avgLatencyMs: number | null;
  samples: { checkedAt: number; latencyMs: number; ok: number; status: number }[];
}

export interface EnvFileSummary {
  file: string;
  path: string;
  exists: boolean;
  varCount: number;
  missingKeys: string[];
}

export interface EnvEntry {
  key: string;
  value: string;
}

export interface EnvFileDetail {
  file: string;
  path: string;
  exists: boolean;
  entries: EnvEntry[];
}

export interface TimeSummary {
  projectId: string;
  todayMs: number;
  weekMs: number;
  days: { day: string; ms: number }[];
}

export type BumpKind = 'patch' | 'minor' | 'major';

export interface ChangelogCommit {
  hash: string;
  shortHash: string;
  type: string;
  scope?: string;
  breaking: boolean;
  message: string;
  author: string;
  date: string;
}

export interface ChangelogResult {
  fromTag: string | null;
  commits: ChangelogCommit[];
  groups: Record<string, ChangelogCommit[]>;
  suggestedBump: BumpKind;
  markdown: string;
  nextVersion: string | null;
  currentVersion: string | null;
}

export interface ReleaseStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  detail?: string;
}

export interface ReleaseProgress {
  steps: ReleaseStep[];
  currentVersion: string | null;
  nextVersion: string | null;
  finished: boolean;
  releaseUrl?: string;
}

export interface BundleSizeRow {
  id: number;
  projectId: string;
  sizeBytes: number;
  fileCount: number;
  recordedAt: number;
}

export interface BundleSample extends BundleSizeRow {
  deltaBytes: number | null;
  deltaPct: number | null;
  sevenDayAvg: number | null;
  growthPct: number | null;
}

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'major' | 'minor' | 'patch' | 'other';
}

export interface AuditCounts {
  low: number;
  moderate: number;
  high: number;
  critical: number;
  total: number;
}

export interface EngineCheck {
  required: string | null;
  installed: string;
  ok: boolean;
}

export interface DepSummary {
  projectId: string;
  runAt: number;
  packages: OutdatedPackage[];
  majorCount: number;
  minorCount: number;
  patchCount: number;
  audit?: AuditCounts;
  engine?: EngineCheck;
}

export interface SafeUpdateResult {
  ok: boolean;
  error?: string;
  updated?: string[];
  auditFixed?: number;
  buildOk?: boolean;
  buildOutput?: string;
  rolledBack?: boolean;
  steps: string[];
}

export interface EnvSyncCompareItem {
  key: string;
  localValue: string | null;
  remoteValue: string | null;
  status: 'only-local' | 'only-remote' | 'match' | 'differ';
}

export interface EnvSyncCompareResult {
  ok: boolean;
  provider: 'vercel' | 'render' | 'none';
  items: EnvSyncCompareItem[];
  error?: string;
}

export interface EnvSyncPushResult {
  ok: boolean;
  pushed: string[];
  failed: Array<{ key: string; error: string }>;
  error?: string;
}

export type CollabRole = 'admin' | 'maintain' | 'write' | 'triage' | 'pull';

export interface Collaborator {
  login: string;
  id: number;
  avatarUrl: string;
  htmlUrl: string;
  role: CollabRole;
  type: string;
}

export interface PendingInvitation {
  id: number;
  invitee: string;
  inviteeAvatar: string;
  inviter: string;
  permissions: string;
  createdAt: string;
  htmlUrl: string;
}

export interface CollabListResult {
  ok: boolean;
  owner?: string;
  repo?: string;
  collaborators: Collaborator[];
  invitations: PendingInvitation[];
  error?: string;
}

export interface CollabActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface PortEntry {
  port: number;
  pid: number;
  processName: string;
  processPath?: string;
  protocol: 'TCP' | 'UDP';
  localAddress: string;
  state?: string;
  projectId?: string;
  projectName?: string;
  isDevDashManaged?: boolean;
}

export interface PortsResult {
  ok: boolean;
  entries: PortEntry[];
  error?: string;
}

export interface PortKillResult {
  ok: boolean;
  pid: number;
  port?: number;
  processName?: string;
  error?: string;
}

export interface CapacitorInfo {
  ok: boolean;
  isCapacitor: boolean;
  capacitorVersion?: string;
  androidFolder: boolean;
  appId?: string;
  appName?: string;
  webDir?: string;
  buildScript?: string;
  error?: string;
}

export interface JavaInfo {
  ok: boolean;
  installed?: string;
  major?: number;
  javaHome?: string;
  required?: number;
  compatible?: boolean;
  hint?: string;
  error?: string;
}

export interface ApkBuildResult {
  ok: boolean;
  apkPath?: string;
  copiedTo?: string;
  durationMs?: number;
  error?: string;
}

export interface CapacitorLogEvent {
  projectId: string;
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
  ts: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface HeatmapResult {
  days: HeatmapDay[];
  currentStreak: number;
  longestStreak: number;
  totalCommits: number;
}

export interface ScreenshotRow {
  id: number;
  projectId: string;
  filePath: string;
  url: string;
  capturedAt: number;
  width: number | null;
  height: number | null;
}

export interface SchedulerJobStatus {
  name: string;
  lastRunAt: number | null;
  lastError: string | null;
}

export interface ErrorBudget {
  source: string;
  days: { day: string; count: number }[];
}

export type AutomationKind = 'pull' | 'deploy';

export interface AutomationJob {
  id: string;
  projectId: string;
  kind: AutomationKind;
  schedule: string;
  enabled: boolean;
  lastRunAt: number | null;
  lastError: string | null;
  lastResult: string | null;
  createdAt: number;
}

export interface AutomationRun {
  id: number;
  jobId: string;
  projectId: string;
  kind: string;
  runAt: number;
  ok: number;
  message: string | null;
}

export type DbKind = 'mongodb' | 'postgres';

export interface DbTarget {
  id: string;
  projectId: string;
  label: string;
  kind: DbKind;
  url: string;
  createdAt: number;
}

export interface DbHealthResult {
  id: string;
  ok: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
  checkedAt: number;
}

export interface RenderMetricsPoint {
  ts: number;
  cpu: number | null;
  memory: number | null;
}

export interface RenderMetricsResult {
  ok: boolean;
  serviceId: string;
  cpu: RenderMetricsPoint[];
  memory: RenderMetricsPoint[];
  error?: string;
}

export interface ProjectInspection {
  path: string;
  exists: boolean;
  isGitRepo: boolean;
  name: string;
  githubUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  liveUrl?: string;
  deployProvider?: 'vercel' | 'render' | 'none';
  deployId?: string;
  deployMatchedBy?: 'vercel-api' | 'render-api' | 'none';
  framework?: string;
  envHints?: {
    hasEnv: boolean;
    hasEnvExample: boolean;
    missingKeys: number;
  };
  warnings: string[];
}

export interface VercelAnalyticsResult {
  ok: boolean;
  projectId: string;
  totalVisitors: number | null;
  totalPageviews: number | null;
  periodDays: number;
  recent: Array<{ day: string; visitors: number; pageviews: number }>;
  topPaths: Array<{ path: string; visitors: number }>;
  error?: string;
  note?: string;
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
        inspect: (targetPath: string) => Promise<ProjectInspection>;
        scanParent: () => Promise<{ parent: string | null; projects: ProjectInspection[] }>;
        importMany: (inputs: Array<Omit<ProjectConfig, 'id'>>) => Promise<{ added: number; total: number }>;
        openFolder: (path: string) => Promise<{ ok: boolean; error?: string }>;
        openInVSCode: (path: string) => Promise<{ ok: boolean; error?: string }>;
        runDev: (id: string) => Promise<{ ok: boolean; error?: string }>;
        pull: (id: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
        framework: (id: string) => Promise<FrameworkInfo | null>;
        quickCommit: (args: { id: string; message: string; stageAll: boolean; push: boolean }) => Promise<{ ok: boolean; commit?: string; pushed?: boolean; pushError?: string | null; error?: string }>;
        gitStatusShort: (id: string) => Promise<{ ok: boolean; output?: string; lineCount?: number; error?: string }>;
        gitDiff: (id: string, staged: boolean) => Promise<{ ok: boolean; diff?: string; staged?: boolean; error?: string }>;
        prList: (id: string) => Promise<{ ok: boolean; prs?: Array<{ number: number; title: string; author: { login: string }; state: string; isDraft: boolean; mergeable: string; url: string; headRefName: string; updatedAt: string }>; error?: string }>;
      };
      devserver: {
        start: (id: string) => Promise<{ ok: boolean; error?: string; framework?: FrameworkInfo }>;
        stop: (id: string) => Promise<{ ok: boolean; error?: string }>;
        status: (id: string) => Promise<DevServerStatus>;
        statusAll: () => Promise<Record<string, DevServerStatus>>;
        logs: (id: string, limit?: number) => Promise<LogLine[]>;
        onLog: (cb: (p: { projectId: string; line: LogLine }) => void) => () => void;
        onStatus: (cb: (p: { projectId: string; running: boolean; framework?: FrameworkInfo; exitCode?: number | null }) => void) => () => void;
      };
      deploys: {
        list: () => Promise<{ items: DeployItem[]; errors: { projectId: string; error: string }[] }>;
        refresh: () => Promise<{ items: DeployItem[]; errors: { projectId: string; error: string }[] }>;
        trigger: (id: string) => Promise<{ ok: boolean; provider?: string; url?: string; id?: string; error?: string }>;
        createNew: (input: {
          projectId: string;
          provider: 'vercel' | 'render';
          framework?: string;
          buildCommand?: string;
          outputDirectory?: string;
          rootDirectory?: string;
          branch?: string;
          serviceType?: 'web_service' | 'static_site';
          region?: string;
          plan?: 'free' | 'starter' | 'standard';
          envVars?: Array<{ key: string; value: string }>;
        }) => Promise<{
          ok: boolean;
          provider: 'vercel' | 'render';
          deployId?: string;
          deployUrl?: string;
          liveUrl?: string;
          dashboardUrl?: string;
          error?: string;
          details?: string;
        }>;
        onUpdate: (cb: (payload: { items: DeployItem[]; errors: { projectId: string; error: string }[]; manual: boolean }) => void) => () => void;
        onToast: (cb: (payload: { type: 'success' | 'error'; title: string; projectId: string }) => void) => () => void;
      };
      uptime: {
        all: () => Promise<UptimeSummary[]>;
        project: (id: string, hours?: number) => Promise<UptimeSummary>;
        runNow: () => Promise<UptimeSummary[]>;
        errors: (id: string) => Promise<ErrorBudget>;
      };
      env: {
        scan: (id: string) => Promise<EnvFileSummary[]>;
        read: (id: string, file: string) => Promise<EnvFileDetail>;
        write: (id: string, file: string, entries: EnvEntry[]) => Promise<{ ok: boolean; error?: string; path?: string }>;
        clone: (sourceId: string, sourceFile: string, targetId: string, targetFile: string, overwrite?: boolean) =>
          Promise<{ ok: boolean; error?: string; mergedCount?: number }>;
        files: () => Promise<string[]>;
        syncCompare: (id: string) => Promise<EnvSyncCompareResult>;
        syncPush: (id: string, keys: string[]) => Promise<EnvSyncPushResult>;
      };
      backup: {
        export: (opts?: { includeCache?: boolean }) => Promise<{ ok: boolean; path?: string; bytes?: number; error?: string }>;
        import: (opts?: { restoreCache?: boolean }) => Promise<{ ok: boolean; projectsRestored?: number; hadCache?: boolean; error?: string }>;
      };
      collab: {
        list: (projectId: string) => Promise<CollabListResult>;
        invite: (projectId: string, username: string, permission: CollabRole) => Promise<CollabActionResult>;
        remove: (projectId: string, username: string) => Promise<CollabActionResult>;
        cancelInvite: (projectId: string, invitationId: number) => Promise<CollabActionResult>;
        checkToken: () => Promise<{ ok: boolean; scopes?: string[]; login?: string; error?: string }>;
      };
      ports: {
        list: () => Promise<PortsResult>;
        kill: (pid: number) => Promise<PortKillResult>;
        killByProject: (projectId: string) => Promise<PortKillResult>;
      };
      capacitor: {
        detect: (projectId: string) => Promise<CapacitorInfo>;
        detectJava: (capVersion?: string) => Promise<JavaInfo>;
        isBuilding: (projectId: string) => Promise<boolean>;
        buildApk: (args: { id: string; flavor: 'debug' | 'release'; runWebBuild: boolean; runSync: boolean; outputToDownloads?: boolean }) => Promise<ApkBuildResult>;
        openApkFolder: (apkPath: string) => Promise<{ ok: boolean; error?: string }>;
        onLog: (cb: (e: CapacitorLogEvent) => void) => () => void;
      };
      scaffold: {
        templates: () => Promise<Array<{ id: string; label: string; description: string }>>;
        pickParent: () => Promise<{ ok: boolean; path?: string }>;
        run: (opts: { projectName: string; targetParentDir: string; template: string; displayName: string; useStripe: boolean; install: boolean; gitInit: boolean }) => Promise<{ ok: boolean; targetDir?: string; error?: string }>;
        isActive: () => Promise<boolean>;
        onLog: (cb: (e: { stream: string; line: string; ts: number }) => void) => () => void;
      };
      time: {
        enter: (id: string) => Promise<{ projectId: string; startedAt: number }>;
        leave: (id: string) => Promise<{ stopped: boolean }>;
        touch: (id: string) => Promise<void>;
        summary: (id?: string | null, days?: number) => Promise<TimeSummary[]>;
        active: () => Promise<{ projectId: string; startedAt: number } | null>;
      };
      changelog: {
        generate: (id: string) => Promise<ChangelogResult | { error: string }>;
        write: (id: string, markdown: string) => Promise<{ ok: boolean; error?: string; path?: string }>;
      };
      release: {
        start: (id: string, opts: {
          bump: BumpKind;
          writeChangelog: boolean;
          releaseNotes: string;
          pushTags: boolean;
          createGithubRelease: boolean;
        }) => Promise<ReleaseProgress | { error: string }>;
        onProgress: (cb: (payload: ReleaseProgress) => void) => () => void;
      };
      bundle: {
        history: (id: string) => Promise<BundleSizeRow[]>;
        checkNow: (id: string) => Promise<BundleSample | null>;
      };
      deps: {
        runNow: (id: string) => Promise<DepSummary | null>;
        latest: (id: string) => Promise<DepSummary | null>;
        safeUpdate: (id: string) => Promise<SafeUpdateResult>;
      };
      heatmap: {
        build: (id: string) => Promise<HeatmapResult | null>;
      };
      screenshots: {
        list: (id: string) => Promise<ScreenshotRow[]>;
        captureNow: (id: string) => Promise<{ ok: boolean; error?: string; row?: ScreenshotRow }>;
        remove: (shotId: number) => Promise<boolean>;
        removeOlderThan: (id: string, days: number) => Promise<number>;
      };
      scheduler: {
        status: () => Promise<SchedulerJobStatus[]>;
        runNow: (name: string) => Promise<{ ok: boolean }>;
      };
      settings: {
        get: () => Promise<AppSettings>;
        update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
        testToken: (provider: 'vercel' | 'render') => Promise<{ ok: boolean; message: string }>;
      };
      app: {
        version: () => Promise<string>;
        configPath: () => Promise<string>;
        openLogs: () => Promise<string>;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
        openPath: (p: string) => Promise<{ ok: boolean; error?: string }>;
        readFileAsDataUrl: (p: string) => Promise<string | null>;
      };
      window: {
        minimize: () => Promise<void>;
        maximizeToggle: () => Promise<void>;
        close: () => Promise<void>;
      };
      ollama: {
        listModels: () => Promise<{ ok: boolean; models?: Array<{ name: string; size: number; modified_at: string }>; error?: string }>;
        chat: (args: {
          streamId: string;
          chatId: string;
          model: string;
          messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
          temperature?: number;
          systemPrompt?: string;
        }) => Promise<{ ok: boolean; content?: string; error?: string }>;
        stop: (streamId: string) => Promise<{ ok: boolean; error?: string }>;
        onChunk: (cb: (payload: { streamId: string; chunk: string }) => void) => () => void;
        onDone: (cb: (payload: { streamId: string; content: string }) => void) => () => void;
        onError: (cb: (payload: { streamId: string; error: string }) => void) => () => void;
      };
      chats: {
        list: () => Promise<Array<{ id: string; title: string; model: string | null; systemPrompt: string | null; createdAt: number; updatedAt: number }>>;
        create: (args: { id: string; title: string; model: string; systemPrompt: string }) =>
          Promise<{ id: string; title: string; model: string | null; systemPrompt: string | null; createdAt: number; updatedAt: number } | null>;
        update: (id: string, patch: { title?: string; model?: string; systemPrompt?: string }) =>
          Promise<{ id: string; title: string; model: string | null; systemPrompt: string | null; createdAt: number; updatedAt: number } | null>;
        delete: (id: string) => Promise<{ ok: boolean }>;
        messages: (chatId: string) =>
          Promise<Array<{ id: number; chatId: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: number }>>;
        addMessage: (args: { chatId: string; role: 'user' | 'assistant' | 'system'; content: string }) =>
          Promise<{ id: number }>;
      };
      config: {
        export: (passphrase: string) => Promise<{ ok: boolean; error?: string }>;
        import: (passphrase: string) => Promise<{ ok: boolean; error?: string }>;
      };
      automations: {
        list: () => Promise<AutomationJob[]>;
        save: (input: Omit<AutomationJob, 'id' | 'lastRunAt' | 'lastError' | 'lastResult' | 'createdAt'> & { id?: string }) => Promise<AutomationJob>;
        delete: (id: string) => Promise<{ ok: boolean }>;
        toggle: (id: string, enabled: boolean) => Promise<AutomationJob | null>;
        runNow: (id: string) => Promise<{ ok: boolean; message?: string }>;
        runs: (jobId: string, limit?: number) => Promise<AutomationRun[]>;
        validateCron: (expr: string) => Promise<{ valid: boolean; error?: string }>;
        onRun: (cb: (payload: { jobId: string; ok: boolean; message: string }) => void) => () => void;
      };
      dbhealth: {
        list: () => Promise<DbTarget[]>;
        save: (input: Omit<DbTarget, 'id' | 'createdAt'> & { id?: string }) => Promise<DbTarget>;
        delete: (id: string) => Promise<{ ok: boolean }>;
        ping: (id: string) => Promise<DbHealthResult>;
        pingProject: (projectId: string) => Promise<DbHealthResult[]>;
        autoDetect: (projectId: string) => Promise<{ added: DbTarget[]; skipped: Array<{ key: string; reason: string }>; scanned: string[] }>;
      };
      metrics: {
        render: (projectId: string, hours?: number) => Promise<RenderMetricsResult>;
      };
      analytics: {
        vercel: (projectId: string, days?: number) => Promise<VercelAnalyticsResult>;
      };
    };
  }
}

export {};
