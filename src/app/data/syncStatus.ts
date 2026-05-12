export const SUPABASE_SYNC_ERROR_EVENT_NAME = 'zoom-supabase-sync-error';

export type SupabaseSyncErrorDetail = {
  area: string;
  message: string;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return 'Unknown Supabase sync error.';
}

export function reportSupabaseSyncError(area: string, error: unknown) {
  const detail: SupabaseSyncErrorDetail = {
    area,
    message: errorMessage(error),
  };

  console.error(`Supabase sync failed for ${area}:`, error);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SupabaseSyncErrorDetail>(SUPABASE_SYNC_ERROR_EVENT_NAME, { detail }));
  }
}
