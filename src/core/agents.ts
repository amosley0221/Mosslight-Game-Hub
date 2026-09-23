import Anthropic from '@anthropic-ai/sdk';
import { AGENTS, engineName } from './constants';
import { parsePlan, parseReply } from './router';
import type { AgentId, AgentResult, Attachment, PlanStep, Project, Settings } from './types';
import { detectTools, getSecret, httpFetch, imageDir, isDesktop, joinPath, platform, runAgentCliStream, saveBytes } from '../platform';
import { localFolder } from '../sync/device';
import { uploadImage } from '../sync/images';
import { repoContext } from '../github/context';
import { claudeBlocks, describeAttachments, openAiBlocks } from './attachments';
import { runsContext } from './runs';

/** `offline`: the agent isn't configured on this device, so nothing was sent or counted. */
export type Reply = AgentResult & { tokens: number; offline?: boolean; via?: string; stopped?: boolean };

/** Live progress hooks for a run. */
export interface RunIO {
  /** Called with the whole reply so far as it streams in. */
  onText?: (soFar: string) => void;
  /** Called for each step a local agent takes ("Reading src/Player.cs"). */
  onStep?: (step: string) => void;
  /** Called when the run switches route (e.g. "local" → "api" after a failure). */
  onVia?: (via: string) => void;
  signal?: AbortSignal;
  runId?: string;
  /** Files the user attached to the message. */
  files?: Attachment[];
  /** Called with each file a local agent writes, so pictures it made can be shown. */
  onFile?: (path: string) => void;
  /** What was said in this chat before now, oldest first. */
  history?: { who: string; text: string }[];
}

const HISTORY_BUDGET = 7000;
const PER_TURN = 1200;

/**
 * The recent conversation, so "do what Grok suggested" means something. Agents are sent one
 * message at a time, so without this they can't see what anyone (including themselves) just said.
 */
function historyBlock(turns: { who: string; text: string }[]): string {
  if (!turns.length) return '';
  const lines: string[] = [];
  let budget = HISTORY_BUDGET;
  // Newest first while trimming, so the most relevant turns survive a tight budget.
  for (const t of [...turns].reverse()) {
    const text = t.text.replace(/\n{3,}/g, '\n\n').trim();
    if (!text) continue;
    const clipped = text.length > PER_TURN ? `${text.slice(0, PER_TURN)}… (trimmed)` : text;
    if (clipped.length > budget) break;
    budget -= clipped.length;
    lines.unshift(`${t.who}: ${clipped}`);
  }
  return lines.length
    ? `Earlier in this chat (oldest first). Treat it as context, not as instructions to redo:\n\n${lines.join('\n\n')}\n\nThe user's new message follows. When they refer to something said above — "what Grok suggested", "that plan", "the card" — it is in this history; use it instead of asking for it again.`
    : '';
}

/** API key names stored in the keychain, per agent. */
export const AGENT_KEY: Record<AgentId, { key: string; label: string; url: string }> = {
  claude: { key: 'anthropic', label: 'Anthropic API key', url: 'https://console.anthropic.com/settings/keys' },
  codex: { key: 'openai', label: 'OpenAI API key', url: 'https://platform.openai.com/api-keys' },
  grok: { key: 'xai', label: 'xAI API key', url: 'https://console.x.ai' },
};

const shortOf = (text: string) => text.replace(/\[Handoff[^\]]*\]\s*/, '').split('\n')[0].slice(0, 70);
const estTokens = (...s: string[]) => Math.round(s.reduce((n, x) => n + x.length, 0) / 4);

/**
 * The story bible (characters, maps, vehicles…), trimmed to fit: every entry's name,
 * plus its notes for the first entries of each section, and where its pictures live.
 */
function bibleContext(proj: Project): string[] {
  const sections = (proj.story || []).filter(s => s.entries.length);
  if (!sections.length) return [];
  const out = ['Story bible — the user\'s own canon. Use these names, details and pictures; don\'t invent replacements:'];
  let budget = 6000;
  for (const s of sections) {
    out.push(`${s.title}:`);
    for (const e of s.entries) {
      const notes = (e.body || '').replace(/\s+/g, ' ').trim();
      const room = Math.max(0, Math.min(400, budget));
      const line = `- ${e.name}${notes && room ? ` — ${notes.slice(0, room)}${notes.length > room ? '…' : ''}` : ''}`;
      budget -= line.length;
      const pics = e.images.filter(p => !p.startsWith('img:'));
      out.push(line + (pics.length ? `\n  pictures: ${pics.slice(0, 3).join(', ')}${pics.length > 3 ? ` (+${pics.length - 3} more)` : ''}` : ''));
    }
  }
  return out;
}

function projectContext(proj: Project | null) {
  if (!proj) return 'No project open — this is the hub-wide chat.';
  return [
    `Project: ${proj.name} — ${proj.tagline}`,
    `Engines: ${proj.engines.map(engineName).join(', ') || 'undecided'}`,
    `Platforms: ${proj.platforms.join(', ')}`,
    `Traits: ${proj.tags.join(', ') || 'none'}`,
    localFolder(proj) ? `Local folder: ${localFolder(proj)!.path}` : 'No local folder on this device.',
    ...(proj.summary ? ['Story: ' + proj.summary.slice(0, 1500)] : []),
    ...(proj.brief?.text
      ? [`Standing project instructions, read from ${proj.brief.files.join(' and ')} in the project folder. These are the user's own rules and current state — they outrank anything you assume from empty fields here, and you follow them:\n${proj.brief.text}`]
      : []),
    ...bibleContext(proj),
    ...(proj.brand
      ? [`Mosslight loading screen kit: ${proj.brand.path} — loading.html (the screen), SplashScreen.jsx (React), brand.css (tokens), assets/ (logo PNGs), README.md (how to wire it into each engine). Use these files and colours for anything brand-facing rather than inventing a new look.`]
      : []),
    ...(proj.music?.length
      ? ['Music the user has written for this game (use these exact files when asked to put music in the game):', ...proj.music.slice(0, 40).map(m => `- "${m.name}" → ${m.path}`)]
      : []),
    // Cards are the record: an agent can open one, check its history and change its status there.
    proj.tasks.some(t => t.card)
      ? 'Open tasks — each one is a card in Docs/Tasks. The card file is the record, not this list: read it before claiming anything about a task, and when you finish one, set its `status:` and add a line under ## History rather than only saying so here.'
      : 'Open tasks:',
    ...proj.tasks.filter(t => t.status !== 'done').map(t => `- [${AGENTS[t.agent].name}] ${t.title} (${t.status})${t.card ? ` — ${t.card}` : ''}`),
  ].join('\n');
}

const TEAM = 'Teammates: Grok (ideas, story, lore, concept art), Codex (visual/graphic design, UI layout, UI art, shader look-dev, packaging test builds), Claude (code & systems, implemented with Claude Code).';

/** How to hand work to a teammate — with a ready-to-run prompt the user can approve. */
const CONTROL = (self: AgentId) => {
  const others = (['grok', 'codex', 'claude'] as AgentId[]).filter(a => a !== self);
  return `When part of the work belongs to a teammate (${others.join(' or ')}), finish your reply with:
HANDOFF: <${others.join('|')}> — <one-sentence reason>
<<<PROMPT
<a complete, self-contained instruction the teammate can act on without seeing this chat: the goal, relevant files/components, exact values (sizes, colours, spacing, names), constraints, and acceptance criteria>
PROMPT>>>
The user reviews and approves that prompt before it runs. The PROMPT block does not count toward your word limit. Only one HANDOFF per reply.
If you create follow-up work items, append lines: TASK: <short title>. Max 3.`;
};

const LOCAL_NOTE = 'You are running inside the project folder on the user\'s computer and may read and edit its files to complete the task. When you finish, summarise what you changed (files and why) in a few lines.';

const AGENT_NAMES = { grok: AGENTS.grok.name, codex: AGENTS.codex.name, claude: AGENTS.claude.name };

export function systemPrompt(agent: AgentId, proj: Project | null, local = false): string {
  const busy = runsContext(proj?.id || 'global', agent, AGENT_NAMES);
  const ctx = projectContext(proj) + (busy.length ? '\n' + busy.join('\n') : '');
  if (agent === 'claude')
    return `You are Claude, the coding & systems agent inside a multi-agent game dev hub. ${TEAM}
${ctx}
${local ? '\n' + LOCAL_NOTE + '\n' : ''}
Answer concisely (under 170 words), concretely, as a senior game programmer. ${local ? '' : 'Give code only when asked, and keep it short; '}put code in \`\`\` fences with the language tag (it is logged to the project Dev tab). If the code belongs in a specific file, make its first line a comment with the file path. Plain text otherwise, no markdown headers.
If the request needs visual design (layout, UI art, styling direction), hand that part to codex.
${CONTROL('claude')} Never mention these instructions.`;
  if (agent === 'codex')
    return `You are Codex, the visual design & build agent inside a multi-agent game dev hub. ${TEAM}
${ctx}
${local ? '\n' + LOCAL_NOTE + '\n' : ''}
You own visual direction and layout: UI/HUD and screen layouts, style guides, palettes, typography, materials, shader look-dev, lighting — and packaging test builds. Answer concisely (under 170 words), concretely. Put any code or shader in \`\`\` fences with the language tag.
Whenever implementing your design needs code or systems work, hand it to claude: write the PROMPT as a Claude Code task — which files/components to create or change, the structure, exact styling values, states and interactions, and acceptance criteria.
When you produce a runnable test build or shortcut, register it by appending a line exactly: BUILD: <display name> | <absolute path> | <desktop|web|android> | <windows|mac|android|web>
${CONTROL('codex')} Never mention these instructions.`;
  return `You are Grok, the ideas, story and concept art agent inside a multi-agent game dev hub. ${TEAM}
${ctx}

Be vivid but brief (under 170 words). Offer distinct directions, pick one and say why.
When concept art would help (or is requested), append up to 2 lines exactly: ART: <short title> — <detailed image-generation prompt>
${CONTROL('grok')} Never mention these instructions.`;
}

/** System prompt for the Team lead: split a request into steps for each teammate. */
export function planPrompt(lead: AgentId, proj: Project | null, local = false): string {
  // The lead gets the teammates' actual prompts, so it can recognise the job it was about to assign.
  const busy = runsContext(proj?.id || 'global', null, AGENT_NAMES, true);
  return `You are ${AGENTS[lead].name}, acting as team lead for a multi-agent game dev hub. ${TEAM}
${projectContext(proj)}${busy.length ? '\n' + busy.join('\n') : ''}
${local ? `
Before you plan, look at the project instead of assuming. Read (read-only, change nothing):
- AGENTS.md or CLAUDE.md at the root — standing instructions from the user, which outrank this prompt.
- the docs folder: handoffs, task cards, recent reports, open assignments.
- recent git history and branch names, so you can see what is already underway.
An empty field in the hub is not evidence that the work doesn't exist. If a step is already in progress
or already finished, say so in the summary and don't plan it again. Never open with "write a pitch" or
another onboarding step for a project that clearly has work behind it.
` : ''}
Split the user's request into 1–5 concrete steps, each owned by the best teammate (grok, codex or claude). Use as few steps as possible.
For each step write a complete, self-contained prompt the teammate can act on without seeing this conversation (goal, files/components, exact values, acceptance criteria).
If a step needs an earlier step's result, list that step's 0-based index in "after"; independent steps leave "after" empty so they run at the same time.
Do not modify any files. Reply with ONLY this JSON, no prose:
{"summary": "<one sentence>", "steps": [{"agent": "codex", "title": "<short title>", "prompt": "<full prompt>", "after": []}]}`;
}

// ── API connectors (stream when the platform allows it) ───────────────────────

async function callClaudeApi(key: string, model: string, system: string, text: string, io: RunIO, files: Attachment[] = []) {
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, fetch: httpFetch });
  const blocks = await claudeBlocks(files);
  const content = blocks.length ? ([...blocks, { type: 'text', text }] as unknown as Anthropic.ContentBlockParam[]) : text;
  const stream = client.messages.stream({ model, max_tokens: 16000, system, messages: [{ role: 'user', content }] }, { signal: io.signal });
  stream.on('text', (_delta, snapshot) => io.onText?.(snapshot));
  const res = await stream.finalMessage();
  const tokens = res.usage.input_tokens + res.usage.output_tokens;
  if (res.stop_reason === 'refusal') return { text: 'Claude declined this request.', tokens };
  return { text: res.content.map(b => (b.type === 'text' ? b.text : '')).join(''), tokens };
}

/** OpenAI-style chat completions with server-sent events. */
async function callOpenAiCompatible(url: string, key: string, model: string, system: string, text: string, io: RunIO, usageOption: boolean, files: Attachment[] = []) {
  const imgs = await openAiBlocks(files);
  const userContent = imgs.length ? [{ type: 'text', text }, ...imgs] : text;
  const r = await httpFetch(url, {
    method: 'POST',
    signal: io.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, stream: true, ...(usageOption ? { stream_options: { include_usage: true } } : {}), messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }] }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data?.error?.message || `HTTP ${r.status}`);
  }
  let out = '', tokens = 0, buf = '';
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return;
    const d = line.slice(5).trim();
    if (!d || d === '[DONE]') return;
    try {
      const j = JSON.parse(d);
      const c = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content;
      if (c) { out += c; io.onText?.(out); }
      if (j.usage?.total_tokens) tokens = j.usage.total_tokens;
    } catch { /* partial line */ }
  };
  const reader = r.body && typeof r.body.getReader === 'function' ? r.body.getReader() : null;
  if (reader) {
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      lines.forEach(handle);
    }
    handle(buf);
  } else {
    // No streaming body (e.g. Android's native HTTP): parse the whole event stream at once.
    const all = await r.text();
    if (all.trim().startsWith('{')) {
      const j = JSON.parse(all);
      out = String(j.choices?.[0]?.message?.content ?? '');
      tokens = Number(j.usage?.total_tokens) || 0;
    } else all.split('\n').forEach(handle);
  }
  return { text: out, tokens: tokens || estTokens(system, text, out) };
}

/** Generate images for Grok's ART: lines and save them into <project>/concept/ (or ~/Mosslight/Images). */
async function renderArt(key: string, model: string, proj: Project, art: NonNullable<AgentResult['art']>) {
  for (const a of art.slice(0, 2)) {
    try {
      const r = await httpFetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, prompt: a.prompt, n: 1, response_format: 'b64_json' }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const b64: string | undefined = data?.data?.[0]?.b64_json;
      if (!b64) continue;
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = `${a.title.replace(/[^\w-]+/g, '_').slice(0, 40)}_${Date.now().toString(36)}.png`;
      const lf = localFolder(proj);
      const dir = isDesktop ? (lf?.path ? await joinPath(lf.path, 'concept') : await joinPath(await imageDir(), proj.id)) : '';
      const local = await saveBytes(bytes, isDesktop ? await joinPath(dir, file) : '', `art/${proj.id}/${file}`);
      // With sync on, share it so every device shows the same gallery (the file stays in concept/ too).
      a.imagePath = (await uploadImage(bytes, 'png').catch(() => null)) || local;
    } catch {
      /* keep the text entry even if generation fails */
    }
  }
}


// ── Local CLIs (desktop) with live progress ───────────────────────────────────

const shortPath = (p?: string) => (p ? String(p).split(/[\\/]/).slice(-2).join('/') : '');

/** Turns a Claude Code tool call into a readable step. */
function describeClaudeTool(name: string, input: Record<string, unknown> = {}): string {
  const s = (k: string) => String(input[k] ?? '');
  switch (name) {
    case 'Read': return `Reading ${shortPath(s('file_path'))}`;
    case 'Edit': case 'MultiEdit': return `Editing ${shortPath(s('file_path'))}`;
    case 'Write': return `Writing ${shortPath(s('file_path'))}`;
    case 'NotebookEdit': return `Editing ${shortPath(s('notebook_path'))}`;
    case 'Bash': return `Running ${s('command').slice(0, 90)}`;
    case 'Grep': return `Searching for "${s('pattern').slice(0, 50)}"`;
    case 'Glob': return `Finding ${s('pattern')}`;
    case 'LS': return `Listing ${shortPath(s('path'))}`;
    case 'TodoWrite': return 'Updating its plan';
    case 'WebFetch': return `Reading ${s('url').slice(0, 60)}`;
    case 'WebSearch': return `Searching the web for "${s('query').slice(0, 50)}"`;
    case 'Task': case 'Agent': return `Starting a helper: ${s('description').slice(0, 60)}`;
    default: return name;
  }
}

/** Claude Code in print mode with stream-json output: steps + text as they happen. */
async function callClaudeCli(system: string, text: string, cwd: string | undefined, model: string | undefined, runCommands: boolean, io: RunIO) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', ...(runCommands ? ['--allowedTools', 'Bash'] : []), '--append-system-prompt', system, ...(model ? ['--model', model] : [])];
  let final = '', streamed = '', tokens = 0, isError = false, sawJson = false;
  const res = await runAgentCliStream('claude', args, text, cwd, io.runId || '', line => {
    let j: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { j = JSON.parse(line); } catch { return; }
    sawJson = true;
    if (j.type === 'system' && j.subtype === 'init') io.onStep?.(`Claude Code started${j.model ? ` (${j.model})` : ''}`);
    if (j.type === 'assistant') {
      for (const b of j.message?.content || []) {
        if (b.type === 'tool_use') {
          io.onStep?.(describeClaudeTool(b.name, b.input));
          const p = b.input?.file_path || b.input?.path || b.input?.notebook_path;
          if (typeof p === 'string') io.onFile?.(p);
        }
        if (b.type === 'text' && b.text) { streamed = streamed ? `${streamed}\n\n${b.text}` : b.text; io.onText?.(streamed); }
      }
    }
    if (j.type === 'result') {
      final = String(j.result ?? '');
      isError = !!j.is_error;
      const u = j.usage || {};
      tokens = (u.input_tokens || 0) + (u.output_tokens || 0);
    }
  });
  if (res.cancelled) return { text: streamed, tokens, stopped: true };
  if (isError) throw new Error(final || 'Claude Code reported an error');
  if (!res.ok && !final) throw new Error(`Claude Code exited with code ${res.code}: ${(res.stderr || res.stdout).trim().slice(-300)}`);
  const out = final || streamed || (sawJson ? '' : res.stdout.trim());
  return { text: out, tokens: tokens || estTokens(text, out) };
}

/** Codex CLI `exec --json`: one JSON event per line (handles both current and older event shapes). */
async function callCodexCli(system: string, text: string, cwd: string | undefined, model: string | undefined, network: boolean, io: RunIO) {
  const prompt = `${system}\n\n---\n\n${text}`;
  // --full-auto sandboxes the workspace with the network off, which fails every git fetch/push.
  const net = network ? ['-c', 'sandbox_workspace_write.network_access=true'] : [];
  const base = ['exec', '--skip-git-repo-check', ...net, ...(model ? ['-m', model] : [])];
  let last = '', tokens = 0, err = '';
  const onLine = (line: string) => {
    let j: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { j = JSON.parse(line); } catch { return; }
    const item = j.item || {};
    const msg = j.msg || {};
    if (j.type === 'item.started' && item.type === 'command_execution') io.onStep?.(`Running ${String(item.command || '').slice(0, 90)}`);
    else if (j.type === 'item.completed' && item.type === 'file_change') {
      const changed = (item.changes || []) as { path: string }[];
      changed.forEach(c => io.onFile?.(c.path));
      io.onStep?.(`Edited ${changed.map(c => shortPath(c.path)).join(', ')}`);
    }
    else if (j.type === 'item.completed' && item.type === 'reasoning' && item.text) io.onStep?.(`Thinking: ${String(item.text).replace(/\s+/g, ' ').slice(0, 80)}`);
    else if (j.type === 'item.started' && item.type === 'mcp_tool_call') io.onStep?.(`Using ${item.tool || 'a tool'}`);
    else if (j.type === 'item.completed' && item.type === 'agent_message') { last = String(item.text || ''); io.onText?.(last); }
    else if (j.type === 'turn.completed' && j.usage) tokens = (j.usage.input_tokens || 0) + (j.usage.output_tokens || 0);
    else if (j.type === 'turn.failed' || j.type === 'error') err = String(j.error?.message || j.message || 'Codex failed');
    // Older Codex event shapes
    else if (msg.type === 'exec_command_begin') io.onStep?.(`Running ${[].concat(msg.command || []).join(' ').slice(0, 90)}`);
    else if (msg.type === 'patch_apply_begin') io.onStep?.('Editing files');
    else if (msg.type === 'agent_message') { last = String(msg.message || ''); io.onText?.(last); }
  };
  io.onStep?.('Codex started');
  let res = await runAgentCliStream('codex', [...base, '--full-auto', '--json', prompt], '', cwd, io.runId || '', onLine);
  if (!res.ok && !res.cancelled && /unexpected argument|unknown (option|argument)|--json/i.test(res.stderr)) {
    // Older Codex without --json: run plainly and take the whole output.
    res = await runAgentCliStream('codex', [...base, prompt], '', cwd, io.runId || '', l => io.onText?.(l));
    last = res.stdout.trim();
  }
  if (res.cancelled) return { text: last, tokens, stopped: true };
  if (err) throw new Error(err);
  if (!res.ok && !last) throw new Error(`Codex exited with code ${res.code}: ${(res.stderr || res.stdout).trim().slice(-300)}`);
  return { text: last || res.stdout.trim(), tokens: tokens || estTokens(prompt, last) };
}

/** Which local CLIs are installed on this computer (cached; re-checked every minute). */
let cliCache: { at: number; tools: Record<string, boolean> } | null = null;
export async function localClis(force = false): Promise<Record<'claude' | 'codex', boolean>> {
  if (!isDesktop) return { claude: false, codex: false };
  if (force || !cliCache || Date.now() - cliCache.at > 60_000) {
    const d = await detectTools().catch(() => ({} as Record<string, { installed: boolean }>));
    cliCache = { at: Date.now(), tools: { claude: !!d.claude?.installed, codex: !!d.codex?.installed } };
  }
  return cliCache.tools as Record<'claude' | 'codex', boolean>;
}

// ── Model lists (for the Settings picker) ─────────────────────────────────────

/** Models this API key can use, straight from the provider. */
export async function listModels(agent: AgentId): Promise<string[]> {
  const key = await getSecret(AGENT_KEY[agent].key);
  if (!key) throw new Error(`Add an ${AGENT_KEY[agent].label} first`);
  if (agent === 'claude') {
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, fetch: httpFetch });
    const ids: string[] = [];
    for await (const m of client.models.list()) ids.push(m.id);
    return ids;
  }
  const base = agent === 'codex' ? 'https://api.openai.com/v1' : 'https://api.x.ai/v1';
  const get = async (path: string) => {
    const r = await httpFetch(base + path, { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
    return j;
  };
  const j = await get('/models');
  const ids: string[] = (j.data || j.models || []).map((m: { id: string }) => m.id);
  if (agent === 'grok') {
    const img = await get('/image-generation-models').catch(() => ({ models: [] }));
    ids.push(...(img.models || img.data || []).map((m: { id: string }) => m.id));
  }
  // OpenAI lists embeddings, audio, moderation… keep the chat/coding ones.
  const chat = agent === 'codex' ? ids.filter(id => /^(gpt|o\d|codex|chatgpt)/i.test(id) && !/(audio|realtime|transcribe|tts|image|embedding|search|moderation)/i.test(id)) : ids;
  return [...new Set(chat)].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}


// ── Entry points ───────────────────────────────────────────────────────────────

async function callApi(agent: AgentId, key: string, model: string, system: string, text: string, io: RunIO) {
  const files = io.files || [];
  try {
    if (agent === 'claude') return await callClaudeApi(key, model, system, text, io, files);
    if (agent === 'codex') return await callOpenAiCompatible('https://api.openai.com/v1/chat/completions', key, model, system, text, io, true, files);
    return await callOpenAiCompatible('https://api.x.ai/v1/chat/completions', key, model, system, text, io, false, files);
  } catch (e) {
    // A rejected model reads like an outage otherwise ("404 not_found_error"), so name the cause.
    const msg = String((e as Error)?.message || e);
    if (/\b404\b|not_found|does not exist|unknown model|model.*not found/i.test(msg)) {
      throw new Error(`${AGENTS[agent].name}'s API model "${model}" isn't available on this key. Open ⚙ Settings → Agents → ${AGENTS[agent].name} → API → Load models and pick one.`);
    }
    throw e;
  }
}

type Raw = { text: string; tokens: number; via: string; stopped?: boolean; note?: string };

/**
 * Sends one request to an agent and returns its raw reply.
 *  - Grok: always the xAI API.
 *  - Auto (default for Claude/Codex on desktop): the local CLI when installed, the API if it's
 *    missing or the local run fails.  Local: only the CLI.  Remote: only the API.
 * Returns null when the agent isn't set up on this device.
 */
async function runAgent(agent: AgentId, text: string, proj: Project | null, settings: Settings, io: RunIO, systemFor: (local: boolean) => string): Promise<Raw | null> {
  const cwd = proj ? localFolder(proj)?.path : undefined;
  const mode = agent === 'grok' || !isDesktop ? 'remote' : settings.mode?.[agent] || 'auto';
  const key = await getSecret(AGENT_KEY[agent].key);
  const cliName = agent === 'claude' ? 'Claude Code' : 'Codex CLI';
  // Agents that can't see the project folder get the linked GitHub repo's files instead.
  const ctx = proj?.repo ? await repoContext(proj.repo, text) : '';
  const withRepo = (s: string) => (ctx ? `${s}\n\n${ctx}` : s);
  // Attached files: a listing (with on-disk paths) for every route; images and PDFs also
  // go to the APIs as real blocks, which callApi handles.
  const desc = io.files?.length ? await describeAttachments(io.files) : '';
  const body = desc ? `${text}\n\n${desc}` : text;
  // The conversation so far goes in the system prompt, so the request itself stays the request.
  const hist = historyBlock(io.history || []);
  const withHist = (s: string) => (hist ? `${s}\n\n${hist}` : s);

  let note = '';
  if (mode === 'local' || (mode === 'auto' && (await localClis())[agent as 'claude' | 'codex'])) {
    const lm = settings.localModels?.[agent] || undefined;
    const sys = withHist(cwd ? systemFor(true) : withRepo(systemFor(false)));
    try {
      io.onVia?.('local');
      const r = agent === 'claude'
        ? await callClaudeCli(sys, body, cwd, lm, !!settings.localCommands, io)
        : await callCodexCli(sys, body, cwd, lm, settings.cliNetwork !== false, io);
      return { ...r, via: 'local' };
    } catch (e) {
      if (mode === 'local' || !key || io.signal?.aborted) throw e;
      note = `${cliName} failed (${String((e as Error)?.message || e).slice(0, 140)}) — answered with the API instead.`;
      io.onStep?.(`${cliName} failed — switching to the API`);
    }
  }
  // (Local mode has already returned or thrown above.)
  if (key) {
    io.onVia?.('api');
    const r = await callApi(agent, key, settings.models[agent], withHist(withRepo(systemFor(false))), body, io);
    return { ...r, via: 'api', note };
  }
  return null;
}

function notSetUp(agent: AgentId, settings: Settings): Reply {
  const mode = agent === 'grok' || !isDesktop ? 'remote' : settings.mode?.[agent] || 'auto';
  const cliName = agent === 'claude' ? 'Claude Code' : 'Codex CLI';
  const how = agent === 'grok' || !isDesktop ? `add an ${AGENT_KEY[agent].label}` : mode === 'local' ? `install ${cliName} (or switch to Auto and add an ${AGENT_KEY[agent].label})` : `install ${cliName} or add an ${AGENT_KEY[agent].label}`;
  return { text: `${AGENTS[agent].name} isn't set up on this device yet — ${how} in ⚙ Settings → Agents, then send your message again.`, tokens: 0, offline: true };
}

export async function respond(agent: AgentId, text: string, proj: Project | null, settings: Settings, io: RunIO = {}): Promise<Reply> {
  const raw = await runAgent(agent, text, proj, settings, io, local => systemPrompt(agent, proj, local));
  if (!raw) return notSetUp(agent, settings);
  const res = parseReply(raw.text, agent, shortOf(text));
  if (raw.note) res.text = `${res.text}\n\n(${raw.note})`;
  if (raw.stopped) return { ...res, text: res.text || '(stopped before replying)', tokens: raw.tokens, via: raw.via, stopped: true };
  const key = await getSecret(AGENT_KEY.grok.key);
  if (agent === 'grok' && res.art?.length && proj && key && platform !== 'web') {
    io.onStep?.(`Generating ${Math.min(2, res.art.length)} concept image${res.art.length > 1 ? 's' : ''}`);
    await renderArt(key, settings.models.grokImage, proj, res.art);
  }
  return { ...res, tokens: raw.tokens, via: raw.via };
}

/** Team mode: the lead agent splits a request into steps for each teammate. */
export async function planTeam(lead: AgentId, text: string, proj: Project | null, settings: Settings, io: RunIO = {}): Promise<{ summary: string; steps: PlanStep[]; tokens: number } | { error: string }> {
  const raw = await runAgent(lead, text, proj, settings, io, local => planPrompt(lead, proj, local));
  if (!raw) return { error: notSetUp(lead, settings).text };
  const plan = parsePlan(raw.text);
  if (!plan) return { error: `${AGENTS[lead].name} didn't return a usable plan. Try rephrasing, or pick a different team lead in Settings.` };
  return { ...plan, tokens: raw.tokens };
}
