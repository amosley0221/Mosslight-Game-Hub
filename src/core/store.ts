import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AGENTS, ENGINE_BY, LIB_HINTS, WEB_ENGINES, engineName, kindOf } from './constants';
import { planTeam, respond, type Reply } from './agents';
import { route } from './router';
import { defaultSettings, emptyData, norm, purgeDemoOnce } from './seed';
import type { AgentId, AgentMode, Asset, Attachment, Build, HubData, Message, PlanStep, Platform, Project, ProjectDoc, Settings, StoryEntry, StorySection, Task, TaskStatus, Usage } from './types';
import { prepareAttachments } from './attachments';
import { A, T, baseName, fmtSize, now, uid, uniq } from './util';
import {
  cancelAgentRun, copyFile, getDesktopDir, homePath, pickParentFolder, writeTextIfMissing, imageDir, isDesktop, joinPath, launchPath, libraryRoot, openExternal,
  pickFolder, platform, readFileBytes, removeFile, saveBytes, scanFolder, findBuilds, findFiles, fileSrc, type ScanResult,
} from '../platform';
import { OS_LABEL, deviceId, deviceOs, localFolder } from '../sync/device';
import { SyncEngine, loadSyncConfig, saveSyncConfig, type SyncConfig, type SyncState } from '../sync/engine';
import { merge, toDoc } from '../sync/merge';
import { setImageStore, uploadFile, uploadImage } from '../sync/images';
import { installOrLaunch, uploadApk } from '../sync/apk';
import { createRepo, getRepo, repoSlug, type GhRepo } from '../github/api';
import { backup, cloneRepo, connectFolder, detectRepo, pushBranch, unpushedBranches } from '../github/git';
import { installKit, kitPrompt } from '../brand/kit';
import { loadState, readLegacy, saveState } from './storage';
import { beginRun, endRun, startRun } from './runs';
import { CARD_DIR, cardRelPath, parseCard, writeCard } from './cards';
import { runImages } from './shots';

const SKEY = 'gdh:settings:v1';

type SavedData = Partial<HubData> & { usage?: Record<AgentId, Usage> };

function shape(s: SavedData | null): HubData | null {
  if (!s || !s.projects) return null;
  return purgeDemoOnce({
    projects: s.projects.map(norm), messages: s.messages || {}, assets: s.assets || [],
    usageBy: s.usageBy || (s.usage ? { [deviceId]: s.usage } : {}), deleted: s.deleted || {}, devices: s.devices || {},
  });
}

/** First paint: the old localStorage copy if this device still has one, otherwise empty until IndexedDB answers. */
function loadData(): HubData {
  try {
    return shape(readLegacy<SavedData>()) || emptyData();
  } catch {
    return emptyData();
  }
}

const ZERO: Record<AgentId, Usage> = { grok: { calls: 0, tokens: 0 }, codex: { calls: 0, tokens: 0 }, claude: { calls: 0, tokens: 0 } };

/** Usage summed over every device that shares the library. */
export function totalUsage(d: HubData): Record<AgentId, Usage> {
  const t = { grok: { ...ZERO.grok }, codex: { ...ZERO.codex }, claude: { ...ZERO.claude } };
  for (const u of Object.values(d.usageBy || {})) for (const a of Object.keys(t) as AgentId[]) { t[a].calls += u[a]?.calls || 0; t[a].tokens += u[a]?.tokens || 0; }
  return t;
}


/**
 * Timestamps whatever a local update changed (so other devices can merge it) and turns
 * removals into deletion markers so they propagate instead of coming back on next sync.
 */
export function stamp(prev: HubData, next: HubData): HubData {
  if (prev === next) return next;
  const t = now();
  const deleted = { ...(next.deleted || {}) };
  const pm = new Map(prev.projects.map(p => [p.id, p]));
  const am = new Map(prev.assets.map(a => [a.id, a]));
  const nextP = new Set(next.projects.map(p => p.id));
  const nextA = new Set(next.assets.map(a => a.id));
  for (const p of prev.projects) if (!nextP.has(p.id)) deleted['p:' + p.id] = t;
  for (const a of prev.assets) if (!nextA.has(a.id)) deleted['a:' + a.id] = t;
  const messages: HubData['messages'] = {};
  for (const [k, list] of Object.entries(next.messages)) {
    const before = prev.messages[k];
    if (before === list) { messages[k] = list; continue; }
    const old = new Map((before || []).map(m => [m.id, m]));
    const ids = new Set(list.map(m => m.id));
    for (const m of before || []) if (!ids.has(m.id)) deleted['m:' + m.id] = t;
    messages[k] = list.map(m => (old.get(m.id) === m ? m : ({ ...m, u: t, ts: m.ts ?? t } as Message)));
  }
  return {
    ...next,
    messages,
    deleted,
    projects: next.projects.map(p => (pm.get(p.id) === p ? p : { ...p, u: t })),
    assets: next.assets.map(a => (am.get(a.id) === a ? a : { ...a, u: t })),
  };
}

/**
 * A saved model must look like a provider's model id ("claude-opus-5", "grok-4"), not a label
 * like "Claude" — a name that reaches the API as a 404 that reads like an outage. Anything that
 * can't be a model id falls back to the default for that agent.
 */
const looksLikeModelId = (m: unknown) => typeof m === 'string' && /^[a-z][a-z0-9]*[.\-_:]/.test(m.trim());
type Models = Settings['models'];
function fixModels(defaults: Models, saved: Partial<Models> | undefined): Models {
  const out = { ...defaults };
  for (const [k, v] of Object.entries(saved || {})) if (looksLikeModelId(v)) out[k as keyof Models] = (v as string).trim();
  return out;
}

function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (s) {
      // Before 0.4 there was only a Local/Remote switch; Remote (the default) becomes Auto = local first.
      const legacy = (a: AgentId): AgentMode => (s.remote && s.remote[a] === false ? 'local' : 'auto');
      const mode = s.mode || { claude: legacy('claude'), codex: legacy('codex'), grok: 'remote' };
      return { ...d, ...s, mode: { ...d.mode, ...mode, grok: 'remote' }, models: fixModels(d.models, s.models), localModels: { ...(s.localModels || {}) }, tools: { ...d.tools, ...s.tools } };
    }
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
  forced: AgentId | 'team' | null;
  toast: string | null;
  /** Files staged in the composer; they go out with the next message. */
  attachments: Attachment[];
  /** Name of the file currently being prepared, while it's being read. */
  attaching: string | null;
}

const BUILD_RE = /\.(lnk|exe|bat|cmd|url|app|command|sh|apk|aab)$/i;
const platformOfFile = (n: string): Platform => (/\.(apk|aab)$/i.test(n) ? 'android' : /\.(app|command|sh)$/i.test(n) ? 'mac' : /\.html?$/i.test(n) ? 'web' : 'windows');
const kindOfFile = (n: string) => (/\.(apk|aab)$/i.test(n) ? 'android' : /\.html?$/i.test(n) ? 'web' : 'desktop') as Build['kind'];
const isUrl = (p: string) => /^https?:/i.test(p);
const slug =(s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** "MosslightVillage.exe" → "MosslightVillage" (build names read better without the extension). */
/** Files a project uses to tell agents how to work on it, best first. */
const BRIEF_FILES = ['AGENTS.md', 'CLAUDE.md', 'Docs/PROJECT-HANDOFF.md', 'PROJECT-HANDOFF.md', 'docs/PROJECT-HANDOFF.md', '.github/copilot-instructions.md'];
const BRIEF_PER_FILE = 6000;
const BRIEF_TOTAL = 9000;
const stripExt = (n: string) => n.replace(/\.[^.]+$/, '');
/** A build found deep in the folder, named by its file and the folder it sits in. */
const buildFrom = (f: { path: string; name: string; folder: string; modified: number }): Build => ({
  id: uid(), name: f.folder ? `${stripExt(f.name)} (${f.folder.split('/').pop()})` : stripExt(f.name),
  path: f.path, kind: kindOfFile(f.name), platform: platformOfFile(f.name), by: 'codex',
  ts: f.modified || Date.now(), device: deviceId,
});

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
    if ((!e.is_dir || /\.app$/i.test(e.name)) && BUILD_RE.test(e.name)) builds.push({ id: uid(), name: e.name, path: await joinPath(scan.path, e.name), kind: kindOfFile(e.name), platform: platformOfFile(e.name), by: 'codex', ts: now(), device: deviceId });
    else if (!e.is_dir && e.name.toLowerCase() === 'index.html') builds.push({ id: uid(), name: e.name, path: await joinPath(scan.path, e.name), kind: 'web', platform: 'web', by: 'codex', ts: now(), device: deviceId });
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
  const [data, setRaw] = useState<HubData>(loadData);
  const setData = useCallback((fn: (d: HubData) => HubData) => setRaw(prev => stamp(prev, fn(prev))), []);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [ui, setUi] = useState<Ui>({ view: 'library', pid: null, tab: 'overview', chatOpen: true, input: '', busy: false, forced: null, toast: null, attachments: [], attaching: null });
  const dataRef = useRef(data); dataRef.current = data;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const uiRef = useRef(ui); uiRef.current = ui;
  const toastTimer = useRef<number>();
  const engineRef = useRef<SyncEngine | null>(null);

  // The library lives in IndexedDB. Load it once, then save every change — and if a save ever
  // fails, say so instead of losing work quietly the way the old localStorage copy could.
  const hydrated = useRef(false);
  const saveFailed = useRef(false);
  useEffect(() => {
    let alive = true;
    void loadState<SavedData>()
      .then(saved => { const d = shape(saved); if (alive && d) setRaw(d); })
      .catch(() => {})
      .finally(() => { hydrated.current = true; });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    void saveState(data).then(
      () => { saveFailed.current = false; },
      (e: unknown) => {
        if (saveFailed.current) return; // one warning per run of bad luck, not one per keystroke
        saveFailed.current = true;
        setUi(u => ({ ...u, toast: `Couldn't save to this device: ${String((e as Error)?.message || e)}` }));
      },
    );
  }, [data]);
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
  type AgentMsg = Extract<Message, { type: 'agent' }>;
  type PlanMsg = Extract<Message, { type: 'plan' }>;
  const updAgentMsg = useCallback((key: string, id: string, patch: Partial<AgentMsg> | ((m: AgentMsg) => Partial<AgentMsg>)) => updMsg(key, id, m => ({ ...m, ...(typeof patch === 'function' ? patch(m as AgentMsg) : patch) } as Message)), [updMsg]);
  const updPlan = useCallback((key: string, id: string, fn: (m: PlanMsg) => Partial<PlanMsg>) => updMsg(key, id, m => ({ ...m, ...fn(m as PlanMsg) } as Message)), [updMsg]);

  // Each agent works through its own queue, so different agents run at the same time.
  const queues = useRef<Partial<Record<AgentId, Promise<unknown>>>>({});
  const running = useRef(0);
  const liveRuns = useRef(new Map<string, { ctrl: AbortController; runId: string }>());
  const skipped = useRef(new Set<string>());
  const setRunning = (delta: number) => { running.current += delta; patchUi({ busy: running.current > 0 }); };

  /** Applies a finished reply's side effects (tasks, art, builds, code, usage) to the project. */
  const applyReply = useCallback((key: string, agent: AgentId, text: string, res: Reply) => {
    const proj = dataRef.current.projects.find(p => p.id === key) || null;
    const newCards: Task[] = [];
    setData(d => {
      const mine = { ...ZERO, ...(d.usageBy[deviceId] || {}) };
      const usageBy = res.offline || !res.tokens ? d.usageBy : { ...d.usageBy, [deviceId]: { ...mine, [agent]: { calls: mine[agent].calls + 1, tokens: mine[agent].tokens + res.tokens } } };
      const projects = !proj || res.offline ? d.projects : d.projects.map(p => {
        if (p.id !== proj.id) return p;
        const q = { ...p };
        if (res.tasks?.length) {
          const fresh = res.tasks.map(t => T(t.agent || agent, t.title, 'todo', 0));
          q.tasks = [...q.tasks, ...fresh];
          q.activity = [...res.tasks.map(t => A(t.agent || agent, 'Task added: ' + t.title)), ...q.activity];
          // Each new task gets its card in Docs/Tasks, so it exists in the repository too.
          newCards.push(...fresh);
        }
        // Cast and places an agent named while working go straight into the story bible.
        if (res.entries?.length) {
          const story = [...(q.story || [])];
          for (const e of res.entries.slice(0, 5)) {
            const title = e.section.replace(/^\w/, c => c.toUpperCase());
            let sec = story.find(s => s.title.toLowerCase() === title.toLowerCase());
            if (!sec) { sec = { id: uid(), title, entries: [], ts: now() }; story.push(sec); }
            if (sec.entries.some(x => x.name.toLowerCase() === e.name.toLowerCase())) continue;
            sec.entries = [...sec.entries, { id: uid(), name: e.name, body: e.body, images: [], ts: now() }];
            q.activity = [A(agent, `Added ${e.name} to ${title}`), ...q.activity];
          }
          q.story = story.map(s => ({ ...s }));
        }
        if (res.art?.length) { q.art = [...res.art.map(a => ({ id: uid(), title: a.title, prompt: a.prompt, imagePath: a.imagePath, ts: now() })), ...q.art]; q.activity = [...res.art.map(a => A('grok', 'Generated concept: ' + a.title)), ...q.activity]; }
        if (res.builds?.length) {
          const fresh = res.builds.map(b => ({ id: uid(), name: b.name, path: b.path, kind: b.kind || kindOfFile(b.path), platform: b.platform || platformOfFile(b.path), by: 'codex' as AgentId, ts: now(), device: isUrl(b.path) ? undefined : deviceId }));
          q.builds = [...fresh, ...q.builds];
          q.spotlight = { buildId: fresh[0].id, ts: now() };
          q.activity = [...res.builds.map(b => A('codex', 'Registered test build ' + b.name)), ...q.activity];
        }
        if (res.code?.length) { q.code = [...res.code.map(k => ({ id: uid(), agent, title: k.title, file: k.file || '', lang: k.lang || '', code: k.code, ts: now() })), ...q.code]; q.activity = [...res.code.map(k => A(agent, 'Code logged: ' + k.title)), ...q.activity]; }
        if (res.gdd) q.gdd = q.gdd.map(g => (g.title.toLowerCase() === res.gdd!.title.toLowerCase() ? { ...g, body: res.gdd!.body } : g));
        q.activity = [A(agent, `${res.stopped ? 'Stopped' : 'Replied to'}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`), ...q.activity];
        return q;
      });
      return { ...d, usageBy, projects };
    });
    if (newCards.length && proj) for (const t of newCards) void saveCardRef.current?.(proj.id, t, `raised by ${AGENTS[agent].name}`);
  }, [setData]);

  /** Set once `saveCard` exists below; applyReply is defined before it. */
  const saveCardRef = useRef<(pid: string, task: Task, change?: string) => Promise<void>>();

  /**
   * What was said in this chat before now, for the agent's context. Handoffs and plans are
   * included as lines of their own — "Codex suggested Claude take X" is often the thing the
   * next message refers to.
   */
  const historyFor = useCallback((key: string, skipId?: string) => {
    const list = (dataRef.current.messages[key] || []).filter(m => m.id !== skipId).slice(-14);
    const out: { who: string; text: string }[] = [];
    for (const m of list) {
      if (m.type === 'user') out.push({ who: 'User', text: m.text + (m.attachments?.length ? `\n(attached: ${m.attachments.map(a => a.name).join(', ')})` : '') });
      else if (m.type === 'agent' && m.text && !m.pending) out.push({ who: AGENTS[m.agent].name, text: m.text });
      else if (m.type === 'handoff') out.push({ who: AGENTS[m.from].name, text: `Suggested ${AGENTS[m.to].name} take this (${m.status}): ${m.reason}${m.prompt ? `\nPrompt written for ${AGENTS[m.to].name}:\n${m.prompt}` : ''}` });
      else if (m.type === 'plan' && m.summary) out.push({ who: `${AGENTS[m.lead].name} (team plan, ${m.status})`, text: `${m.summary}\n${m.steps.map((s, i) => `${i + 1}. [${AGENTS[s.agent].name}] ${s.title}`).join('\n')}` });
    }
    return out;
  }, []);

  const approveRef = useRef<(key: string, m: Extract<Message, { type: 'handoff' }>, prompt?: string, auto?: boolean) => void>();

  /**
   * Sends a request to one agent. Shows live progress (streamed text, steps, timer) while it runs,
   * waits in that agent's queue if it's busy, and resolves with the final reply.
   */
  const dispatch = useCallback((key: string, agent: AgentId, text: string, routeLabel: string, files: Attachment[] = []): Promise<Reply & { messageId: string }> => {
    const id = uid();
    const busyAhead = !!queues.current[agent];
    push(key, { id, type: 'agent', agent, text: '', pending: true, queued: busyAhead, route: routeLabel, userText: text });
    // Teammates are told about this while it runs, so nobody takes the same job twice.
    beginRun({ id, agent, key, prompt: text, queued: busyAhead, at: now() });

    const run = async (): Promise<Reply & { messageId: string }> => {
      if (skipped.current.delete(id)) {
        endRun(id);
        updAgentMsg(key, id, { pending: false, queued: false, stopped: true, text: '(cancelled before it started)' });
        return { text: '', tokens: 0, stopped: true, messageId: id };
      }
      const ctrl = new AbortController();
      const runId = uid() + uid();
      liveRuns.current.set(id, { ctrl, runId });
      startRun(id);
      setRunning(1);
      updAgentMsg(key, id, { queued: false, startedAt: now(), runId, runDevice: deviceId, steps: [] });

      // Stream updates are batched so a fast token stream doesn't re-render (or sync) on every word.
      const live = { text: '', steps: [] as string[], via: '' };
      const wrote = new Set<string>();
      // Captured before the run so the agent sees the conversation as it stood when asked.
      const history = historyFor(key, id);
      const runStart = now();
      let timer: number | undefined;
      const flush = () => { timer = undefined; updAgentMsg(key, id, m => ({ text: live.text, steps: live.steps.slice(-200), route: live.via ? `${routeLabel} · ${live.via}` : m.route })); };
      const schedule = () => { if (timer === undefined) timer = window.setTimeout(flush, 250); };
      const proj = dataRef.current.projects.find(p => p.id === key) || null;

      let res: Reply;
      try {
        res = await respond(agent, text, proj, settingsRef.current, {
          onText: t => { live.text = t; schedule(); },
          onStep: s => { live.steps.push(s); schedule(); },
          onVia: v => { live.via = v; schedule(); },
          signal: ctrl.signal,
          runId,
          files,
          onFile: p => wrote.add(p),
          history,
        });
      } catch (e) {
        res = ctrl.signal.aborted
          ? { text: live.text || '(stopped)', tokens: 0, stopped: true, via: live.via }
          : { text: 'Something went wrong: ' + ((e as Error)?.message || String(e)), tokens: 0, error: true, via: live.via };
      } finally {
        window.clearTimeout(timer);
        liveRuns.current.delete(id);
        endRun(id);
        setRunning(-1);
      }
      updAgentMsg(key, id, {
        text: res.text, pending: false, finishedAt: now(), stopped: res.stopped, error: res.error || res.offline,
        steps: live.steps.slice(-200), route: res.via ? `${routeLabel} · ${res.via}` : routeLabel,
      });
      applyReply(key, agent, text, res);
      // Pictures this run made: art the agent generated, files it wrote, and anything new in the
      // project's capture folders (engine screenshots, renders).
      void (async () => {
        const made = res.art?.map(a => a.imagePath).filter((p): p is string => !!p) || [];
        const shots = isDesktop ? await runImages(proj ? localFolder(proj)?.path : undefined, runStart, wrote).catch(() => []) : [];
        const images = [...new Set([...made, ...shots])];
        if (images.length) updAgentMsg(key, id, { images });
      })();
      if (res.handoff && !res.stopped) {
        const h: Extract<Message, { type: 'handoff' }> = { id: uid(), type: 'handoff', from: agent, to: res.handoff.to, reason: res.handoff.reason, prompt: res.handoff.prompt, status: 'pending', userText: text };
        push(key, h);
        if (settingsRef.current.autoHandoff) window.setTimeout(() => approveRef.current?.(key, h, undefined, true), 50);
      }
      // A local agent may have changed files — back them up if the project auto-backs up.
      if (res.via === 'local' && !res.stopped && proj?.repo?.auto) void backupRef.current?.(proj.id, `${AGENTS[agent].name}: ${text.split('\n')[0].slice(0, 60)}`, true);
      return { ...res, messageId: id };
    };

    const job = (queues.current[agent] || Promise.resolve()).catch(() => undefined).then(run);
    const tail = job.finally(() => { if (queues.current[agent] === tail) delete queues.current[agent]; });
    queues.current[agent] = tail;
    return job;
  }, [push, updAgentMsg, applyReply, historyFor]);

  /** Stops a running (or queued) request started on this device. */
  const stopRun = useCallback((key: string, m: Extract<Message, { type: 'agent' }>) => {
    const r = liveRuns.current.get(m.id);
    if (r) { r.ctrl.abort(); void cancelAgentRun(r.runId); toast(`Stopping ${AGENTS[m.agent].name}…`); return; }
    if (m.queued) { skipped.current.add(m.id); updAgentMsg(key, m.id, { text: 'Cancelling…' }); }
  }, [toast, updAgentMsg]);

  // Requests that were running when the app closed can't finish — mark them.
  useEffect(() => {
    setData(d => {
      let changed = false;
      const messages = Object.fromEntries(Object.entries(d.messages).map(([k, list]) => [k, list.map(m => {
        if (m.type === 'agent' && m.pending && (!m.runDevice || m.runDevice === deviceId)) { changed = true; return { ...m, pending: false, queued: false, stopped: true, interrupted: true, text: (m.text ? m.text + '\n\n' : '') + '(interrupted — Mosslight was closed while this was running)' }; }
        return m;
      })]));
      return changed ? { ...d, messages } : d;
    });
  }, [setData]);

  /** GDD "Draft with X" writes the agent's reply into that section. */
  const draftSection = useCallback(async (pid: string, sid: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const s = p?.gdd.find(g => g.id === sid);
    if (!p || !s) return;
    const text = `Draft the "${s.title}" section of the GDD for ${p.name}. Keep it under 120 words. Reply with the section text only.`;
    push(pid, { id: uid(), type: 'user', text });
    const res = await dispatch(pid, s.agent, text, 'you picked ' + AGENTS[s.agent].name);
    if (!res.error && !res.offline && !res.stopped && res.text) updProj(pid, q => ({ ...q, gdd: q.gdd.map(g => (g.id === sid ? { ...g, body: res.text } : g)) }));
  }, [dispatch, push, updProj]);

  /** "Draft with Grok" for the story: the reply lands in the summary, not just in the chat. */
  const draftSummary = useCallback(async (pid: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    if (!p) return;
    const text = `Write the story summary for ${p.name} — what the game is about, the setting, the player's role and the hook. 150–250 words, plain prose, no headings. Reply with the summary only; it goes straight into the project's Story tab.`;
    push(pid, { id: uid(), type: 'user', text });
    const res = await dispatch(pid, 'grok', text, 'drafting the story');
    if (!res.error && !res.offline && !res.stopped && res.text) {
      updProj(pid, q => ({ ...q, summary: res.text, activity: [A('grok', 'Drafted the story summary'), ...q.activity] }));
      toast('Story summary updated');
    }
  }, [dispatch, push, toast, updProj]);

  /**
   * Builds a story section from a folder of folders: "Characters/Ray Calder/*.png" becomes an
   * entry named Ray Calder with those pictures. It's the layout people already keep art in.
   */
  const importEntries = useCallback(async (pid: string, title: string, root: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    if (!p || !isDesktop) return 0;
    let files: { path: string; folder: string; name: string }[] = [];
    try {
      files = await findFiles(root, ['png', 'jpg', 'jpeg', 'webp', 'bmp'], 2000);
    } catch (e) {
      toast(String((e as Error)?.message || e));
      return 0;
    }
    // One entry per immediate subfolder; images sitting loose in the root are ignored.
    const byName = new Map<string, string[]>();
    for (const f of files) {
      const first = f.folder.split('/')[0];
      if (!first) continue;
      const list = byName.get(first) || [];
      if (list.length < 40) list.push(f.path);
      byName.set(first, list);
    }
    if (!byName.size) {
      toast('No subfolders with pictures in there — pick the folder that holds one folder per character');
      return 0;
    }
    updProj(pid, q => {
      const story = [...(q.story || [])];
      let sec = story.find(s => s.title.toLowerCase() === title.toLowerCase());
      if (!sec) { sec = { id: uid(), title, entries: [], ts: now() }; story.push(sec); }
      const have = new Set(sec.entries.map(e => e.name.toLowerCase()));
      const fresh = [...byName.entries()]
        .filter(([name]) => !have.has(name.toLowerCase()))
        .map(([name, images]) => ({ id: uid(), name, images, cover: images[0], ts: now() }));
      sec.entries = [...sec.entries, ...fresh];
      return { ...q, story: story.map(s => (s.id === sec!.id ? { ...sec! } : s)), activity: [A('grok', `Added ${fresh.length} ${title.toLowerCase()} from ${baseName(root)}`), ...q.activity] };
    });
    toast(`Added ${byName.size} to ${title}`);
    return byName.size;
  }, [toast, updProj]);

  /** Folder names a section is likely kept under, so "Characters" finds Characters/ or Cast/. */
  const FOLDER_ALIASES: Record<string, string[]> = {
    characters: ['characters', 'character', 'cast', 'people'],
    maps: ['maps', 'map', 'levels', 'areas'],
    locations: ['locations', 'location', 'places', 'areas'],
    vehicles: ['vehicles', 'vehicle', 'cars'],
    factions: ['factions', 'faction', 'groups'],
  };

  /** Imports without asking when the project folder has an obvious home for this section. */
  const autoImportEntries = useCallback(async (pid: string, title: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const root = p && localFolder(p)?.path;
    if (!isDesktop || !root) { toast('This project has no folder on this computer'); return 0; }
    const want = FOLDER_ALIASES[title.toLowerCase()] || [title.toLowerCase()];
    try {
      const scan = await scanFolder(root);
      const hit = scan.entries.find(e => e.is_dir && want.includes(e.name.toLowerCase()));
      if (!hit) { toast(`No ${title} folder in ${baseName(root)} — use Import from folder… to point at one`); return 0; }
      return await importEntries(pid, title, await joinPath(root, hit.name));
    } catch (e) {
      toast(String((e as Error)?.message || e));
      return 0;
    }
  }, [importEntries, toast]);

  /** "cal-mercer-bio.md" → "Cal Mercer". */
  const nameFromFile = (file: string) => baseName(file)
    .replace(/\.[^.]+$/, '')
    .replace(/[-_ ]?(bio|biography|sheet|profile|ref|reference|card)$/i, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ')
    .trim();

  const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  /**
   * Everything in the project that looks like a member of this section: a folder per name, and
   * documents named after someone ("cal-mercer-bio.md"). Each comes back with its pictures.
   */
  const suggestEntries = useCallback(async (pid: string, title: string): Promise<{ name: string; images: string[]; source?: string }[]> => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const root = p && localFolder(p)?.path;
    if (!isDesktop || !root) { toast('This project has no folder on this computer'); return []; }
    const sec = (p.story || []).find(s => s.title.toLowerCase() === title.toLowerCase());
    const taken = new Set((sec?.entries || []).map(e => slugOf(e.name)));
    const want = FOLDER_ALIASES[title.toLowerCase()] || [title.toLowerCase()];

    const found = new Map<string, { name: string; images: string[]; source?: string }>();
    // Collections like Cast-Biographies.md aren't people, but they're where the bios live.
    const sources: string[] = [];
    const add = (name: string, source?: string) => {
      const key = slugOf(name);
      if (!key || taken.has(key) || name.length < 2) return;
      const at = found.get(key);
      if (at) { if (source && !at.source) at.source = source; return; }
      found.set(key, { name, images: [], source });
    };

    try {
      // Folders named after each member — the usual way art is kept.
      const scan = await scanFolder(root);
      for (const dir of scan.entries.filter(e => e.is_dir && want.includes(e.name.toLowerCase()))) {
        const inner = await scanFolder(await joinPath(root, dir.name)).catch(() => null);
        for (const e of inner?.entries || []) if (e.is_dir) add(e.name, `${dir.name}/${e.name}`);
      }
      // Documents named after one person ("cal-mercer-bio.md"), never collections
      // ("Cast-Biographies.md", "Character Appearance Pass05.md") — those are sources, not people.
      const GENERIC = /^(cast|character|characters|appearance|biographies|biography|bios|profiles|sheets|references|index|readme|notes|overview|summary|pass\d*|v\d+)$/i;
      // Words that mean the file is about the work, not about a person.
      const NOT_A_NAME = /^(profile|render|cpu|gpu|city|map|maps|report|reports|review|task|tasks|check|work|before|after|existing|build|builds|perf|performance|trace|corrected|claude|codex|grok|mosslight|hub)$/i;
      // Folders that hold process, not fiction.
      const SKIP = /^(docs\/tasks|docs\/reviews|docs\/reports|tools|build|builds|saved|intermediate)(\/|$)/i;
      const docs = await findFiles(root, ['md', 'txt'], 1200).catch(() => []);
      for (const d of docs) {
        if (!/bio|profile|sheet|character|cast/i.test(d.name)) continue;
        const source = `${d.folder ? d.folder + '/' : ''}${d.name}`;
        if (SKIP.test(d.folder)) continue;
        const name = nameFromFile(d.name);
        const words = name.split(/\s+/).filter(Boolean);
        // A person's own file: a couple of words, no digits, nothing about the work itself.
        const looksLikeAName = words.length >= 2 && words.length <= 4 && !/\d/.test(name)
          && !words.some(w => GENERIC.test(w) || NOT_A_NAME.test(w));
        if (looksLikeAName) add(name, source);
        else sources.push(source);
      }

      // Pictures for each, by folder or file name.
      const pics = await findFiles(root, ['png', 'jpg', 'jpeg', 'webp'], 4000).catch(() => []);
      for (const pic of pics) {
        const hay = slugOf(`${pic.folder} ${pic.name}`);
        for (const [key, v] of found) if (v.images.length < 30 && hay.includes(key)) v.images.push(pic.path);
      }
    } catch (e) {
      toast(String((e as Error)?.message || e));
    }
    lastSources.current = sources.slice(0, 12);
    return [...found.values()].sort((a, b) => b.images.length - a.images.length).slice(0, 40);
  }, [toast]);

  /** Collection documents the last scan saw, handed to the agent as where to read. */
  const lastSources = useRef<string[]>([]);

  /** Bios for a list of names, returned for review instead of written straight in. */
  const proposeBios = useCallback(async (pid: string, title: string, names: string[]): Promise<Record<string, string>> => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    if (!p || !names.length) return {};
    const text = [
      `For each of these ${title.toLowerCase()} in ${p.name}, give the bio the project's own files already support — do not invent anything that isn't written down.`,
      names.map(n => `- ${n}`).join('\n'),
      '',
      ...(lastSources.current.length
        ? [`Start with these files — the scan found them and they are the likely source: ${lastSources.current.join(', ')}.`]
        : []),
      'Also search the whole project for each name in every spelling it might use (Cal Mercer → cal-mercer, cal_mercer, CalMercer, "Cal Mercer") — bio, cast and character sheets anywhere in the repository, and the design and story documents.',
      'You are running in the project folder and can read these files. If you genuinely cannot read any file, say so once rather than repeating it for every name.',
      'Where a written bio exists, condense it faithfully: keep its facts, age, role and relationships, contradict nothing. Where nothing is written, say in one line what is known and mark the rest unknown.',
      '40–80 words each, plain prose, present tense.',
      `If one of these names is not a ${title.toLowerCase().replace(/s$/, '')} at all — a report, a task card, a document that got picked up by mistake — start its body with "This is not a character" and say in one line what the file actually is.`,
      'Reply with JSON only: {"entries":[{"name":"<exactly as listed>","body":"<bio>","source":"<file, or none>"}]}',
    ].join('\n');
    push(pid, { id: uid(), type: 'user', text });
    const res = await dispatch(pid, 'claude', text, `reading the ${title.toLowerCase()}`);
    if (res.error || res.offline || res.stopped || !res.text) return {};
    try {
      const json = res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as { entries?: { name?: string; body?: string }[] };
      return Object.fromEntries((parsed.entries || []).filter(e => e.name && e.body).map(e => [slugOf(e.name!), e.body!.trim()]));
    } catch {
      toast("Couldn't read that reply as bios — it's still in the chat");
      return {};
    }
  }, [dispatch, push, toast]);

  /** Adds reviewed entries, with their pictures and notes. */
  const addEntries = useCallback((pid: string, title: string, list: { name: string; images: string[]; body?: string; cover?: string }[]) => {
    if (!list.length) return;
    updProj(pid, q => {
      const story = [...(q.story || [])];
      let sec = story.find(s => s.title.toLowerCase() === title.toLowerCase());
      if (!sec) { sec = { id: uid(), title, entries: [], ts: now() }; story.push(sec); }
      const have = new Set(sec.entries.map(e => slugOf(e.name)));
      const fresh = list.filter(x => !have.has(slugOf(x.name))).map(x => ({ id: uid(), name: x.name, body: x.body, images: x.images, cover: x.cover || x.images[0], ts: now() }));
      sec.entries = [...sec.entries, ...fresh];
      return { ...q, story: story.map(s => (s.id === sec!.id ? { ...sec! } : s)), activity: [A('grok', `Added ${fresh.length} to ${title}`), ...q.activity] };
    });
    toast(`Added ${list.length} to ${title}`);
  }, [toast, updProj]);

  /** One name you typed: find its pictures and its bio, ready to review. */
  const buildEntry = useCallback(async (pid: string, title: string, name: string) => {
    const all = await suggestEntries(pid, title);
    const hit = all.find(x => slugOf(x.name) === slugOf(name)) || { name, images: [] as string[], source: undefined };
    const bios = await proposeBios(pid, title, [hit.name]);
    return { ...hit, body: bios[slugOf(hit.name)] };
  }, [proposeBios, suggestEntries]);

  /** Fills in the blank bios in a section, from what the project's own files say. */
  const draftEntries = useCallback(async (pid: string, sid: string, agent: AgentId = 'claude') => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const sec = p?.story?.find(s => s.id === sid);
    if (!p || !sec) return;
    const blank = sec.entries.filter(e => !e.body?.trim());
    if (!blank.length) { toast('Every entry already has notes'); return; }
    const names = blank.slice(0, 25).map(e => e.name);
    const text = [
      `Write short bios for these ${sec.title.toLowerCase()} in ${p.name}, from what the project's own files already say — do not invent anything that isn't written down.`,
      names.map(n => `- ${n}`).join('\n'),
      '',
      'Search the whole project first, not just Docs/: look for files whose name contains the name in any spelling (Cal Mercer → cal-mercer, cal_mercer, CalMercer, "Cal Mercer"), including bio, cast and character sheets anywhere in the repository, and grep the design and story documents for each name.',
      'Where a written bio already exists, condense that one faithfully — keep its facts, names, ages, roles and relationships, and do not contradict it. Where nothing is written, say in one line what is known (for example that reference art exists) and mark the rest unknown.',
      '40–80 words each, plain prose, present tense, no spoilers beyond what the source says.',
      'Reply with JSON only, no prose around it: {"entries":[{"name":"<exactly as listed>","body":"<bio>","source":"<file you took it from, or none>"}]}',
    ].join('\n');
    push(pid, { id: uid(), type: 'user', text });
    const res = await dispatch(pid, agent, text, `writing ${sec.title.toLowerCase()} notes`);
    if (res.error || res.offline || res.stopped || !res.text) return;
    try {
      const json = res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as { entries?: { name?: string; body?: string }[] };
      const byName = new Map((parsed.entries || []).filter(e => e.name && e.body).map(e => [e.name!.toLowerCase().trim(), e.body!.trim()]));
      if (!byName.size) { toast("That reply didn't contain bios — try again, or paste them in by hand"); return; }
      updProj(pid, q => ({
        ...q,
        story: (q.story || []).map(s => (s.id !== sid ? s : { ...s, entries: s.entries.map(e => (e.body?.trim() || !byName.has(e.name.toLowerCase()) ? e : { ...e, body: byName.get(e.name.toLowerCase()) })) })),
      }));
      toast(`Wrote ${byName.size} bio${byName.size === 1 ? '' : 's'}`);
    } catch {
      toast("Couldn't read that reply as bios — it's still in the chat");
    }
  }, [dispatch, push, toast, updProj]);

  // ── Team mode ────────────────────────────────────────────────────────────────
  /** The team lead drafts a plan (steps per agent); you approve it once, then it runs. */
  const startTeam = useCallback(async (key: string, text: string, files: Attachment[] = []) => {
    const lead = settingsRef.current.teamLead || 'codex';
    const id = uid();
    push(key, { id, type: 'plan', lead, summary: '', steps: [], status: 'drafting', userText: text });
    const proj = dataRef.current.projects.find(p => p.id === key) || null;
    setRunning(1);
    try {
      const plan = await planTeam(lead, text, proj, settingsRef.current, { files, history: historyFor(key) });
      if ('error' in plan) updPlan(key, id, () => ({ status: 'failed', error: plan.error }));
      else {
        updPlan(key, id, () => ({ status: 'pending', summary: plan.summary, steps: plan.steps }));
        applyReply(key, lead, text, { text: '', tokens: plan.tokens });
      }
    } catch (e) {
      updPlan(key, id, () => ({ status: 'failed', error: String((e as Error)?.message || e) }));
    } finally {
      setRunning(-1);
    }
  }, [push, updPlan, applyReply, historyFor]);

  /** Runs an approved plan: independent steps in parallel, dependent ones after their inputs, passing results along. */
  const runPlan = useCallback(async (key: string, planId: string, steps: PlanStep[]) => {
    const n = steps.length;
    updPlan(key, planId, () => ({ status: 'running', steps: steps.map(s => ({ ...s, status: 'waiting' as const })) }));
    const setStep = (i: number, patch: Partial<PlanStep>) => updPlan(key, planId, m => ({ steps: m.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
    const results: Promise<Reply | null>[] = [];
    steps.forEach((s, i) => {
      results[i] = Promise.all(s.after.map(j => results[j])).then(async prev => {
        if (prev.some(r => !r || r.error || r.offline || r.stopped)) { setStep(i, { status: 'skipped' }); return null; }
        const inputs = s.after.map((j, k) => `--- Result of step ${j + 1} (${AGENTS[steps[j].agent].name}: ${steps[j].title}) ---\n${(prev[k]!.text || '').slice(0, 6000)}`).join('\n\n');
        setStep(i, { status: 'running' });
        const job = dispatch(key, s.agent, inputs ? `${s.prompt}\n\n${inputs}` : s.prompt, `team · step ${i + 1}/${n} · ${s.title}`);
        const res = await job;
        setStep(i, { status: res.error || res.offline || res.stopped ? 'failed' : 'done', messageId: res.messageId });
        return res;
      });
    });
    const all = await Promise.all(results);
    updPlan(key, planId, () => ({ status: all.every(r => r && !r.error && !r.offline && !r.stopped) ? 'done' : 'failed' }));
  }, [dispatch, updPlan]);

  const sendText = useCallback((key: string, raw: string, forced: AgentId | 'team' | null, files: Attachment[] = []) => {
    const text = raw.trim() || (files.length ? `Here ${files.length === 1 ? 'is a file' : 'are some files'} — take a look.` : '');
    if (!text) return;
    push(key, { id: uid(), type: 'user', text, ...(files.length ? { attachments: files } : {}) });
    if (forced === 'team') return void startTeam(key, text, files);
    const r = forced ? { agent: forced, hit: 'manual' } : route(text);
    if (!r.agent) return push(key, { id: uid(), type: 'choose', userText: text });
    void dispatch(key, r.agent, text, r.hit === 'manual' ? 'you picked ' + AGENTS[r.agent].name : `auto-routed · "${r.hit}"`, files);
  }, [dispatch, push, startTeam]);

  /** Stages dropped, pasted or picked files on the composer. */
  const attachFiles = useCallback(async (files: File[]) => {
    const list = files.filter(f => f.size > 0).slice(0, 12);
    if (!list.length) return;
    const u = uiRef.current;
    const p = u.view === 'project' && u.pid ? dataRef.current.projects.find(x => x.id === u.pid) || null : null;
    try {
      const made = await prepareAttachments(list, p, !!engineRef.current, s => patchUi({ attaching: s }));
      patchUi({ attachments: [...uiRef.current.attachments, ...made] });
    } catch (e) {
      toast('Could not attach that: ' + String((e as Error)?.message || e));
    } finally {
      patchUi({ attaching: null });
    }
  }, [patchUi, toast]);

  const removeAttachment = useCallback((id: string) => patchUi({ attachments: uiRef.current.attachments.filter(a => a.id !== id) }), [patchUi]);

  const chatKey = ui.view === 'project' && ui.pid ? ui.pid : 'global';
  const send = useCallback(() => {
    const u = uiRef.current;
    sendText(u.view === 'project' && u.pid ? u.pid : 'global', u.input, u.forced, u.attachments);
    patchUi({ input: '', attachments: [] });
  }, [sendText, patchUi]);
  const ask = useCallback((text: string, forced: AgentId | null = null) => { const u = uiRef.current; sendText(u.view === 'project' && u.pid ? u.pid : 'global', text, forced ?? u.forced); }, [sendText]);

  const reroute = useCallback((key: string, m: Extract<Message, { type: 'agent' }>, to: AgentId) => {
    updMsg(key, m.id, x => ({ ...x, showOverride: false, route: ((x as typeof m).route || '') + ' · rerouted' } as Message));
    void dispatch(key, to, m.userText || m.text, 'rerouted by you');
  }, [dispatch, updMsg]);

  /** Approve a handoff: the teammate runs the (optionally edited) prompt the other agent wrote. */
  const approve = useCallback((key: string, m: Extract<Message, { type: 'handoff' }>, prompt?: string, auto = false) => {
    const finalPrompt = (prompt ?? m.prompt ?? '').trim();
    updMsg(key, m.id, x => ({ ...x, status: 'approved', prompt: finalPrompt || (x as typeof m).prompt, auto } as Message));
    const text = finalPrompt
      ? `${finalPrompt}\n\n(Handed off from ${AGENTS[m.from].name}: ${m.reason})`
      : `[Handoff from ${AGENTS[m.from].name}] ${m.reason}\n\nOriginal request: ${m.userText || ''}`;
    void dispatch(key, m.to, text, auto ? 'handoff · auto-approved' : 'handoff · approved by you');
  }, [dispatch, updMsg]);
  approveRef.current = approve;
  const decline = useCallback((key: string, m: Message) => updMsg(key, m.id, x => ({ ...x, status: 'declined' } as Message)), [updMsg]);
  const choose = useCallback((key: string, m: Extract<Message, { type: 'choose' }>, a: AgentId) => { dropMsg(key, m.id); void dispatch(key, a, m.userText, 'you picked ' + AGENTS[a].name); }, [dispatch, dropMsg]);
  const toggleOverride = useCallback((key: string, m: Message) => updMsg(key, m.id, x => ({ ...x, showOverride: !(x as { showOverride?: boolean }).showOverride } as Message)), [updMsg]);
  const declinePlan = useCallback((key: string, id: string) => updPlan(key, id, () => ({ status: 'declined' })), [updPlan]);

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  /** Pins pictures from a reply into the project's Art, where folder filters can't hide them. */
  const addArtImages = useCallback((pid: string, paths: string[], title = 'From chat') => {
    updProj(pid, p => {
      const have = new Set(p.art.map(a => a.imagePath));
      const fresh = paths.filter(x => !have.has(x)).map(x => ({ id: uid(), title: `${title} · ${baseName(x)}`, prompt: '', imagePath: x, ts: now() }));
      return fresh.length ? { ...p, art: [...fresh, ...p.art], activity: [A('codex', `Added ${fresh.length} picture${fresh.length === 1 ? '' : 's'} to Art`), ...p.activity] } : p;
    });
    toast(paths.length === 1 ? 'Added to Art' : `Added ${paths.length} to Art`);
  }, [toast, updProj]);

  // ── Task cards on disk ───────────────────────────────────────────────────────
  /** Mirrors a task to its card in Docs/Tasks, so the repository holds the record. */
  const saveCard = useCallback(async (pid: string, task: Task, change?: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const root = p && localFolder(p)?.path;
    if (!isDesktop || !root) return;
    try {
      await writeCard(root, task, change);
      const rel = cardRelPath(task);
      updProj(pid, q => ({ ...q, tasks: q.tasks.map(t => (t.id === task.id && t.card !== rel ? { ...t, card: rel } : t)) }));
    } catch { /* folder not writable — the task still lives in the hub */ }
  }, [updProj]);
  saveCardRef.current = saveCard;

  /**
   * Reconciles the hub's tasks with the cards in Docs/Tasks: cards the hub doesn't know about
   * become tasks, tasks without a card get one, and a card's status wins — an agent that moved
   * a card to done has changed the record, not just its own copy.
   */
  const syncCards = useCallback(async (pid: string, announce = false) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const root = p && localFolder(p)?.path;
    if (!isDesktop || !root) { if (announce) toast('This project has no folder on this computer'); return; }
    let found: { path: string; folder: string; text: string }[] = [];
    try {
      const files = (await findFiles(root, ['md'], 400)).filter(f => f.folder.toLowerCase() === CARD_DIR.join('/').toLowerCase());
      found = await Promise.all(files.map(async f => ({ path: f.path, folder: f.folder, text: new TextDecoder().decode(await readFileBytes(f.path, 200_000)) })));
    } catch { /* no Docs/Tasks yet */ }

    const cards = found.map(f => ({ ...parseCard(f.text)!, rel: `${f.folder}/${baseName(f.path)}` })).filter(c => c.id);
    let added = 0, moved = 0;
    updProj(pid, q => {
      const byId = new Map(cards.map(c => [c.id, c]));
      const tasks = q.tasks.map(t => {
        const c = byId.get(t.id);
        if (!c) return t;
        if (c.status !== t.status) moved++;
        return { ...t, title: c.title || t.title, agent: c.owner, status: c.status, card: c.rel };
      });
      const known = new Set(tasks.map(t => t.id));
      for (const c of cards) {
        if (known.has(c.id)) continue;
        added++;
        tasks.push({ id: c.id, agent: c.owner, title: c.title, status: c.status, ts: c.created || now(), card: c.rel });
      }
      return { ...q, tasks };
    });
    // Anything the hub has but the folder doesn't gets a card written for it.
    const after = dataRef.current.projects.find(x => x.id === pid);
    const missing = (after?.tasks || []).filter(t => !cards.some(c => c.id === t.id));
    for (const t of missing) await saveCard(pid, t, 'card created from the hub');
    if (announce) toast(`${cards.length} card${cards.length === 1 ? '' : 's'} in Docs/Tasks${added ? ` · ${added} new here` : ''}${moved ? ` · ${moved} status change${moved === 1 ? '' : 's'}` : ''}${missing.length ? ` · wrote ${missing.length}` : ''}`);
  }, [saveCard, toast, updProj]);

  const cycleTask = useCallback((pid: string, tid: string) => {
    let changed: { task: Task; from: TaskStatus } | null = null;
    updProj(pid, p => {
      const tasks = p.tasks.map(t => (t.id === tid ? { ...t, status: t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : 'todo' } as typeof t : t));
      const t = tasks.find(x => x.id === tid)!;
      changed = { task: t, from: p.tasks.find(x => x.id === tid)!.status };
      return { ...p, tasks, activity: [A(t.agent, (t.status === 'done' ? 'Completed ' : t.status === 'doing' ? 'Started ' : 'Reopened ') + t.title), ...p.activity] };
    });
    // (TypeScript can't see that updProj ran its callback synchronously.)
    const c = changed as { task: Task; from: TaskStatus } | null;
    if (c) void saveCard(pid, c.task, `${c.from} → ${c.task.status}`);
  }, [saveCard, updProj]);

  // ── GitHub backups ────────────────────────────────────────────────────────────
  const backingUp = useRef(new Set<string>());
  const backupRef = useRef<(pid: string, reason?: string, silent?: boolean) => Promise<void>>();
  const [busyRepo, setBusyRepo] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{ done: number; total: number } | null>(null);
  const [scanningBuilds, setScanningBuilds] = useState(false);
  const myDeviceName = () => dataRef.current.devices?.[deviceId]?.name || OS_LABEL[deviceOs];

  /** Commit + push the project's local folder. `silent` = no toast when there's nothing to back up. */
  const backupNow = useCallback(async (pid: string, reason?: string, silent = false) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const lf = p && localFolder(p);
    if (!p?.repo || !lf?.path || !isDesktop || backingUp.current.has(pid)) return;
    backingUp.current.add(pid);
    try {
      // `silent` means this is the automatic backup after a run — that one leaves the default
      // branch alone. A backup you asked for by name still does what you asked.
      const res = await backup(lf.path, reason ? `Mosslight backup — ${reason}` : `Mosslight backup from ${myDeviceName()}`, silent ? p.repo.branch || 'main' : undefined);
      if (res.skipped) {
        if (!silent) toast(`Not backed up: ${p.name} is on ${res.skipped}, and auto backup leaves that branch alone`);
        return;
      }
      if (res.committed || res.pushed) {
        updProj(pid, q => ({ ...q, repo: q.repo && { ...q.repo, lastBackup: now(), lastBackupDevice: deviceId, lastCommit: res.commit, lastError: undefined }, activity: [A('codex', `Backed up to GitHub (${q.repo?.owner}/${q.repo?.name}${res.commit ? ' @ ' + res.commit : ''})`), ...q.activity] }));
        toast(`Backed up ${p.name} to GitHub`);
      } else {
        if (p.repo.lastError) updProj(pid, q => ({ ...q, repo: q.repo && { ...q.repo, lastError: undefined } }));
        if (!silent) toast(`${p.name} is already backed up — no changes`);
      }
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      updProj(pid, q => ({ ...q, repo: q.repo && { ...q.repo, lastError: msg } }));
      toast(`Backup of ${p.name} failed: ${msg}`);
    } finally {
      backingUp.current.delete(pid);
    }
  }, [updProj, toast]);
  backupRef.current = backupNow;

  /** Branches an agent committed but couldn't push (its sandbox has no access to your credentials). */
  const listUnpushed = useCallback(async (pid: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const path = p && localFolder(p)?.path;
    if (!isDesktop || !path || !p.repo) return [];
    return unpushedBranches(path).catch(() => []);
  }, []);

  const pushOne = useCallback(async (pid: string, branch: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const path = p && localFolder(p)?.path;
    if (!path) return;
    try {
      await pushBranch(path, branch);
      updProj(pid, q => ({ ...q, activity: [A('codex', `Pushed ${branch} to GitHub`), ...q.activity] }));
      toast(`Pushed ${branch}`);
    } catch (e) {
      toast(String((e as Error)?.message || e));
    }
  }, [toast, updProj]);

  const withRepoBusy = useCallback(async (pid: string, label: string, fn: () => Promise<void>) => {
    setBusyRepo(pid);
    toast(label);
    try { await fn(); } catch (e) { toast(String((e as Error)?.message || e)); } finally { setBusyRepo(null); }
  }, [toast]);

  /** Link a GitHub repo you already have. With a local folder here, the folder is connected and pushed. */
  const linkRepo = useCallback((pid: string, owner: string, name: string) => withRepoBusy(pid, `Linking ${owner}/${name}…`, async () => {
    const r = await getRepo(owner, name);
    const link = { owner: r.owner.login, name: r.name, branch: r.default_branch, private: r.private, auto: false };
    updProj(pid, q => ({ ...q, repo: link, activity: [A('codex', `Linked GitHub repo ${r.full_name}`), ...q.activity] }));
    const p = dataRef.current.projects.find(x => x.id === pid);
    const lf = p && localFolder(p);
    if (lf?.path && isDesktop) {
      const res = await connectFolder(lf.path, link.owner, link.name, p!.engines, (r.size || 0) > 0);
      updProj(pid, q => ({ ...q, repo: q.repo && { ...q.repo, lastBackup: now(), lastBackupDevice: deviceId, lastCommit: res.commit } }));
      toast(`${p!.name} is now backed up to ${r.full_name}${res.lfs ? '' : ' (tip: install Git LFS for big art/audio files)'}`);
    } else {
      toast(`Linked ${r.full_name} — agents can now read it${isDesktop ? '. Clone it to this computer to back up local work.' : ''}`);
    }
  }), [withRepoBusy, updProj, toast]);

  /** Create a new private repo for the project (and push its local folder if it has one here). */
  const createRepoFor = useCallback((pid: string) => withRepoBusy(pid, 'Creating a private GitHub repo…', async () => {
    const p = dataRef.current.projects.find(x => x.id === pid)!;
    const lf = localFolder(p);
    let r: GhRepo | null = null;
    for (let i = 0; i < 5 && !r; i++) {
      const name = repoSlug(p.name) + (i ? `-${i + 1}` : '');
      try { r = await createRepo(name, p.tagline, !(lf?.path && isDesktop)); } catch (e) { if (!/already exists/i.test(String(e))) throw e; }
    }
    if (!r) throw new Error('Couldn\'t find a free repo name — create it on GitHub and link it instead');
    const link = { owner: r.owner.login, name: r.name, branch: r.default_branch || 'main', private: true, auto: false };
    updProj(pid, q => ({ ...q, repo: link, activity: [A('codex', `Created private GitHub repo ${r!.full_name}`), ...q.activity] }));
    if (lf?.path && isDesktop) {
      const res = await connectFolder(lf.path, link.owner, link.name, p.engines, false);
      updProj(pid, q => ({ ...q, repo: q.repo && { ...q.repo, branch: 'main', lastBackup: now(), lastBackupDevice: deviceId, lastCommit: res.commit } }));
    }
    toast(`Created ${r.full_name} (private)`);
  }), [withRepoBusy, updProj, toast]);

  const unlinkRepo = useCallback((pid: string) => {
    updProj(pid, q => ({ ...q, repo: undefined, activity: [A('codex', `Unlinked GitHub repo ${q.repo?.owner}/${q.repo?.name} (the repo itself is untouched)`), ...q.activity] }));
  }, [updProj]);

  const setRepoAuto = useCallback((pid: string, auto: boolean) => updProj(pid, q => ({ ...q, repo: q.repo && { ...q.repo, auto } })), [updProj]);

  // Automatic backups every 30 minutes (only commits when something changed).
  useEffect(() => {
    if (!isDesktop) return;
    const iv = window.setInterval(() => {
      for (const p of dataRef.current.projects) if (p.repo?.auto && localFolder(p)) void backupNow(p.id, `Auto backup from ${myDeviceName()}`, true);
    }, 30 * 60_000);
    return () => window.clearInterval(iv);
  }, [backupNow]);

  // ── Projects ──────────────────────────────────────────────────────────────────
  const createProject = useCallback(async (nf: { name: string; tagline: string; tags: string[]; engines: string[]; github?: boolean; brand?: boolean }) => {
    const n = nf.name.trim();
    if (!n) { toast('Give the project a name'); return false; }
    const p: Project = {
      id: uid(), name: n, tagline: nf.tagline || 'No pitch yet — ask Grok for one.', tags: nf.tags, engines: nf.engines,
      platforms: nf.tags.includes('Mobile') ? ['android'] : nf.tags.includes('Web') ? ['web'] : ['windows'],
      stack: { languages: [], libraries: [], tools: [] }, code: [], folder: null,
      tasks: [T('grok', 'Write the one-paragraph pitch', 'todo', 0), T('codex', 'Mood board & palette', 'todo', 0), T('claude', 'Project scaffold in ' + (nf.engines[0] ? ENGINE_BY[nf.engines[0]].name : 'chosen engine'), 'todo', 0)],
      art: [], gdd: [{ id: uid(), title: 'Pitch', agent: 'grok', body: '' }, { id: uid(), title: 'Core loop', agent: 'claude', body: '' }], builds: [], activity: [A('claude', 'Project created')],
    };
    if (nf.github && isDesktop) {
      // New projects get a working folder so agents can build in it and it can be pushed.
      const dir = await homePath('Mosslight', 'Projects', repoSlug(n));
      await writeTextIfMissing(await joinPath(dir, 'README.md'), `# ${n}\n\n${p.tagline}\n\nCreated with Mosslight Game Hub.\n`);
      p.folder = { name: repoSlug(n), path: dir, device: deviceId };
    }
    // The Mosslight loading screen, ready in the game's folder from the first commit.
    if (nf.brand && p.folder?.path) {
      try {
        const kit = await installKit(p.folder.path, p, []);
        p.brand = { path: kit, device: deviceId, ts: now() };
        p.tasks = [...p.tasks, T('codex', 'Wire in the Mosslight loading screen', 'todo', 0)];
      } catch { /* the folder isn't writable — the kit can be added later from Overview */ }
    }
    setData(d => ({ ...d, projects: [p, ...d.projects] }));
    patchUi({ view: 'project', pid: p.id, tab: 'overview' });
    if (nf.github) window.setTimeout(() => void createRepoFor(p.id), 50);
    return true;
  }, [patchUi, toast, createRepoFor]);

  /**
   * Looks through the whole project folder for playable builds — Builds/, WindowsNoEditor/,
   * export/ and the rest — not just files sitting at the top level.
   */
  const rescanBuilds = useCallback(async (pid: string): Promise<number> => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const path = p && localFolder(p)?.path;
    if (!isDesktop || !path) { toast('This project has no folder on this computer'); return 0; }
    setScanningBuilds(true);
    try {
      const found = await findBuilds(path);
      const have = new Set(p.builds.map(b => b.path));
      const skip = new Set(p.dismissed || []);
      const fresh = found
        .filter(f => !have.has(f.path) && !skip.has(f.path))
        .slice(0, 12)
        .map(buildFrom);
      if (fresh.length) {
        updProj(pid, q => ({
          ...q, builds: [...fresh, ...q.builds],
          spotlight: { buildId: fresh[0].id, ts: now() },
          activity: [A('codex', `Found ${fresh.length} build${fresh.length === 1 ? '' : 's'} in the project folder`), ...q.activity],
        }));
      }
      toast(fresh.length ? `Added ${fresh.length} build${fresh.length === 1 ? '' : 's'}` : found.length ? 'No new builds — everything found is already listed' : 'No builds found in this folder');
      return fresh.length;
    } catch (e) {
      toast('Could not scan: ' + String((e as Error)?.message || e));
      return 0;
    } finally {
      setScanningBuilds(false);
    }
  }, [toast, updProj]);

  // ── Project brief (AGENTS.md and friends) ────────────────────────────────────
  /**
   * Reads the project's own instruction files and keeps a trimmed copy on the project, so the
   * agents that can't see the folder — Grok, anything on the phone, API fallbacks — get the same
   * standing rules as local Claude Code and Codex, without you maintaining them twice.
   */
  const refreshBrief = useCallback(async (pid: string, announce = false) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const root = p && localFolder(p)?.path;
    if (!isDesktop || !root) { if (announce) toast('This project has no folder on this computer'); return; }
    const found: { file: string; text: string }[] = [];
    for (const rel of BRIEF_FILES) {
      if (found.length >= 2) break;
      try {
        const bytes = await readFileBytes(await joinPath(root, ...rel.split('/')), 400_000);
        const text = new TextDecoder().decode(bytes).trim();
        // Windows paths are case-insensitive, so Docs/ and docs/ are the same file — don't send it twice.
        if (text && !found.some(f => f.text === text.slice(0, BRIEF_PER_FILE))) found.push({ file: rel, text: text.slice(0, BRIEF_PER_FILE) });
      } catch { /* not in this project */ }
    }
    if (!found.length) {
      updProj(pid, q => (q.brief ? { ...q, brief: undefined } : q));
      if (announce) toast('No AGENTS.md, CLAUDE.md or PROJECT-HANDOFF.md in this folder');
      return;
    }
    const text = found.map(f => `--- ${f.file} ---\n${f.text}`).join('\n\n').slice(0, BRIEF_TOTAL);
    updProj(pid, q => ({ ...q, brief: { files: found.map(f => f.file), text, ts: now() } }));
    if (announce) toast(`Loaded ${found.map(f => f.file).join(' + ')} — every agent sees it now`);
  }, [toast, updProj]);

  // Re-read the brief when a project is opened, so edits to AGENTS.md reach the agents on their own.
  const openedPid = ui.view === 'project' ? ui.pid : null;
  useEffect(() => {
    if (!openedPid || !isDesktop) return;
    const p = dataRef.current.projects.find(x => x.id === openedPid);
    if (!p || !localFolder(p)?.path) return;
    if (p.brief && now() - p.brief.ts < 60_000) return;
    void refreshBrief(openedPid);
    void syncCards(openedPid);
  }, [openedPid, refreshBrief, syncCards]);

  // ── Brand kit (the Mosslight loading screen) ─────────────────────────────────
  /** Writes the loading screen kit into the game's folder on this computer. */
  const addLoadingScreen = useCallback(async (pid: string, tips?: string[]): Promise<string | null> => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    if (!p) return null;
    const path = localFolder(p)?.path;
    if (!isDesktop || !path) { toast('Open this project\'s folder on this computer first — that\'s where the screen goes'); return null; }
    try {
      const dir = await installKit(path, p, tips ?? p.brand?.tips ?? []);
      updProj(pid, q => ({
        ...q,
        brand: { path: dir, device: deviceId, ts: now(), tips: tips ?? q.brand?.tips, wired: q.brand?.wired },
        activity: [A('codex', 'Added the Mosslight loading screen'), ...q.activity],
      }));
      toast('Loading screen added — ' + dir);
      return dir;
    } catch (e) {
      toast('Could not write the kit: ' + String((e as Error)?.message || e));
      return null;
    }
  }, [toast, updProj]);

  /** Asks Codex to put the screen in front of the game itself (in-engine where the templates can't go). */
  const wireLoadingScreen = useCallback((pid: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    if (!p?.brand) return;
    updProj(pid, q => ({ ...q, brand: q.brand && { ...q.brand, wired: true } }));
    patchUi({ chatOpen: true });
    void dispatch(pid, 'codex', kitPrompt(p, p.brand.path), 'brand kit');
  }, [dispatch, patchUi, updProj]);

  const removeProject = useCallback((pid: string) => {
    setData(d => ({ ...d, projects: d.projects.filter(p => p.id !== pid) }));
    patchUi({ view: 'library', pid: null });
  }, [patchUi]);

  /** Import (or re-link) a local folder as a project; picks up its GitHub remote automatically. */
  const importFolder = useCallback(async (path: string, prefer?: string): Promise<string | null> => {
    let scan: ScanResult;
    try { scan = await scanFolder(path); } catch (e) { toast(String(e)); return null; }
    const det = await detectFromScan(scan);
    // Builds usually live a few folders down (Builds/, WindowsNoEditor/, export/), not at the top.
    const deep = await findBuilds(path).catch(() => []);
    det.builds = [
      ...det.builds,
      ...deep.filter(f => !det.builds.some(b => b.path === f.path)).slice(0, 12).map(buildFrom),
    ];
    const remote = await detectRepo(path).catch(() => null);
    const sameRepo = (p: Project) => !!remote && p.repo?.owner.toLowerCase() === remote.owner.toLowerCase() && p.repo?.name.toLowerCase() === remote.name.toLowerCase();
    const match = (p: Project) => p.id === prefer || sameRepo(p) || p.folder?.path === path || p.folder?.name === scan.name || p.name.toLowerCase() === scan.name.toLowerCase();
    const existing = dataRef.current.projects.find(match);
    const pid = existing ? existing.id : uid();
    const repo = remote ? { owner: remote.owner, name: remote.name, branch: remote.branch, auto: false } : undefined;
    setData(d => {
      const ex = d.projects.find(p => p.id === pid);
      if (ex) {
        return { ...d, projects: d.projects.map(p => p.id !== ex.id ? p : {
          ...p, folder: { name: scan.name, path, device: deviceId }, engines: p.engines.length ? p.engines : det.engines, platforms: uniq([...p.platforms, ...det.platforms]),
          stack: { ...p.stack, libraries: uniq([...p.stack.libraries, ...det.libs]), languages: uniq([...p.stack.languages, ...det.langs]) },
          builds: [...det.builds.filter(b => !p.builds.some(x => x.path === b.path || x.name === b.name)), ...p.builds],
          repo: p.repo || repo,
          activity: [A('claude', `Linked local folder ${scan.name} (${det.builds.length} shortcuts found)`), ...p.activity],
        }) };
      }
      const p: Project = {
        id: pid, name: scan.name, tagline: 'Loaded from local folder. Ask Grok to write the pitch.', tags: det.engines.some(e => WEB_ENGINES.includes(e)) ? ['Web'] : [], engines: det.engines, platforms: det.platforms,
        stack: { languages: det.langs, libraries: det.libs, tools: [] }, code: [], folder: { name: scan.name, path, device: deviceId }, repo,
        tasks: [T('claude', 'Audit existing code & summarize state', 'todo', 0), T('grok', 'Write pitch from existing project', 'todo', 0)], art: [], gdd: [{ id: uid(), title: 'Pitch', agent: 'grok', body: '' }],
        builds: det.builds, activity: [A('claude', `Imported folder ${scan.name} (${det.builds.length} shortcuts, ${det.names.length} entries)`)],
      };
      return { ...d, projects: [p, ...d.projects] };
    });
    patchUi({ view: 'project', pid, tab: 'overview' });
    toast((det.engines.length ? 'Detected ' + det.engines.map(engineName).join(', ') + ' · ' : '') + (remote ? `GitHub ${remote.owner}/${remote.name} · ` : '') + det.builds.length + ' build' + (det.builds.length === 1 ? '' : 's') + ' found');
    return pid;
  }, [patchUi, toast]);

  const openFolder = useCallback(async () => {
    if (!isDesktop) return toast('Opening local folders needs the desktop app');
    const path = await pickFolder();
    if (path) await importFolder(path);
  }, [importFolder, toast]);

  /**
   * Bring in a project from an existing GitHub repo.
   * Desktop: clone it into a folder you pick (the agents then work in it and backups push to it).
   * Phone: add it to the library linked to the repo, so agents can read it.
   */
  const openFromGitHub = useCallback(async (r: GhRepo) => {
    const linked = dataRef.current.projects.find(p => p.repo?.owner.toLowerCase() === r.owner.login.toLowerCase() && p.repo?.name.toLowerCase() === r.name.toLowerCase());
    if (!isDesktop) {
      if (linked) { patchUi({ view: 'project', pid: linked.id, tab: 'overview' }); return; }
      const p: Project = {
        id: uid(), name: r.name, tagline: r.description || 'Linked from GitHub.', tags: [], engines: [], platforms: ['windows'], stack: { languages: [], libraries: [], tools: [] }, code: [], folder: null,
        repo: { owner: r.owner.login, name: r.name, branch: r.default_branch, private: r.private, auto: false },
        tasks: [T('claude', 'Audit the repo & summarize state', 'todo', 0)], art: [], gdd: [{ id: uid(), title: 'Pitch', agent: 'grok', body: '' }], builds: [], activity: [A('claude', `Linked GitHub repo ${r.full_name}`)],
      };
      setData(d => ({ ...d, projects: [p, ...d.projects] }));
      patchUi({ view: 'project', pid: p.id, tab: 'overview' });
      toast(`Added ${r.full_name}. Open it on your computer to clone and work on it.`);
      return;
    }
    const parent = await pickParentFolder(`Where should ${r.name} be cloned? (a ${r.name} folder is created inside)`);
    if (!parent) return;
    setBusyRepo(linked?.id || 'new');
    toast(`Cloning ${r.full_name}…`);
    try {
      const dir = await cloneRepo(r.owner.login, r.name, parent);
      const pid = await importFolder(dir, linked?.id);
      if (pid) updProj(pid, q => ({ ...q, tagline: q.tagline.startsWith('Loaded from local folder') && r.description ? r.description : q.tagline, repo: { ...(q.repo || {}), owner: r.owner.login, name: r.name, branch: r.default_branch, private: r.private, auto: q.repo?.auto ?? true } }));
    } catch (e) {
      toast(String((e as Error)?.message || e));
    } finally {
      setBusyRepo(null);
    }
  }, [importFolder, patchUi, setData, toast, updProj]);

  /** Clone a project's linked repo onto this computer (e.g. created from the phone or another PC). */
  const cloneHere = useCallback(async (pid: string) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    if (!p?.repo || !isDesktop) return;
    const parent = await pickParentFolder(`Where should ${p.repo.name} be cloned?`);
    if (!parent) return;
    await withRepoBusy(pid, `Cloning ${p.repo.owner}/${p.repo.name}…`, async () => {
      const dir = await cloneRepo(p.repo!.owner, p.repo!.name, parent);
      await importFolder(dir, pid);
    });
  }, [importFolder, withRepoBusy]);


  /** Poll linked folders + the Desktop for new shortcuts/builds (Codex drops them there). */
  useEffect(() => {
    if (!isDesktop) return;
    let stop = false;
    const tick = async () => {
      const desk = await getDesktopDir().catch(() => null);
      const deskScan = desk ? await scanFolder(desk).catch(() => null) : null;
      for (const p of dataRef.current.projects) {
        const found: Build[] = [];
        const lf = localFolder(p);
        if (lf?.path) {
          const s = await scanFolder(lf.path).catch(() => null);
          if (s) found.push(...(await detectFromScan(s)).builds);
        }
        if (deskScan && desk) {
          for (const e of deskScan.entries) {
            if (BUILD_RE.test(e.name) && slug(e.name).startsWith(slug(p.name)) && slug(p.name).length >= 3)
              found.push({ id: uid(), name: e.name, path: await joinPath(desk, e.name), kind: kindOfFile(e.name), platform: platformOfFile(e.name), by: 'codex', ts: now(), device: deviceId });
          }
        }
        const fresh = found.filter(b => !p.builds.some(x => x.path === b.path) && !(p.dismissed || []).includes(b.path));
        if (fresh.length && !stop) {
          // Point at the newest one so it's obvious which shortcut to click.
          updProj(p.id, q => ({ ...q, builds: [...fresh.filter(b => !q.builds.some(x => x.path === b.path)), ...q.builds], spotlight: { buildId: fresh[0].id, ts: now() }, activity: [...fresh.map(b => A('codex', 'New build detected: ' + b.name)), ...q.activity] }));
          toast(`New build for ${p.name}: ${fresh[0].name}`);
        }
      }
    };
    const iv = window.setInterval(() => { void tick(); }, 15000);
    void tick();
    return () => { stop = true; window.clearInterval(iv); };
  }, [updProj, toast]);

  // ── Builds ────────────────────────────────────────────────────────────────────
  const deviceName = useCallback((id?: string) => (id && dataRef.current.devices?.[id]?.name) || 'another device', []);

  /**
   * Windows builds only launch on Windows, Mac builds on a Mac, Android builds on Android.
   * Local files also have to be on this device; web URLs open anywhere.
   */
  const launchable = useCallback((b: Build): { ok: boolean; why?: string } => {
    const onThisDevice = !b.device || b.device === deviceId;
    if (b.platform === 'web') return isUrl(b.path) || onThisDevice ? { ok: true } : { ok: false, why: `This web build is on ${deviceName(b.device)}` };
    if (b.platform === 'android') {
      if (deviceOs !== 'android') return { ok: false, why: 'Android build — play it from the Mosslight app on your phone' };
      if (b.remote || isUrl(b.path)) return { ok: true };
      return { ok: false, why: b.device ? `Waiting for ${deviceName(b.device)} to upload this APK — open Mosslight there with sync on` : 'This APK isn\'t synced yet' };
    }
    if (b.platform !== deviceOs) return { ok: false, why: `${OS_LABEL[b.platform]} build — open Mosslight on ${b.platform === 'mac' ? 'a Mac' : 'a Windows PC'} to play it` };
    if (!onThisDevice) return { ok: false, why: `This build is on ${deviceName(b.device)}` };
    return { ok: true };
  }, [deviceName]);

  const launch = useCallback(async (p: Project, b: Build) => {
    const l = launchable(b);
    if (!l.ok) return toast(l.why!);
    try {
      if (b.platform === 'android' && b.remote) {
        const store = engineRef.current?.store;
        if (!store) return toast('Turn on sync in Settings to install builds from your computer');
        toast(await installOrLaunch(store, b, toast));
      } else if (isUrl(b.path)) {
        await openExternal(b.path);
        toast('Opened ' + b.name);
      } else {
        await launchPath(b.path);
        toast('Launched ' + b.name);
      }
      logActivity(p.id, 'codex', `Launched test build ${b.name} on ${dataRef.current.devices?.[deviceId]?.name || OS_LABEL[deviceOs]}`);
    } catch (e) {
      toast('Couldn\'t launch ' + b.name + ': ' + ((e as Error)?.message || String(e)));
    }
  }, [launchable, logActivity, toast, deviceName]);

  const addBuild = useCallback((pid: string, v: string) => {
    const path = v.trim().replace(/^"|"$/g, '');
    if (!path) return;
    const name = baseName(path);
    updProj(pid, p => ({ ...p, builds: [{ id: uid(), name, path, kind: /^https?:/i.test(path) ? 'web' : kindOfFile(path), platform: /^https?:/i.test(path) ? 'web' : platformOfFile(path), by: 'codex', ts: now(), device: isUrl(path) ? undefined : deviceId }, ...p.builds], activity: [A('codex', 'Registered shortcut ' + name), ...p.activity] }));
  }, [updProj]);

  const removeBuild = useCallback((pid: string, b: Build) => updProj(pid, p => ({ ...p, builds: p.builds.filter(x => x.id !== b.id), dismissed: uniq([...(p.dismissed || []), b.path]) })), [updProj]);

  // ── Images (covers, art, previews) ────────────────────────────────────────────
  const storeImage = useCallback(async (file: File, name: string): Promise<string> => {
    const { dataUrl, bytes } = await resizeImage(file, 1400);
    // With sync on, images go to the shared repo so every device can show them.
    if (engineRef.current) {
      const ref = await uploadImage(bytes).catch(() => null);
      if (ref) return ref;
    }
    if (platform === 'web') return dataUrl;
    const fname = `${name}_${Date.now().toString(36)}.jpg`;
    return saveBytes(bytes, isDesktop ? await joinPath(await imageDir(), fname) : '', `images/${fname}`);
  }, []);

  const setCoverImage = useCallback(async (pid: string, file: File) => {
    const path = await storeImage(file, 'cover_' + pid);
    updProj(pid, p => ({ ...p, coverImage: path, coverArt: undefined }));
  }, [storeImage, updProj]);

  /** Use an image that already exists (project folder or generated art) as the cover. */
  const setCoverFrom = useCallback(async (pid: string, src: string) => {
    updProj(pid, p => ({ ...p, coverImage: src, coverArt: undefined }));
    toast('Cover updated');
    // With sync on, share a local file so the other devices show the same cover.
    if (engineRef.current && isDesktop && !src.startsWith('img:') && !isUrl(src)) {
      try {
        const blob = await (await fetch(fileSrc(src)!)).blob();
        const { bytes } = await resizeImage(blob, 1400);
        const ref = await uploadImage(bytes);
        if (ref) updProj(pid, p => (p.coverImage === src ? { ...p, coverImage: ref } : p));
      } catch { /* keep the local path */ }
    }
  }, [updProj, toast]);

  const clearCover = useCallback((pid: string) => updProj(pid, p => ({ ...p, coverImage: undefined, coverArt: undefined })), [updProj]);

  /**
   * Copies local art into sync (downscaled) so the phone and other computers can see it.
   * Skips anything already shared.
   */
  const shareArt = useCallback(async (pid: string, items: { src: string; name: string; group: string }[]) => {
    if (!engineRef.current) return toast('Turn on sync in Settings first — that\'s how your phone sees this art');
    const have = new Set((dataRef.current.projects.find(p => p.id === pid)?.sharedArt || []).map(a => a.from || a.name));
    const todo = items.filter(i => !have.has(i.src) && !i.src.startsWith('img:')).slice(0, 400);
    if (!todo.length) return toast('Already shared with your devices');
    setSharing({ done: 0, total: todo.length });
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      const it = todo[i];
      try {
        const blob = await (await fetch(fileSrc(it.src)!)).blob();
        const { bytes } = await resizeImage(blob, 1600);
        const ref = await uploadImage(bytes);
        if (ref) updProj(pid, p => ({ ...p, sharedArt: [...(p.sharedArt || []), { id: uid(), name: it.name, group: it.group, ref, from: it.src, ts: now() }] }));
      } catch { failed++; }
      setSharing({ done: i + 1, total: todo.length });
    }
    setSharing(null);
    toast(`Shared ${todo.length - failed} image${todo.length - failed === 1 ? '' : 's'} with your devices${failed ? ` · ${failed} couldn't be read` : ''}`);
  }, [updProj, toast]);

  const unshareArt = useCallback((pid: string, group?: string) => {
    updProj(pid, p => ({ ...p, sharedArt: (p.sharedArt || []).filter(a => (group ? a.group !== group : false)) }));
    toast(group ? `${group} is no longer shared` : 'Shared art removed');
  }, [updProj, toast]);

  // ── Story bible (characters, maps, locations…) ───────────────────────────────
  const updStory = useCallback((pid: string, fn: (s: StorySection[]) => StorySection[]) => updProj(pid, p => ({ ...p, story: fn(p.story || []) })), [updProj]);
  const updSection = useCallback((pid: string, sid: string, fn: (s: StorySection) => StorySection) => updStory(pid, list => list.map(s => (s.id === sid ? fn(s) : s))), [updStory]);

  const addSection = useCallback((pid: string, title: string) => {
    const id = uid();
    updStory(pid, list => [...list, { id, title, entries: [], ts: now() }]);
    return id;
  }, [updStory]);
  const renameSection = useCallback((pid: string, sid: string, title: string) => updSection(pid, sid, s => ({ ...s, title })), [updSection]);
  const removeSection = useCallback((pid: string, sid: string) => updStory(pid, list => list.filter(s => s.id !== sid)), [updStory]);

  const addEntry = useCallback((pid: string, sid: string, name: string) => {
    const id = uid();
    updSection(pid, sid, s => ({ ...s, entries: [...s.entries, { id, name, images: [], ts: now() }] }));
    return id;
  }, [updSection]);
  const updEntry = useCallback((pid: string, sid: string, eid: string, patch: Partial<StoryEntry>) => updSection(pid, sid, s => ({ ...s, entries: s.entries.map(e => (e.id === eid ? { ...e, ...patch } : e)) })), [updSection]);
  const removeEntry = useCallback((pid: string, sid: string, eid: string) => updSection(pid, sid, s => ({ ...s, entries: s.entries.filter(e => e.id !== eid) })), [updSection]);

  /**
   * Adds pictures to a story entry. Local files are copied into sync (downscaled) so the
   * character/map shows on every device — a story bible is small, so this happens automatically.
   */
  const addEntryImages = useCallback(async (pid: string, sid: string, eid: string, srcs: string[]) => {
    if (!srcs.length) return;
    updEntry(pid, sid, eid, { images: uniq([...(dataRef.current.projects.find(p => p.id === pid)?.story?.find(s => s.id === sid)?.entries.find(e => e.id === eid)?.images || []), ...srcs]) });
    if (!engineRef.current || !isDesktop) return;
    const local = srcs.filter(s => !s.startsWith('img:') && !isUrl(s));
    if (!local.length) return;
    setSharing({ done: 0, total: local.length });
    for (let i = 0; i < local.length; i++) {
      try {
        const blob = await (await fetch(fileSrc(local[i])!)).blob();
        const { bytes } = await resizeImage(blob, 1600);
        const ref = await uploadImage(bytes);
        if (ref) updEntry(pid, sid, eid, { images: uniq((dataRef.current.projects.find(p => p.id === pid)?.story?.find(s => s.id === sid)?.entries.find(e => e.id === eid)?.images || []).map(x => (x === local[i] ? ref : x))) });
      } catch { /* keep the local path */ }
      setSharing({ done: i + 1, total: local.length });
    }
    setSharing(null);
  }, [updEntry]);

  const setArtFolders = useCallback((pid: string, folders: string[] | undefined) => updProj(pid, p => ({ ...p, artFolders: folders })), [updProj]);

  /** Copies a song into sync so it plays on the phone too. */
  const shareTrack = useCallback(async (pid: string, t: { id: string; path: string; name: string }) => {
    if (!engineRef.current) return toast('Turn on sync in Settings first');
    setSharing({ done: 0, total: 1 });
    try {
      const bytes = await readFileBytes(t.path, 60 * 1024 * 1024);
      const ref = await uploadFile(bytes, (t.path.split('.').pop() || 'mp3').toLowerCase());
      if (!ref) throw new Error('Upload failed');
      updProj(pid, p => ({ ...p, music: (p.music || []).map(m => (m.id === t.id ? { ...m, ref } : m)) }));
      toast(`${t.name} now plays on your other devices`);
    } catch (e) {
      toast(`Couldn't share ${t.name}: ${(e as Error)?.message || e}`);
    } finally {
      setSharing(null);
    }
  }, [updProj, toast]);

  /** Copies a PDF/doc into sync so it opens on the phone too. */
  const shareDoc = useCallback(async (pid: string, doc: ProjectDoc) => {
    if (!engineRef.current) return toast('Turn on sync in Settings first');
    setSharing({ done: 0, total: 1 });
    try {
      const bytes = await readFileBytes(doc.path, 80 * 1024 * 1024);
      const ref = await uploadFile(bytes, (doc.path.split('.').pop() || 'pdf').toLowerCase());
      if (!ref) throw new Error('Upload failed');
      updProj(pid, p => {
        const docs = p.docs || [];
        return { ...p, docs: docs.some(d => d.id === doc.id) ? docs.map(d => (d.id === doc.id ? { ...d, ref } : d)) : [{ ...doc, ref }, ...docs] };
      });
      toast(`${doc.name} is now readable on your other devices`);
    } catch (e) {
      toast(`Couldn't share ${doc.name}: ${(e as Error)?.message || e}`);
    } finally {
      setSharing(null);
    }
  }, [updProj, toast]);
  const setFeaturedBuild = useCallback((pid: string, bid: string | undefined) => updProj(pid, p => ({ ...p, featuredBuild: p.featuredBuild === bid ? undefined : bid, spotlight: p.spotlight?.buildId === bid ? undefined : p.spotlight })), [updProj]);
  const clearSpotlight = useCallback((pid: string) => updProj(pid, p => ({ ...p, spotlight: undefined })), [updProj]);
  const setSummary = useCallback((pid: string, summary: string) => updProj(pid, p => ({ ...p, summary })), [updProj]);

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
      added.push({ id: uid(), name: f.name, kind, size: fmtSize(f.size), tags: [], ts: now(), usedBy: pid ? [pid] : [], path, preview, hash, device: path ? deviceId : undefined });
    }
    setData(d => ({ ...d, assets: [...added, ...d.assets] }));
    toast(`Added ${added.length} file${added.length === 1 ? '' : 's'} to the asset library` + (dupes ? ` · ${dupes} already there` : ''));
  }, [toast]);

  const toggleAssetLink = useCallback(async (a: Asset, p: Project) => {
    const linked = a.usedBy.includes(p.id);
    let links = { ...(a.links || {}) };
    try {
      const lf = localFolder(p);
      if (!linked && isDesktop && a.path && lf?.path && (!a.device || a.device === deviceId)) {
        links[p.id] = await copyFile(a.path, await joinPath(lf.path, ...assetFolderFor(p), a.name));
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

  // ── Sync across devices ───────────────────────────────────────────────────────
  const [syncState, setSyncState] = useState<SyncState>({ status: 'off' });
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);

  /** Remote changes are merged into whatever is current, so edits made meanwhile survive. */
  const applyRemote = useCallback((d: HubData) => {
    const next = merge(dataRef.current, toDoc(d));
    dataRef.current = next;
    setRaw(cur => merge(cur, toDoc(d)));
  }, []);

  const startSync = useCallback(async (cfg: SyncConfig) => {
    engineRef.current?.stop();
    const engine = new SyncEngine(cfg, () => dataRef.current, applyRemote, setSyncState);
    engineRef.current = engine;
    const ok = await engine.start();
    if (!ok) { engine.stop(); engineRef.current = null; setImageStore(null); return false; }
    setImageStore(engine.store);
    setSyncConfig(cfg);
    return true;
  }, [applyRemote]);

  const connectSync = useCallback(async (cfg: SyncConfig) => {
    const ok = await startSync(cfg);
    if (ok) { await saveSyncConfig(cfg); toast('Sync is on — this device now shares the library'); }
    return ok;
  }, [startSync, toast]);

  const disconnectSync = useCallback(async () => {
    engineRef.current?.stop();
    engineRef.current = null;
    setImageStore(null);
    setSyncConfig(null);
    setSyncState({ status: 'off' });
    await saveSyncConfig(null);
    toast('Sync turned off on this device');
  }, [toast]);

  useEffect(() => {
    void loadSyncConfig().then(c => { if (c) void startSync(c); });
    return () => engineRef.current?.stop();
  }, [startSync]);

  useEffect(() => { engineRef.current?.schedulePush(); }, [data]);

  /** Desktop: upload Android builds found on this computer so the phone can install them. */
  const apkTried = useRef(new Set<string>());
  useEffect(() => {
    const store = engineRef.current?.store;
    if (!isDesktop || !store || syncState.status !== 'ok') return;
    for (const p of data.projects) {
      for (const b of p.builds) {
        if (b.platform !== 'android' || b.remote || isUrl(b.path) || b.device !== deviceId || apkTried.current.has(b.id)) continue;
        apkTried.current.add(b.id);
        void uploadApk(store, b)
          .then(remote => { updProj(p.id, q => ({ ...q, builds: q.builds.map(x => (x.id === b.id ? { ...x, remote } : x)) })); toast(`${b.name} is ready to install on your phone`); })
          .catch(e => toast(`Couldn't send ${b.name} to your phone: ${(e as Error)?.message || e}`));
      }
    }
  }, [data.projects, syncState.status, updProj, toast]);

  /** Once sync is on, move images that only exist on this device into the shared repo. */
  const imgTried = useRef(new Set<string>());
  useEffect(() => {
    if (syncState.status !== 'ok' || platform === 'android') return;
    const local = (s?: string) => !!s && !s.startsWith('img:') && !isUrl(s) && !imgTried.current.has(s);
    const lift = async (src: string) => {
      imgTried.current.add(src);
      const bytes = src.startsWith('data:') ? Uint8Array.from(atob(src.split(',')[1]), c => c.charCodeAt(0)) : await readFileBytes(src, 25 * 1024 * 1024);
      return uploadImage(bytes, /\.png$/i.test(src) || src.startsWith('data:image/png') ? 'png' : 'jpg');
    };
    for (const p of data.projects) {
      if (local(p.coverImage)) void lift(p.coverImage!).then(ref => ref && updProj(p.id, q => ({ ...q, coverImage: ref }))).catch(() => {});
      for (const a of p.art) if (local(a.imagePath)) void lift(a.imagePath!).then(ref => ref && updProj(p.id, q => ({ ...q, art: q.art.map(x => (x.id === a.id ? { ...x, imagePath: ref } : x)) }))).catch(() => {});
    }
  }, [data.projects, syncState.status, updProj]);

  const proj = useMemo(() => (ui.view === 'project' ? data.projects.find(p => p.id === ui.pid) || null : null), [data.projects, ui.view, ui.pid]);

  return {
    data, settings, ui, proj, chatKey,
    patchUi, toast, updProj, updSettings, setData,
    send, ask, dispatch, attachFiles, removeAttachment, reroute, approve, decline, choose, toggleOverride, draftSection, stopRun, runPlan, declinePlan,
    cycleTask, createProject, removeProject, openFolder,
    launch, launchable, deviceName, addBuild, removeBuild, setCoverImage, setArtImage, setCoverFrom, clearCover, setFeaturedBuild, setSummary,
    addLoadingScreen, wireLoadingScreen, rescanBuilds, scanningBuilds, refreshBrief, syncCards, addArtImages,
    shareArt, unshareArt, shareDoc, shareTrack, sharing, clearSpotlight,
    addSection, renameSection, removeSection, addEntry, updEntry, removeEntry, addEntryImages, setArtFolders,
    draftSummary, importEntries, autoImportEntries, draftEntries, suggestEntries, proposeBios, addEntries, buildEntry,
    addAssets, toggleAssetLink, removeAsset, setAssetPreview,
    syncState, syncConfig, connectSync, disconnectSync,
    busyRepo, backupNow, linkRepo, createRepoFor, unlinkRepo, setRepoAuto, openFromGitHub, cloneHere, listUnpushed, pushOne,
  };
}

export type Hub = ReturnType<typeof useHub>;
