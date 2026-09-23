import { httpFetch, platform } from '../platform';

/** Minimal GitHub REST client used as the sync store (a private repo per user). */
export class GitHubStore {
  constructor(readonly repo: string, private token: string) {}

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...extra };
  }

  private api(path: string) {
    return `https://api.github.com/repos/${this.repo}${path}`;
  }

  /** Checks the token can read and write the repo. */
  async verify(): Promise<string | null> {
    const r = await httpFetch(this.api(''), { headers: this.headers() });
    if (r.status === 401) return 'The token was rejected — check it was copied fully and hasn\'t expired.';
    if (r.status === 404) return `Repository ${this.repo} not found, or the token can't see it.`;
    if (!r.ok) return `GitHub returned ${r.status}.`;
    const j = await r.json();
    if (j.permissions && !j.permissions.push) return 'The token can read but not write this repo — give it "Contents: Read and write".';
    return null;
  }

  /** Reads a file. `etag` makes an unchanged poll a free 304. */
  async read(path: string, etag?: string): Promise<{ status: 'same' } | { status: 'missing' } | { status: 'ok'; sha: string; text: string; etag?: string }> {
    let r: Response;
    if (platform === 'android') {
      // Android's native HTTP bridge can't handle a 304 reply ("Failed to fetch"), so no
      // conditional request there — and a cache-buster so the WebView never serves a stale copy.
      r = await httpFetch(this.api(`/contents/${path}?_=${Date.now()}`), { headers: this.headers() });
    } else {
      r = await httpFetch(this.api(`/contents/${path}`), { headers: this.headers(etag ? { 'If-None-Match': etag } : {}), cache: 'no-store' });
    }
    if (r.status === 304) return { status: 'same' };
    if (r.status === 404) return { status: 'missing' };
    if (!r.ok) throw new Error(`Sync read failed (${r.status})`);
    const j = await r.json();
    let b64: string = j.content || '';
    if (!b64 && j.sha) {
      // Files over 1 MB come back without inline content — fetch the blob instead.
      const br = await httpFetch(this.api(`/git/blobs/${j.sha}`), { headers: this.headers() });
      b64 = (await br.json()).content || '';
    }
    return { status: 'ok', sha: j.sha, text: decodeUtf8(b64), etag: r.headers.get('etag') || undefined };
  }

  /** Creates/updates a file. Returns the new sha, or 'conflict' if `sha` is stale. */
  async write(path: string, body: string | Uint8Array, sha: string | null, message: string): Promise<string | 'conflict'> {
    const content = typeof body === 'string' ? encodeUtf8(body) : bytesToB64(body);
    const r = await httpFetch(this.api(`/contents/${path}`), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, content, ...(sha ? { sha } : {}) }),
    });
    if (r.status === 409 || r.status === 422) {
      // 422 also means "file already exists" when creating without a sha.
      return 'conflict';
    }
    if (!r.ok) throw new Error(`Sync write failed (${r.status})`);
    return (await r.json()).content.sha;
  }

  async exists(path: string) {
    const r = await httpFetch(this.api(`/contents/${path}`), { method: 'GET', headers: this.headers() });
    return r.ok;
  }

  /** Raw bytes of a repo file (used for synced images). */
  async readBytes(path: string): Promise<Blob> {
    const r = await httpFetch(this.api(`/contents/${path}`), { headers: this.headers({ Accept: 'application/vnd.github.raw' }) });
    if (!r.ok) throw new Error(`Image fetch failed (${r.status})`);
    return r.blob();
  }

  /** The "builds" release in the sync repo holds APKs so phones can install them. */
  async buildsRelease(): Promise<{ id: number; upload_url: string }> {
    const r = await httpFetch(this.api('/releases/tags/builds'), { headers: this.headers() });
    if (r.ok) return r.json();
    const c = await httpFetch(this.api('/releases'), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tag_name: 'builds', name: 'Test builds (synced by Mosslight)', body: 'Android test builds uploaded by the Mosslight desktop app so the companion can install them.', draft: false, prerelease: true }),
    });
    if (!c.ok) throw new Error(`Couldn't create the builds release (${c.status}). The repo needs at least one commit — it gets one when sync first saves.`);
    return c.json();
  }

  async uploadAsset(bytes: Uint8Array, name: string, contentType: string): Promise<{ id: number; name: string; size: number }> {
    const rel = await this.buildsRelease();
    const safe = `${Date.now().toString(36)}_${name.replace(/[^\w.-]+/g, '_')}`;
    const url = rel.upload_url.replace(/\{.*$/, '') + `?name=${encodeURIComponent(safe)}`;
    const r = await httpFetch(url, { method: 'POST', headers: this.headers({ 'Content-Type': contentType }), body: bytes as BodyInit });
    if (!r.ok) throw new Error(`Upload failed (${r.status})`);
    const j = await r.json();
    return { id: j.id, name: j.name, size: j.size };
  }

  assetApiUrl(id: number) {
    return this.api(`/releases/assets/${id}`);
  }

  authHeader() {
    return `Bearer ${this.token}`;
  }
}

export function bytesToB64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const encodeUtf8 = (s: string) => bytesToB64(new TextEncoder().encode(s));
const decodeUtf8 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
