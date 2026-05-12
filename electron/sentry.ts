import axios from 'axios';
import crypto from 'node:crypto';

/**
 * Sentry integration helpers.
 *
 * Sentry DSN shape:
 *   https://<publicKey>@o<orgId>.ingest.sentry.io/<projectId>
 *   https://<publicKey>@o<orgId>.ingest.us.sentry.io/<projectId>
 *   https://<publicKey>@<host>/<projectId>   (self-hosted / custom host)
 *
 * The numeric orgId in the host (`oNNN.ingest.sentry.io`) is NOT the same as
 * the human-facing org slug used in API paths (e.g. `acme-inc`). We have to
 * look the slug up via the /organizations/ endpoint using the auth token.
 */

export interface ParsedDsn {
  key: string;
  host: string;
  orgId: string | null;
  projectId: string;
}

export interface ResolvedSentryProject {
  orgSlug: string | null;
  projectSlug: string | null;
  projectIdNumeric: string;
  error?: string;
}

/** Basic DSN validation regex; loose enough for self-hosted hosts. */
const DSN_RE = /^https:\/\/([a-z0-9]+)@([^/]+)\/(\d+)$/i;

/** Extracts numeric org id from hosts like `o4505.ingest.us.sentry.io`. */
function extractOrgIdFromHost(host: string): string | null {
  const m = host.match(/^o(\d+)\./i);
  return m ? m[1] : null;
}

export function parseDsn(dsn: string): ParsedDsn | null {
  if (!dsn || typeof dsn !== 'string') return null;
  const trimmed = dsn.trim();
  const m = trimmed.match(DSN_RE);
  if (!m) return null;
  const [, key, host, projectId] = m;
  return {
    key,
    host,
    orgId: extractOrgIdFromHost(host),
    projectId,
  };
}

/** Shallow validity check used by the renderer. */
export function validateDsn(dsn: string): {
  ok: boolean;
  orgId: string | null;
  projectId: string | null;
  error?: string;
} {
  const parsed = parseDsn(dsn);
  if (!parsed) return { ok: false, orgId: null, projectId: null, error: 'Invalid DSN format' };
  return { ok: true, orgId: parsed.orgId, projectId: parsed.projectId };
}

// ---------- Org slug cache ----------
// Keyed by orgId + hash(token) so rotating the token busts the cache.

interface OrgCacheEntry {
  slug: string;
  expires: number;
}

const orgCache = new Map<string, OrgCacheEntry>();
const ORG_TTL_MS = 15 * 60 * 1000;

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
}

function cacheKey(orgId: string, token: string): string {
  return `${orgId}:${tokenHash(token)}`;
}

interface SentryOrgListItem {
  id: string;
  slug: string;
  name?: string;
}

export async function resolveOrgSlug(token: string, orgId: string): Promise<string | null> {
  if (!token || !orgId) return null;
  const key = cacheKey(orgId, token);
  const cached = orgCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.slug;

  try {
    const res = await axios.get<SentryOrgListItem[]>('https://sentry.io/api/0/organizations/', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    const list = Array.isArray(res.data) ? res.data : [];
    const match = list.find((o) => String(o.id) === String(orgId));
    if (match?.slug) {
      orgCache.set(key, { slug: match.slug, expires: Date.now() + ORG_TTL_MS });
      return match.slug;
    }
    // If only one org is visible to the token, fall back to that one — a very
    // common case for personal projects.
    if (list.length === 1 && list[0]?.slug) {
      orgCache.set(key, { slug: list[0].slug, expires: Date.now() + ORG_TTL_MS });
      return list[0].slug;
    }
    return null;
  } catch (err) {
    console.warn('[sentry] resolveOrgSlug failed:', (err as Error).message);
    return null;
  }
}

/**
 * Best-effort lookup of the project slug given an org slug + numeric project id.
 * Returns null if the token can't see the project.
 */
export async function resolveProjectSlug(
  token: string,
  orgSlug: string,
  projectIdNumeric: string
): Promise<string | null> {
  if (!token || !orgSlug || !projectIdNumeric) return null;
  try {
    const res = await axios.get<Array<{ id: string; slug: string }>>(
      `https://sentry.io/api/0/organizations/${encodeURIComponent(orgSlug)}/projects/`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      }
    );
    const list = Array.isArray(res.data) ? res.data : [];
    const match = list.find((p) => String(p.id) === String(projectIdNumeric));
    return match?.slug ?? null;
  } catch (err) {
    console.warn('[sentry] resolveProjectSlug failed:', (err as Error).message);
    return null;
  }
}

/**
 * High-level helper: given a DSN + token and optional pre-saved slugs,
 * return the resolved org slug + project slug. Uses saved slugs when present.
 */
export async function resolveSentryProject(
  dsn: string,
  token: string,
  overrides?: { orgSlug?: string | null; projectSlug?: string | null }
): Promise<ResolvedSentryProject> {
  const parsed = parseDsn(dsn);
  if (!parsed) {
    return { orgSlug: null, projectSlug: null, projectIdNumeric: '', error: 'Invalid DSN' };
  }
  const projectIdNumeric = parsed.projectId;

  const manualOrg = overrides?.orgSlug?.trim() || null;
  const manualProject = overrides?.projectSlug?.trim() || null;

  if (manualOrg && manualProject) {
    return { orgSlug: manualOrg, projectSlug: manualProject, projectIdNumeric };
  }

  if (!token) {
    return {
      orgSlug: manualOrg,
      projectSlug: manualProject,
      projectIdNumeric,
      error: 'No Sentry auth token configured',
    };
  }

  let orgSlug = manualOrg;
  if (!orgSlug) {
    if (!parsed.orgId) {
      return {
        orgSlug: null,
        projectSlug: manualProject,
        projectIdNumeric,
        error: 'DSN has no org id (self-hosted?) — set orgSlug manually',
      };
    }
    orgSlug = await resolveOrgSlug(token, parsed.orgId);
    if (!orgSlug) {
      return {
        orgSlug: null,
        projectSlug: manualProject,
        projectIdNumeric,
        error: 'Org slug not found for this token',
      };
    }
  }

  let projectSlug = manualProject;
  if (!projectSlug) {
    projectSlug = await resolveProjectSlug(token, orgSlug, projectIdNumeric);
  }

  return { orgSlug, projectSlug, projectIdNumeric };
}

/**
 * Call the project-level stats endpoint. Returns per-day error counts for
 * the past 7 days.
 */
export async function getErrorStats(
  token: string,
  orgSlug: string,
  projectSlug: string
): Promise<{ day: string; count: number }[]> {
  if (!token || !orgSlug || !projectSlug) return [];
  const url =
    `https://sentry.io/api/0/organizations/${encodeURIComponent(orgSlug)}/stats_v2/` +
    `?field=sum(quantity)&interval=1d&statsPeriod=7d&category=error` +
    `&project=${encodeURIComponent(projectSlug)}`;
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    const intervals: string[] = res.data?.intervals ?? [];
    const groups = res.data?.groups ?? [];
    const row = groups[0]?.series?.['sum(quantity)'] ?? [];
    const out: { day: string; count: number }[] = [];
    for (let i = 0; i < intervals.length; i++) {
      out.push({ day: String(intervals[i]).slice(0, 10), count: Number(row[i] ?? 0) });
    }
    return out;
  } catch (err) {
    console.warn('[sentry] getErrorStats failed:', (err as Error).message);
    return [];
  }
}

export function clearOrgCache(): void {
  orgCache.clear();
}
