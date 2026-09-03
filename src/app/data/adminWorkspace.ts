import type { User } from '@supabase/supabase-js';
import { requireSupabase } from '../lib/supabase';

export type AdminRole = 'owner' | 'admin';

export type AdminWorkspace = {
  id: string;
  name: string;
  ownerUserId: string;
  role: AdminRole;
};

type WorkspaceMembershipRow = {
  role: AdminRole;
  admin_accounts: {
    id: string;
    name: string;
    owner_user_id: string;
  } | null;
};

/**
 * Resolves authorization from Supabase, never from browser storage. The first
 * account is deliberately provisioned by the deployment SQL template; this
 * avoids letting any authenticated user self-promote to administrator.
 */
export async function resolveAdminWorkspace(user?: User | null): Promise<AdminWorkspace | null> {
  const client = requireSupabase();
  const currentUser = user || (await client.auth.getUser()).data.user;

  if (!currentUser) return null;

  const { data, error } = await client
    .from('admin_members')
    .select('role, admin_accounts!inner(id, name, owner_user_id)')
    .eq('user_id', currentUser.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const membership = data as WorkspaceMembershipRow | null;
  if (!membership?.admin_accounts) return null;

  return {
    id: membership.admin_accounts.id,
    name: membership.admin_accounts.name,
    ownerUserId: membership.admin_accounts.owner_user_id,
    role: membership.role,
  };
}

export async function requireAdminWorkspace(): Promise<AdminWorkspace> {
  const workspace = await resolveAdminWorkspace();
  if (!workspace) {
    throw new Error('This Supabase account is not authorized for an admin workspace.');
  }
  return workspace;
}
