import { isSupabaseConfigured, requireSupabase } from './supabase';

/**
 * Calls to the public Edge Functions.
 *
 * These are the only write paths available to a visitor without an admin
 * session. They carry the public anon key and nothing else — no service role,
 * no mail credential, no privileged token ever reaches this bundle.
 */

export type EdgeError = {
  message: string;
  field?: string;
  status: number;
};

export class EdgeFunctionError extends Error {
  readonly field?: string;
  readonly status: number;

  constructor({ message, field, status }: EdgeError) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.field = field;
    this.status = status;
  }
}

export async function callEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new EdgeFunctionError({
      message: 'This feature is unavailable because Supabase is not configured.',
      status: 0,
    });
  }

  const { data, error } = await requireSupabase().functions.invoke<T>(name, { body, headers });

  if (error) {
    // functions.invoke surfaces a non-2xx as an error whose response body still
    // carries the field-level detail the form needs.
    const context = (error as { context?: Response }).context;
    let message = error.message || 'Request failed.';
    let field: string | undefined;
    let status = context?.status ?? 0;

    if (context && typeof context.json === 'function') {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === 'string') message = payload.error;
        if (typeof payload?.field === 'string') field = payload.field;
        status = context.status;
      } catch {
        // Non-JSON error body; the generic message stands.
      }
    }

    throw new EdgeFunctionError({ message, field, status });
  }

  return data as T;
}
