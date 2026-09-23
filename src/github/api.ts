import { getSecret, httpFetch, setSecret } from '../platform';

/** GitHub account token for project repos (separate from the sync token). */
const TOKEN = 'github-account-token';
export const getGitHubToken = () => getSecret(TOKEN);
export const setGitHubToken = (t: string) => setSecret(TOKEN, t.trim());

export interface GhUser { login: string; id: number; name?: string | null }
export interface GhRepo { name: string; full_name: string; size?: number; owner: { login: string }; private: boolean; default_branch: string; html_url: string; description?: string | null; pushed_at?: string }

export class GitHubError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function gh<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const t = token ?? (await getGitHubToken());
  if (!t) throw new GitHubError('Add your GitHub token in ⚙ Settings → GitHub first', 401);
  const r = await httpFetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
  });
  if (r.status === 204) return undefined as T;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.errors?.[0]?.message || j?.message || `HTTP ${r.status}`;
    throw new GitHubError(r.status === 401 ? 'GitHub rejected the token — check it in ⚙ Settings → GitHub' : r.status === 403 && /Resource not accessible/i.test(msg) ? 'The GitHub token doesn\'t have permission for this — see docs/SETUP.md (GitHub section)' : msg, r.status);
  }
  return j as T;
}

let me: Promise<GhUser> | null = null;
export const currentUser = (token?: string) => (token ? gh<GhUser>('/user', {}, token) : (me ??= gh<GhUser>('/user').catch(e => { me = null; throw e; })));
export const forgetUser = () => { me = null; };

/** Your repos (owned + collaborator), most recently pushed first. */
export async function listRepos(): Promise<GhRepo[]> {
  const out: GhRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh<GhRepo[]>(`/user/repos?per_page=100&sort=pushed&page=${page}&affiliation=owner,collaborator,organization_member`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

export const getRepo = (owner: string, name: string) => gh<GhRepo>(`/repos/${owner}/${name}`);

export function createRepo(name: string, description: string, autoInit: boolean) {
  return gh<GhRepo>('/user/repos', { method: 'POST', body: JSON.stringify({ name, description: description.slice(0, 300), private: true, auto_init: autoInit }) });
}

/** "owner/name", https URLs, git@ URLs → { owner, name } */
export function parseRepo(input: string): { owner: string; name: string } | null {
  const s = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const m = s.match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)$/);
  return m ? { owner: m[1], name: m[2] } : null;
}

export const repoSlug = (name: string) => name.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'mosslight-project';

// ── Reading repo contents (lets API-mode agents and the phone see the code) ─────

interface TreeItem { path: string; type: 'blob' | 'tree'; size?: number }
const treeCache = new Map<string, { at: number; items: TreeItem[]; truncated: boolean }>();

export async function repoTree(owner: string, name: string, branch = 'HEAD') {
  const key = `${owner}/${name}@${branch}`;
  const hit = treeCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit;
  const j = await gh<{ tree: TreeItem[]; truncated: boolean }>(`/repos/${owner}/${name}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const v = { at: Date.now(), items: j.tree || [], truncated: !!j.truncated };
  treeCache.set(key, v);
  return v;
}

export async function repoFile(owner: string, name: string, path: string, branch?: string): Promise<string> {
  const t = await getGitHubToken();
  const r = await httpFetch(`https://api.github.com/repos/${owner}/${name}/contents/${path.split('/').map(encodeURIComponent).join('/')}${branch ? `?ref=${encodeURIComponent(branch)}` : ''}`, {
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!r.ok) throw new GitHubError(`Couldn't read ${path} (${r.status})`, r.status);
  return r.text();
}

export async function repoReadme(owner: string, name: string): Promise<string> {
  const t = await getGitHubToken();
  const r = await httpFetch(`https://api.github.com/repos/${owner}/${name}/readme`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github.raw' } });
  return r.ok ? r.text() : '';
}
