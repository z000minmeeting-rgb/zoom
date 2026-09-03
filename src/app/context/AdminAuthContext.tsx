import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { clearCloudCache } from '../data/adminCache';
import { AdminWorkspace, resolveAdminWorkspace } from '../data/adminWorkspace';

type AdminLoginPayload = { email: string; password: string };
type AdminLoginResult = { ok: boolean; message?: string };
export type AdminAuthState = 'loading' | 'signed_out' | 'unauthorized' | 'authorized' | 'error';

type AdminAuthContextValue = {
  state: AdminAuthState;
  user: User | null;
  workspace: AdminWorkspace | null;
  isAdminConfigured: boolean;
  isAdminAuthenticated: boolean;
  isCheckingAdmin: boolean;
  error: string | null;
  loginAdmin: (payload: AdminLoginPayload) => Promise<AdminLoginResult>;
  logoutAdmin: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<AdminWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = async (nextUser: User | null) => {
    setUser(nextUser);
    setError(null);
    if (!nextUser) {
      setWorkspace(null);
      setState('signed_out');
      return;
    }
    try {
      const nextWorkspace = await resolveAdminWorkspace(nextUser);
      setWorkspace(nextWorkspace);
      setState(nextWorkspace ? 'authorized' : 'unauthorized');
    } catch (cause) {
      setWorkspace(null);
      setState('error');
      setError(cause instanceof Error ? cause.message : 'Unable to verify administrator access.');
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState('error');
      setError('Admin authentication requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    const client = requireSupabase();
    let active = true;
    client.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError) {
        setState('error');
        setError(authError.message);
        return;
      }
      resolve(data.user).catch(() => undefined);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      resolve(session?.user ?? null).catch(() => undefined);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    state, user, workspace,
    isAdminConfigured: isSupabaseConfigured,
    isAdminAuthenticated: state === 'authorized',
    isCheckingAdmin: state === 'loading',
    error,
    loginAdmin: async ({ email, password }) => {
      if (!isSupabaseConfigured) return { ok: false, message: 'Supabase is not configured.' };
      setState('loading');
      setError(null);
      const { data, error: signInError } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data.user) {
        setState('signed_out');
        return { ok: false, message: signInError?.message || 'Unable to sign in.' };
      }
      await resolve(data.user);
      return { ok: true };
    },
    logoutAdmin: async () => {
      clearCloudCache();
      if (isSupabaseConfigured) await requireSupabase().auth.signOut();
      setWorkspace(null);
      setUser(null);
      setState('signed_out');
    },
  }), [state, user, workspace, error]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return context;
}
