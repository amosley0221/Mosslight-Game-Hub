/**
 * The Mosslight brand kit: the studio splash and the game loading screen, shipped inside the hub.
 *
 * `installKit()` writes a ready-to-run copy into a game's folder (screen, component, tokens, logos)
 * and `kitPrompt()` is the instruction handed to an agent to wire it into the engine — the
 * templates are web, so a Unity/Unreal/Godot game gets the same screen rebuilt from the same recipe.
 */
import loadingHtml from './templates/loading.html?raw';
import splashJsx from './templates/SplashScreen.jsx?raw';
import brandCss from './templates/brand.css?raw';
import readmeMd from './templates/README.md?raw';
import { joinPath, saveBytes } from '../platform';
import { WEB_ENGINES } from '../core/constants';
import type { Project } from '../core/types';

export const BRAND_ASSETS = ['mosslight-logo.png', 'mosslight-icon.png', 'mosslight-wordmark.png', 'mosslight-wordmark-full.png'];

/** Folder inside a game where the kit lands. */
export const KIT_DIR = ['Mosslight', 'Brand'];

export const DEFAULT_TIPS = [
  'Tip: the loading screen is yours — put real hints here, one sentence each.',
];

/** What the screen looks like, in words, so an agent can rebuild it in any engine. */
export const KIT_SPEC = `Mosslight loading screen: centred column on a near-black forest background (#0d0f0d, radial to #080908).
Top: the lantern monogram (mosslight-logo.png) at about 30% of the screen height, with a slow glow pulse (drop shadow #f2c14e, 18px → 34px, 2.4s).
Then "MOSSLIGHT STUDIOS PRESENTS" — 12px, uppercase, letter-spacing .22em, brass #c9a961.
Then the game title in a display serif (Cormorant Garamond, fall back to Georgia), 40–76px, weight 600.
Optional italic subtitle underneath in #cdbf9f.
Then a 3px progress bar, width min(60vw, 420px), brass #c9a961 on #d6c4a020, rounded 2px, .4s ease on width.
Then one tip in 13px #8f8672, max 520px wide, rotating every 4 seconds. Everything rises in over 800ms on show, fades out over 600ms.`;

const fill = (s: string, p: Project, tips: string[]) => s
  .replace(/__TITLE__/g, p.name)
  .replace(/__SUBTITLE__/g, (p.tagline || '').replace(/"/g, "'"))
  .replace(/__TIPS__/g, JSON.stringify(tips.length ? tips : DEFAULT_TIPS, null, 2));

const text = (s: string) => new TextEncoder().encode(s);

/**
 * Writes the kit into the game's folder. `root` is the project folder on this device.
 * Returns the folder the kit landed in.
 */
export async function installKit(root: string, p: Project, tips: string[] = []): Promise<string> {
  const dir = await joinPath(root, ...KIT_DIR);
  await saveBytes(text(fill(loadingHtml, p, tips)), await joinPath(dir, 'loading.html'), '');
  await saveBytes(text(fill(splashJsx, p, tips)), await joinPath(dir, 'SplashScreen.jsx'), '');
  await saveBytes(text(brandCss), await joinPath(dir, 'brand.css'), '');
  await saveBytes(text(fill(readmeMd, p, tips)), await joinPath(dir, 'README.md'), '');
  for (const name of BRAND_ASSETS) {
    const res = await fetch(`./assets/${name}`);
    if (!res.ok) continue;
    await saveBytes(new Uint8Array(await res.arrayBuffer()), await joinPath(dir, 'assets', name), '');
  }
  return dir;
}

/** The task handed to an agent to put the screen in front of the game itself. */
export function kitPrompt(p: Project, dir: string): string {
  const engine = p.engines[0] || 'the engine this project uses';
  const web = p.engines.some(e => WEB_ENGINES.includes(e));
  return [
    `Put the Mosslight loading screen in front of ${p.name} when it boots.`,
    '',
    `The kit is already on disk at ${dir}: loading.html (the screen, ready to run), SplashScreen.jsx (the same screen as a React component), brand.css (the tokens) and assets/ (the logo PNGs). Read README.md there first.`,
    '',
    web
      ? 'This is a web-based game, so use the files as they are: show loading.html (or SplashScreen.jsx) before the game canvas, and drive it from the loader with window.mosslightLoading.progress(0..100) and .done().'
      : `This is a ${engine} project, so the web files are the reference, not the implementation — rebuild the same screen natively in ${engine}, importing the PNGs from the kit's assets folder and matching the colors, fonts, sizes and timings exactly.`,
    '',
    KIT_SPEC,
    '',
    `Wire it to real loading progress, not a timer, and make it disappear once the game is ready. Tell me which files you changed and how to see it.`,
  ].join('\n');
}
