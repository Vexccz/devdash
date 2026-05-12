import fs from 'node:fs';
import path from 'node:path';
import { simpleGit } from 'simple-git';

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

const TYPE_ORDER = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'style',
  'test',
  'build',
  'ci',
  'chore',
  'other',
];

const TYPE_LABEL: Record<string, string> = {
  feat: '✨ Features',
  fix: '🐛 Fixes',
  perf: '⚡ Performance',
  refactor: '♻️ Refactor',
  docs: '📝 Docs',
  style: '💄 Style',
  test: '✅ Tests',
  build: '📦 Build',
  ci: '👷 CI',
  chore: '🔧 Chore',
  other: '💬 Other',
};

function readPackageJson(projectPath: string): { version?: string } | null {
  const p = path.join(projectPath, 'package.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function parseCommit(hash: string, rawMessage: string, author: string, date: string): ChangelogCommit {
  const firstLine = rawMessage.split('\n')[0];
  const m = firstLine.match(/^(feat|fix|perf|refactor|docs|style|test|build|ci|chore)(\(([^)]+)\))?(!)?:\s*(.+)$/i);
  if (m) {
    return {
      hash,
      shortHash: hash.slice(0, 7),
      type: m[1].toLowerCase(),
      scope: m[3],
      breaking: !!m[4] || /BREAKING CHANGE/i.test(rawMessage),
      message: m[5].trim(),
      author,
      date,
    };
  }
  return {
    hash,
    shortHash: hash.slice(0, 7),
    type: 'other',
    breaking: /BREAKING CHANGE/i.test(rawMessage),
    message: firstLine,
    author,
    date,
  };
}

function bumpVersion(current: string, kind: BumpKind): string {
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m) return current;
  let [, ma, mi, pa] = m;
  let major = Number(ma);
  let minor = Number(mi);
  let patch = Number(pa);
  if (kind === 'major') {
    major++;
    minor = 0;
    patch = 0;
  } else if (kind === 'minor') {
    minor++;
    patch = 0;
  } else {
    patch++;
  }
  return `${major}.${minor}.${patch}`;
}

export async function generateChangelog(projectPath: string): Promise<ChangelogResult> {
  const pkg = readPackageJson(projectPath);
  const currentVersion = pkg?.version ?? null;

  if (!fs.existsSync(path.join(projectPath, '.git'))) {
    return {
      fromTag: null,
      commits: [],
      groups: {},
      suggestedBump: 'patch',
      markdown: '_Not a git repository._',
      nextVersion: currentVersion ? bumpVersion(currentVersion, 'patch') : null,
      currentVersion,
    };
  }

  const git = simpleGit(projectPath);
  let fromTag: string | null = null;
  try {
    const tags = await git.tags();
    if (tags.latest) fromTag = tags.latest;
  } catch {
    /* ignore */
  }

  const range = fromTag ? `${fromTag}..HEAD` : undefined;
  const log = range ? await git.log({ from: fromTag!, to: 'HEAD' }) : await git.log({ maxCount: 100 });

  const commits = log.all.map((c) => parseCommit(c.hash, c.message + '\n' + (c.body ?? ''), c.author_name, c.date));

  const groups: Record<string, ChangelogCommit[]> = {};
  for (const c of commits) {
    const key = TYPE_ORDER.includes(c.type) ? c.type : 'other';
    groups[key] = groups[key] ?? [];
    groups[key].push(c);
  }

  let suggested: BumpKind = 'patch';
  if (commits.some((c) => c.breaking)) suggested = 'major';
  else if (commits.some((c) => c.type === 'feat')) suggested = 'minor';

  const nextVersion = currentVersion ? bumpVersion(currentVersion, suggested) : null;

  const md = renderMarkdown(groups, fromTag, nextVersion ?? 'unreleased');

  return {
    fromTag,
    commits,
    groups,
    suggestedBump: suggested,
    markdown: md,
    nextVersion,
    currentVersion,
  };
}

function renderMarkdown(
  groups: Record<string, ChangelogCommit[]>,
  fromTag: string | null,
  nextVersion: string
): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`## [${nextVersion}] - ${date}`);
  if (fromTag) lines.push('');
  for (const t of TYPE_ORDER) {
    const items = groups[t];
    if (!items || !items.length) continue;
    lines.push('');
    lines.push(`### ${TYPE_LABEL[t]}`);
    for (const c of items) {
      const scope = c.scope ? `**${c.scope}:** ` : '';
      lines.push(`- ${scope}${c.message} (\`${c.shortHash}\`)`);
    }
  }
  if (!lines.length) lines.push('_No changes._');
  return lines.join('\n') + '\n';
}

export function writeChangelogToProject(
  projectPath: string,
  markdown: string
): { ok: boolean; path?: string; error?: string } {
  const p = path.join(projectPath, 'CHANGELOG.md');
  try {
    let existing = '';
    if (fs.existsSync(p)) existing = fs.readFileSync(p, 'utf-8');
    const header = existing ? existing : `# Changelog\n\n`;
    const body = existing.includes('# Changelog')
      ? existing.replace('# Changelog\n', `# Changelog\n\n${markdown}\n`)
      : header + markdown + '\n' + existing;
    fs.writeFileSync(p, body, 'utf-8');
    return { ok: true, path: p };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function computeNextVersion(current: string, kind: BumpKind): string {
  return bumpVersion(current, kind);
}
