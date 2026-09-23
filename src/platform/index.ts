import { Channel, invoke, convertFileSrc } from '@tauri-apps/api/core';
import { desktopDir, homeDir, join } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

export type PlatformKind = 'desktop' | 'android' | 'web';

export interface ScanResult { name: string; path: string; entries: { name: string; is_dir: boolean }[]; packageJson?: string | null }
export interface ToolStatus { installed: boolean; path?: string | null }

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const isAndroid = !isTauri && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const platform: PlatformKind = isTauri ? 'desktop' : isAndroid ? 'android' : 'web';
export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
export const isDesktop = platform === 'desktop';

/** fetch that bypasses webview CORS (Tauri HTTP plugin / CapacitorHttp patches window.fetch). */
export const httpFetch: typeof fetch = isTauri ? (tauriFetch as typeof fetch) : (input, init) => window.fetch(input, init);

// ── Secrets: OS keychain on desktop, app-private preferences on Android ──────────
const SECRET_PREFIX = 'mosslight.secret.';
export async function getSecret(name: string): Promise<string> {
  try {
    if (isTauri) return (await invoke<string | null>('secret_get', { name })) || '';
    if (isAndroid) return (await Preferences.get({ key: SECRET_PREFIX + name })).value || '';
    return localStorage.getItem(SECRET_PREFIX + name) || '';
  } catch {
    return '';
  }
}
export async function setSecret(name: string, value: string): Promise<void> {
  if (isTauri) return invoke('secret_set', { name, value });
  if (isAndroid) return value ? Preferences.set({ key: SECRET_PREFIX + name, value }) : Preferences.remove({ key: SECRET_PREFIX + name });
  if (value) localStorage.setItem(SECRET_PREFIX + name, value);
  else localStorage.removeItem(SECRET_PREFIX + name);
}

// ── Files ──────────────────────────────────────────────────────────────────────
export async function pickFolder(): Promise<string | null> {
  if (!isTauri) return null;
  const r = await openDialog({ directory: true, multiple: false, title: 'Open a game project folder' });
  return typeof r === 'string' ? r : null;
}

/** Pick a program (an engine editor, a tool) the hub should use. */
export async function pickExecutable(name: string): Promise<string | null> {
  if (!isTauri) return null;
  const r = await openDialog({ multiple: false, title: `Find ${name}`, filters: isMac ? undefined : [{ name: 'Programs', extensions: ['exe', 'bat', 'cmd', 'app'] }] });
  return typeof r === 'string' ? r : null;
}

export async function pickFiles(): Promise<string[]> {
  if (!isTauri) return [];
  const r = await openDialog({ multiple: true, title: 'Add files to the asset library' });
  return Array.isArray(r) ? r : r ? [r] : [];
}

export const scanFolder = (path: string) => invoke<ScanResult>('scan_folder', { path });
export const copyFile = (src: string, dest: string) => invoke<string>('copy_file', { src, dest });
export const removeFile = (path: string) => invoke<void>('remove_file', { path });
export const detectTools = () => (isTauri ? invoke<Record<string, ToolStatus>>('detect_tools') : Promise.resolve({} as Record<string, ToolStatus>));
export const adbInstall = (apk: string) => invoke<string>('adb_install', { apk });
/** Reads a local file (desktop only), refusing anything over `max` bytes. */
export const readFileBytes = async (path: string, max: number) => new Uint8Array(await invoke<ArrayBuffer>('read_file_bytes', { path, max }));
export const runAgentCli = (program: 'claude' | 'codex', args: string[], stdin: string, cwd?: string) => invoke<string>('run_agent_cli', { program, args, stdin, cwd: cwd || null });
export const getDesktopDir = async () => (isTauri ? desktopDir() : null);
export const joinPath = (...parts: string[]) => join(...parts);

/** Root of the shared asset library: ~/Mosslight/Library */
export async function libraryRoot(custom?: string): Promise<string> {
  return custom || join(await homeDir(), 'Mosslight', 'Library');
}

/** Save bytes to disk (desktop) or app storage (Android); returns a path usable with fileSrc(). */
export async function saveBytes(bytes: Uint8Array, desktopPath: string, androidName: string): Promise<string> {
  if (isTauri) return invoke<string>('save_bytes', bytes, { headers: { 'x-path': encodeURIComponent(desktopPath) } });
  if (isAndroid) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    await Filesystem.writeFile({ path: androidName, data: btoa(bin), directory: Directory.Data, recursive: true });
    return (await Filesystem.getUri({ path: androidName, directory: Directory.Data })).uri;
  }
  return URL.createObjectURL(new Blob([bytes as BlobPart]));
}

/** Turn a stored path/URL into something an <img> can load. */
export function fileSrc(p?: string): string | undefined {
  if (!p) return undefined;
  if (/^(https?:|data:|blob:)/.test(p)) return p;
  if (isTauri) return convertFileSrc(p);
  if (isAndroid) return Capacitor.convertFileSrc(p);
  return p;
}

export async function imageDir(): Promise<string> {
  return join(await homeDir(), 'Mosslight', 'Images');
}

// ── Launching ──────────────────────────────────────────────────────────────────
export async function openExternal(url: string) {
  if (isTauri) return openUrl(url);
  if (isAndroid) return Browser.open({ url });
  window.open(url, '_blank', 'noopener');
}

export async function launchPath(path: string) {
  if (/^https?:/i.test(path)) return openExternal(path);
  if (isTauri) return openPath(path);
  throw new Error('Local files can only be launched from the desktop app');
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── Git (desktop) ──────────────────────────────────────────────────────────────
export interface GitOutput { ok: boolean; code: number; stdout: string; stderr: string }
/** Runs git; `auth` is an Authorization header value used only for github.com. */
export const runGit = (args: string[], cwd?: string, auth?: string) => invoke<GitOutput>('run_git', { args, cwd: cwd || null, auth: auth || null });
export const writeTextIfMissing = (path: string, text: string) => invoke<boolean>('write_text_if_missing', { path, text });
export const pickParentFolder = async (title: string): Promise<string | null> => {
  if (!isTauri) return null;
  const r = await openDialog({ directory: true, multiple: false, title });
  return typeof r === 'string' ? r : null;
};
export const homePath = async (...parts: string[]) => join(await homeDir(), ...parts);

// ── Local agent runs with live output (desktop) ────────────────────────────────
export interface StreamResult { ok: boolean; code: number; stdout: string; stderr: string; cancelled: boolean }
/** Runs the claude/codex CLI and calls `onLine` for each stdout line as it arrives. */
export function runAgentCliStream(program: 'claude' | 'codex', args: string[], stdin: string, cwd: string | undefined, runId: string, onLine: (line: string) => void) {
  const ch = new Channel<string>();
  ch.onmessage = onLine;
  return invoke<StreamResult>('run_agent_cli_stream', { program, args, stdin, cwd: cwd || null, runId, onLine: ch });
}
export const cancelAgentRun = (runId: string) => (isTauri ? invoke<boolean>('cancel_agent_run', { runId }) : Promise.resolve(false));

// ── Finding art and documents in a project folder (desktop) ───────────────────
export interface FoundFile { path: string; name: string; folder: string; size: number; modified: number }
export const findFiles = (root: string, exts: string[], max = 3000) => (isTauri ? invoke<FoundFile[]>('find_files', { root, exts, max }) : Promise.resolve([] as FoundFile[]));
export const findBuilds = (root: string, max = 60) => (isTauri ? invoke<FoundFile[]>('find_builds', { root, max }) : Promise.resolve([] as FoundFile[]));
