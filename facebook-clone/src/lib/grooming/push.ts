import { groomingApi } from './api';
import { API_MODE, VAPID_PUBLIC_KEY } from './config';

export type PushStatus =
  | 'unsupported'
  | 'needs-home-screen'
  | 'default'
  | 'granted'
  | 'denied';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function getPushStatus(): PushStatus {
  if (!('Notification' in window)) {
    // iOS only exposes notifications to Home Screen web apps (16.4+).
    return isIos() && !isStandalone() ? 'needs-home-screen' : 'unsupported';
  }
  return Notification.permission as PushStatus;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Must be called from a tap/click. With the real backend and a VAPID key it
 * registers /sw.js and sends the subscription to POST /push/subscribe;
 * otherwise it only enables in-page notifications.
 */
export async function enablePush(): Promise<PushStatus> {
  if (!('Notification' in window)) return getPushStatus();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission as PushStatus;

  if (API_MODE === 'http' && VAPID_PUBLIC_KEY && 'serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));
    const json = sub.toJSON();
    await groomingApi.subscribePush({
      endpoint: json.endpoint ?? sub.endpoint,
      keys: (json.keys as Record<string, string>) ?? {},
    });
  } else {
    await groomingApi.subscribePush({ endpoint: 'local-demo', keys: {} });
  }
  return 'granted';
}

/** In-page notification while the guardian page is open (mock mode). */
export function showLocalNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: title + body });
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}
