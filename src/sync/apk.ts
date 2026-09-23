import { CapacitorHttp, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { Build } from '../core/types';
import { readFileBytes } from '../platform';
import type { GitHubStore } from './github';

/** Native side lives in android/…/ApkInstallerPlugin.java (written by scripts/android-setup.mjs). */
interface ApkInstaller {
  inspect(o: { path: string }): Promise<{ packageName?: string; versionCode?: number }>;
  installedVersion(o: { packageName: string }): Promise<{ installed: boolean; versionCode?: number }>;
  install(o: { path: string }): Promise<{ started: boolean; needsPermission?: boolean }>;
  launch(o: { packageName: string }): Promise<{ launched: boolean }>;
}
const ApkInstaller = registerPlugin<ApkInstaller>('ApkInstaller');

const MAX_APK = 1024 * 1024 * 1024;

/** Desktop: push a local APK to the sync repo so paired phones can install it. */
export async function uploadApk(store: GitHubStore, b: Build) {
  const bytes = await readFileBytes(b.path, MAX_APK);
  return store.uploadAsset(bytes, b.name.endsWith('.apk') ? b.name : b.name + '.apk', 'application/vnd.android.package-archive');
}

async function download(store: GitHubStore, b: Build): Promise<string> {
  const rel = `apks/${b.remote!.name}`;
  try {
    const st = await Filesystem.stat({ path: rel, directory: Directory.Cache });
    if (st.size === b.remote!.size) return st.uri;
  } catch { /* not cached yet */ }
  // GitHub answers with a redirect to a signed download URL; follow it without our token.
  const r = await CapacitorHttp.request({ method: 'GET', url: store.assetApiUrl(b.remote!.assetId), headers: { Authorization: store.authHeader(), Accept: 'application/octet-stream' }, disableRedirects: true });
  const loc = r.headers?.Location || r.headers?.location;
  if (!loc) throw new Error(`Couldn't get the download link (${r.status})`);
  await Filesystem.downloadFile({ url: loc, path: rel, directory: Directory.Cache, recursive: true });
  return (await Filesystem.getUri({ path: rel, directory: Directory.Cache })).uri;
}

/**
 * Phone: install the build if it isn't installed at this version yet, otherwise launch it.
 * Returns a short status line for a toast.
 */
export async function installOrLaunch(store: GitHubStore, b: Build, onStep: (s: string) => void): Promise<string> {
  onStep(`Downloading ${b.name}…`);
  const uri = await download(store, b);
  const path = uri.replace(/^file:\/\//, '');
  const info = await ApkInstaller.inspect({ path });
  if (info.packageName) {
    const cur = await ApkInstaller.installedVersion({ packageName: info.packageName });
    if (cur.installed && (cur.versionCode ?? -1) >= (info.versionCode ?? 0)) {
      await ApkInstaller.launch({ packageName: info.packageName });
      return `Launched ${b.name}`;
    }
  }
  const r = await ApkInstaller.install({ path });
  if (r.needsPermission) return 'Allow Mosslight to install apps, then tap the build again';
  return `Installing ${b.name} — tap ▶ again after it finishes to play`;
}
