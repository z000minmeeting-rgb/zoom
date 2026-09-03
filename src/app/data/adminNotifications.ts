import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { readCloudCache, writeCloudCache } from './adminCache';
import { requireAdminWorkspace } from './adminWorkspace';

export type AdminNotificationEvent = 'app_entry' | 'user_registration' | 'subscription_submitted' | 'payment_successful' | 'booking_created' | 'new_chat_message';
export type AdminNotification = { id: string; event: AdminNotificationEvent; title: string; description: string; country: string; time: string; createdAt: string; actionUrl: string; read: boolean };
type Row = { id: string; event: AdminNotificationEvent; title: string; description: string; country: string; action_url: string; read_at: string | null; created_at: string };

export const ADMIN_NOTIFICATIONS_KEY = 'zoo-admin-notifications-v1';
export const ADMIN_NOTIFICATION_EVENT = 'zoo-admin-notification-created';
const APP_ENTRY_SESSION_KEY = 'zoo-admin-entry-notification-sent';

function id() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function toNotification(row: Row): AdminNotification { return { id: row.id, event: row.event, title: row.title, description: row.description, country: row.country, actionUrl: row.action_url, createdAt: row.created_at, time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(row.created_at)), read: Boolean(row.read_at) }; }

export function getVisitorContext() {
  const language = navigator.language || 'en-US';
  let country = 'Unknown';
  try { const region = new Intl.Locale(language).region; country = region ? new Intl.DisplayNames([language], { type: 'region' }).of(region) || region : 'Unknown'; } catch { /* unavailable browser API */ }
  const deviceType = /iPad|Tablet/i.test(navigator.userAgent) ? 'Tablet' : /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
  return { country, language, deviceType };
}

export function readAdminNotifications(): AdminNotification[] { return readCloudCache<AdminNotification[]>('notifications', []); }
export function readLegacyAdminNotifications(): AdminNotification[] {
  try { return JSON.parse(window.localStorage.getItem(ADMIN_NOTIFICATIONS_KEY) || '[]') as AdminNotification[]; } catch { return []; }
}

export async function refreshAdminNotificationsFromRemote() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');
  const workspace = await requireAdminWorkspace();
  const { data, error } = await supabase.from('admin_notifications').select('*').eq('admin_account_id', workspace.id).order('created_at', { ascending: false });
  if (error) throw error;
  const notifications = (data as Row[]).map(toNotification);
  writeCloudCache('notifications', notifications);
  window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATION_EVENT));
  return notifications;
}

export async function createAdminNotification(notification: Omit<AdminNotification, 'id' | 'time' | 'createdAt' | 'read'>) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');
  const workspace = await requireAdminWorkspace();
  const createdAt = new Date().toISOString();
  const { data, error } = await supabase.from('admin_notifications').insert({ id: id(), admin_account_id: workspace.id, event: notification.event, title: notification.title, description: notification.description, country: notification.country, action_url: notification.actionUrl, created_at: createdAt }).select().single();
  if (error) throw error;
  const next = toNotification(data as Row);
  writeCloudCache('notifications', [next, ...readAdminNotifications()]);
  window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATION_EVENT, { detail: next }));
  return next;
}

export async function markAdminNotificationRead(notificationId: string) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');
  const workspace = await requireAdminWorkspace();
  const { error } = await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId).eq('admin_account_id', workspace.id);
  if (error) throw error;
  const notifications = readAdminNotifications().map((notification) => notification.id === notificationId ? { ...notification, read: true } : notification);
  writeCloudCache('notifications', notifications);
  window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATION_EVENT));
  return notifications;
}

export async function markAllAdminNotificationsRead() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');
  const workspace = await requireAdminWorkspace();
  const { error } = await supabase.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('admin_account_id', workspace.id).is('read_at', null);
  if (error) throw error;
  const notifications = readAdminNotifications().map((notification) => ({ ...notification, read: true }));
  writeCloudCache('notifications', notifications);
  window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATION_EVENT));
  return notifications;
}

export function notifyAppEntry() {
  if (window.sessionStorage.getItem(APP_ENTRY_SESSION_KEY)) return;
  window.sessionStorage.setItem(APP_ENTRY_SESSION_KEY, 'true');
  const { country, language, deviceType } = getVisitorContext();
  createAdminNotification({ event: 'app_entry', title: 'New App Entry Detected', description: `Language: ${language}. Device: ${deviceType}.`, country, actionUrl: '/admin' }).catch(() => undefined);
}

export function notifyAdmin(event: AdminNotificationEvent, input: { title: string; description: string; country?: string; actionUrl: string }) {
  return createAdminNotification({ ...input, event, country: input.country || getVisitorContext().country });
}
