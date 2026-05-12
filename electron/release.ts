import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { simpleGit } from 'simple-git';
import { BrowserWindow } from 'electron';
import { generateChangelog, computeNextVersion, writeChangelogToProject, BumpKind } from './changelog';
import { gitPush as safePush, gitPushTags as safePushTags } from './gitsafe';

export interface ReleaseOptions {
  projectPath: string;
  bump: BumpKind;
  writeChangelog: boolean;
  releaseNotes: string;
  pushTags: boolean;
  createGithubRelease: boolean;
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

function runCommand(cmd: string, args: string[], cwd: string): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    const p = spawn(cmd, args, { cwd, shell: true, windowsHide: true });
    p.stdout.on('data', (d) => (out += d.toString('utf-8')));
    p.stderr.on('data', (d) => (err += d.toString('utf-8')));
    p.on('close', (code) => resolve({ code: code ?? 1, out, err }));
    p.on('error', (e) => resolve({ code: 1, out, err: e.message }));
  });
}

function broadcast(window: () => BrowserWindow | null, progress: ReleaseProgress) {
  const w = window();
  if (w && !w.isDestroyed()) w.webContents.send('release:progress', progress);
}

function setStep(progress: ReleaseProgress, id: string, patch: Partial<ReleaseStep>) {
  const step = progress.steps.find((s) => s.id === id);
  if (step) Object.assign(step, patch);
}

export async function performRelease(
  opts: ReleaseOptions,
  getWindow: () => BrowserWindow | null
): Promise<ReleaseProgress> {
  const pkgPath = path.join(opts.projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return {
      steps: [{ id: 'pkg', label: 'Read package.json', status: 'error', detail: 'No package.json' }],
      currentVersion: null,
      nextVersion: null,
      finished: true,
    };
  }

  const progress: ReleaseProgress = {
    steps: [
      { id: 'pkg', label: 'Bump package.json', status: 'pending' },
      { id: 'changelog', label: 'Write CHANGELOG.md', status: opts.writeChangelog ? 'pending' : 'skipped' },
      { id: 'commit', label: 'git commit', status: 'pending' },
      { id: 'tag', label: 'git tag', status: 'pending' },
      { id: 'push', label: 'git push + tags', status: opts.pushTags ? 'pending' : 'skipped' },
      {
        id: 'gh',
        label: 'gh release create',
        status: opts.createGithubRelease ? 'pending' : 'skipped',
      },
    ],
    currentVersion: null,
    nextVersion: null,
    finished: false,
  };

  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    progress.currentVersion = pkgJson.version;
    progress.nextVersion = progress.currentVersion ? computeNextVersion(progress.currentVersion, opts.bump) : null;

    setStep(progress, 'pkg', { status: 'running', detail: progress.nextVersion ?? '' });
    broadcast(getWindow, progress);
    if (!progress.nextVersion) {
      setStep(progress, 'pkg', { status: 'error', detail: 'Current version missing' });
      progress.finished = true;
      broadcast(getWindow, progress);
      return progress;
    }
    pkgJson.version = progress.nextVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf-8');
    setStep(progress, 'pkg', { status: 'done', detail: `${progress.currentVersion} → ${progress.nextVersion}` });
    broadcast(getWindow, progress);

    // Changelog
    if (opts.writeChangelog) {
      setStep(progress, 'changelog', { status: 'running' });
      broadcast(getWindow, progress);
      const cl = await generateChangelog(opts.projectPath);
      const md = (opts.releaseNotes ? `${opts.releaseNotes}\n\n` : '') + cl.markdown;
      const w = writeChangelogToProject(opts.projectPath, md.replace(/^##\s.*$/m, `## [${progress.nextVersion}] - ${new Date().toISOString().slice(0, 10)}`));
      if (!w.ok) {
        setStep(progress, 'changelog', { status: 'error', detail: w.error });
        progress.finished = true;
        broadcast(getWindow, progress);
        return progress;
      }
      setStep(progress, 'changelog', { status: 'done', detail: w.path });
      broadcast(getWindow, progress);
    }

    const git = simpleGit(opts.projectPath);
    setStep(progress, 'commit', { status: 'running' });
    broadcast(getWindow, progress);
    try {
      await git.add(['package.json', 'CHANGELOG.md'].filter((f) => fs.existsSync(path.join(opts.projectPath, f))));
      await git.commit(`chore(release): v${progress.nextVersion}`);
      setStep(progress, 'commit', { status: 'done' });
    } catch (err) {
      setStep(progress, 'commit', { status: 'error', detail: (err as Error).message });
      progress.finished = true;
      broadcast(getWindow, progress);
      return progress;
    }
    broadcast(getWindow, progress);

    setStep(progress, 'tag', { status: 'running' });
    broadcast(getWindow, progress);
    try {
      await git.addAnnotatedTag(`v${progress.nextVersion}`, `Release v${progress.nextVersion}`);
      setStep(progress, 'tag', { status: 'done', detail: `v${progress.nextVersion}` });
    } catch (err) {
      setStep(progress, 'tag', { status: 'error', detail: (err as Error).message });
      progress.finished = true;
      broadcast(getWindow, progress);
      return progress;
    }
    broadcast(getWindow, progress);

    if (opts.pushTags) {
      setStep(progress, 'push', { status: 'running' });
      broadcast(getWindow, progress);
      const pushRes = await safePush(opts.projectPath);
      if (!pushRes.ok) {
        setStep(progress, 'push', { status: 'error', detail: pushRes.error ?? pushRes.stderr });
        progress.finished = true;
        broadcast(getWindow, progress);
        return progress;
      }
      const tagsRes = await safePushTags(opts.projectPath);
      if (!tagsRes.ok) {
        setStep(progress, 'push', { status: 'error', detail: tagsRes.error ?? tagsRes.stderr });
        progress.finished = true;
        broadcast(getWindow, progress);
        return progress;
      }
      setStep(progress, 'push', { status: 'done' });
      broadcast(getWindow, progress);
    }

    if (opts.createGithubRelease) {
      setStep(progress, 'gh', { status: 'running' });
      broadcast(getWindow, progress);
      const assets: string[] = [];
      const distDir = path.join(opts.projectPath, 'dist');
      if (fs.existsSync(distDir)) {
        for (const f of fs.readdirSync(distDir)) {
          if (/\.(exe|apk|msi|dmg)$/i.test(f)) assets.push(path.join(distDir, f));
        }
      }
      const notesTxt = (opts.releaseNotes || `Release v${progress.nextVersion}`).slice(0, 10000);
      const tmpNotes = path.join(opts.projectPath, `.release-notes-${Date.now()}.md`);
      fs.writeFileSync(tmpNotes, notesTxt, 'utf-8');
      const args = ['release', 'create', `v${progress.nextVersion}`, '--title', `v${progress.nextVersion}`, '--notes-file', tmpNotes, ...assets];
      const res = await runCommand('gh', args, opts.projectPath);
      try {
        fs.unlinkSync(tmpNotes);
      } catch {
        /* ignore */
      }
      if (res.code !== 0) {
        setStep(progress, 'gh', { status: 'error', detail: res.err || res.out });
      } else {
        const urlMatch = res.out.match(/https:\/\/github\.com\/[^\s]+/);
        progress.releaseUrl = urlMatch?.[0];
        setStep(progress, 'gh', { status: 'done', detail: progress.releaseUrl });
      }
      broadcast(getWindow, progress);
    }

    progress.finished = true;
    broadcast(getWindow, progress);
    return progress;
  } catch (err) {
    progress.finished = true;
    const running = progress.steps.find((s) => s.status === 'running');
    if (running) running.status = 'error';
    if (running) running.detail = (err as Error).message;
    broadcast(getWindow, progress);
    return progress;
  }
}
