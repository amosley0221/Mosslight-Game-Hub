/**
 * Pictures a run produced.
 *
 * Two ways an agent makes an image: it writes the file itself (the CLIs report those paths), or a
 * command it ran does — an engine capture, a render, a screenshot tool. The second kind is found
 * by looking in the handful of folders those tools write to, for anything newer than the run.
 */
import { findFiles, joinPath } from '../platform';

const IMG = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];
const isImage = (p: string) => IMG.includes((p.split('.').pop() || '').toLowerCase());

/** Where engines and capture tools drop images, relative to the project folder. */
const SHOT_DIRS = [
  'Saved/Screenshots', 'Screenshots', 'Screenshot', 'Captures', 'Capture',
  'concept', 'Docs/Reviews', 'Docs/Screenshots', 'Tools/RuntimeReviews', 'Recordings', 'export',
];

const MAX_SHOWN = 8;

/**
 * Images from this run: the ones the agent wrote directly, plus anything new in the capture
 * folders since it started. Newest first.
 */
export async function runImages(root: string | undefined, since: number, touched: Iterable<string>): Promise<string[]> {
  const out = new Map<string, number>();
  for (const p of touched) if (isImage(p)) out.set(p, Date.now());
  if (root) {
    const found = await Promise.all(SHOT_DIRS.map(async d => {
      try {
        const dir = await joinPath(root, ...d.split('/'));
        // A missing folder just throws; that's the common case and costs nothing.
        return await findFiles(dir, IMG, 60);
      } catch {
        return [];
      }
    }));
    // A couple of seconds of slack: file timestamps and the run clock don't have to agree.
    for (const f of found.flat()) if (f.modified >= since - 3000) out.set(f.path, f.modified);
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_SHOWN).map(([p]) => p);
}
