import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AGENTS, ENGINE_BY, LIB_HINTS, WEB_ENGINES, engineName, kindOf } from './constants';
import { respond, type Reply } from './agents';
import { route } from './router';
import { defaultSettings, norm, seedData } from './seed';
import type { AgentId, Asset, Build, HubData, Message, Platform, Project, Settings } from './types';
import { A, T, baseName, fmtSize, now, uid, uniq } from './util';
import {
  adbInstall, copyFile, getDesktopDir, imageDir, isDesktop, joinPath, launchPath, libraryRoot, openExternal,
  pickFolder, platform, removeFile, saveBytes, scanFolder, type ScanResult,
} from '../platform';

const KEY = 'gdh:state:v3';
const SKEY = 'gdh:settings:v1';

function loadData(): HubData {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.projects) return { projects: s.projects.map(norm), usage: s.usage, messages: s.messages || {}, assets: s.assets || [] };
  } catch { /* first run */ }
  return seedData();
}

function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (s) return { ...d, ...s, remote: { ...d.remote, ...s.remote }, models: { ...d.models, ...s.models }, tools: { ...d.tools, ...s.tools } };
  } catch { /* defaults */ }
  return d;
}

export type View = 'library' | 'project' | 'integrations' | 'assets';
export interface Ui {
  view: View;
  pid: string | null;
  tab: string;
  chatOpen: boolean;
  input: string;
  busy: boolean;
  forced: AgentId | null;
  toast: string | null;
}

const BUILD_RE = /\.(lnk|exe|bat|cmd|url|app|command|sh|apk|aab)$/i;
const platformOfFile = (n: string): Platform => (/\.(apk|aab)$/i.test(n) ? 'android' : /\.(app|command|sh)$/i.test(n) ? 'mac' : /\.html?$/i.test(n) ? 'web' : 'windows');
const kindOfFile = (n: string) => (/\.(apk|aab)$/i.test(n) ? 'android' : /\.html?$/i.test(n) ? 'web' : 'desktop') as Build['kind'];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Conventional folder inside a project where linked library assets are copied. */
function assetFolderFor(p: Project) {
  if (p.engines.includes('unreal')) return ['Content', 'Mosslight'];
  if (p.engines.includes('unity')) return ['Assets', 'Mosslight'];
  if (p.engines.includes('godot')) return ['assets', 'mosslight'];
  if (p.engines.some(e => WEB_ENGINES.includes(e))) return ['public', 'assets'];
  return ['assets'];
}

async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Downscale an image file to a JPEG data URL (for thumbnails) or bytes (for covers). */
async function resizeImage(file: Blob, max: number): Promise<{ dataUrl: string; bytes: Uint8Array }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), ch => ch.charCodeAt(0));
    return { dataUrl, bytes };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Detect engines, languages, libraries, builds and platforms from a top-level folder scan. */
async function detectFromScan(scan: ScanResult) {
  const names = scan.entries.map(e => e.name);
  const builds: Build[] = [];
  for (const e of scan.entries) {
    if ((!e.is_dir || /\.app$/i.test(e.name)) && BUILD_RE.test(e.name)) builds.push({ id: uid(), name: e.name, path: await joinPath(scan.path, e.name), kind: kindOfFile(e.name), platform: platformOfFile(e.name), by: 'codex', ts: now() });
    else if (!e.is_dir && e.name.toLowerCase() === 'index.html') builds.push({ id: uid(), name: e.name, path: await joinPath(scan.path, e.name), kind: 'web', platform: 'web', by: 'codex', ts: now() });
  }
  let libs: string[] = [];
  const langs: string[] = [];
  const engines: string[] = [];
  if (scan.packageJson) {
    try {
      const pkg = JSON.parse(scan.packageJson);
      const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
      libs = deps.map(d => LIB_HINTS[d]).filter(Boolean);
      langs.push(deps.includes('typescript') ? 'TypeScript' : 'JavaScript');
      if (deps.includes('@babylonjs/core')) engines.push('babylon');
      if (deps.includes('phaser')) engines.push('phaser');
      if (deps.includes('playcanvas')) engines.push('playcanvas');
      if (deps.includes('three') || (!engines.length)) engines.push('threejs');
    } catch { /* ignore malformed package.json */ }
  }
  if (names.some(n => /\.uproject$/i.test(n))) engines.unshift('unreal');
  if (names.includes('ProjectSettings') && names.includes('Assets')) engines.unshift('unity');
  if (names.includes('project.godot')) engines.unshift('godot');
  if (!scan.packageJson && names.includes('index.html') && !engines.length) engines.push('threejs');
  if (engines.includes('unreal')) langs.push('C++', 'Blueprints');
  if (engines.includes('unity')) langs.push('C#');
  if (engines.includes('godot')) langs.push('GDScript');
  const platforms: Platform[] = [];
  if (names.some(n => /^(android|build\.gradle|gradlew|capacitor\.config)/i.test(n)) || builds.some(b => b.platform === 'android')) platforms.push('android');
  if (builds.some(b => b.platform === 'web') || engines.some(e => WEB_ENGINES.includes(e))) platforms.push('web');
  if (builds.some(b => b.platform === 'mac')) platforms.push('mac');
  if (!platforms.length || builds.some(b => b.platform === 'windows')) platforms.push('windows');
  return { names, builds, libs: uniq(libs), langs: uniq(langs), engines: uniq(engines), platforms: uniq(platforms) };
}

export function useHub() {
  const [data, setData] = useState<HubData>(loadData);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [ui, setUi] = useState<Ui>({ view: 'library', pid: null, tab: 'overview', chatOpen: true, input: '', busy: false, forced: null, toast: null });
  const dataRef = useRef(data); dataRef.current = data;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const uiRef = useRef(ui); uiRef.current = ui;
  const toastTimer = useRef<number>();

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ } }, [data]);
  useEffect(() => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* quota */ } }, [settings]);

  const patchUi = useCallback((p: Partial<Ui> | ((u: Ui) => Partial<Ui>)) => setUi(u => ({ ...u, ...(typeof p === 'function' ? p(u) : p) })), []);
  const toast = useCallback((t: string) => {
    patchUi({ toast: t });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => patchUi({ toast: null }), 2800);
  }, [patchUi]);
  const updProj = useCallback((id: string, fn: (p: Project) => Project) => setData(d => ({ ...d, projects: d.projects.map(p => (p.id === id ? fn({ ...p }) : p)) })), []);
  const updSettings = useCallback((fn: (s: Settings) => Settings) => setSettings(s => fn({ ...s })), []);
  const logActivity = useCallback((pid: string, agent: AgentId, text: string) => updProj(pid, p => ({ ...p, activity: [A(agent, text), ...p.activity] })), [updProj]);

  // ── Chat ──────────────────────────────────────────────────────────────────────
  const push = useCallback((key: string, m: Message) => setData(d => ({ ...d, messages: { ...d.messages, [key]: [...(d.messages[key] || []), m] } })), []);
  const updMsg = useCallback((key: string, id: string, fn: (m: Message) => Message) => setData(d => ({ ...d, messages: { ...d.messages, [key]: (d.messages[key] || []).map(m => (m.id === id ? fn({ ...m } as Message) : m)) } })), []);
  const dropMsg = useCallback((key: string, id: string) => setData(d => ({ ...d, messages: { ...d.messages, [key]: (d.messages[key] || []).filter(m => m.id !== id) } })), []);

  const dispatch = useCallback(async (key: string, agent: AgentId, text: string, routeLabel: string) => {
    const id = uid();
    push(key, { id, type: 'agent', agent, text: '', pending: true, route: routeLabel, userText: text });
    patchUi({ busy: true });
    const proj = dataRef.current.projects.find(p => p.id === key) || null;
    let res: Reply;
    try {
      res = await respond(agent, text, proj, settingsRef.current);
    } catch (e) {
      res = { text: 'Something went wrong: ' + ((e as Error)?.message || String(e)), tokens: 0, error: true };
    }
    patchUi({ busy: false });
    setData(d => {
      const messages = { ...d.messages, [key]: (d.messages[key] || []).map(m => (m.id === id ? { ...m, text: res.text, pending: false, error: res.error } as Message : m)) };
      const usage = { ...d.usage, [agent]: { calls: d.usage[agent].calls + 1, tokens: d.usage[agent].tokens + res.tokens } };
      const projects = !proj ? d.projects : d.projects.map(p => {
        if (p.id !== proj.id) return p;
        const q = { ...p };
        if (res.tasks?.length) { q.tasks = [...q.tasks, ...res.tasks.map(t => T(t.agent || agent, t.title, 'todo', 0))]; q.activity = [...res.tasks.map(t => A(t.agent || agent, 'Task added: ' + t.title)), ...q.activity]; }
        if (res.art?.length) { q.art = [...res.art.map(a => ({ id: uid(), title: a.title, prompt: a.prompt, imagePath: a.imagePath, ts: now() })), ...q.art]; q.activity = [...res.art.map(a => A('grok', 'Generated concept: ' + a.title)), ...q.activity]; }
        if (res.builds?.length) {
          q.builds = [...res.builds.map(b => ({ id: uid(), name: b.name, path: b.path, kind: b.kind || kindOfFile(b.path), platform: b.platform || platformOfFile(b.path), by: 'codex' as AgentId, ts: now() })), ...q.builds];
          q.activity = [...res.builds.map(b => A('codex', 'Registered test build ' + b.name)), ...q.activity];
        }
        if (res.code?.length) { q.code = [...res.code.map(k => ({ id: uid(), agent, title: k.title, file: k.file || '', lang: k.lang || '', code: k.code, ts: now() })), ...q.code]; q.activity = [...res.code.map(k => A(agent, 'Code logged: ' + k.title)), ...q.activity]; }
        if (res.gdd) q.gdd = q.gdd.map(g => (g.title.toLowerCase() === res.gdd!.title.toLowerCase() ? { ...g, body: res.gdd!.body } : g));
        q.activity = [A(agent, 'Replied to: ' + text.slice(0, 60) + (text.length > 60 ? '…' : '')), ...q.activity];
        return q;
      });
      return { ...d, messages, usage, projects };
    });
    if (res.handoff) push(key, { id: uid(), type: 'handoff', from: agent, to: res.handoff.to, reason: res.handoff.reason, status: 'pending', userText: text });
  }, [push, patchUi]);

  /** GDD "Draft with X" writes the agent's reply into that section. */
  const draftSection = useCallback(async (pid: string, sid: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const s = p?.gdd.find(g => g.id === sid);
    if (!p || !s) return;
    const text = `Draft the "${s.title}" section of the GDD for ${p.name}. Keep it under 120 words. Reply with the section text only.`;
    push(pid, { id: uid(), type: 'user', text });
    const before = (dataRef.current.messages[pid] || []).length;
    await dispatch(pid, s.agent, text, 'you picked ' + AGENTS[s.agent].name);
    await new Promise(r => setTimeout(r, 50));
    const reply = (dataRef.current.messages[pid] || []).slice(before).find(m => m.type === 'agent') as Extract<Message, { type: 'agent' }> | undefined;
    if (reply && !reply.error && reply.text) updProj(pid, q => ({ ...q, gdd: q.gdd.map(g => (g.id === sid ? { ...g, body: reply.text.replace(/\n\n\(Simulated[\s\S]*$/, '') } : g)) }));
  }, [dispatch, push, updProj]);

  const sendText = useCallback((key: string, raw: string, forced: AgentId | null) => {
    const text = raw.trim();
    if (!text || uiRef.current.busy) return;
    push(key, { id: uid(), type: 'user', text });
    const r = forced ? { agent: forced, hit: 'manual' } : route(text);
    if (!r.agent) return push(key, { id: uid(), type: 'choose', userText: text });
    void dispatch(key, r.agent, text, r.hit === 'manual' ? 'you picked ' + AGENTS[r.agent].name : `auto-routed · "${r.hit}"`);
  }, [dispatch, push]);

  const chatKey = ui.view === 'project' && ui.pid ? ui.pid : 'global';
  const send = useCallback(() => { const u = uiRef.current; sendText(u.view === 'project' && u.pid ? u.pid : 'global', u.input, u.forced); patchUi({ input: '' }); }, [sendText, patchUi]);
  const ask = useCallback((text: string, forced: AgentId | null = null) => { const u = uiRef.current; sendText(u.view === 'project' && u.pid ? u.pid : 'global', text, forced ?? u.forced); }, [sendText]);

  const reroute = useCallback((key: string, m: Extract<Message, { type: 'agent' }>, to: AgentId) => {
    updMsg(key, m.id, x => ({ ...x, showOverride: false, route: ((x as typeof m).route || '') + ' · rerouted' } as Message));
    void dispatch(key, to, m.userText || m.text, 'rerouted by you');
  }, [dispatch, updMsg]);
  const approve = useCallback((key: string, m: Extract<Message, { type: 'handoff' }>) => {
    updMsg(key, m.id, x => ({ ...x, status: 'approved' } as Message));
    void dispatch(key, m.to, `[Handoff from ${AGENTS[m.from].name}] ${m.reason}\n\nOriginal request: ${m.userText || ''}`, 'handoff · approved by you');
  }, [dispatch, updMsg]);
  const decline = useCallback((key: string, m: Message) => updMsg(key, m.id, x => ({ ...x, status: 'declined' } as Message)), [updMsg]);
  const choose = useCallback((key: string, m: Extract<Message, { type: 'choose' }>, a: AgentId) => { dropMsg(key, m.id); void dispatch(key, a, m.userText, 'you picked ' + AGENTS[a].name); }, [dispatch, dropMsg]);
  const toggleOverride = useCallback((key: string, m: Message) => updMsg(key, m.id, x => ({ ...x, showOverride: !(x as { showOverride?: boolean }).showOverride } as Message)), [updMsg]);

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  const cycleTask = useCallback((pid: string, tid: string) => updProj(pid, p => {
    const tasks = p.tasks.map(t => (t.id === tid ? { ...t, status: t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : 'todo' } as typeof t : t));
    const t = tasks.find(x => x.id === tid)!;
    return { ...p, tasks, activity: [A(t.agent, (t.status === 'done' ? 'Completed ' : t.status === 'doing' ? 'Started ' : 'Reopened ') + t.title), ...p.activity] };
  }), [updProj]);

  // ── Projects ──────────────────────────────────────────────────────────────────
  const createProject = useCallback((nf: { name: string; tagline: string; tags: string[]; engines: string[] }) => {
    const n = nf.name.trim();
    if (!n) { toast('Give the project a name'); return false; }
    const p: Project = {
      id: uid(), name: n, tagline: nf.tagline || 'No pitch yet — ask Grok for one.', tags: nf.tags, engines: nf.engines,
      platforms: nf.tags.includes('Mobile') ? ['android'] : nf.tags.includes('Web') ? ['web'] : ['windows'],
      stack: { languages: [], libraries: [], tools: [] }, code: [], folder: null,
      tasks: [T('grok', 'Write the one-paragraph pitch', 'todo', 0), T('codex', 'Mood board & palette', 'todo', 0), T('claude', 'Project scaffold in ' + (nf.engines[0] ? ENGINE_BY[nf.engines[0]].name : 'chosen engine'), 'todo', 0)],
      art: [], gdd: [{ id: uid(), title: 'Pitch', agent: 'grok', body: '' }, { id: uid(), title: 'Core loop', agent: 'claude', body: '' }], builds: [], activity: [A('claude', 'Project created')],
    };
    setData(d => ({ ...d, projects: [p, ...d.projects] }));
    patchUi({ view: 'project', pid: p.id, tab: 'overview' });
    return true;
  }, [patchUi, toast]);

  const removeProject = useCallback((pid: string) => {
    setData(d => ({ ...d, projects: d.projects.filter(p => p.id !== pid) }));
    patchUi({ view: 'library', pid: null });
  }, [patchUi]);

  const openFolder = useCallback(async () => {
    if (!isDesktop) return toast('Opening local folders needs the desktop app');
    const path = await pickFolder();
    if (!path) return;
    let scan: ScanResult;
    try { scan = await scanFolder(path); } catch (e) { return toast(String(e)); }
    const det = await detectFromScan(scan);
    const match = (p: Project) => p.folder?.path === path || p.folder?.name === scan.name || p.name.toLowerCase() === scan.name.toLowerCase();
    const existing = dataRef.current.projects.find(match);
    const pid = existing ? existing.id : uid();
    setData(d => {
      const ex = d.projects.find(p => p.id === pid);
      if (ex) {
        return { ...d, projects: d.projects.map(p => p.id !== ex.id ? p : {
          ...p, folder: { name: scan.name, path }, engines: p.engines.length ? p.engines : det.engines, platforms: uniq([...p.platforms, ...det.platforms]),
          stack: { ...p.stack, libraries: uniq([...p.stack.libraries, ...det.libs]), languages: uniq([...p.stack.languages, ...det.langs]) },
          builds: [...det.builds.filter(b => !p.builds.some(x => x.path === b.path || x.name === b.name)), ...p.builds],
          activity: [A('claude', `Linked local folder ${scan.name} (${det.builds.length} shortcuts found)`), ...p.activity],
        }) };
      }
      const p: Project = {
        id: pid, name: scan.name, tagline: 'Loaded from local folder. Ask Grok to write the pitch.', tags: det.engines.some(e => WEB_ENGINES.includes(e)) ? ['Web'] : [], engines: det.engines, platforms: det.platforms,
        stack: { languages: det.langs, libraries: det.libs, tools: [] }, code: [], folder: { name: scan.name, path },
        tasks: [T('claude', 'Audit existing code & summarize state', 'todo', 0), T('grok', 'Write pitch from existing project', 'todo', 0)], art: [], gdd: [{ id: uid(), title: 'Pitch', agent: 'grok', body: '' }],
        builds: det.builds, activity: [A('claude', `Imported folder ${scan.name} (${det.builds.length} shortcuts, ${det.names.length} entries)`)],
      };
      return { ...d, projects: [p, ...d.projects] };
    });
    patchUi({ view: 'project', pid, tab: 'builds' });
    toast((det.engines.length ? 'Detected ' + det.engines.map(engineName).join(', ') + ' · ' : '') + (det.libs.length ? det.libs.length + ' libraries · ' : '') + det.builds.length + ' shortcut' + (det.builds.length === 1 ? '' : 's') + ' found');
  }, [patchUi, toast]);

  /** Poll linked folders + the Desktop for new shortcuts/builds (Codex drops them there). */
  useEffect(() => {
    if (!isDesktop) return;
    let stop = false;
    const tick = async () => {
      const desk = await getDesktopDir().catch(() => null);
      const deskScan = desk ? await scanFolder(desk).catch(() => null) : null;
      for (const p of dataRef.current.projects) {
        const found: Build[] = [];
        if (p.folder?.path) {
          const s = await scanFolder(p.folder.path).catch(() => null);
          if (s) found.push(...(await detectFromScan(s)).builds);
        }
        if (deskScan && desk) {
          for (const e of deskScan.entries) {
            if (BUILD_RE.test(e.name) && slug(e.name).startsWith(slug(p.name)) && slug(p.name).length >= 3)
              found.push({ id: uid(), name: e.name, path: await joinPath(desk, e.name), kind: kindOfFile(e.name), platform: platformOfFile(e.name), by: 'codex', ts: now() });
          }
        }
        const fresh = found.filter(b => !p.builds.some(x => x.path === b.path) && !(p.dismissed || []).includes(b.path));
        if (fresh.length && !stop) {
          updProj(p.id, q => ({ ...q, builds: [...fresh.filter(b => !q.builds.some(x => x.path === b.path)), ...q.builds], activity: [...fresh.map(b => A('codex', 'New build detected: ' + b.name)), ...q.activity] }));
          toast(`New build for ${p.name}: ${fresh[0].name}`);
        }
      }
    };
    const iv = window.setInterval(() => { void tick(); }, 15000);
    void tick();
    return () => { stop = true; window.clearInterval(iv); };
  }, [updProj, toast]);

  // ── Builds ────────────────────────────────────────────────────────────────────
  const launch = useCallback(async (p: Project, b: Build) => {
    try {
      if (b.platform === 'android' && !/^https?:/i.test(b.path)) {
        if (platform !== 'desktop') return toast('This APK lives on your computer — launch it from the desktop app');
        toast('Installing ' + b.name + ' on your Android device…');
        toast(await adbInstall(b.path));
      } else if (/^https?:/i.test(b.path)) {
        await openExternal(b.path);
        toast('Opened ' + b.name);
      } else {
        if (platform !== 'desktop') return toast('This build lives on your computer — launch it from the desktop app');
        await launchPath(b.path);
        toast('Launched ' + b.name);
      }
      logActivity(p.id, 'codex', 'Launched test build ' + b.name);
    } catch (e) {
      toast('Couldn\'t launch ' + b.name + ': ' + ((e as Error)?.message || String(e)));
    }
  }, [logActivity, toast]);

  const addBuild = useCallback((pid: string, v: string) => {
    const path = v.trim().replace(/^"|"$/g, '');
    if (!path) return;
    const name = baseName(path);
    updProj(pid, p => ({ ...p, builds: [{ id: uid(), name, path, kind: /^https?:/i.test(path) ? 'web' : kindOfFile(path), platform: /^https?:/i.test(path) ? 'web' : platformOfFile(path), by: 'codex', ts: now() }, ...p.builds], activity: [A('codex', 'Registered shortcut ' + name), ...p.activity] }));
  }, [updProj]);

  const removeBuild = useCallback((pid: string, b: Build) => updProj(pid, p => ({ ...p, builds: p.builds.filter(x => x.id !== b.id), dismissed: uniq([...(p.dismissed || []), b.path]) })), [updProj]);

  // ── Images (covers, art, previews) ────────────────────────────────────────────
  const storeImage = useCallback(async (file: File, name: string): Promise<string> => {
    const { dataUrl, bytes } = await resizeImage(file, 1400);
    if (platform === 'web') return dataUrl;
    const fname = `${name}_${Date.now().toString(36)}.jpg`;
    return saveBytes(bytes, isDesktop ? await joinPath(await imageDir(), fname) : '', `images/${fname}`);
  }, []);

  const setCoverImage = useCallback(async (pid: string, file: File) => {
    const path = await storeImage(file, 'cover_' + pid);
    updProj(pid, p => ({ ...p, coverImage: path, coverArt: undefined }));
  }, [storeImage, updProj]);

  const setArtImage = useCallback(async (pid: string, aid: string, file: File) => {
    const path = await storeImage(file, 'art_' + aid);
    updProj(pid, p => ({ ...p, art: p.art.map(a => (a.id === aid ? { ...a, imagePath: path } : a)) }));
  }, [storeImage, updProj]);

  // ── Asset library ─────────────────────────────────────────────────────────────
  const addAssets = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const root = isDesktop ? await libraryRoot(settingsRef.current.libraryDir) : '';
    const added: Asset[] = [];
    let dupes = 0;
    for (const f of files) {
      const buf = await f.arrayBuffer();
      const hash = await sha256(buf);
      if (dataRef.current.assets.some(a => a.hash === hash) || added.some(a => a.hash === hash)) { dupes++; continue; }
      const kind = kindOf(f.name);
      let path: string | undefined;
      if (isDesktop) path = await saveBytes(new Uint8Array(buf), await joinPath(root, kind, f.name), '');
      let preview: string | undefined;
      if ((kind === 'image' || kind === 'texture') && /\.(png|jpe?g|webp)$/i.test(f.name)) preview = (await resizeImage(f, 480).catch(() => null))?.dataUrl;
      const pid = uiRef.current.view === 'project' ? uiRef.current.pid : null;
      added.push({ id: uid(), name: f.name, kind, size: fmtSize(f.size), tags: [], ts: now(), usedBy: pid ? [pid] : [], path, preview, hash });
    }
    setData(d => ({ ...d, assets: [...added, ...d.assets] }));
    toast(`Added ${added.length} file${added.length === 1 ? '' : 's'} to the asset library` + (dupes ? ` · ${dupes} already there` : ''));
  }, [toast]);

  const toggleAssetLink = useCallback(async (a: Asset, p: Project) => {
    const linked = a.usedBy.includes(p.id);
    let links = { ...(a.links || {}) };
    try {
      if (!linked && isDesktop && a.path && p.folder?.path) {
        links[p.id] = await copyFile(a.path, await joinPath(p.folder.path, ...assetFolderFor(p), a.name));
      } else if (linked && links[p.id]) {
        await removeFile(links[p.id]);
        const { [p.id]: _gone, ...rest } = links;
        void _gone;
        links = rest;
      }
    } catch (e) {
      toast('Couldn\'t copy into the project: ' + String(e));
    }
    setData(d => ({
      ...d,
      assets: d.assets.map(x => (x.id === a.id ? { ...x, links, usedBy: linked ? x.usedBy.filter(i => i !== p.id) : [...x.usedBy, p.id] } : x)),
      projects: d.projects.map(q => (q.id === p.id ? { ...q, activity: [A('codex', (linked ? 'Unlinked asset ' : 'Linked asset ') + a.name), ...q.activity] } : q)),
    }));
    toast((linked ? 'Removed from ' : 'Added to ') + p.name);
  }, [toast]);

  const removeAsset = useCallback((id: string) => setData(d => ({ ...d, assets: d.assets.filter(x => x.id !== id) })), []);
  const setAssetPreview = useCallback(async (id: string, file: File) => {
    const r = await resizeImage(file, 480);
    setData(d => ({ ...d, assets: d.assets.map(x => (x.id === id ? { ...x, preview: r.dataUrl } : x)) }));
  }, []);

  const proj = useMemo(() => (ui.view === 'project' ? data.projects.find(p => p.id === ui.pid) || null : null), [data.projects, ui.view, ui.pid]);

  return {
    data, settings, ui, proj, chatKey,
    patchUi, toast, updProj, updSettings, setData,
    send, ask, dispatch, reroute, approve, decline, choose, toggleOverride, draftSection,
    cycleTask, createProject, removeProject, openFolder,
    launch, addBuild, removeBuild, setCoverImage, setArtImage,
    addAssets, toggleAssetLink, removeAsset, setAssetPreview,
  };
}

export type Hub = ReturnType<typeof useHub>;
