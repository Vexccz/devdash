import axios from 'axios';

export type CollabRole = 'admin' | 'maintain' | 'write' | 'triage' | 'pull';

export interface Collaborator {
  login: string;
  id: number;
  avatarUrl: string;
  htmlUrl: string;
  role: CollabRole;
  type: string;
}

export interface PendingInvitation {
  id: number;
  invitee: string;
  inviteeAvatar: string;
  inviter: string;
  permissions: string;
  createdAt: string;
  htmlUrl: string;
}

export interface CollabListResult {
  ok: boolean;
  owner?: string;
  repo?: string;
  collaborators: Collaborator[];
  invitations: PendingInvitation[];
  error?: string;
}

export interface CollabActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  try {
    const u = url.trim().replace(/\.git$/, '');
    const m = u.match(/github\.com[:/]+([^/]+)\/([^/]+)/i);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
  } catch {
    return null;
  }
}

function roleFromPermissions(p: any): CollabRole {
  if (!p) return 'pull';
  if (p.admin) return 'admin';
  if (p.maintain) return 'maintain';
  if (p.push) return 'write';
  if (p.triage) return 'triage';
  if (p.pull) return 'pull';
  return 'pull';
}

export async function listCollaborators(token: string, githubUrl: string): Promise<CollabListResult> {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) return { ok: false, collaborators: [], invitations: [], error: 'Invalid GitHub URL' };
  if (!token) return { ok: false, collaborators: [], invitations: [], error: 'GitHub token missing in Settings' };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    const [collabRes, inviteRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/collaborators?affiliation=all&per_page=100`, {
        headers,
        timeout: 15000,
      }),
      axios.get(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/invitations?per_page=100`, {
        headers,
        timeout: 15000,
      }),
    ]);

    const collaborators: Collaborator[] = (collabRes.data as any[]).map((c: any) => ({
      login: String(c.login),
      id: Number(c.id),
      avatarUrl: String(c.avatar_url ?? ''),
      htmlUrl: String(c.html_url ?? ''),
      role: roleFromPermissions(c.permissions),
      type: String(c.type ?? 'User'),
    }));

    const invitations: PendingInvitation[] = (inviteRes.data as any[]).map((inv: any) => ({
      id: Number(inv.id),
      invitee: String(inv.invitee?.login ?? ''),
      inviteeAvatar: String(inv.invitee?.avatar_url ?? ''),
      inviter: String(inv.inviter?.login ?? ''),
      permissions: String(inv.permissions ?? ''),
      createdAt: String(inv.created_at ?? ''),
      htmlUrl: String(inv.html_url ?? ''),
    }));

    return {
      ok: true,
      owner: parsed.owner,
      repo: parsed.repo,
      collaborators,
      invitations,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message ?? err?.message ?? 'Request failed';
    if (status === 404) return { ok: false, collaborators: [], invitations: [], error: 'Repo not found or token lacks access.' };
    if (status === 403) return { ok: false, collaborators: [], invitations: [], error: `Forbidden: ${msg}` };
    return { ok: false, collaborators: [], invitations: [], error: msg };
  }
}

export async function inviteCollaborator(
  token: string,
  githubUrl: string,
  username: string,
  permission: CollabRole
): Promise<CollabActionResult> {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) return { ok: false, error: 'Invalid GitHub URL' };
  if (!token) return { ok: false, error: 'GitHub token missing in Settings' };
  if (!username.trim()) return { ok: false, error: 'Username required' };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    const res = await axios.put(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/collaborators/${encodeURIComponent(username.trim())}`,
      { permission },
      { headers, timeout: 15000 }
    );
    if (res.status === 201 || res.status === 204) {
      return {
        ok: true,
        message: res.status === 201 ? `Invitation sent to ${username}.` : `${username} already has access.`,
      };
    }
    return { ok: true, message: `Updated ${username}.` };
  } catch (err: any) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message ?? err?.message ?? 'Invite failed';
    if (status === 404) return { ok: false, error: 'User not found or repo inaccessible.' };
    if (status === 422) return { ok: false, error: msg || 'Validation failed (duplicate invite?)' };
    return { ok: false, error: msg };
  }
}

export async function removeCollaborator(token: string, githubUrl: string, username: string): Promise<CollabActionResult> {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) return { ok: false, error: 'Invalid GitHub URL' };
  if (!token) return { ok: false, error: 'GitHub token missing in Settings' };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    await axios.delete(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/collaborators/${encodeURIComponent(username)}`,
      { headers, timeout: 15000 }
    );
    return { ok: true, message: `Removed ${username}.` };
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? err?.message ?? 'Remove failed';
    return { ok: false, error: msg };
  }
}

export async function cancelInvitation(token: string, githubUrl: string, invitationId: number): Promise<CollabActionResult> {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) return { ok: false, error: 'Invalid GitHub URL' };
  if (!token) return { ok: false, error: 'GitHub token missing in Settings' };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    await axios.delete(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/invitations/${invitationId}`,
      { headers, timeout: 15000 }
    );
    return { ok: true, message: 'Invitation cancelled.' };
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? err?.message ?? 'Cancel failed';
    return { ok: false, error: msg };
  }
}

export async function checkTokenScopes(token: string): Promise<{ ok: boolean; scopes?: string[]; login?: string; error?: string }> {
  if (!token) return { ok: false, error: 'Token missing' };
  try {
    const res = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 10000,
    });
    const scopesHeader = (res.headers['x-oauth-scopes'] ?? '') as string;
    const scopes = scopesHeader ? scopesHeader.split(',').map((s) => s.trim()).filter(Boolean) : [];
    return { ok: true, scopes, login: String(res.data?.login ?? '') };
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? err?.message ?? 'Check failed';
    return { ok: false, error: msg };
  }
}
