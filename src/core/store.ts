import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AGENTS, ENGINE_BY, LIB_HINTS, WEB_ENGINES, engineName, kindOf } from './constants';
import { planTeam, respond, type Reply } from './agents';
import { route } from './router';
import { defaultSettings, emptyData, norm, purgeDemoOnce } from './seed';
import type { AgentId, AgentMode, Asset, Build, HubData, Message, PlanStep, Platform, Project, Settings, Usage } from './types';
import { A, T, baseName, fmtSize, now, uid, uniq } from './util';
import {
  cancelAgentRun, copyFile, getDesktopDir, homePath, pickParentFolder, writeTextIfMissing, imageDir, isDesktop, joinPath, launchPath, libraryRoot, openExternal,
  pickFolder, platform, readFileBytes, removeFile, saveBytes, scanFolder, type ScanResult,
} from '../platform';
import { OS_LABEL, deviceId, deviceOs, localFolder } from '../sync/device';
import { SyncEngine, loadSyncConfig, saveSyncConfig, type SyncConfig, type SyncState } from '../sync/engine';
import { merge, toDoc } from '../sync/merge';
import { setImageStore, uploadImage } from '../sync/images';
import { installOrLaunch, uploadApk } from '../sync/apk';
import { createRepo, getRepo, repoSlug, type GhRepo } from '../github/api';
import { backup, cloneRepo, connectFolder, detectRepo } from '../github/git';

const KEY = 'gdh:state:v3';
const SKEY = 'gdh:settings:v1';

function loadData(): HubData {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.projects) {
      return purgeDemoOnce({
        projects: s.projects.map(norm), messages: s.messages || {}, assets: s.assets || [],
        usageBy: s.usageBy || (s.usage ? { [deviceId]: s.usage } : {}), deleted: s.deleted || {}, devices: s.devices || {},
      });
    }
  } catch { /* first run */ }
  return emptyData();
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

function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (s) {
      // Before 0.4 there was only a Local/Remote switch; Remote (the default) becomes Auto = local first.
      const legacy = (a: AgentId): AgentMode => (s.remote && s.remote[a] === false ? 'local' : 'auto');
      const mode = s.mode || { claude: legacy('claude'), codex: legacy('codex'), grok: 'remote' };
      return { ...d, ...s, mode: { ...d.mode, ...mode, grok: 'remote' }, models: { ...d.models, ...s.models }, localModels: { ...(s.localModels || {}) }, tools: { ...d.tools, ...s.tools } };
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
}

const BUILD_RE = /\.(lnk|exe|bat|cmd|url|app|command|sh|apk|aab)$/i;
const platformOfFile = (n: string): Platform => (/\.(apk|aab)$/i.test(n) ? 'android' : /\.(app|command|sh)$/i.test(n) ? 'mac' : /\.html?$/i.test(n) ? 'web' : 'windows');
const kindOfFile = (n: string) => (/\.(apk|aab)$/i.test(n) ? 'android' : /\.html?$/i.test(n) ? 'web' : 'desktop') as Build['kind'];
const isUrl = (p: string) => /^https?:/i.test(p);
const slug =(s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

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
  const [ui, setUi] = useState<Ui>({ view: 'library', pid: null, tab: 'overview', chatOpen: true, input: '', busy: false, forced: null, toast: null });
  const dataRef = useRef(data); dataRef.current = data;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const uiRef = useRef(ui); uiRef.current = ui;
  const toastTimer = useRef<number>();
  const engineRef = useRef<SyncEngine | null>(null);

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
    setData(d => {
      const mine = { ...ZERO, ...(d.usageBy[deviceId] || {}) };
      const usageBy = res.offline || !res.tokens ? d.usageBy : { ...d.usageBy, [deviceId]: { ...mine, [agent]: { calls: mine[agent].calls + 1, tokens: mine[agent].tokens + res.tokens } } };
      const projects = !proj || res.offline ? d.projects : d.projects.map(p => {
        if (p.id !== proj.id) return p;
        const q = { ...p };
        if (res.tasks?.length) { q.tasks = [...q.tasks, ...res.tasks.map(t => T(t.agent || agent, t.title, 'todo', 0))]; q.activity = [...res.tasks.map(t => A(t.agent || agent, 'Task added: ' + t.title)), ...q.activity]; }
        if (res.art?.length) { q.art = [...res.art.map(a => ({ id: uid(), title: a.title, prompt: a.prompt, imagePath: a.imagePath, ts: now() })), ...q.art]; q.activity = [...res.art.map(a => A('grok', 'Generated concept: ' + a.title)), ...q.activity]; }
        if (res.builds?.length) {
          q.builds = [...res.builds.map(b => ({ id: uid(), name: b.name, path: b.path, kind: b.kind || kindOfFile(b.path), platform: b.platform || platformOfFile(b.path), by: 'codex' as AgentId, ts: now(), device: isUrl(b.path) ? undefined : deviceId })), ...q.builds];
          q.activity = [...res.builds.map(b => A('codex', 'Registered test build ' + b.name)), ...q.activity];
        }
        if (res.code?.length) { q.code = [...res.code.map(k => ({ id: uid(), agent, title: k.title, file: k.file || '', lang: k.lang || '', code: k.code, ts: now() })), ...q.code]; q.activity = [...res.code.map(k => A(agent, 'Code logged: ' + k.title)), ...q.activity]; }
        if (res.gdd) q.gdd = q.gdd.map(g => (g.title.toLowerCase() === res.gdd!.title.toLowerCase() ? { ...g, body: res.gdd!.body } : g));
        q.activity = [A(agent, `${res.stopped ? 'Stopped' : 'Replied to'}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`), ...q.activity];
        return q;
      });
      return { ...d, usageBy, projects };
    });
  }, [setData]);

  const approveRef = useRef<(key: string, m: Extract<Message, { type: 'handoff' }>, prompt?: string, auto?: boolean) => void>();

  /**
   * Sends a request to one agent. Shows live progress (streamed text, steps, timer) while it runs,
   * waits in that agent's queue if it's busy, and resolves with the final reply.
   */
  const dispatch = useCallback((key: string, agent: AgentId, text: string, routeLabel: string): Promise<Reply & { messageId: string }> => {
    const id = uid();
    const busyAhead = !!queues.current[agent];
    push(key, { id, type: 'agent', agent, text: '', pending: true, queued: busyAhead, route: routeLabel, userText: text });

    const run = async (): Promise<Reply & { messageId: string }> => {
      if (skipped.current.delete(id)) {
        updAgentMsg(key, id, { pending: false, queued: false, stopped: true, text: '(cancelled before it started)' });
        return { text: '', tokens: 0, stopped: true, messageId: id };
      }
      const ctrl = new AbortController();
      const runId = uid() + uid();
      liveRuns.current.set(id, { ctrl, runId });
      setRunning(1);
      updAgentMsg(key, id, { queued: false, startedAt: now(), runId, runDevice: deviceId, steps: [] });

      // Stream updates are batched so a fast token stream doesn't re-render (or sync) on every word.
      const live = { text: '', steps: [] as string[], via: '' };
      let timer: number | undefined;
      const flush = () => { timer = undefined; updAgentMsg(key, id, m => ({ text: live.text, steps: live.steps.slice(-40), route: live.via ? `${routeLabel} · ${live.via}` : m.route })); };
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
        });
      } catch (e) {
        res = ctrl.signal.aborted
          ? { text: live.text || '(stopped)', tokens: 0, stopped: true, via: live.via }
          : { text: 'Something went wrong: ' + ((e as Error)?.message || String(e)), tokens: 0, error: true, via: live.via };
      } finally {
        window.clearTimeout(timer);
        liveRuns.current.delete(id);
        setRunning(-1);
      }
      updAgentMsg(key, id, {
        text: res.text, pending: false, finishedAt: now(), stopped: res.stopped, error: res.error || res.offline,
        steps: live.steps.slice(-40), route: res.via ? `${routeLabel} · ${res.via}` : routeLabel,
      });
      applyReply(key, agent, text, res);
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
  }, [push, updAgentMsg, applyReply]);

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
        if (m.type === 'agent' && m.pending && (!m.runDevice || m.runDevice === deviceId)) { changed = true; return { ...m, pending: false, queued: false, stopped: true, text: (m.text ? m.text + '\n\n' : '') + '(interrupted — Mosslight was closed while this was running)' }; }
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

  // ── Team mode ────────────────────────────────────────────────────────────────
  /** The team lead drafts a plan (steps per agent); you approve it once, then it runs. */
  const startTeam = useCallback(async (key: string, text: string) => {
    const lead = settingsRef.current.teamLead || 'codex';
    const id = uid();
    push(key, { id, type: 'plan', lead, summary: '', steps: [], status: 'drafting', userText: text });
    const proj = dataRef.current.projects.find(p => p.id === key) || null;
    setRunning(1);
    try {
      const plan = await planTeam(lead, text, proj, settingsRef.current);
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
  }, [push, updPlan, applyReply]);

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

  const sendText = useCallback((key: string, raw: string, forced: AgentId | 'team' | null) => {
    const text = raw.trim();
    if (!text) return;
    push(key, { id: uid(), type: 'user', text });
    if (forced === 'team') return void startTeam(key, text);
    const r = forced ? { agent: forced, hit: 'manual' } : route(text);
    if (!r.agent) return push(key, { id: uid(), type: 'choose', userText: text });
    void dispatch(key, r.agent, text, r.hit === 'manual' ? 'you picked ' + AGENTS[r.agent].name : `auto-routed · "${r.hit}"`);
  }, [dispatch, push, startTeam]);

  const chatKey = ui.view === 'project' && ui.pid ? ui.pid : 'global';
  const send = useCallback(() => { const u = uiRef.current; sendText(u.view === 'project' && u.pid ? u.pid : 'global', u.input, u.forced); patchUi({ input: '' }); }, [sendText, patchUi]);
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
  const cycleTask = useCallback((pid: string, tid: string) => updProj(pid, p => {
    const tasks = p.tasks.map(t => (t.id === tid ? { ...t, status: t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : 'todo' } as typeof t : t));
    const t = tasks.find(x => x.id === tid)!;
    return { ...p, tasks, activity: [A(t.agent, (t.status === 'done' ? 'Completed ' : t.status === 'doing' ? 'Started ' : 'Reopened ') + t.title), ...p.activity] };
  }), [updProj]);

  // ── GitHub backups ────────────────────────────────────────────────────────────
  const backingUp = useRef(new Set<string>());
  const backupRef = useRef<(pid: string, reason?: string, silent?: boolean) => Promise<void>>();
  const [busyRepo, setBusyRepo] = useState<string | null>(null);
  const myDeviceName = () => dataRef.current.devices?.[deviceId]?.name || OS_LABEL[deviceOs];

  /** Commit + push the project's local folder. `silent` = no toast when there's nothing to back up. */
  const backupNow = useCallback(async (pid: string, reason?: string, silent = false) => {
    const p = dataRef.current.projects.find(x => x.id === pid);
    const lf = p && localFolder(p);
    if (!p?.repo || !lf?.path || !isDesktop || backingUp.current.has(pid)) return;
    backingUp.current.add(pid);
    try {
      const res = await backup(lf.path, reason || `Mosslight backup from ${myDeviceName()}`);
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

  const withRepoBusy = useCallback(async (pid: string, label: string, fn: () => Promise<void>) => {
    setBusyRepo(pid);
    toast(label);
    try { await fn(); } catch (e) { toast(String((e as Error)?.message || e)); } finally { setBusyRepo(null); }
  }, [toast]);

  /** Link a GitHub repo you already have. With a local folder here, the folder is connected and pushed. */
  const linkRepo = useCallback((pid: string, owner: string, name: string) => withRepoBusy(pid, `Linking ${owner}/${name}…`, async () => {
    const r = await getRepo(owner, name);
    const link = { owner: r.owner.login, name: r.name, branch: r.default_branch, private: r.private, auto: true };
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
    const link = { owner: r.owner.login, name: r.name, branch: r.default_branch || 'main', private: true, auto: true };
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
  const createProject = useCallback(async (nf: { name: string; tagline: string; tags: string[]; engines: string[]; github?: boolean }) => {
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
    setData(d => ({ ...d, projects: [p, ...d.projects] }));
    patchUi({ view: 'project', pid: p.id, tab: 'overview' });
    if (nf.github) window.setTimeout(() => void createRepoFor(p.id), 50);
    return true;
  }, [patchUi, toast, createRepoFor]);

  const removeProject = useCallback((pid: string) => {
    setData(d => ({ ...d, projects: d.projects.filter(p => p.id !== pid) }));
    patchUi({ view: 'library', pid: null });
  }, [patchUi]);

  /** Import (or re-link) a local folder as a project; picks up its GitHub remote automatically. */
  const importFolder = useCallback(async (path: string, prefer?: string): Promise<string | null> => {
    let scan: ScanResult;
    try { scan = await scanFolder(path); } catch (e) { toast(String(e)); return null; }
    const det = await detectFromScan(scan);
    const remote = await detectRepo(path).catch(() => null);
    const sameRepo = (p: Project) => !!remote && p.repo?.owner.toLowerCase() === remote.owner.toLowerCase() && p.repo?.name.toLowerCase() === remote.name.toLowerCase();
    const match = (p: Project) => p.id === prefer || sameRepo(p) || p.folder?.path === path || p.folder?.name === scan.name || p.name.toLowerCase() === scan.name.toLowerCase();
    const existing = dataRef.current.projects.find(match);
    const pid = existing ? existing.id : uid();
    const repo = remote ? { owner: remote.owner, name: remote.name, branch: remote.branch, auto: true } : undefined;
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
        repo: { owner: r.owner.login, name: r.name, branch: r.default_branch, private: r.private, auto: true },
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
    send, ask, dispatch, reroute, approve, decline, choose, toggleOverride, draftSection, stopRun, runPlan, declinePlan,
    cycleTask, createProject, removeProject, openFolder,
    launch, launchable, deviceName, addBuild, removeBuild, setCoverImage, setArtImage,
    addAssets, toggleAssetLink, removeAsset, setAssetPreview,
    syncState, syncConfig, connectSync, disconnectSync,
    busyRepo, backupNow, linkRepo, createRepoFor, unlinkRepo, setRepoAuto, openFromGitHub, cloneHere,
  };
}

export type Hub = ReturnType<typeof useHub>;
