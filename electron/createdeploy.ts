import axios from 'axios';
import { loadConfig, updateProject } from './config';

export type CreateProvider = 'vercel' | 'render';

export interface CreateDeploymentInput {
  projectId: string;
  provider: CreateProvider;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  rootDirectory?: string;
  branch?: string;
  // Render-specific
  serviceType?: 'web_service' | 'static_site';
  region?: string;
  plan?: 'free' | 'starter' | 'standard';
  envVars?: Array<{ key: string; value: string }>;
}

export interface CreateDeploymentResult {
  ok: boolean;
  provider: CreateProvider;
  deployId?: string;
  deployUrl?: string;
  liveUrl?: string;
  dashboardUrl?: string;
  error?: string;
  details?: string;
}

const VERCEL_FRAMEWORK_MAP: Record<string, string> = {
  vite: 'vite',
  next: 'nextjs',
  expo: 'create-react-app',
  'react-native': 'create-react-app',
  electron: 'vite',
  flutter: 'create-react-app', // approx
  uvicorn: 'other',
  fastapi: 'other',
  node: 'other',
  unknown: 'other',
};

function deriveBuildDefaults(framework?: string, isMonorepoSubpath?: boolean): {
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
} {
  const fw = (framework || '').toLowerCase();
  if (fw.includes('next')) {
    return { buildCommand: 'npm run build', outputDirectory: '.next' };
  }
  if (fw.includes('vite') || fw.includes('react') || fw.includes('electron')) {
    return { buildCommand: 'npm run build', outputDirectory: 'dist' };
  }
  if (fw.includes('flutter')) {
    return {
      buildCommand: 'flutter build web --release',
      outputDirectory: 'build/web',
      installCommand: 'flutter pub get',
    };
  }
  return { buildCommand: 'npm run build', outputDirectory: 'dist' };
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  const m = url.match(/github\.com[:/]+([^/]+)\/([^/.]+?)(?:\.git)?(?:\/|$)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

async function createVercel(input: CreateDeploymentInput): Promise<CreateDeploymentResult> {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === input.projectId);
  if (!project) return { ok: false, provider: 'vercel', error: 'Project not found' };
  if (!project.githubUrl) {
    return {
      ok: false,
      provider: 'vercel',
      error: 'GitHub URL required',
      details: 'Add a GitHub URL in the project settings before creating a Vercel project.',
    };
  }
  const token = cfg.settings.vercelToken?.trim();
  if (!token) return { ok: false, provider: 'vercel', error: 'No Vercel token configured' };

  const gh = parseGithubUrl(project.githubUrl);
  if (!gh) return { ok: false, provider: 'vercel', error: `Invalid GitHub URL: ${project.githubUrl}` };

  const defaults = deriveBuildDefaults(input.framework, !!input.rootDirectory);
  const fwSlug = VERCEL_FRAMEWORK_MAP[(input.framework || '').toLowerCase()] || null;

  // Step 1: Create Vercel project
  const projectName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100);

  let vercelProjectId: string;
  let vercelProjectName: string;
  try {
    const createRes = await axios.post(
      'https://api.vercel.com/v10/projects',
      {
        name: projectName,
        framework: fwSlug,
        gitRepository: { type: 'github', repo: `${gh.owner}/${gh.repo}` },
        buildCommand: input.buildCommand || defaults.buildCommand,
        outputDirectory: input.outputDirectory || defaults.outputDirectory,
        installCommand: defaults.installCommand,
        rootDirectory: input.rootDirectory || null,
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
    );
    vercelProjectId = createRes.data?.id;
    vercelProjectName = createRes.data?.name || projectName;
    if (!vercelProjectId) throw new Error('Vercel returned no project ID');
  } catch (err: any) {
    return {
      ok: false,
      provider: 'vercel',
      error: err?.response?.data?.error?.message || err?.message || 'Project creation failed',
    };
  }

  // Step 2: Add env vars (if any)
  if (input.envVars?.length) {
    for (const env of input.envVars) {
      if (!env.key || !env.value) continue;
      try {
        await axios.post(
          `https://api.vercel.com/v10/projects/${vercelProjectId}/env`,
          {
            key: env.key,
            value: env.value,
            type: 'encrypted',
            target: ['production', 'preview', 'development'],
          },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
        );
      } catch {
        // Env failures are non-fatal
      }
    }
  }

  // Step 3: Trigger first deployment
  let deployUrl: string | undefined;
  let deployId: string | undefined;
  try {
    const deployRes = await axios.post(
      'https://api.vercel.com/v13/deployments',
      {
        name: vercelProjectName,
        project: vercelProjectId,
        target: 'production',
        gitSource: { type: 'github', ref: input.branch || 'main' },
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
    );
    deployUrl = deployRes.data?.url ? `https://${deployRes.data.url}` : undefined;
    deployId = deployRes.data?.id;
  } catch (err: any) {
    // Project exists, deploy failed: still return success on project creation
  }

  // Step 4: Update local config with new deploy info
  const liveUrl = deployUrl || `https://${vercelProjectName}.vercel.app`;
  updateProject(input.projectId, {
    deployProvider: 'vercel',
    deployId: vercelProjectId,
    liveUrl,
  });

  return {
    ok: true,
    provider: 'vercel',
    deployId: vercelProjectId,
    deployUrl,
    liveUrl,
    dashboardUrl: `https://vercel.com/dashboard/projects/${vercelProjectName}`,
  };
}

async function findRenderOwner(token: string): Promise<string | null> {
  try {
    const res = await axios.get('https://api.render.com/v1/owners?limit=1', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 10000,
    });
    const data = res.data;
    const arr: any[] = Array.isArray(data) ? data : [];
    const first = arr[0]?.owner || arr[0];
    return first?.id || null;
  } catch {
    return null;
  }
}

async function createRender(input: CreateDeploymentInput): Promise<CreateDeploymentResult> {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === input.projectId);
  if (!project) return { ok: false, provider: 'render', error: 'Project not found' };
  if (!project.githubUrl) {
    return {
      ok: false,
      provider: 'render',
      error: 'GitHub URL required',
      details: 'Add a GitHub URL in the project settings before creating a Render service.',
    };
  }
  const token = cfg.settings.renderToken?.trim();
  if (!token) return { ok: false, provider: 'render', error: 'No Render token configured' };

  const gh = parseGithubUrl(project.githubUrl);
  if (!gh) return { ok: false, provider: 'render', error: `Invalid GitHub URL: ${project.githubUrl}` };

  const ownerId = await findRenderOwner(token);
  if (!ownerId) return { ok: false, provider: 'render', error: 'Could not resolve Render owner from token' };

  const defaults = deriveBuildDefaults(input.framework);
  const serviceName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);

  const isStaticSite = input.serviceType === 'static_site';

  const body: any = {
    type: isStaticSite ? 'static_site' : 'web_service',
    name: serviceName,
    ownerId,
    repo: project.githubUrl.replace(/\.git$/, ''),
    branch: input.branch || 'main',
    autoDeploy: 'yes',
    serviceDetails: isStaticSite
      ? {
          buildCommand: input.buildCommand || defaults.buildCommand,
          publishPath: input.outputDirectory || defaults.outputDirectory,
        }
      : {
          env: 'node',
          plan: input.plan || 'free',
          region: input.region || 'singapore',
          buildCommand: input.buildCommand || 'npm install',
          startCommand: 'npm start',
        },
  };

  if (input.envVars?.length) {
    body.envVars = input.envVars
      .filter((e) => e.key && e.value)
      .map((e) => ({ key: e.key, value: e.value }));
  }

  let serviceId: string;
  let serviceUrl: string | undefined;
  try {
    const res = await axios.post('https://api.render.com/v1/services', body, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 30000,
    });
    const svc = res.data?.service || res.data;
    serviceId = svc?.id;
    serviceUrl = svc?.serviceDetails?.url;
    if (!serviceId) throw new Error('Render returned no service ID');
  } catch (err: any) {
    return {
      ok: false,
      provider: 'render',
      error: err?.response?.data?.message || err?.message || 'Service creation failed',
      details: err?.response?.data ? JSON.stringify(err.response.data).slice(0, 500) : undefined,
    };
  }

  updateProject(input.projectId, {
    deployProvider: 'render',
    deployId: serviceId,
    liveUrl: serviceUrl,
  });

  return {
    ok: true,
    provider: 'render',
    deployId: serviceId,
    liveUrl: serviceUrl,
    dashboardUrl: `https://dashboard.render.com/web/${serviceId}`,
  };
}

export async function createDeployment(input: CreateDeploymentInput): Promise<CreateDeploymentResult> {
  if (input.provider === 'vercel') return createVercel(input);
  if (input.provider === 'render') return createRender(input);
  return { ok: false, provider: input.provider, error: 'Unknown provider' };
}
