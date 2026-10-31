/** Browser notification helpers. These only work while the app is open in a tab/window:
 *  there is no push backend, so a closed browser can never be woken by this app. */
export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationPermission(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).toString());
  } catch {
    return null;
  }
}

/** Must be called from a user gesture (a click on “Turn on notifications”). */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    const r = await Notification.requestPermission();
    if (r === 'granted') await registerServiceWorker();
    return r as PermissionState;
  } catch {
    return notificationPermission();
  }
}

/** Asks the browser to display a notification. Returns whether the browser accepted the request —
 *  it cannot confirm the user actually saw it (focus modes, OS settings and so on can hide it). */
export async function showSystemNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: new URL('favicon.svg', document.baseURI).toString(), badge: new URL('favicon.svg', document.baseURI).toString() });
      return true;
    }
    new Notification(title, { body, tag });
    return true;
  } catch {
    try { new Notification(title, { body, tag }); return true; } catch { return false; }
  }
}
