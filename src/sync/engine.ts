import type { HubData } from '../core/types';
import { getSecret, setSecret } from '../platform';
import { deviceId, deviceOs, getDeviceName } from './device';
import { GitHubStore } from './github';
import { fingerprint, merge, toDoc, type SyncDoc } from './merge';

const DOC = 'hub.json';
const REPO_KEY = 'mosslight.sync.repo';
const TOKEN_SECRET = 'github-sync-token';
export const DEFAULT_SYNC_REPO = 'amosley0221/mosslight-sync';
const POLL_MS = 4000;
const PUSH_DELAY_MS = 1200;

export interface SyncConfig { repo: string; token: string }
export type SyncState = { status: 'off' } | { status: 'connecting' } | { status: 'ok'; at: number } | { status: 'error'; message: string };

export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const repo = localStorage.getItem(REPO_KEY);
  const token = await getSecret(TOKEN_SECRET);
  return repo && token ? { repo, token } : null;
}
export async function saveSyncConfig(c: SyncConfig | null) {
  if (c) { localStorage.setItem(REPO_KEY, c.repo); await setSecret(TOKEN_SECRET, c.token); }
  else { localStorage.removeItem(REPO_KEY); await setSecret(TOKEN_SECRET, ''); }
}

/** mosslight://pair#r=<owner/repo>&t=<token> — shown as a QR code on a paired device. */
export const pairingLink = (c: SyncConfig) => `mosslight://pair#r=${encodeURIComponent(c.repo)}&t=${encodeURIComponent(c.token)}`;
export function parsePairingLink(link: string): SyncConfig | null {
  const m = link.trim().match(/^mosslight:\/\/pair[#?](.+)$/i);
  if (!m) return null;
  const q = new URLSearchParams(m[1]);
  const repo = q.get('r'), token = q.get('t');
  return repo && token ? { repo, token } : null;
}

/**
 * Keeps the local library and the shared repo in step:
 *  - polls hub.json every few seconds (conditional requests, so unchanged polls are free),
 *  - merges remote edits into local state,
 *  - pushes local edits shortly after they happen, retrying on write conflicts.
 */
export class SyncEngine {
  store: GitHubStore;
  private sha: string | null = null;
  private etag: string | undefined;
  private lastPushed = '';
  private timer?: number;
  private pushTimer?: number;
  private busy = false;
  private again = false;
  private stopped = false;

  constructor(
    cfg: SyncConfig,
    private getLocal: () => HubData,
    private applyRemote: (d: HubData) => void,
    private onState: (s: SyncState) => void,
    store?: GitHubStore,
  ) {
    this.store = store || new GitHubStore(cfg.repo, cfg.token);
  }

  async start() {
    this.onState({ status: 'connecting' });
    const err = await this.store.verify().catch(e => String(e?.message || e));
    if (err) { this.onState({ status: 'error', message: err }); return false; }
    this.touchDevice();
    await this.tick(true);
    const loop = () => {
      if (this.stopped) return;
      this.timer = window.setTimeout(async () => {
        if (document.visibilityState !== 'hidden') await this.tick();
        loop();
      }, POLL_MS);
    };
    loop();
    document.addEventListener('visibilitychange', this.onVisible);
    return true;
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.timer);
    window.clearTimeout(this.pushTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  private onVisible = () => { if (document.visibilityState === 'visible') void this.tick(); };

  /** Records this device in the shared device list (at most hourly). */
  private touchDevice() {
    const local = this.getLocal();
    const me = local.devices?.[deviceId];
    if (me && me.name === getDeviceName() && Date.now() - me.lastSeen < 3600e3) return;
    this.applyRemote({ ...local, devices: { ...(local.devices || {}), [deviceId]: { name: getDeviceName(), os: deviceOs, lastSeen: Date.now() } } });
  }

  /** Call after any local change. */
  schedulePush() {
    if (this.stopped) return;
    window.clearTimeout(this.pushTimer);
    this.pushTimer = window.setTimeout(() => void this.tick(), PUSH_DELAY_MS);
  }

  /** Pull, merge and push once (also used by tests). */
  syncNow() { return this.tick(); }

  private async tick(force = false) {
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = await this.store.read(DOC, force ? undefined : this.etag);
        force = false;
        let remote: SyncDoc | null = null;
        if (r.status === 'ok') {
          this.sha = r.sha;
          this.etag = r.etag;
          try { remote = JSON.parse(r.text); } catch { remote = null; }
        } else if (r.status === 'missing') {
          this.sha = null;
        }
        const local = this.getLocal();
        let merged = local;
        if (remote) {
          merged = merge(local, remote);
          if (fingerprint(merged) !== fingerprint(local)) this.applyRemote(merged);
        }
        const out = JSON.stringify(toDoc(merged));
        const remoteSame = remote ? fingerprint(remote) === fingerprint(toDoc(merged)) : false;
        if (remoteSame) { this.lastPushed = out; break; }
        if (r.status === 'same' && out === this.lastPushed) break;
        const res = await this.store.write(DOC, out, this.sha, `Sync from ${getDeviceName()}`);
        if (res === 'conflict') { this.etag = undefined; force = true; continue; }
        this.sha = res;
        this.etag = undefined;
        this.lastPushed = out;
        break;
      }
      this.onState({ status: 'ok', at: Date.now() });
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      this.onState({ status: 'error', message: /failed to fetch|network/i.test(msg) ? "Can't reach GitHub right now — retrying automatically" : msg });
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.schedulePush(); }
    }
  }
}
