import { joinPath, runGit, scanFolder, writeTextIfMissing, type GitOutput } from '../platform';
import { currentUser, getGitHubToken, parseRepo } from './api';

/** Basic-auth header for github.com; handed to git via environment variables only. */
async function auth() {
  const t = await getGitHubToken();
  if (!t) throw new Error('Add your GitHub token in ⚙ Settings → GitHub first');
  return 'basic ' + btoa('x-access-token:' + t);
}

const tail = (r: GitOutput) => (r.stderr || r.stdout).trim().split('\n').filter(Boolean).slice(-2).join(' — ');
function must(r: GitOutput, what: string) {
  if (!r.ok) throw new Error(`${what} failed: ${tail(r) || 'exit ' + r.code}`);
  return r.stdout.trim();
}
const git = async (args: string[], cwd?: string, withAuth = false) => runGit(args, cwd, withAuth ? await auth() : undefined);
const remoteUrl = (owner: string, name: string) => `https://github.com/${owner}/${name}.git`;

export async function isRepo(dir: string) {
  const r = await git(['rev-parse', '--is-inside-work-tree'], dir);
  return r.ok && r.stdout.trim() === 'true';
}

/** The GitHub repo a local folder already pushes to, if any. */
export async function detectRepo(dir: string): Promise<{ owner: string; name: string; branch?: string } | null> {
  if (!(await isRepo(dir))) return null;
  const url = await git(['remote', 'get-url', 'origin'], dir);
  if (!url.ok || !/github\.com/i.test(url.stdout)) return null;
  const parsed = parseRepo(url.stdout.trim());
  if (!parsed) return null;
  const br = await git(['rev-parse', '--abbrev-ref', 'HEAD'], dir);
  return { ...parsed, branch: br.ok ? br.stdout.trim() : undefined };
}

/** Commits need a name/email; use the GitHub account's if the folder has none configured. */
async function ensureIdentity(dir: string) {
  const email = await git(['config', 'user.email'], dir);
  if (email.ok && email.stdout.trim()) return;
  const u = await currentUser();
  must(await git(['config', 'user.name', u.name || u.login], dir), 'Setting git name');
  must(await git(['config', 'user.email', `${u.id}+${u.login}@users.noreply.github.com`], dir), 'Setting git email');
}

async function hasLfs() {
  return (await git(['lfs', 'version'])).ok;
}

const LFS_PATTERNS = ['*.uasset', '*.umap', '*.fbx', '*.obj', '*.blend', '*.psd', '*.tga', '*.exr', '*.hdr', '*.png', '*.jpg', '*.jpeg', '*.wav', '*.mp3', '*.ogg', '*.flac', '*.mp4', '*.mov', '*.ttf', '*.otf', '*.glb', '*.bank', '*.a', '*.dll', '*.so', '*.dylib', '*.zip'];

function gitignoreFor(engines: string[]) {
  const lines = ['# Created by Mosslight', '.DS_Store', 'Thumbs.db', '*.tmp', '', '# Test builds (shared through Mosslight instead)', 'Builds/', 'builds/', '*.apk', '*.aab', ''];
  if (engines.includes('unreal')) lines.push('# Unreal', 'Binaries/', 'DerivedDataCache/', 'Intermediate/', 'Saved/', '.vs/', '*.sln', 'Plugins/*/Binaries/', 'Plugins/*/Intermediate/', '');
  if (engines.includes('unity')) lines.push('# Unity', '[Ll]ibrary/', '[Tt]emp/', '[Oo]bj/', '[Bb]uild/', '[Ll]ogs/', '[Uu]ser[Ss]ettings/', '*.csproj', '*.sln', '.vs/', '');
  if (engines.includes('godot')) lines.push('# Godot', '.godot/', '.import/', 'android/build/', '');
  lines.push('# Web / tooling', 'node_modules/', 'dist/', '.env', '.env.*', '');
  return lines.join('\n');
}

/**
 * Commit everything and push. Pulls (rebase) first if GitHub has newer commits.
 * Returns what happened; throws with git's message on failure.
 */
export async function backup(dir: string, message: string, protectBranch?: string): Promise<{ committed: boolean; pushed: boolean; commit?: string; skipped?: string }> {
  await ensureIdentity(dir);
  // Committing straight to main behind the user's back is how an agent's work gets
  // misattributed — and most projects have a rule against it.
  if (protectBranch) {
    const here = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], dir, true)).stdout.trim();
    if (here === protectBranch) return { committed: false, pushed: false, skipped: here };
  }
  const status = must(await git(['status', '--porcelain'], dir), 'Checking changes');
  let committed = false;
  if (status) {
    must(await git(['add', '-A'], dir), 'Staging files');
    must(await git(['commit', '-m', message], dir), 'Committing');
    committed = true;
  }
  const branch = must(await git(['rev-parse', '--abbrev-ref', 'HEAD'], dir), 'Reading branch');
  let push = await git(['push', '-u', 'origin', branch], dir, true);
  if (!push.ok && /rejected|fetch first|non-fast-forward/i.test(tail(push))) {
    must(await git(['pull', '--rebase', '--autostash', 'origin', branch], dir, true), 'Getting newer changes from GitHub');
    push = await git(['push', '-u', 'origin', branch], dir, true);
  }
  if (!push.ok) {
    const t = tail(push);
    if (!committed && /everything up-to-date/i.test(t)) return { committed, pushed: false };
    throw new Error(`Push failed: ${/larger than|exceeds|100\.00 MB/i.test(t) ? 'a file is over GitHub\'s 100 MB limit — install Git LFS (git-lfs.com) or add it to .gitignore' : t}`);
  }
  const pushed = !/everything up-to-date/i.test(push.stderr + push.stdout) || committed;
  const commit = (await git(['rev-parse', '--short', 'HEAD'], dir)).stdout.trim() || undefined;
  return { committed, pushed, commit };
}

/** Clone into `<parent>/<name>` and return the new folder. */
/**
 * Every checkout of this repository. Isolated work usually lives in a sibling worktree
 * (`F:/Vacancy-render` beside `F:/Vacancy`), which an agent started in the main folder can't
 * reach unless it's told about it.
 */
export async function worktrees(dir: string): Promise<string[]> {
  const r = await git(['worktree', 'list', '--porcelain'], dir);
  if (!r.ok) return [];
  const here = dir.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
  return r.stdout
    .split('\n')
    .filter(l => l.startsWith('worktree '))
    .map(l => l.slice(9).trim())
    .filter(p => p && p.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase() !== here)
    .slice(0, 24);
}

export interface LocalBranch { name: string; ahead: number; pushed: boolean; subject: string; dir: string; from?: string }

/** Branches in one repository that GitHub hasn't seen. */
async function branchesIn(dir: string, from?: string): Promise<LocalBranch[]> {
  // An agent's sandbox runs as another Windows user, so its clone is "dubious ownership" to us.
  // Allowing it for this one command is safer than changing the user's global git config.
  const safe = ['-c', `safe.directory=${dir.replace(/\\/g, '/')}`];

  // A branch cut from main and never committed to has no upstream either, but there's nothing
  // to back up — so measure it against the default branch, not just against having a remote.
  let base = '';
  for (const candidate of ['refs/remotes/origin/main', 'refs/remotes/origin/master']) {
    if ((await git([...safe, 'rev-parse', '--verify', '--quiet', candidate], dir)).ok) { base = candidate; break; }
  }
  const fmt = `%(refname:short)\u0001%(upstream)\u0001%(upstream:track)\u0001%(objectname:short)\u0001${base ? `%(ahead-behind:${base})` : ''}\u0001%(contents:subject)`;
  const r = await git([...safe, 'for-each-ref', '--sort=-committerdate', `--format=${fmt}`, 'refs/heads'], dir);
  if (!r.ok) return [];

  // A branch fetched by hand has no upstream configured, so ask what origin actually has
  // rather than reporting work as unpushed when GitHub already holds it.
  const remote = await git([...safe, 'for-each-ref', '--format=%(refname:short)\u0001%(objectname:short)', 'refs/remotes/origin'], dir);
  const onRemote = new Map(
    (remote.ok ? remote.stdout.split('\n') : [])
      .filter(Boolean)
      .map(l => l.split('\u0001'))
      .map(([ref, sha]) => [ref.replace(/^origin\//, ''), sha]),
  );

  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [name, upstream, track, sha, aheadBehind, subject] = line.split('\u0001');
      const ahead = Number(track?.match(/ahead (\d+)/)?.[1] || 0);
      // "<ahead> <behind>" against the default branch; without a base, assume it has something.
      const own = base ? Number(aheadBehind?.trim().split(/\s+/)[0] || 0) : 1;
      const there = onRemote.get(name);
      return { name, ahead: ahead || own, pushed: !!upstream || there === sha, subject: subject || '', dir, from, sha, sameAsRemote: there === sha, own };
    })
    // Worth showing only when it holds work of its own that GitHub doesn't already have.
    .filter(b => b.name && b.name !== 'main' && b.name !== 'master' && !b.sameAsRemote && b.own > 0)
    .map(({ sha, sameAsRemote, own, ...b }) => b); // eslint-disable-line @typescript-eslint/no-unused-vars
}

/**
 * Work that isn't on GitHub yet, from the project itself and from the clones agents make beside
 * it. A sandboxed agent often can't create a worktree inside your repo (it runs as a different
 * user), so it clones into Tools/Worktrees and commits there — invisible from the main checkout.
 */
export async function unpushedBranches(dir: string): Promise<LocalBranch[]> {
  const out = await branchesIn(dir);
  const seen = new Set(out.map(b => b.name));
  // Where agents put their clones. Deliberately not all of Tools/ — that can hold hundreds of
  // folders, and listing each one to look for .git would cost more than this is worth.
  for (const parent of ['Tools/Worktrees', 'Worktrees']) {
    const base = await joinPath(dir, ...parent.split('/'));
    const listing = await scanFolder(base).catch(() => null);
    for (const child of (listing?.entries || []).filter(e => e.is_dir).slice(0, 25)) {
      const path = await joinPath(base, child.name);
      const inner = await scanFolder(path).catch(() => null);
      if (!inner?.entries.some(e => e.name === '.git')) continue;
      for (const b of await branchesIn(path, `${parent}/${child.name}`)) {
        if (seen.has(b.name)) continue;
        seen.add(b.name);
        out.push(b);
      }
    }
  }
  return out.slice(0, 20);
}

/**
 * Pushes one branch using the hub's own GitHub token. Agents commit fine but often can't push:
 * a sandboxed CLI can't reach the Windows credential store, so the credential helper comes up
 * empty. The token here is passed to git through the environment and never written to disk.
 */
export async function pushBranch(dir: string, branch: string): Promise<string> {
  const r = await git(['-c', `safe.directory=${dir.replace(/\\/g, '/')}`, 'push', '-u', 'origin', `${branch}:${branch}`], dir, true);
  if (!r.ok) throw new Error(`Pushing ${branch} failed: ${tail(r) || 'exit ' + r.code}`);
  return branch;
}

export async function cloneRepo(owner: string, name: string, parent: string): Promise<string> {
  const dest = await joinPath(parent, name);
  must(await git(['clone', remoteUrl(owner, name), dest], parent, true), `Cloning ${owner}/${name}`);
  return dest;
}

/**
 * Connect a local folder to a GitHub repo and push it:
 *  - new/empty repo: init, .gitignore (+ LFS), first commit, push;
 *  - repo that already has commits: adopt its history, then commit local differences on top.
 */
export async function connectFolder(dir: string, owner: string, name: string, engines: string[], remoteHasCommits: boolean): Promise<{ commit?: string; lfs: boolean }> {
  const url = remoteUrl(owner, name);
  if (!(await isRepo(dir))) must(await git(['init', '-b', 'main'], dir), 'Creating git repo');
  const origin = await git(['remote', 'get-url', 'origin'], dir);
  if (origin.ok) {
    const cur = parseRepo(origin.stdout.trim());
    if (cur && (cur.owner.toLowerCase() !== owner.toLowerCase() || cur.name.toLowerCase() !== name.toLowerCase())) {
      throw new Error(`This folder already backs up to ${cur.owner}/${cur.name} — link that repo instead`);
    }
  } else {
    must(await git(['remote', 'add', 'origin', url], dir), 'Adding GitHub remote');
  }
  await writeTextIfMissing(await joinPath(dir, '.gitignore'), gitignoreFor(engines));
  const lfs = await hasLfs();
  if (lfs) {
    await git(['lfs', 'install', '--local'], dir);
    await writeTextIfMissing(await joinPath(dir, '.gitattributes'), LFS_PATTERNS.map(p => `${p} filter=lfs diff=lfs merge=lfs -text`).join('\n') + '\n');
  }
  await ensureIdentity(dir);
  const hasHead = (await git(['rev-parse', '--verify', 'HEAD'], dir)).ok;
  if (remoteHasCommits && !hasHead) {
    must(await git(['fetch', 'origin'], dir, true), 'Fetching from GitHub');
    const def = (await git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], dir)).stdout.trim() || 'origin/main';
    const branch = def.replace(/^origin\//, '');
    // Point the folder at GitHub's history but keep every local file as it is.
    must(await git(['reset', '--mixed', def], dir), 'Adopting GitHub history');
    await git(['checkout', '-B', branch], dir);
    await git(['branch', '--set-upstream-to', def], dir);
  }
  const res = await backup(dir, hasHead || remoteHasCommits ? 'Connect to Mosslight' : 'Initial commit from Mosslight');
  return { commit: res.commit, lfs };
}
