/**
 * Pictures a run produced.
 *
 * Two ways an agent makes an image: it writes the file itself (the CLIs report those paths), or a
 * command it ran does — an engine capture, a render, a screenshot tool. The second kind is found
 * by looking in the handful of folders those tools write to, for anything newer than the run.
 */
import { findFiles, joinPath, scanFolder } from '../platform';

const IMG = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];
const isImage = (p: string) => IMG.includes((p.split('.').pop() || '').toLowerCase());

/** Where engines and capture tools drop images, relative to the project folder. */
const SHOT_DIRS = [
  'Saved/Screenshots', 'Screenshots', 'Screenshot', 'Captures', 'Capture',
  'concept', 'Docs/Reviews', 'Docs/Screenshots', 'Tools/RuntimeReviews', 'Recordings', 'export',
  // Where playtest captures and render comparisons land once a project has a review habit.
  'Art/Reports', 'Art/Captures', 'Art/Renders', 'Art/Screenshots', 'Docs/World',
];

const MAX_SHOWN = 8;

/**
 * Clones agents make beside the project. A sandboxed agent often can't work inside your checkout,
 * so it clones into Tools/Worktrees — and its captures land there, not where you'd look.
 */
async function agentClones(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const parent of ['Tools/Worktrees', 'Worktrees']) {
    const base = await joinPath(root, ...parent.split('/')).catch(() => '');
    if (!base) continue;
    const listing = await scanFolder(base).catch(() => null);
    for (const child of (listing?.entries || []).filter(e => e.is_dir).slice(0, 12)) {
      out.push(await joinPath(base, child.name));
    }
  }
  return out;
}

/**
 * Images from this run: the ones the agent wrote directly, plus anything new in the capture
 * folders since it started. Newest first.
 */
export async function runImages(root: string | undefined, since: number, touched: Iterable<string>): Promise<string[]> {
  const out = new Map<string, number>();
  for (const p of touched) if (isImage(p)) out.set(p, Date.now());
  if (root) {
    const roots = [root, ...await agentClones(root).catch(() => [])];
    const found = await Promise.all(roots.flatMap(r => SHOT_DIRS.map(async d => {
      try {
        const dir = await joinPath(r, ...d.split('/'));
        // A missing folder just throws; that's the common case and costs nothing.
        return await findFiles(dir, IMG, 60);
      } catch {
        return [];
      }
    })));
    // A couple of seconds of slack: file timestamps and the run clock don't have to agree.
    for (const f of found.flat()) if (f.modified >= since - 3000) out.set(f.path, f.modified);
  }
  // The same capture usually exists in both your checkout and the agent's clone. Show it once.
  const seen = new Set<string>();
  return [...out.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([p, m]) => {
      const key = `${(p.split(/[\\/]/).pop() || '').toLowerCase()}|${m}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .slice(0, MAX_SHOWN)
    .map(([p]) => p);
}
