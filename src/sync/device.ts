import type { Platform, Project } from '../core/types';
import { platform } from '../platform';

/** Which OS this copy of the app runs on — decides which builds can launch here. */
export const deviceOs: Platform = platform === 'android'
  ? 'android'
  : /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? 'mac'
  : /Win/i.test(navigator.platform || navigator.userAgent) ? 'windows'
  : 'web';

const ID_KEY = 'mosslight.deviceId';
const NAME_KEY = 'mosslight.deviceName';

function load(key: string, make: () => string) {
  try {
    const v = localStorage.getItem(key);
    if (v) return v;
    const n = make();
    localStorage.setItem(key, n);
    return n;
  } catch {
    return make();
  }
}

/** Stable per-install id. */
export const deviceId = load(ID_KEY, () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)));

const defaultName = () => (deviceOs === 'android' ? 'Android phone' : deviceOs === 'mac' ? 'Mac' : deviceOs === 'windows' ? 'Windows PC' : 'Browser');
export const getDeviceName = () => load(NAME_KEY, defaultName);
export const setDeviceName = (n: string) => { try { localStorage.setItem(NAME_KEY, n.trim() || defaultName()); } catch { /* ignore */ } };

export const OS_LABEL: Record<Platform, string> = { windows: 'Windows', mac: 'macOS', android: 'Android', web: 'Web' };

/** The project's folder, only if it lives on this device. */
export const localFolder = (p: Project) => (p.folder?.path && (!p.folder.device || p.folder.device === deviceId) ? p.folder : null);
