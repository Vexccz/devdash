import { loadConfig, saveConfig, updateSettings } from './config';
import type { AppConfig, ProjectConfig } from './config';

export interface SyncStatus {
  enabled: boolean;
  lastSynced: string | null;
  status: 'idle' | 'syncing' | 'error' | 'offline';
  error?: string;
}

interface SyncPayload {
  projects: Array<Omit<ProjectConfig, 'path'>>;
  settings: Partial<AppConfig['settings']>;
  updatedAt: string;
}

let syncStatus: SyncStatus = {
  enabled: false,
  lastSynced: null,
  status: 'idle',
};

let debounceTimer: NodeJS.Timeout | null = null;

function getSupabaseConfig(): { url: string; key: string } | null {
  const cfg = loadConfig();
  const url = (cfg.settings as any).supabaseUrl;
  const key = (cfg.settings as any).supabaseAnonKey;
  if (!url || !key) return null;
  return { url, key };
}

function buildHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': 'return=minimal',
  };
}

export function getStatus(): SyncStatus {
  return { ...syncStatus };
}

export function configure(supabaseUrl: string, supabaseAnonKey: string, enabled: boolean): SyncStatus {
  updateSettings({ supabaseUrl, supabaseAnonKey, syncEnabled: enabled } as any);
  syncStatus.enabled = enabled;
  if (!enabled) {
    syncStatus.status = 'idle';
  }
  return getStatus();
}

export async function push(): Promise<{ ok: boolean; error?: string }> {
  const supa = getSupabaseConfig();
  if (!supa) return { ok: false, error: 'Supabase not configured' };

  const cfg = loadConfig();
  if (!(cfg.settings as any).syncEnabled) return { ok: false, error: 'Sync disabled' };

  syncStatus.status = 'syncing';

  // Build payload — exclude sensitive tokens
  const payload: SyncPayload = {
    projects: cfg.projects.map((p) => {
      const { path: _path, ...rest } = p;
      return rest;
    }),
    settings: {
      pollIntervalMinutes: cfg.settings.pollIntervalMinutes,
      darkMode: cfg.settings.darkMode,
      autoLaunch: cfg.settings.autoLaunch,
      uptimeIntervalMinutes: cfg.settings.uptimeIntervalMinutes,
      uptimeEnabled: cfg.settings.uptimeEnabled,
      bundleWatchEnabled: cfg.settings.bundleWatchEnabled,
      depsCheckEnabled: cfg.settings.depsCheckEnabled,
      screenshotsEnabled: cfg.settings.screenshotsEnabled,
      screenshotHour: cfg.settings.screenshotHour,
      idleTimeoutMinutes: cfg.settings.idleTimeoutMinutes,
      ollamaBaseUrl: cfg.settings.ollamaBaseUrl,
      ollamaDefaultModel: cfg.settings.ollamaDefaultModel,
      ollamaSystemPrompt: cfg.settings.ollamaSystemPrompt,
      ollamaTemperature: cfg.settings.ollamaTemperature,
      theme: cfg.settings.theme,
    },
    updatedAt: new Date().toISOString(),
  };

  try {
    // Upsert to a 'devdash_sync' table with id='default'
    const res = await fetch(`${supa.url}/rest/v1/devdash_sync?id=eq.default`, {
      method: 'PUT',
      headers: {
        ...buildHeaders(supa.key),
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        id: 'default',
        payload: JSON.stringify(payload),
        updated_at: payload.updatedAt,
      }),
    });

    if (!res.ok) {
      // Try POST if PUT fails (row doesn't exist)
      const postRes = await fetch(`${supa.url}/rest/v1/devdash_sync`, {
        method: 'POST',
        headers: {
          ...buildHeaders(supa.key),
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: 'default',
          payload: JSON.stringify(payload),
          updated_at: payload.updatedAt,
        }),
      });
      if (!postRes.ok) {
        const errText = await postRes.text().catch(() => '');
        syncStatus.status = 'error';
        syncStatus.error = `Push failed: ${postRes.status} ${errText.slice(0, 100)}`;
        return { ok: false, error: syncStatus.error };
      }
    }

    syncStatus.status = 'idle';
    syncStatus.lastSynced = new Date().toISOString();
    syncStatus.error = undefined;
    return { ok: true };
  } catch (err: any) {
    syncStatus.status = 'error';
    syncStatus.error = err?.message || 'Network error';
    return { ok: false, error: syncStatus.error };
  }
}

export async function pull(): Promise<{ ok: boolean; merged?: boolean; error?: string }> {
  const supa = getSupabaseConfig();
  if (!supa) return { ok: false, error: 'Supabase not configured' };

  const cfg = loadConfig();
  if (!(cfg.settings as any).syncEnabled) return { ok: false, error: 'Sync disabled' };

  syncStatus.status = 'syncing';

  try {
    const res = await fetch(`${supa.url}/rest/v1/devdash_sync?id=eq.default&select=payload,updated_at`, {
      method: 'GET',
      headers: buildHeaders(supa.key),
    });

    if (!res.ok) {
      syncStatus.status = 'error';
      syncStatus.error = `Pull failed: ${res.status}`;
      return { ok: false, error: syncStatus.error };
    }

    const rows = await res.json() as Array<{ payload: string; updated_at: string }>;
    if (!rows || rows.length === 0) {
      syncStatus.status = 'idle';
      return { ok: true, merged: false };
    }

    const remote: SyncPayload = JSON.parse(rows[0].payload);
    const remoteTime = new Date(remote.updatedAt).getTime();
    const localTime = syncStatus.lastSynced ? new Date(syncStatus.lastSynced).getTime() : 0;

    // Last-write-wins: only apply if remote is newer
    if (remoteTime <= localTime) {
      syncStatus.status = 'idle';
      return { ok: true, merged: false };
    }

    // Merge settings (non-token fields only)
    const currentCfg = loadConfig();
    if (remote.settings) {
      const safePatch: any = { ...remote.settings };
      // Never overwrite tokens from remote
      delete safePatch.vercelToken;
      delete safePatch.renderToken;
      delete safePatch.githubToken;
      delete safePatch.sentryAuthToken;
      delete safePatch.ollamaApiKey;
      delete safePatch.supabaseAnonKey;
      currentCfg.settings = { ...currentCfg.settings, ...safePatch };
    }

    // Merge projects: add remote projects that don't exist locally (by id)
    if (remote.projects) {
      const existingIds = new Set(currentCfg.projects.map((p) => p.id));
      for (const rp of remote.projects) {
        if (!existingIds.has(rp.id)) {
          // Remote project without path — set empty path
          currentCfg.projects.push({ ...rp, path: '' } as ProjectConfig);
        }
      }
    }

    saveConfig(currentCfg);
    syncStatus.status = 'idle';
    syncStatus.lastSynced = new Date().toISOString();
    syncStatus.error = undefined;
    return { ok: true, merged: true };
  } catch (err: any) {
    syncStatus.status = 'error';
    syncStatus.error = err?.message || 'Network error';
    return { ok: false, error: syncStatus.error };
  }
}

export function schedulePush() {
  if (!syncStatus.enabled) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void push();
  }, 5000);
}

export function initSync() {
  const cfg = loadConfig();
  syncStatus.enabled = !!(cfg.settings as any).syncEnabled;
}
