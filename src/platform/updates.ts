import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { App } from '@capacitor/app';
import { REPO } from '../core/constants';
import { cmpVersion } from '../core/util';
import { httpFetch, openExternal, platform } from './index';

declare const __APP_VERSION__: string;

export interface UpdateInfo {
  version: string;
  notes: string;
  /** Desktop: downloads, installs and restarts. Android: opens the APK download. */
  install: (onProgress?: (pct: number) => void) => Promise<void>;
}

export async function currentVersion(): Promise<string> {
  if (platform === 'android') {
    try {
      return (await App.getInfo()).version;
    } catch {
      /* fall through */
    }
  }
  return __APP_VERSION__;
}

export const releasesUrl = `https://github.com/${REPO}/releases`;

/**
 * Desktop uses the Tauri updater (signed latest.json on the GitHub release), which installs
 * over the existing app. Android checks the latest GitHub release for a newer signed APK;
 * because every release is signed with the same key and has a higher versionCode,
 * Android installs it as an in-place update.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (platform === 'desktop') {
    const u: Update | null = await check();
    if (!u) return null;
    return {
      version: u.version,
      notes: u.body || '',
      install: async onProgress => {
        let total = 0, got = 0;
        await u.downloadAndInstall(ev => {
          if (ev.event === 'Started') total = ev.data.contentLength || 0;
          if (ev.event === 'Progress') {
            got += ev.data.chunkLength;
            if (total) onProgress?.(Math.round((100 * got) / total));
          }
        });
        await relaunch();
      },
    };
  }
  if (platform === 'android') {
    const r = await httpFetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const rel = await r.json();
    const version = String(rel.tag_name || '').replace(/^v/, '');
    if (!version || cmpVersion(version, await currentVersion()) <= 0) return null;
    const apk = (rel.assets || []).find((a: { name: string }) => a.name.endsWith('.apk'));
    return {
      version,
      notes: rel.body || '',
      install: async () => openExternal(apk ? apk.browser_download_url : rel.html_url),
    };
  }
  return null;
}
