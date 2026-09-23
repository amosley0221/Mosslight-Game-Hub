// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { stamp } from '../core/store';
import { seedData } from '../core/seed';
import type { HubData } from '../core/types';
import { SyncEngine } from './engine';
import type { GitHubStore } from './github';
import { merge, toDoc } from './merge';

/** In-memory stand-in for the GitHub contents API, with optimistic concurrency on sha. */
class FakeStore {
  files = new Map<string, { sha: string; text: string }>();
  n = 0;
  beforeWrite?: () => unknown;
  async verify() { return null; }
  async read(path: string, etag?: string) {
    const f = this.files.get(path);
    if (!f) return { status: 'missing' as const };
    if (etag === f.sha) return { status: 'same' as const };
    return { status: 'ok' as const, sha: f.sha, text: f.text, etag: f.sha };
  }
  async write(path: string, body: string | Uint8Array, sha: string | null) {
    const hook = this.beforeWrite;
    this.beforeWrite = undefined;
    await hook?.();
    const f = this.files.get(path);
    if ((f?.sha ?? null) !== sha) return 'conflict' as const;
    const s = 'sha' + ++this.n;
    this.files.set(path, { sha: s, text: String(body) });
    return s;
  }
}

const empty = (): HubData => ({ projects: [], messages: {}, assets: [], usageBy: {}, deleted: {}, devices: {} });

function device(store: FakeStore, initial: HubData) {
  let data = initial;
  const engine = new SyncEngine({ repo: 'me/sync', token: 't' }, () => data, d => { data = merge(data, toDoc(d)); }, () => {}, store as unknown as GitHubStore);
  return {
    get: () => data,
    edit: (fn: (d: HubData) => HubData) => { data = stamp(data, fn(data)); },
    sync: () => engine.syncNow(),
  };
}

const later = () => new Promise(r => setTimeout(r, 3));

describe('sync between devices', () => {
  it('a new device receives the whole library', async () => {
    const store = new FakeStore();
    const pc = device(store, seedData());
    const phone = device(store, empty());
    await pc.sync();
    await phone.sync();
    expect(phone.get().projects.map(p => p.name)).toEqual(pc.get().projects.map(p => p.name));
    expect(phone.get().assets.length).toBe(pc.get().assets.length);
  });

  it('edits on one device show up on the other', async () => {
    const store = new FakeStore();
    const pc = device(store, seedData());
    const phone = device(store, empty());
    await pc.sync(); await phone.sync();
    await later();
    const tid = phone.get().projects[0].tasks[2].id;
    phone.edit(d => ({ ...d, projects: d.projects.map((p, i) => (i ? p : { ...p, tasks: p.tasks.map(t => (t.id === tid ? { ...t, status: 'done' as const } : t)) })) }));
    await phone.sync(); await pc.sync();
    expect(pc.get().projects[0].tasks.find(t => t.id === tid)!.status).toBe('done');
  });

  it('concurrent edits to different projects both survive a write conflict', async () => {
    const store = new FakeStore();
    const pc = device(store, seedData());
    const mac = device(store, empty());
    await pc.sync(); await mac.sync();
    await later();
    pc.edit(d => ({ ...d, projects: d.projects.map(p => (p.id === 'hollowmere' ? { ...p, tagline: 'edited on PC' } : p)) }));
    mac.edit(d => ({ ...d, projects: d.projects.map(p => (p.id === 'byteshift' ? { ...p, tagline: 'edited on Mac' } : p)) }));
    // The PC's write lands between the Mac's read and write, forcing a conflict + retry.
    store.beforeWrite = () => pc.sync();
    await mac.sync();
    await later();
    await pc.sync(); await mac.sync();
    for (const d of [pc, mac]) {
      expect(d.get().projects.find(p => p.id === 'hollowmere')!.tagline).toBe('edited on PC');
      expect(d.get().projects.find(p => p.id === 'byteshift')!.tagline).toBe('edited on Mac');
    }
  });

  it('the newer edit to the same project wins', async () => {
    const store = new FakeStore();
    const pc = device(store, seedData());
    const phone = device(store, empty());
    await pc.sync(); await phone.sync();
    await later();
    pc.edit(d => ({ ...d, projects: d.projects.map(p => (p.id === 'orbital' ? { ...p, name: 'Old name' } : p)) }));
    await later();
    phone.edit(d => ({ ...d, projects: d.projects.map(p => (p.id === 'orbital' ? { ...p, name: 'Newest name' } : p)) }));
    await pc.sync(); await phone.sync(); await pc.sync();
    expect(pc.get().projects.find(p => p.id === 'orbital')!.name).toBe('Newest name');
    expect(phone.get().projects.find(p => p.id === 'orbital')!.name).toBe('Newest name');
  });

  it('deleting a project removes it everywhere and it does not come back', async () => {
    const store = new FakeStore();
    const pc = device(store, seedData());
    const phone = device(store, empty());
    await pc.sync(); await phone.sync();
    await later();
    pc.edit(d => ({ ...d, projects: d.projects.filter(p => p.id !== 'byteshift') }));
    await pc.sync(); await phone.sync(); await pc.sync(); await phone.sync();
    expect(phone.get().projects.some(p => p.id === 'byteshift')).toBe(false);
    expect(pc.get().projects.some(p => p.id === 'byteshift')).toBe(false);
  });

  it('chat messages from both devices are merged in order', async () => {
    const store = new FakeStore();
    const pc = device(store, seedData());
    const phone = device(store, empty());
    await pc.sync(); await phone.sync();
    await later();
    pc.edit(d => ({ ...d, messages: { ...d.messages, global: [...(d.messages.global || []), { id: 'pc1', type: 'user', text: 'from pc' }] } }));
    await later();
    phone.edit(d => ({ ...d, messages: { ...d.messages, global: [...(d.messages.global || []), { id: 'ph1', type: 'user', text: 'from phone' }] } }));
    await pc.sync(); await phone.sync(); await pc.sync();
    const ids = (d: typeof pc) => d.get().messages.global.map(m => m.id).slice(-2);
    expect(ids(pc)).toEqual(['pc1', 'ph1']);
    expect(ids(phone)).toEqual(['pc1', 'ph1']);
  });

  it('usage from each device adds up instead of overwriting', async () => {
    const store = new FakeStore();
    const pc = device(store, { ...empty(), usageBy: { pc: { grok: { calls: 2, tokens: 10 }, codex: { calls: 0, tokens: 0 }, claude: { calls: 5, tokens: 50 } } } });
    const phone = device(store, { ...empty(), usageBy: { phone: { grok: { calls: 1, tokens: 5 }, codex: { calls: 0, tokens: 0 }, claude: { calls: 0, tokens: 0 } } } });
    await pc.sync(); await phone.sync(); await pc.sync();
    expect(Object.keys(pc.get().usageBy).sort()).toEqual(['pc', 'phone']);
    expect(Object.keys(phone.get().usageBy).sort()).toEqual(['pc', 'phone']);
  });
});
