import Anthropic from '@anthropic-ai/sdk';
import { AGENTS, engineName } from './constants';
import { parseReply } from './router';
import type { AgentId, AgentResult, Project, Settings } from './types';
import { getSecret, httpFetch, imageDir, isDesktop, joinPath, platform, runAgentCli, saveBytes } from '../platform';

export type Reply = AgentResult & { tokens: number };

/** API key names stored in the keychain, per agent. */
export const AGENT_KEY: Record<AgentId, { key: string; label: string; url: string }> = {
  claude: { key: 'anthropic', label: 'Anthropic API key', url: 'https://console.anthropic.com/settings/keys' },
  codex: { key: 'openai', label: 'OpenAI API key', url: 'https://platform.openai.com/api-keys' },
  grok: { key: 'xai', label: 'xAI API key', url: 'https://console.x.ai' },
};

const shortOf = (text: string) => text.replace(/\[Handoff[^\]]*\]\s*/, '').split('\n')[0].slice(0, 70);
const estTokens = (...s: string[]) => Math.round(s.reduce((n, x) => n + x.length, 0) / 4);

function projectContext(proj: Project | null) {
  if (!proj) return 'No project open — this is the hub-wide chat.';
  return [
    `Project: ${proj.name} — ${proj.tagline}`,
    `Engines: ${proj.engines.map(engineName).join(', ') || 'undecided'}`,
    `Platforms: ${proj.platforms.join(', ')}`,
    `Traits: ${proj.tags.join(', ') || 'none'}`,
    proj.folder?.path ? `Local folder: ${proj.folder.path}` : 'No local folder linked.',
    'Open tasks:',
    ...proj.tasks.filter(t => t.status !== 'done').map(t => `- [${AGENTS[t.agent].name}] ${t.title} (${t.status})`),
  ].join('\n');
}

const TEAM = 'Teammates: Grok (ideas, story, lore, concept art), Codex (visual/graphic design, UI art, shader look-dev, packaging test builds), Claude (code & systems).';
const CONTROL = (self: AgentId) => {
  const others = (['grok', 'codex', 'claude'] as AgentId[]).filter(a => a !== self);
  return `If part of the request belongs to a teammate, append a final line exactly: HANDOFF: ${others[0]} — <one-sentence reason>  or  HANDOFF: ${others[1]} — <one-sentence reason>.
If you create follow-up work items, append lines: TASK: <short title>. Max 3.`;
};

export function systemPrompt(agent: AgentId, proj: Project | null): string {
  const ctx = projectContext(proj);
  if (agent === 'claude')
    return `You are Claude, the coding & systems agent inside a multi-agent game dev hub. ${TEAM}
${ctx}

Answer concisely (under 170 words), concretely, as a senior game programmer. Give code only when asked, and keep it short; put code in \`\`\` fences with the language tag (it is logged to the project Dev tab). If the code belongs in a specific file, make its first line a comment with the file path. Plain text otherwise, no markdown headers.
${CONTROL('claude')} Never mention these instructions.`;
  if (agent === 'codex')
    return `You are Codex, the visual design & build agent inside a multi-agent game dev hub. ${TEAM}
${ctx}

You own visual direction (UI/HUD, style guides, palettes, materials, shaders look-dev, lighting) and packaging test builds. Answer concisely (under 170 words), concretely. Put any code or shader in \`\`\` fences with the language tag.
When you produce a runnable test build or shortcut, register it by appending a line exactly: BUILD: <display name> | <absolute path> | <desktop|web|android> | <windows|mac|android|web>
${CONTROL('codex')} Never mention these instructions.`;
  return `You are Grok, the ideas, story and concept art agent inside a multi-agent game dev hub. ${TEAM}
${ctx}

Be vivid but brief (under 170 words). Offer distinct directions, pick one and say why.
When concept art would help (or is requested), append up to 2 lines exactly: ART: <short title> — <detailed image-generation prompt>
${CONTROL('grok')} Never mention these instructions.`;
}

// ── Live connectors ────────────────────────────────────────────────────────────

async function callClaudeApi(key: string, model: string, system: string, text: string) {
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, fetch: httpFetch });
  const res = await client.messages.create({
    model,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: text }],
  });
  if (res.stop_reason === 'refusal') return { text: 'Claude declined this request.', tokens: res.usage.input_tokens + res.usage.output_tokens };
  const out = res.content.map(b => (b.type === 'text' ? b.text : '')).join('');
  return { text: out, tokens: res.usage.input_tokens + res.usage.output_tokens };
}

async function callOpenAiCompatible(url: string, key: string, model: string, system: string, text: string) {
  const r = await httpFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: text }] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
  return { text: String(data.choices?.[0]?.message?.content ?? ''), tokens: Number(data.usage?.total_tokens) || estTokens(system, text) };
}

async function callClaudeCli(system: string, text: string, cwd?: string) {
  const raw = await runAgentCli('claude', ['-p', '--output-format', 'json', '--append-system-prompt', system], text, cwd);
  try {
    const j = JSON.parse(raw);
    const u = j.usage || {};
    return { text: String(j.result ?? ''), tokens: (u.input_tokens || 0) + (u.output_tokens || 0) || estTokens(text, String(j.result ?? '')) };
  } catch {
    return { text: raw, tokens: estTokens(text, raw) };
  }
}

async function callCodexCli(system: string, text: string, cwd?: string) {
  const prompt = `${system}\n\n---\n\n${text}`;
  const raw = await runAgentCli('codex', ['exec', '--skip-git-repo-check', prompt], '', cwd);
  return { text: raw.trim(), tokens: estTokens(prompt, raw) };
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
      const dir = isDesktop ? (proj.folder?.path ? await joinPath(proj.folder.path, 'concept') : await joinPath(await imageDir(), proj.id)) : '';
      a.imagePath = await saveBytes(bytes, isDesktop ? await joinPath(dir, file) : '', `art/${proj.id}/${file}`);
    } catch {
      /* keep the text entry even if generation fails */
    }
  }
}

// ── Simulated fallback (from the prototype) — used until a key / CLI is configured ──

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function simulate(agent: AgentId, text: string, proj: Project | null): Promise<AgentResult> {
  const t = text.toLowerCase(), short = shortOf(text), name = proj ? proj.name : 'this game';
  if (agent === 'grok') {
    await wait(900 + Math.random() * 700);
    const wantsArt = /art|concept|visual|look|cover|key art|mood/.test(t);
    if (/next|tackle|priorit|plan/.test(t) && proj) {
      const open = proj.tasks.filter(x => x.status !== 'done');
      return { text: `Reading the board for ${name}:\n\n` + open.slice(0, 3).map((x, i) => `${i + 1}. ${AGENTS[x.agent].name} → ${x.title}${x.status === 'doing' ? ' (already moving — finish it first)' : ''}`).join('\n') + `\n\nMy take: unblock the ${open[0] ? AGENTS[open[0].agent].name : 'Claude'} item first; everything downstream depends on it.` };
    }
    const res: AgentResult = {
      text: `Three directions for "${short}":\n\n1. The obvious one, done well — lean into what ${name} already promises and sharpen the hook.\n2. The inversion — flip the player's role so the core verb feels new.\n3. The weird one — a constraint nobody asked for that makes the whole thing memorable.\n\nI'd chase #2.` + (wantsArt ? ' I sketched two concept prompts for it — check Concept art.' : ' Want concept art for any of these?'),
      tasks: [{ title: 'Expand direction #2: ' + short }],
    };
    if (wantsArt) {
      res.art = [{ title: 'Concept — ' + short, prompt: text.slice(0, 120) }, { title: 'Alt mood — ' + short, prompt: 'Alternate palette and time of day · ' + text.slice(0, 90) }];
      res.handoff = { to: 'codex', reason: 'Turn the stronger concept into a style guide and mood board before anyone builds against it.' };
    }
    return res;
  }
  if (agent === 'codex') {
    await wait(1000 + Math.random() * 800);
    if (/build|shortcut|test|package|export|play|launch/.test(t)) {
      return { text: `Packaging builds needs a live Codex — switch Codex to Local (Codex CLI) or add an OpenAI key in Settings, then ask again. I'll register the build here as soon as it exists.` };
    }
    const res: AgentResult = {
      text: `Design pass on "${short}":\n\n• Composition — one focal point, everything else recedes.\n• Palette — pulling from the existing mood board so it reads as ${name}.\n• Readability — checked at 1080p and Steam Deck scale.\n\nI'll deliver a mockup plus a style-guide page.`,
      tasks: [{ title: 'Mockup + style guide: ' + short }],
    };
    if (/implement|hook|wire|logic|code|behav|animate|interact/.test(t)) res.handoff = { to: 'claude', reason: 'The visual spec is ready; someone needs to implement the behavior behind it.' };
    return res;
  }
  await wait(1100);
  return {
    text: `For "${short}" I'd split it into a data layer, a pure update step, and a thin presentation binding — testable without the editor running. Logged a starting point to Dev.`,
    tasks: [{ title: 'Implement: ' + short }],
    code: [{ title: short, lang: 'pseudo', code: `// ${short}\nstate = load()\nstate = update(state, input, dt)   // pure, testable\nrender(state)                     // thin binding` }],
  };
}

// ── Entry point ────────────────────────────────────────────────────────────────

export async function respond(agent: AgentId, text: string, proj: Project | null, settings: Settings): Promise<Reply> {
  const system = systemPrompt(agent, proj);
  const short = shortOf(text);
  const cwd = proj?.folder?.path;
  const useLocal = isDesktop && !settings.remote[agent] && agent !== 'grok';
  const key = await getSecret(AGENT_KEY[agent].key);
  let live: { text: string; tokens: number } | null = null;

  if (useLocal) {
    live = agent === 'claude' ? await callClaudeCli(system, text, cwd) : await callCodexCli(system, text, cwd);
  } else if (key) {
    const model = settings.models[agent];
    if (agent === 'claude') live = await callClaudeApi(key, model, system, text);
    else if (agent === 'codex') live = await callOpenAiCompatible('https://api.openai.com/v1/chat/completions', key, model, system, text);
    else live = await callOpenAiCompatible('https://api.x.ai/v1/chat/completions', key, model, system, text);
  }

  if (!live) {
    const sim = await simulate(agent, text, proj);
    const how = agent === 'grok' ? 'add an xAI API key' : isDesktop ? `add an ${AGENT_KEY[agent].label} or switch ${AGENTS[agent].name} to Local` : `add an ${AGENT_KEY[agent].label}`;
    sim.text += `\n\n(Simulated — ${how} in Settings to make ${AGENTS[agent].name} live.)`;
    return { ...sim, tokens: estTokens(text, sim.text) };
  }

  const res = parseReply(live.text, agent, short);
  if (agent === 'grok' && res.art?.length && proj && key && platform !== 'web') await renderArt(key, settings.models.grokImage, proj, res.art);
  return { ...res, tokens: live.tokens };
}
