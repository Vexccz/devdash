import { startTimeSession, endTimeSession, readTimeSessions } from './cache';

interface ActiveSession {
  sessionId: number;
  projectId: string;
  startedAt: number;
  lastActivity: number;
  idleTimer: NodeJS.Timeout | null;
}

let active: ActiveSession | null = null;
let idleTimeoutMs = 2 * 60 * 1000;

export function setIdleTimeout(minutes: number): void {
  idleTimeoutMs = Math.max(30 * 1000, minutes * 60 * 1000);
}

function clearIdle() {
  if (active?.idleTimer) {
    clearTimeout(active.idleTimer);
    active.idleTimer = null;
  }
}

function scheduleIdleCheck() {
  if (!active) return;
  clearIdle();
  active.idleTimer = setTimeout(() => {
    if (!active) return;
    const idle = Date.now() - active.lastActivity;
    if (idle >= idleTimeoutMs) {
      stopCurrent('idle');
    } else {
      scheduleIdleCheck();
    }
  }, idleTimeoutMs);
}

export function enter(projectId: string): { projectId: string; startedAt: number } {
  if (active && active.projectId === projectId) {
    active.lastActivity = Date.now();
    scheduleIdleCheck();
    return { projectId: active.projectId, startedAt: active.startedAt };
  }
  if (active) stopCurrent('switched');
  const startedAt = Date.now();
  const sessionId = startTimeSession(projectId, startedAt);
  active = {
    sessionId,
    projectId,
    startedAt,
    lastActivity: startedAt,
    idleTimer: null,
  };
  scheduleIdleCheck();
  return { projectId, startedAt };
}

export function touch(projectId: string): void {
  if (active && active.projectId === projectId) {
    active.lastActivity = Date.now();
    scheduleIdleCheck();
  }
}

export function leave(projectId: string): { stopped: boolean } {
  if (active && active.projectId === projectId) {
    stopCurrent('leave');
    return { stopped: true };
  }
  return { stopped: false };
}

function stopCurrent(_reason: string) {
  if (!active) return;
  endTimeSession(active.sessionId, Date.now());
  clearIdle();
  active = null;
}

export function stopAll(): void {
  if (active) stopCurrent('shutdown');
}

export function getActive(): { projectId: string; startedAt: number } | null {
  return active ? { projectId: active.projectId, startedAt: active.startedAt } : null;
}

export interface TimeSummary {
  projectId: string;
  todayMs: number;
  weekMs: number;
  days: { day: string; ms: number }[];
}

function msBetween(a: number, b: number) {
  return Math.max(0, b - a);
}

export function summaryFor(projectId: string | null, days = 7): TimeSummary[] {
  const now = Date.now();
  const weekStart = startOfWeek(now);
  const sinceMs = weekStart;
  const allRows = readTimeSessions(null, sinceMs - 24 * 60 * 60 * 1000);

  const byProject = new Map<string, { todayMs: number; weekMs: number; days: Map<string, number> }>();

  for (const row of allRows) {
    const start = row.startedAt;
    const end = row.endedAt ?? now;
    const dur = msBetween(start, end);
    if (dur <= 0) continue;
    const pid = row.projectId;
    const entry = byProject.get(pid) ?? { todayMs: 0, weekMs: 0, days: new Map<string, number>() };

    if (start >= weekStart) entry.weekMs += dur;
    const todayStart = startOfDay(now);
    if (start >= todayStart) entry.todayMs += dur;
    const dayKey = new Date(start).toISOString().slice(0, 10);
    entry.days.set(dayKey, (entry.days.get(dayKey) ?? 0) + dur);
    byProject.set(pid, entry);
  }

  const lastNDays: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    lastNDays.push(d.toISOString().slice(0, 10));
  }

  const out: TimeSummary[] = [];
  const keys = projectId ? [projectId] : Array.from(byProject.keys());
  for (const pid of keys) {
    const entry = byProject.get(pid) ?? { todayMs: 0, weekMs: 0, days: new Map() };
    out.push({
      projectId: pid,
      todayMs: entry.todayMs,
      weekMs: entry.weekMs,
      days: lastNDays.map((d) => ({ day: d, ms: entry.days.get(d) ?? 0 })),
    });
  }
  return out;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday-based
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
