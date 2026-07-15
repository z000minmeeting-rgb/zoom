export type AdminNotificationEvent =
  | 'app_entry'
  | 'user_registration'
  | 'subscription_submitted'
  | 'payment_successful'
  | 'booking_created'
  | 'new_chat_message';

export type AdminNotification = {
  id: string;
  event: AdminNotificationEvent;
  title: string;
  description: string;
  country: string;
  time: string;
  createdAt: string;
  actionUrl: string;
  read: boolean;
};

export const ADMIN_NOTIFICATIONS_KEY = 'zoo-admin-notifications-v1';
export const ADMIN_NOTIFICATION_EVENT = 'zoo-admin-notification-created';
const APP_ENTRY_SESSION_KEY = 'zoo-admin-entry-notification-sent';

function id() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getVisitorContext() {
  const language = navigator.language || 'en-US';
  let country = 'Unknown';
  try {
    const region = new Intl.Locale(language).region;
    country = region ? new Intl.DisplayNames([language], { type: 'region' }).of(region) || region : 'Unknown';
  } catch {
    // Locale APIs are unavailable in a few embedded browsers; leave country unknown.
  }
  const deviceType = /iPad|Tablet/i.test(navigator.userAgent) ? 'Tablet' : /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
  return { country, language, deviceType };
}

export function readAdminNotifications(): AdminNotification[] {
  try {
    return JSON.parse(window.localStorage.getItem(ADMIN_NOTIFICATIONS_KEY) || '[]') as AdminNotification[];
  } catch {
    return [];
  }
}

export function createAdminNotification(notification: Omit<AdminNotification, 'id' | 'time' | 'createdAt' | 'read'>) {
  const createdAt = new Date().toISOString();
  const next: AdminNotification = {
    ...notification,
    id: id(),
    createdAt,
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(createdAt)),
    read: false,
  };
  const notifications = [next, ...readAdminNotifications()];
  window.localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATION_EVENT, { detail: next }));
  return next;
}

export function notifyAppEntry() {
  if (window.sessionStorage.getItem(APP_ENTRY_SESSION_KEY)) return;
  window.sessionStorage.setItem(APP_ENTRY_SESSION_KEY, 'true');
  const { country, language, deviceType } = getVisitorContext();
  createAdminNotification({
    event: 'app_entry', title: 'New App Entry Detected',
    description: `Language: ${language}. Device: ${deviceType}.`, country, actionUrl: '/admin',
  });
}

export function notifyAdmin(event: AdminNotificationEvent, input: { title: string; description: string; country?: string; actionUrl: string }) {
  return createAdminNotification({ ...input, event, country: input.country || getVisitorContext().country });
}
