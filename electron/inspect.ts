import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { loadConfig } from './config';
import type { DeployProvider } from './config';

export interface ProjectInspection {
  path: string;
  exists: boolean;
  isGitRepo: boolean;
  name: string;
  githubUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  liveUrl?: string;
  deployProvider?: DeployProvider;
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

function readPackageName(dir: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
    return pkg.name || null;
  } catch {
    return null;
  }
}

function readGitRemoteUrl(dir: string): string | null {
  const configPath = path.join(dir, '.git', 'config');
  if (!fs.existsSync(configPath)) return null;
  try {
    const txt = fs.readFileSync(configPath, 'utf-8');
    // Match [remote "origin"] block followed by url =
    const m = txt.match(/\[remote\s+"origin"\]\s*\n(?:.*\n)*?\s*url\s*=\s*(.+)/);
    if (!m) return null;
    return m[1].trim();
  } catch {
    return null;
  }
}

function normalizeGithubUrl(raw: string): {
  githubUrl?: string;
  owner?: string;
  repo?: string;
} {
  if (!raw) return {};
  let url = raw.trim();

  // git@github.com:Owner/Repo.git → https://github.com/Owner/Repo
  const sshMatch = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      githubUrl: `https://github.com/${sshMatch[1]}/${sshMatch[2]}`,
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  // https://github.com/Owner/Repo(.git)
  const httpsMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?(?:\/|$)/i);
  if (httpsMatch) {
    return {
      githubUrl: `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`,
      owner: httpsMatch[1],
      repo: httpsMatch[2],
    };
  }

  return {};
}

async function findVercelProjectByGithub(
  token: string,
  owner: string,
  repo: string
): Promise<{ id: string; url?: string } | null> {
  try {
    // Vercel projects API returns projects with `link` pointing to GitHub
    const res = await axios.get('https://api.vercel.com/v10/projects', {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 100 },
      timeout: 10000,
    });
    const projects = res.data?.projects || [];
    const match = projects.find((p: any) => {
      const link = p.link;
      if (!link) return false;
      const type = link.type || '';
      if (type.toLowerCase() !== 'github') return false;
      const linkOwner = (link.org || link.owner || '').toLowerCase();
      const linkRepo = (link.repo || '').toLowerCase();
      return linkOwner === owner.toLowerCase() && linkRepo === repo.toLowerCase();
    });
    if (!match) return null;
    // Prefer production alias if present
    let liveUrl: string | undefined;
    const alias = match.alias?.[0]?.domain || match.targets?.production?.alias?.[0];
    if (alias) liveUrl = `https://${alias}`;
    return { id: match.id, url: liveUrl };
  } catch {
    return null;
  }
}

async function findRenderServiceByGithub(
  token: string,
  owner: string,
  repo: string
): Promise<{ id: string; url?: string } | null> {
  try {
    const res = await axios.get('https://api.render.com/v1/services', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      params: { limit: 100 },
      timeout: 10000,
    });
    const wrapper = res.data || [];
    const items: any[] = Array.isArray(wrapper) ? wrapper : [];
    const match = items.find((entry) => {
      const svc = entry.service || entry;
      const repoUrl = (svc.repo || svc.repoUrl || '').toLowerCase();
      return (
        repoUrl.includes(`github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`) ||
        repoUrl.includes(`${owner.toLowerCase()}/${repo.toLowerCase()}`)
      );
    });
    if (!match) return null;
    const svc = match.service || match;
    const liveUrl = svc.serviceDetails?.url || undefined;
    return { id: svc.id, url: liveUrl };
  } catch {
    return null;
  }
}

function detectFrameworkLabel(dir: string): string | undefined {
  if (fs.existsSync(path.join(dir, 'pubspec.yaml'))) return 'Flutter';
  if (fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'Python';
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.next) return 'Next.js';
      if (deps.expo) return 'Expo';
      if (deps.vite) return 'Vite';
      if (deps['react-native']) return 'React Native';
      if (deps.electron) return 'Electron';
      if (deps.react) return 'React';
      return 'Node';
    } catch {
      return 'Node';
    }
  }
  // Subfolder scan
  for (const sub of ['frontend', 'web', 'client', 'backend', 'server']) {
    if (fs.existsSync(path.join(dir, sub, 'package.json'))) {
      return `Monorepo (has ${sub}/)`;
    }
  }
  return undefined;
}

function checkEnvHints(dir: string): ProjectInspection['envHints'] {
  const candidates = ['.env', '.env.local', '.env.production'];
  let hasEnv = false;
  for (const c of candidates) {
    if (fs.existsSync(path.join(dir, c))) {
      hasEnv = true;
      break;
    }
  }
  // Subfolder scan
  if (!hasEnv) {
    for (const sub of ['backend', 'server', 'api', 'frontend']) {
      for (const c of candidates) {
        if (fs.existsSync(path.join(dir, sub, c))) {
          hasEnv = true;
          break;
        }
      }
      if (hasEnv) break;
    }
  }

  const examplePath = path.join(dir, '.env.example');
  const hasEnvExample = fs.existsSync(examplePath);
  let missingKeys = 0;
  if (hasEnvExample) {
    try {
      const exampleKeys = new Set<string>();
      const exampleTxt = fs.readFileSync(examplePath, 'utf-8');
      for (const line of exampleTxt.split(/\r?\n/)) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (m) exampleKeys.add(m[1]);
      }
      const envPath = path.join(dir, '.env');
      if (fs.existsSync(envPath)) {
        const envTxt = fs.readFileSync(envPath, 'utf-8');
        const haveKeys = new Set<string>();
        for (const line of envTxt.split(/\r?\n/)) {
          const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
          if (m) haveKeys.add(m[1]);
        }
        for (const k of exampleKeys) if (!haveKeys.has(k)) missingKeys++;
      } else {
        missingKeys = exampleKeys.size;
      }
    } catch {
      /* ignore */
    }
  }

  return { hasEnv, hasEnvExample, missingKeys };
}

export async function inspectPath(targetPath: string): Promise<ProjectInspection> {
  const out: ProjectInspection = {
    path: targetPath,
    exists: false,
    isGitRepo: false,
    name: path.basename(targetPath),
    deployProvider: 'none',
    warnings: [],
  };

  if (!fs.existsSync(targetPath)) {
    out.warnings.push('Folder not found');
    return out;
  }
  out.exists = true;
  out.isGitRepo = fs.existsSync(path.join(targetPath, '.git'));

  // Name: prefer package.json name, fall back to folder name
  const pkgName = readPackageName(targetPath);
  if (pkgName) out.name = pkgName;

  // GitHub URL from git remote
  if (out.isGitRepo) {
    const remoteUrl = readGitRemoteUrl(targetPath);
    if (remoteUrl) {
      const parsed = normalizeGithubUrl(remoteUrl);
      if (parsed.githubUrl) {
        out.githubUrl = parsed.githubUrl;
        out.githubOwner = parsed.owner;
        out.githubRepo = parsed.repo;
      } else {
        out.warnings.push(`Non-GitHub remote: ${remoteUrl.slice(0, 80)}`);
      }
    }
  } else {
    out.warnings.push('Not a git repository');
  }

  out.framework = detectFrameworkLabel(targetPath);
  out.envHints = checkEnvHints(targetPath);

  // Try to match against Vercel/Render projects
  const cfg = loadConfig();
  if (out.githubOwner && out.githubRepo) {
    const { vercelToken, renderToken } = cfg.settings;
    if (vercelToken?.trim()) {
      const hit = await findVercelProjectByGithub(
        vercelToken.trim(),
        out.githubOwner,
        out.githubRepo
      );
      if (hit) {
        out.deployProvider = 'vercel';
        out.deployId = hit.id;
        out.liveUrl = hit.url;
        out.deployMatchedBy = 'vercel-api';
      }
    }
    if (!out.deployId && renderToken?.trim()) {
      const hit = await findRenderServiceByGithub(
        renderToken.trim(),
        out.githubOwner,
        out.githubRepo
      );
      if (hit) {
        out.deployProvider = 'render';
        out.deployId = hit.id;
        out.liveUrl = hit.url;
        out.deployMatchedBy = 'render-api';
      }
    }
  }

  return out;
}

/**
 * Scan a parent directory and return inspections for every git repo found
 * (1 level deep). Useful for "import all projects" flow.
 */
export async function scanParentFolder(parentPath: string): Promise<ProjectInspection[]> {
  const out: ProjectInspection[] = [];
  if (!fs.existsSync(parentPath)) return out;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(parentPath, { withFileTypes: true });
  } catch {
    return out;
  }

  const dirs = entries.filter((e) => e.isDirectory()).map((e) => path.join(parentPath, e.name));

  // Only dive into folders that look like projects
  const candidates = dirs.filter((d) => {
    return (
      fs.existsSync(path.join(d, '.git')) ||
      fs.existsSync(path.join(d, 'package.json')) ||
      fs.existsSync(path.join(d, 'pubspec.yaml')) ||
      fs.existsSync(path.join(d, 'pyproject.toml'))
    );
  });

  // Parallel inspect with concurrency cap
  const CONCURRENT = 4;
  for (let i = 0; i < candidates.length; i += CONCURRENT) {
    const batch = candidates.slice(i, i + CONCURRENT).map((d) => inspectPath(d));
    const results = await Promise.all(batch);
    out.push(...results);
  }

  return out;
}
