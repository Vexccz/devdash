import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { loadConfig, updateProject } from './config';

export interface TemplateVersion {
  version: string;
  changelog: Array<{ version: string; date: string; changes: string[] }>;
}

export interface TemplateUpdateInfo {
  projectId: string;
  projectName: string;
  templateId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  changes: string[];
}

export interface TemplateDiff {
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
    content?: string;
  }>;
}

function templatesRoot(): string {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'templates'),
    path.join(app.getAppPath(), 'templates'),
    path.resolve(__dirname, '..', 'templates'),
    path.resolve(process.cwd(), 'templates'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return candidates[candidates.length - 1];
}

function readVersionsJson(templateId: string): TemplateVersion | null {
  const vPath = path.join(templatesRoot(), templateId, 'versions.json');
  if (!fs.existsSync(vPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(vPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function checkUpdates(): TemplateUpdateInfo[] {
  const cfg = loadConfig();
  const results: TemplateUpdateInfo[] = [];

  for (const project of cfg.projects) {
    if (!project.templateId || !project.templateVersion) continue;
    const versions = readVersionsJson(project.templateId);
    if (!versions) continue;

    const latestVersion = versions.version;
    const hasUpdate = latestVersion !== project.templateVersion;

    const changes: string[] = [];
    if (hasUpdate && versions.changelog) {
      for (const entry of versions.changelog) {
        if (entry.version !== project.templateVersion) {
          changes.push(...entry.changes.map((c) => `${entry.version}: ${c}`));
        }
      }
    }

    results.push({
      projectId: project.id,
      projectName: project.name,
      templateId: project.templateId,
      currentVersion: project.templateVersion,
      latestVersion,
      hasUpdate,
      changes,
    });
  }

  return results;
}

export function viewDiff(projectId: string): TemplateDiff | { error: string } {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === projectId);
  if (!project) return { error: 'Project not found' };
  if (!project.templateId) return { error: 'Project has no template info' };

  const templateDir = path.join(templatesRoot(), project.templateId);
  if (!fs.existsSync(templateDir)) return { error: 'Template not found on disk' };
  if (!fs.existsSync(project.path)) return { error: 'Project path does not exist' };

  const files: TemplateDiff['files'] = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'versions.json']);
  const projectPath = project.path;

  function scanTemplate(dir: string, rel: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      const templateFilePath = path.join(dir, entry.name);
      const projectFilePath = path.join(projectPath, entryRel);

      if (entry.isDirectory()) {
        scanTemplate(templateFilePath, entryRel);
      } else {
        const templateContent = fs.readFileSync(templateFilePath, 'utf-8');
        if (!fs.existsSync(projectFilePath)) {
          files.push({ path: entryRel, status: 'added', content: templateContent.slice(0, 2000) });
        } else {
          const projectContent = fs.readFileSync(projectFilePath, 'utf-8');
          if (templateContent !== projectContent) {
            files.push({ path: entryRel, status: 'modified', content: templateContent.slice(0, 2000) });
          }
        }
      }
    }
  }

  scanTemplate(templateDir, '');
  return { files };
}

export function applyUpdate(projectId: string): { ok: boolean; applied: number; error?: string } {
  const cfg = loadConfig();
  const project = cfg.projects.find((p) => p.id === projectId);
  if (!project) return { ok: false, applied: 0, error: 'Project not found' };
  if (!project.templateId) return { ok: false, applied: 0, error: 'No template info' };

  const templateDir = path.join(templatesRoot(), project.templateId);
  if (!fs.existsSync(templateDir)) return { ok: false, applied: 0, error: 'Template not found' };

  const versions = readVersionsJson(project.templateId);
  if (!versions) return { ok: false, applied: 0, error: 'No versions.json in template' };

  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'versions.json', 'package-lock.json']);
  let applied = 0;
  const projectPath = project.path;
  const latestVersion = versions.version;

  function mergeDir(dir: string, rel: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      const templateFilePath = path.join(dir, entry.name);
      const projectFilePath = path.join(projectPath, entryRel);

      if (entry.isDirectory()) {
        mergeDir(templateFilePath, entryRel);
      } else {
        const templateContent = fs.readFileSync(templateFilePath, 'utf-8');
        if (!fs.existsSync(projectFilePath)) {
          // New file from template — add it
          const parentDir = path.dirname(projectFilePath);
          if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
          fs.writeFileSync(projectFilePath, templateContent, 'utf-8');
          applied++;
        } else {
          const projectContent = fs.readFileSync(projectFilePath, 'utf-8');
          if (templateContent !== projectContent) {
            // Add conflict markers
            const merged = `<<<<<<< YOUR VERSION\n${projectContent}\n=======\n${templateContent}\n>>>>>>> TEMPLATE (${latestVersion})\n`;
            fs.writeFileSync(projectFilePath, merged, 'utf-8');
            applied++;
          }
        }
      }
    }
  }

  mergeDir(templateDir, '');

  // Update project version
  updateProject(projectId, {
    templateVersion: latestVersion,
  } as any);

  return { ok: true, applied };
}
