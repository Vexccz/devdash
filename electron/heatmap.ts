import fs from 'node:fs';
import path from 'node:path';
import { simpleGit } from 'simple-git';

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

function isoDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export async function build(projectPath: string, days = 90): Promise<HeatmapResult> {
  const empty: HeatmapResult = { days: [], currentStreak: 0, longestStreak: 0, totalCommits: 0 };
  if (!fs.existsSync(path.join(projectPath, '.git'))) return empty;
  const git = simpleGit(projectPath);
  try {
    const since = `${days} days ago`;
    const log = await git.log(['--since', since, '--all']);
    const counts = new Map<string, number>();
    for (const c of log.all) {
      const d = new Date(c.date).toISOString().slice(0, 10);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    const out: HeatmapDay[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = isoDay(Date.now() - i * 24 * 60 * 60 * 1000);
      out.push({ date: day, count: counts.get(day) ?? 0 });
    }
    // streaks (from most recent back)
    let current = 0;
    let longest = 0;
    let run = 0;
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].count > 0) {
        run++;
        if (i === out.length - 1 || current > 0) current = run;
      } else {
        if (i === out.length - 1) current = 0;
        if (run > longest) longest = run;
        run = 0;
      }
    }
    if (run > longest) longest = run;
    if (current === 0 && out[out.length - 1]?.count > 0) current = 1;
    const total = out.reduce((a, d) => a + d.count, 0);
    return { days: out, currentStreak: current, longestStreak: longest, totalCommits: total };
  } catch {
    return empty;
  }
}
