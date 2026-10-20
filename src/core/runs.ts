/**
 * What every agent is doing on this device right now.
 *
 * Agents can't see each other's work, so two of them happily take the same job — Codex writes a
 * handoff for something Claude is already running. This registry is read when a prompt is built,
 * so each agent is told what its teammates are on, and the team lead gets their actual prompts.
 */
import type { AgentId } from './types';

export interface ActiveRun {
  id: string;
  agent: AgentId;
  /** Chat thread: a project id, or 'global'. */
  key: string;
  /** What was asked. */
  prompt: string;
  queued: boolean;
  at: number;
}

const runs = new Map<string, ActiveRun>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(fn => fn());

export function beginRun(r: ActiveRun) { runs.set(r.id, r); changed(); }
export function startRun(id: string) { const r = runs.get(id); if (r) { runs.set(id, { ...r, queued: false, at: Date.now() }); changed(); } }
export function endRun(id: string) { if (runs.delete(id)) changed(); }
export function onRunsChanged(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Everything in flight, newest last. `key` limits it to one project's chat. */
export const activeRuns = (key?: string) => [...runs.values()].filter(r => !key || r.key === key).sort((a, b) => a.at - b.at);
export const anyRunning = () => [...runs.values()].some(r => !r.queued);

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Context lines about teammates' work. `detail` gives the team lead enough of each prompt to
 * recognise the same job; everyone else just needs to know not to duplicate it.
 */
export function runsContext(key: string, self: AgentId | null, names: Record<AgentId, string>, detail = false): string[] {
  const others = activeRuns(key).filter(r => r.agent !== self);
  if (!others.length) return [];
  const lines = others.map(r => {
    const who = names[r.agent];
    const what = oneLine(r.prompt).slice(0, detail ? 700 : 140);
    const when = r.queued ? 'queued, not started' : `running for ${Math.round((Date.now() - r.at) / 1000)}s`;
    return `- ${who} (${when}): ${what}${oneLine(r.prompt).length > (detail ? 700 : 140) ? '…' : ''}`;
  });
  return [
    'Work already in progress on this project right now:',
    ...lines,
    detail
      ? 'Do not plan a step that repeats one of these. If your request overlaps work already running, say so in the summary and either leave that part out or make your step depend on it.'
      : 'Don\'t start or hand off work that repeats one of these — say it\'s already in progress instead.',
  ];
}

/** Engines running on this computer, so agents can see what holds the GPU before asking for it. */
export interface Proc { name: string; pid: number; ppid?: number; parent?: string; window: string; mb: number; started: string; cmd?: string }
let engines: Proc[] = [];
export const setEngineProcs = (list: Proc[]) => { engines = list; };

/** One running application, with the helper processes it started. */
export interface ProcGroup { root: Proc; kids: Proc[]; mb: number; count: number }

/**
 * Group processes into the applications they actually are.
 *
 * An engine is a tree: one Unity batch build is nine processes, Unity Hub is six, and listing
 * them flat turns two running apps into thirteen alarming rows each offering to end something.
 * Worse, the helpers have no window, so the "a session that never shut down" warning lands on
 * every one of them — including the children of a build that is working perfectly.
 */
export function groupProcs(list: Proc[]): ProcGroup[] {
  const byPid = new Map(list.map(p => [p.pid, p]));
  const roots = list.filter(p => !p.ppid || !byPid.has(p.ppid));
  return roots.map(root => {
    // Walk down from the root so a grandchild lands under the app, not under its own parent.
    const kids: Proc[] = [];
    let frontier = [root.pid];
    while (frontier.length) {
      const next = list.filter(p => p.pid !== root.pid && frontier.includes(p.ppid || -1));
      kids.push(...next);
      frontier = next.map(p => p.pid);
    }
    return { root, kids, count: kids.length + 1, mb: [root, ...kids].reduce((n, p) => n + p.mb, 0) };
  });
}

/** Headless on purpose (a commandlet, an offscreen render) rather than a window that never closed. */
const isBatch = (e: { name: string; cmd?: string }) =>
  /-cmd(\.exe)?$/i.test(e.name) || /-unattended|-renderoffscreen|-execcmds|--background|-batchmode|--headless/i.test(e.cmd || '');

export function engineContext(): string[] {
  if (!engines.length) return [];
  return [
    'Engines running on this computer right now (the single GPU slot). Each line is one program,'
    + ' with the helper processes it started counted in — ending the first ends all of them:',
    ...groupProcs(engines).map(g => {
      const e = g.root;
      const how = /^unrealbuildtool$/i.test(e.name) ? ' — a build in progress'
        : e.window ? ` — window "${e.window}"`
        : isBatch(e) ? ' — headless job, probably a run already in progress'
        // Only a root whose parent is gone is a candidate leftover, and even then an app whose
        // launcher has exited looks exactly like this. Say what's known, not what's assumed.
        : e.parent ? ` — started by ${e.parent}`
        : ' — no window and its parent has exited; may be a session that never shut down';
      const also = g.kids.length ? `, ${g.count} processes` : '';
      return `- ${e.name} (PID ${e.pid}, ${g.mb} MB${also}${e.started ? `, since ${e.started.replace('T', ' ').slice(0, 16)}` : ''})${how}`;
    }),
    'Do not start an engine or GPU capture while one of these is running, and never end one yourself: name it and let the user decide.',
    // Two UnrealBuildTool instances started together race on the same Trace.uba file and one dies
    // before it builds anything, so a second build is not just slow — it can silently not happen.
    'That includes builds: never start an Unreal build while UnrealBuildTool is listed above. Wait for it to finish.',
  ];
}
