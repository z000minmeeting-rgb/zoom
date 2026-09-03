import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireEnv } from './env.ts';

/**
 * Service-role client. It bypasses RLS, which is precisely why it exists only
 * here and never leaves the Edge runtime.
 *
 * SUPABASE_SERVICE_ROLE_KEY is injected automatically into deployed Edge
 * Functions; it is not something to add to the frontend environment.
 */
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}
