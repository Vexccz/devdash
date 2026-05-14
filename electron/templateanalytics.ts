import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface ScaffoldRecord {
  id: string;
  templateId: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  options: {
    useStripe: boolean;
    install: boolean;
    gitInit: boolean;
    uiKit?: string;
    envPreset?: string;
    structure?: string;
  };
}

export interface TemplateStats {
  totalScaffolds: number;
  mostUsedTemplate: { id: string; count: number } | null;
  avgScaffoldTimeMs: number;
  perTemplate: Array<{
    templateId: string;
    count: number;
    successRate: number;
    avgDurationMs: number;
  }>;
  usageOverTime: Array<{ day: string; count: number }>;
}

function analyticsPath(): string {
  return path.join(app.getPath('userData'), 'templateanalytics.json');
}

function readRecords(): ScaffoldRecord[] {
  const p = analyticsPath();
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as ScaffoldRecord[];
  } catch {
    return [];
  }
}

function writeRecords(records: ScaffoldRecord[]): void {
  fs.writeFileSync(analyticsPath(), JSON.stringify(records, null, 2), 'utf-8');
}

export function recordScaffold(entry: Omit<ScaffoldRecord, 'id'>): ScaffoldRecord {
  const records = readRecords();
  const record: ScaffoldRecord = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  };
  records.push(record);
  // Keep max 1000 records
  if (records.length > 1000) records.splice(0, records.length - 1000);
  writeRecords(records);
  return record;
}

export function getStats(): TemplateStats {
  const records = readRecords();

  if (records.length === 0) {
    return {
      totalScaffolds: 0,
      mostUsedTemplate: null,
      avgScaffoldTimeMs: 0,
      perTemplate: [],
      usageOverTime: [],
    };
  }

  // Per-template aggregation
  const templateMap = new Map<string, { count: number; successCount: number; totalDuration: number }>();
  let totalDuration = 0;

  for (const r of records) {
    totalDuration += r.durationMs;
    const existing = templateMap.get(r.templateId) || { count: 0, successCount: 0, totalDuration: 0 };
    existing.count++;
    if (r.success) existing.successCount++;
    existing.totalDuration += r.durationMs;
    templateMap.set(r.templateId, existing);
  }

  const perTemplate = Array.from(templateMap.entries()).map(([templateId, data]) => ({
    templateId,
    count: data.count,
    successRate: data.count > 0 ? Math.round((data.successCount / data.count) * 100) : 0,
    avgDurationMs: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
  }));

  perTemplate.sort((a, b) => b.count - a.count);

  const mostUsedTemplate = perTemplate.length > 0
    ? { id: perTemplate[0].templateId, count: perTemplate[0].count }
    : null;

  // Usage over time (last 30 days)
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const dayMap = new Map<string, number>();

  for (let i = 0; i < 30; i++) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }

  for (const r of records) {
    if (r.timestamp >= thirtyDaysAgo) {
      const key = new Date(r.timestamp).toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    }
  }

  const usageOverTime = Array.from(dayMap.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    totalScaffolds: records.length,
    mostUsedTemplate,
    avgScaffoldTimeMs: Math.round(totalDuration / records.length),
    perTemplate,
    usageOverTime,
  };
}
