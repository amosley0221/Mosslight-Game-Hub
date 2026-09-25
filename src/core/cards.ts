/**
 * Task cards on disk.
 *
 * A task in the hub is a row in a database no agent can read, so "what's the status of card X?"
 * is unanswerable and every claim about it stays unverified. Each task is mirrored to a Markdown
 * card in the project's `Docs/Tasks/` folder — id, owner, status and a dated history — so the
 * repository holds the record, the agents can read and check it, and git keeps the history.
 */
import type { AgentId, Task, TaskStatus } from './types';
import { joinPath, readFileBytes, saveBytes } from '../platform';
import { getDeviceName } from '../sync/device';

export const CARD_DIR = ['Docs', 'Tasks'];
const MAX_CARD = 200_000;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'task';

/** Card file name for a task: stable across renames because the id leads. */
export const cardName = (t: Task) => `${t.id.slice(0, 8)}-${slug(t.title)}.md`;
export const cardRelPath = (t: Task) => `${CARD_DIR.join('/')}/${cardName(t)}`;

const stamp = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16);

export interface CardFile {
  id: string;
  title: string;
  owner: AgentId;
  status: TaskStatus;
  /** The word the file actually used — agents write their own ("reviewed", "ready for review"). */
  rawStatus?: string;
  created?: number;
  body: string;
}

/**
 * The hub tracks three states; a card can say anything. An agent writing "reviewed" on its own
 * card is recording real work, so a word we don't know means work in flight — never a reason to
 * disown the card, which is how a reviewed card ends up replaced by a blank template.
 */
export function toStatus(raw: string): TaskStatus | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s === 'todo' || s === 'doing' || s === 'done') return s;
  if (/\b(done|complete|completed|closed|merged|shipped|cancelled|canceled|wont ?fix)\b/.test(s)) return 'done';
  return 'doing';
}

const OWNERS: AgentId[] = ['grok', 'codex', 'claude'];

/** Reads the front matter of a card. Returns null for a Markdown file that isn't one. */
export function parseCard(text: string): CardFile | null {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fields: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) fields[kv[1].toLowerCase()] = kv[2].trim();
  }
  const owner = fields.owner as AgentId;
  const status = toStatus(fields.status || '');
  if (!fields.id || !fields.title || !OWNERS.includes(owner) || !status) return null;
  const created = fields.created ? Date.parse(fields.created) : NaN;
  return { id: fields.id, title: fields.title, owner, status, rawStatus: fields.status, created: Number.isNaN(created) ? undefined : created, body: m[2] };
}

function frontMatter(t: Task, created: number, status: string = t.status) {
  return ['---', `id: ${t.id}`, `title: ${t.title.replace(/\n/g, ' ')}`, `owner: ${t.agent}`, `status: ${status}`, `created: ${new Date(created).toISOString()}`, `updated: ${new Date().toISOString()}`, '---'].join('\n');
}

/** Adds a dated line under "## History", making the section if the card doesn't have one yet. */
function withHistory(body: string, line: string) {
  const entry = `- ${stamp(Date.now())} — ${line} (${getDeviceName()})`;
  if (/^##\s+History\s*$/m.test(body)) {
    return body.replace(/^(##\s+History\s*\n)/m, `$1${entry}\n`);
  }
  return `${body.trimEnd()}\n\n## History\n${entry}\n`;
}

const NEW_BODY = (t: Task) => `\n# ${t.title}\n\n## Objective\n_Fill this in — what "done" means, which files it touches, and how it's verified._\n\n## Notes\n\n## History\n`;

/**
 * Writes (or updates) a task's card. Keeps whatever you and the agents wrote in the body,
 * replacing only the front matter and adding a history line when something changed.
 */
export async function writeCard(root: string, t: Task, change?: string): Promise<string> {
  const path = await joinPath(root, ...CARD_DIR, cardName(t));
  let body = '';
  let created = t.ts || Date.now();
  let existing = '';
  let old: CardFile | null = null;
  try {
    existing = new TextDecoder().decode(await readFileBytes(path, MAX_CARD));
    old = parseCard(existing);
  } catch { /* new card */ }
  // A file we can't read is someone else's work, not a blank to fill. Writing a fresh template
  // over it destroys whatever it held — which is exactly what happened to cards whose status the
  // agents had written in their own words.
  if (existing.trim() && !old) return path;
  if (old) { body = old.body; created = old.created ?? created; }
  if (!body.trim()) body = NEW_BODY(t);
  if (change) body = withHistory(body, change);
  // Keep the file's own word for the status when it still means what the hub thinks it means:
  // "reviewed" says more than "doing", and the hub has no business flattening it.
  const status = old?.rawStatus && toStatus(old.rawStatus) === t.status ? old.rawStatus : t.status;
  await saveBytes(new TextEncoder().encode(`${frontMatter(t, created, status)}\n${body.startsWith('\n') ? '' : '\n'}${body}`), path, '');
  return path;
}
