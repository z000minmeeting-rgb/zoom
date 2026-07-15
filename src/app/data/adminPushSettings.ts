const PUSH_SUBSCRIPTION_KEY = 'zoo-admin-push-subscription-v1';

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export type PushRegistrationState = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  active: boolean;
};

export function getPushRegistrationState(): PushRegistrationState {
  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  return {
    supported,
    permission: supported ? Notification.permission : 'unsupported',
    active: Boolean(window.localStorage.getItem(PUSH_SUBSCRIPTION_KEY)),
  };
}

export async function enablePushNotifications() {
  const current = getPushRegistrationState();
  if (!current.supported) throw new Error('Push notifications are not supported on this device.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) throw new Error('Push is not configured. Add VITE_VAPID_PUBLIC_KEY before enabling this device.');
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidKey),
  });
  window.localStorage.setItem(PUSH_SUBSCRIPTION_KEY, JSON.stringify(subscription.toJSON()));
  return getPushRegistrationState();
}

export async function disablePushNotifications() {
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
  window.localStorage.removeItem(PUSH_SUBSCRIPTION_KEY);
  return getPushRegistrationState();
}
