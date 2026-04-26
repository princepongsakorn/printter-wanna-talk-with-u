/**
 * Thin wrapper around the Notification API + service-worker integration.
 *
 * - On iOS Safari: Notifications are only available when running as an
 *   installed PWA (iOS 16.4+). We detect "unsupported" in that case and
 *   the UI simply hides the permission controls.
 * - When a service worker is registered (see public/sw.js) we show
 *   notifications through it so clicks can focus an existing tab and
 *   trigger in-app navigation. Falls back to `new Notification()` in
 *   the window context otherwise.
 */

export type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return "unsupported";
  try {
    const res = await Notification.requestPermission();
    return res as NotificationPermissionState;
  } catch {
    return "denied";
  }
}

export function canShowNotification(): boolean {
  return isNotificationSupported() && Notification.permission === "granted";
}

export type ShowNotificationOptions = {
  title: string;
  body: string;
  /** Dedup key — a new notif with the same tag replaces the old one. */
  tag?: string;
  /** Absolute app URL (e.g. "/chat/abc_def") clicked notifications navigate to. */
  url?: string;
  icon?: string;
};

export async function showNotification(opts: ShowNotificationOptions): Promise<void> {
  if (!canShowNotification()) return;
  const icon = opts.icon ?? "/favicon.svg";
  const payload: NotificationOptions = {
    body: opts.body,
    tag: opts.tag,
    icon,
    badge: icon,
    data: { url: opts.url ?? "/" },
  };

  // Prefer the service worker path so clicks reopen/focus the existing
  // window and trigger react-router navigation (see main.tsx).
  const reg =
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration()
      : null;

  if (reg) {
    try {
      await reg.showNotification(opts.title, payload);
      return;
    } catch {
      // fall through to window Notification
    }
  }

  try {
    const n = new Notification(opts.title, payload);
    n.onclick = () => {
      window.focus();
      if (opts.url) window.location.assign(opts.url);
      n.close();
    };
  } catch {
    /* some browsers require SW for notifications — swallow */
  }
}
