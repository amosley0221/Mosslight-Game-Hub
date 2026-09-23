import { KW, ORDER } from './constants';
import type { AgentId, AgentResult, BuildKind, PlanStep, Platform } from './types';

/** Score a message against each agent's keywords. Ties or zero → null (ask the user). */
export function route(text: string): { agent: AgentId | null; hit?: string } {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return { agent: null };
  const scores = {} as Record<AgentId, number>;
  const hits = {} as Record<AgentId, string>;
  for (const a of ORDER) {
    scores[a] = 0;
    for (const k of KW[a]) {
      if (t.includes(k)) {
        scores[a] += k.length > 5 ? 2 : 1;
        hits[a] = hits[a] || k;
      }
    }
  }
  const sorted = ORDER.slice().sort((a, b) => scores[b] - scores[a]);
  if (scores[sorted[0]] === 0 || scores[sorted[0]] === scores[sorted[1]]) return { agent: null };
  return { agent: sorted[0], hit: hits[sorted[0]] };
}

const AGENT_RE = /^(grok|codex|claude)$/i;

/**
 * Parse an agent's raw reply: strip HANDOFF / TASK / ART / BUILD control lines
 * and capture fenced code blocks for the Dev tab.
 */
export function parseReply(raw: string, agent: AgentId, short: string): AgentResult {
  const res: AgentResult = { text: '', tasks: [] };
  // A handoff can carry a ready-to-run prompt for the teammate: <<<PROMPT … PROMPT>>>
  let handoffPrompt: string | undefined;
  const body = String(raw).replace(/<<<PROMPT\s*\n?([\s\S]*?)\n?\s*PROMPT>>>/, (_m, p: string) => { handoffPrompt = p.trim(); return ''; });
  const fences = [...body.matchAll(/```([\w+#.-]*)[^\n]*\n([\s\S]*?)```/g)];
  if (fences.length) {
    res.code = fences.map((f, i) => {
      const code = f[2].replace(/\s+$/, '');
      const fileHint = code.split('\n')[0].match(/^\s*(?:\/\/|#|--)\s*(?:file:\s*)?([\w./\\-]+\.\w+)\s*$/i);
      return { title: short + (fences.length > 1 ? ' (' + (i + 1) + ')' : ''), lang: f[1] || '', code, file: fileHint ? fileHint[1] : '' };
    });
  }
  const keep: string[] = [];
  for (const ln of body.split('\n')) {
    const h = ln.match(/^\s*HANDOFF:\s*(grok|codex|claude)\s*[—–-]+\s*(.+)$/i);
    const k = ln.match(/^\s*TASK:\s*(?:\[(grok|codex|claude)\]\s*)?(.+)$/i);
    const art = ln.match(/^\s*ART:\s*(.+?)\s*[—–|-]+\s*(.+)$/i);
    const b = ln.match(/^\s*BUILD:\s*(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(desktop|web|android))?(?:\s*\|\s*(windows|mac|android|web))?\s*$/i);
    if (h && h[1].toLowerCase() !== agent) res.handoff = { to: h[1].toLowerCase() as AgentId, reason: h[2].trim() };
    else if (k) res.tasks!.push({ title: k[2].trim(), agent: k[1] && AGENT_RE.test(k[1]) ? (k[1].toLowerCase() as AgentId) : undefined });
    else if (art && agent === 'grok') (res.art = res.art || []).push({ title: art[1].trim(), prompt: art[2].trim() });
    else if (b && agent === 'codex') (res.builds = res.builds || []).push({ name: b[1].trim(), path: b[2].trim(), kind: b[3]?.toLowerCase() as BuildKind | undefined, platform: b[4]?.toLowerCase() as Platform | undefined });
    else keep.push(ln);
  }
  res.text = keep.join('\n').trim();
  if (res.handoff && handoffPrompt) res.handoff.prompt = handoffPrompt;
  return res;
}

/** Extracts a Team plan ({ summary, steps: [{ agent, title, prompt, after }] }) from a reply. */
export function parsePlan(raw: string): { summary: string; steps: PlanStep[] } | null {
  const s = String(raw);
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(s.slice(start, end + 1));
    const steps: PlanStep[] = (Array.isArray(j.steps) ? j.steps : [])
      .filter((x: { agent?: string; prompt?: string }) => x && AGENT_RE.test(String(x.agent)) && x.prompt)
      .slice(0, 6)
      .map((x: { agent: string; title?: string; prompt: string; after?: unknown }, i: number) => ({
        agent: x.agent.toLowerCase() as AgentId,
        title: String(x.title || x.prompt).slice(0, 80),
        prompt: String(x.prompt),
        after: (Array.isArray(x.after) ? x.after : []).map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n < i),
        status: 'waiting' as const,
      }));
    return steps.length ? { summary: String(j.summary || ''), steps } : null;
  } catch {
    return null;
  }
}
