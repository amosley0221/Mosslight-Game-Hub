import type { AgentId, Asset, HubData, Message, Project, Usage } from '../core/types';
import { DEMO_USAGE_KEY, isDemoAsset } from '../core/seed';

/** What goes into the shared store. Settings (theme, API keys, Local/Remote) stay per device. */
export type SyncDoc = Pick<HubData, 'projects' | 'messages' | 'assets' | 'usageBy' | 'deleted' | 'devices'> & { v: 1 };

/**
 * Messages kept per thread in the shared document. High enough that real histories are never
 * trimmed; `fitDoc` lowers it only if a library grows past what one document should carry.
 */
export const FULL_THREAD = 5000;

export const toDoc = (d: HubData, maxThread = FULL_THREAD): SyncDoc => ({
  v: 1,
  projects: d.projects,
  assets: d.assets,
  usageBy: d.usageBy,
  deleted: d.deleted || {},
  devices: d.devices || {},
  messages: Object.fromEntries(Object.entries(d.messages).map(([k, v]) => [k, v.slice(-maxThread)])),
});

/** Biggest shared document we'll push. GitHub's contents API takes far more, but this stays quick. */
const MAX_DOC = 12 * 1024 * 1024;

/**
 * The document to upload: whole chat threads, unless the library is so large that the document
 * would be unwieldy — then the oldest messages are left out of *this upload only*. They stay on
 * the device that has them, so nothing is deleted.
 */
export function fitDoc(d: HubData): { doc: SyncDoc; json: string; trimmedTo?: number } {
  for (const cap of [FULL_THREAD, 2000, 800, 300]) {
    const doc = toDoc(d, cap);
    const json = JSON.stringify(doc);
    if (json.length <= MAX_DOC || cap === 300) return { doc, json, trimmedTo: cap === FULL_THREAD ? undefined : cap };
  }
  throw new Error('unreachable');
}

/** Last-writer-wins per entity (by `u`), with deletion markers winning over older edits. */
function mergeById<X extends { id: string; u?: number }>(local: X[], remote: X[], prefix: string, deleted: Record<string, number>): X[] {
  const byId = new Map<string, X>();
  const order: string[] = [];
  for (const x of [...local, ...remote]) {
    const prev = byId.get(x.id);
    if (!prev) { byId.set(x.id, x); order.push(x.id); }
    else if ((x.u || 0) > (prev.u || 0)) byId.set(x.id, x);
  }
  return order.map(id => byId.get(id)!).filter(x => !(deleted[prefix + x.id] >= (x.u || 0)));
}

function mergeThread(local: Message[], remote: Message[], deleted: Record<string, number>): Message[] {
  const byId = new Map<string, Message>();
  const firstSeen = new Map<string, number>();
  [...remote, ...local].forEach((m, i) => {
    const prev = byId.get(m.id);
    if (!firstSeen.has(m.id)) firstSeen.set(m.id, i);
    if (!prev || (m.u || 0) > (prev.u || 0)) byId.set(m.id, m);
  });
  return [...byId.values()]
    .filter(m => !deleted['m:' + m.id])
    .sort((a, b) => (a.ts || 0) - (b.ts || 0) || firstSeen.get(a.id)! - firstSeen.get(b.id)!);
}

function mergeUsage(a: Record<string, Record<AgentId, Usage>>, b: Record<string, Record<AgentId, Usage>>) {
  const out: Record<string, Record<AgentId, Usage>> = { ...b };
  for (const [dev, u] of Object.entries(a)) {
    const r = out[dev];
    // Each device only ever increases its own counters, so the larger value is the newer one.
    out[dev] = !r ? u : (Object.fromEntries((Object.keys({ ...u, ...r }) as AgentId[]).map(k => [k, (u[k]?.calls || 0) >= (r[k]?.calls || 0) ? u[k] : r[k]])) as Record<AgentId, Usage>);
  }
  delete out[DEMO_USAGE_KEY];
  return out;
}

export function merge(local: HubData, remote: SyncDoc): HubData {
  const deleted = { ...(remote.deleted || {}) };
  for (const [k, t] of Object.entries(local.deleted || {})) deleted[k] = Math.max(t, deleted[k] || 0);
  const devices = { ...(remote.devices || {}) };
  for (const [k, d] of Object.entries(local.devices || {})) if (!devices[k] || d.lastSeen > devices[k].lastSeen) devices[k] = d;
  const threads = new Set([...Object.keys(local.messages), ...Object.keys(remote.messages || {})]);
  return {
    projects: mergeById<Project>(local.projects, remote.projects || [], 'p:', deleted),
    assets: mergeById<Asset>(local.assets, remote.assets || [], 'a:', deleted).filter(a => !isDemoAsset(a)),
    messages: Object.fromEntries([...threads].map(k => [k, mergeThread(local.messages[k] || [], remote.messages?.[k] || [], deleted)])),
    usageBy: mergeUsage(local.usageBy, remote.usageBy || {}),
    deleted,
    devices,
  };
}

/** Stable string for "did anything change" checks. */
export const fingerprint = (d: HubData | SyncDoc) => JSON.stringify([d.projects, d.assets, d.messages, d.usageBy, d.deleted || {}, d.devices || {}]);
