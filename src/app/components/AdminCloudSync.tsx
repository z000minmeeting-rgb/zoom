import { useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { importLegacyAdminData } from '../data/legacyAdminMigration';
import { refreshThreadsFromRemote } from '../data/verificationChat';
import { refreshClientProfilesFromRemote } from '../data/clientProfiles';
import { refreshSubscriptionContentFromRemote } from '../data/subscriptionPackages';
import { refreshAdminNotificationsFromRemote } from '../data/adminNotifications';

/** One lifecycle-owned Realtime channel, rather than one subscription per UI screen. */
export function AdminCloudSync() {
  const { state, workspace } = useAdminAuth();
  useEffect(() => {
    if (state !== 'authorized' || !workspace || !isSupabaseConfigured || !supabase) return;
    let active = true;
    const refreshAll = () => Promise.all([
      refreshThreadsFromRemote(), refreshClientProfilesFromRemote(), refreshSubscriptionContentFromRemote(), refreshAdminNotificationsFromRemote(),
    ]).catch((error) => console.error('Admin cloud refresh failed', error));
    importLegacyAdminData().catch((error) => console.error('Legacy admin import failed', error)).finally(() => { if (active) refreshAll(); });

    const channel = supabase.channel(`admin-workspace:${workspace.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_threads', filter: `admin_account_id=eq.${workspace.id}` }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_messages', filter: `admin_account_id=eq.${workspace.id}` }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_attachments', filter: `admin_account_id=eq.${workspace.id}` }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_profiles', filter: `admin_account_id=eq.${workspace.id}` }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_content', filter: `admin_account_id=eq.${workspace.id}` }, refreshAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications', filter: `admin_account_id=eq.${workspace.id}` }, refreshAll)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [state, workspace?.id]);
  return null;
}
