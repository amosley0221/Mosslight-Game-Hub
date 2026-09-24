/**
 * Desktop and phone notifications for the moments that need you: a handoff waiting for approval,
 * a plan ready to run, a question about who should take a request.
 *
 * A run takes minutes, so the app is usually behind something else by the time it finishes.
 */
import { isDesktop, platform } from './index';

let ready: boolean | null = null;

/** Asks once, the first time there's something worth saying. */
async function allowed(): Promise<boolean> {
  if (ready !== null) return ready;
  try {
    if (isDesktop) {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      ready = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
    } else if (platform === 'android') {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const now = await LocalNotifications.checkPermissions();
      ready = now.display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted';
    } else {
      ready = false;
    }
  } catch {
    ready = false;
  }
  return ready;
}

/** True when the window is in front, so we don't notify about something already on screen. */
export const looking = () => typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();

export async function notify(title: string, body: string) {
  if (!(await allowed())) return;
  try {
    if (isDesktop) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title, body });
      return;
    }
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{ id: Date.now() % 2147483647, title, body, smallIcon: 'ic_launcher' }],
    });
  } catch {
    /* notifications are a nicety; never let one break a run */
  }
}
