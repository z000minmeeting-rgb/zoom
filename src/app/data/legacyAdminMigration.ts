import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { readLegacyClients, readClients, refreshClientProfilesFromRemote, saveClientProfiles, type ClientProfile } from './clientProfiles';
import { readLegacyThreads, readThreads, refreshThreadsFromRemote, persistThreadRemote, type VerificationThread } from './verificationChat';
import { loadLegacySubscriptionContent, loadSubscriptionContent, refreshSubscriptionContentFromRemote, saveSubscriptionContent } from './subscriptionPackages';
import { readLegacyAdminNotifications } from './adminNotifications';
import { requireAdminWorkspace } from './adminWorkspace';

export const LEGACY_ADMIN_MIGRATION_KEY = 'legacy-admin-localstorage-v1';
export const ADMIN_DEVICE_ID_KEY = 'zoo-admin-device-id-v1';

type Counts = Record<string, number>;
export type LegacyMigrationResult = { examined: Counts; imported: Counts; skipped: Counts; conflicts: string[]; alreadyCompleted: boolean };

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  throw new Error('This browser cannot create a stable device identifier.');
}

export function getAdminDeviceId() {
  const existing = window.localStorage.getItem(ADMIN_DEVICE_ID_KEY);
  if (existing) return existing;
  const value = uuid();
  window.localStorage.setItem(ADMIN_DEVICE_ID_KEY, value);
  return value;
}

function time(value?: string) { return new Date(value || 0).getTime(); }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function createResult(): LegacyMigrationResult { return { examined: {}, imported: {}, skipped: {}, conflicts: [], alreadyCompleted: false }; }
function increment(target: Counts, key: string) { target[key] = (target[key] || 0) + 1; }

async function trackDevice(accountId: string, deviceId: string) {
  const { error } = await supabase!.from('admin_devices').upsert({ admin_account_id: accountId, device_id: deviceId, device_name: navigator.userAgent.slice(0, 160), platform: navigator.platform || '', last_seen_at: new Date().toISOString() }, { onConflict: 'admin_account_id,device_id' });
  if (error) throw error;
}

/**
 * Imports one browser's legacy dataset once. It keeps the source keys intact,
 * imports only stable UUID records, and lets a newer cloud record win.
 */
export async function importLegacyAdminData(): Promise<LegacyMigrationResult> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');
  const workspace = await requireAdminWorkspace();
  const deviceId = getAdminDeviceId();
  const result = createResult();
  const { data: existing } = await supabase.from('admin_migrations').select('status').eq('admin_account_id', workspace.id).eq('migration_key', LEGACY_ADMIN_MIGRATION_KEY).eq('device_id', deviceId).maybeSingle();
  if (existing?.status === 'completed') return { ...result, alreadyCompleted: true };

  await trackDevice(workspace.id, deviceId);
  await supabase.from('admin_migrations').upsert({ admin_account_id: workspace.id, migration_key: LEGACY_ADMIN_MIGRATION_KEY, device_id: deviceId, status: 'started' }, { onConflict: 'admin_account_id,migration_key,device_id' });

  try {
    await Promise.all([refreshThreadsFromRemote(), refreshClientProfilesFromRemote(), refreshSubscriptionContentFromRemote()]);
    const cloudThreads = new Map(readThreads().map((thread) => [thread.id, thread]));
    for (const legacy of readLegacyThreads()) {
      increment(result.examined, 'verification_threads');
      if (!isUuid(legacy.id)) { increment(result.skipped, 'verification_threads'); result.conflicts.push(`Skipped verification thread without UUID: ${legacy.fullName}`); continue; }
      const cloud = cloudThreads.get(legacy.id);
      if (cloud && time(cloud.updatedAt || cloud.createdAt) >= time(legacy.updatedAt || legacy.createdAt)) { increment(result.skipped, 'verification_threads'); continue; }
      await persistThreadRemote(legacy);
      increment(result.imported, 'verification_threads');
    }

    const cloudClients = new Map(readClients().map((client) => [client.id, client]));
    const importClients: ClientProfile[] = [];
    for (const legacy of readLegacyClients()) {
      increment(result.examined, 'client_profiles');
      if (!isUuid(legacy.id)) { increment(result.skipped, 'client_profiles'); result.conflicts.push(`Skipped client without UUID: ${legacy.name}`); continue; }
      const cloud = cloudClients.get(legacy.id);
      if (cloud && time(cloud.updatedAt || cloud.createdAt) >= time(legacy.updatedAt || legacy.createdAt)) { increment(result.skipped, 'client_profiles'); continue; }
      importClients.push(legacy);
    }
    if (importClients.length) {
      await saveClientProfiles(importClients);
      importClients.forEach(() => increment(result.imported, 'client_profiles'));
    }

    const legacyContent = loadLegacySubscriptionContent();
    increment(result.examined, 'subscription_content');
    const cloudContent = loadSubscriptionContent();
    if (JSON.stringify(cloudContent) === JSON.stringify(legacyContent)) increment(result.skipped, 'subscription_content');
    else { await saveSubscriptionContent(legacyContent); increment(result.imported, 'subscription_content'); }

    for (const notification of readLegacyAdminNotifications()) {
      increment(result.examined, 'admin_notifications');
      if (!isUuid(notification.id)) { increment(result.skipped, 'admin_notifications'); continue; }
      const { error } = await supabase.from('admin_notifications').upsert({ id: notification.id, admin_account_id: workspace.id, event: notification.event, title: notification.title, description: notification.description, country: notification.country, action_url: notification.actionUrl, created_at: notification.createdAt, read_at: notification.read ? notification.createdAt : null }, { onConflict: 'id' });
      if (error) throw error;
      increment(result.imported, 'admin_notifications');
    }

    await Promise.all([refreshThreadsFromRemote(), refreshClientProfilesFromRemote(), refreshSubscriptionContentFromRemote()]);
    const { error } = await supabase.from('admin_migrations').update({ status: 'completed', completed_at: new Date().toISOString(), records_examined: result.examined, records_imported: result.imported, records_skipped: result.skipped, conflicts: result.conflicts }).eq('admin_account_id', workspace.id).eq('migration_key', LEGACY_ADMIN_MIGRATION_KEY).eq('device_id', deviceId);
    if (error) throw error;
    return result;
  } catch (cause) {
    await supabase.from('admin_migrations').update({ status: 'failed', records_examined: result.examined, records_imported: result.imported, records_skipped: result.skipped, conflicts: [...result.conflicts, cause instanceof Error ? cause.message : 'Unknown migration failure'] }).eq('admin_account_id', workspace.id).eq('migration_key', LEGACY_ADMIN_MIGRATION_KEY).eq('device_id', deviceId);
    throw cause;
  }
}
