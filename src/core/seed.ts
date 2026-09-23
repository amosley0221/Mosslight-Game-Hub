import type { HubData, Project, Settings } from './types';
import { DEFAULT_MODELS } from './constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/** Fill in fields older saves may be missing. */
export const norm = (p: Raw): Project => ({
  platforms: p.platforms || ['windows'],
  stack: p.stack || { languages: [], libraries: [], tools: [] },
  code: p.code || [],
  art: p.art || [],
  gdd: p.gdd || [],
  tasks: p.tasks || [],
  activity: p.activity || [],
  tags: p.tags || [],
  engines: p.engines || [],
  folder: p.folder || null,
  ...p,
  builds: (p.builds || []).map((b: Raw) => ({ ...b, platform: b.platform || (b.kind === 'web' ? 'web' : b.kind === 'android' ? 'android' : 'windows') })),
});

/** A brand-new install starts with an empty library. */
export const emptyData = (): HubData => ({ projects: [], messages: {}, assets: [], usageBy: {}, deleted: {}, devices: {} });

// Demo content that versions 0.1–0.2 pre-filled. Removed once per device; the removal syncs.
const DEMO_PROJECTS = ['hollowmere', 'byteshift', 'orbital'];
const DEMO_ASSETS = ['Mixamo_Idle_Breathing.fbx', 'Mixamo_Walk_Forward.fbx', 'Lantern_v3.glb', 'Moss_Albedo_2k.png', 'UI_Click_Soft.wav', 'CameraShake.cs', 'Fog_Depth.hlsl'];
export const DEMO_USAGE_KEY = 'demo';
const PURGED_KEY = 'mosslight.demoPurged';

/** Demo assets had random ids per device, so they are recognised by name (and never had a file). */
export const isDemoAsset = (a: { name: string; path?: string }) => DEMO_ASSETS.includes(a.name) && !a.path;

const isDemoWelcome = (m: { type: string; text?: string; route?: string }) => m.type === 'agent' && m.route === 'hub' && (m.text || '').startsWith('Mosslight online.');

/** Removes demo projects/assets/messages, leaving deletion markers so other devices drop them too. */
export function purgeDemo(d: HubData, t = Date.now()): HubData {
  const deleted = { ...(d.deleted || {}) };
  for (const id of DEMO_PROJECTS) deleted['p:' + id] = t;
  const assets = d.assets.filter(a => {
    const demo = isDemoAsset(a);
    if (demo) deleted['a:' + a.id] = t;
    return !demo;
  });
  const messages: HubData['messages'] = {};
  for (const [k, list] of Object.entries(d.messages)) {
    if (DEMO_PROJECTS.includes(k)) { list.forEach(m => { deleted['m:' + m.id] = t; }); continue; }
    messages[k] = list.filter(m => {
      if (isDemoWelcome(m as never)) { deleted['m:' + m.id] = t; return false; }
      return true;
    });
  }
  const { [DEMO_USAGE_KEY]: _demo, ...usageBy } = d.usageBy || {};
  void _demo;
  return { ...d, projects: d.projects.filter(p => !DEMO_PROJECTS.includes(p.id)), assets, messages, usageBy, deleted };
}

/** Run the demo cleanup once per device. */
export function purgeDemoOnce(d: HubData): HubData {
  try {
    if (localStorage.getItem(PURGED_KEY)) return d;
    localStorage.setItem(PURGED_KEY, '1');
  } catch { /* storage unavailable — purge anyway */ }
  return purgeDemo(d);
}

export const defaultSettings = (): Settings => ({
  theme: 'dark',
  devMode: true,
  mode: { claude: 'auto', codex: 'auto', grok: 'remote' },
  localModels: {},
  models: { ...DEFAULT_MODELS },
  device: { name: '', paired: false },
  tools: {},
});
