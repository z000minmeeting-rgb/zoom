import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { requireAdminWorkspace } from './adminWorkspace';

/**
 * Read-only delivery status for the admin dashboard.
 *
 * The outbox grants `select` to authenticated users and nothing else; the RLS
 * policy narrows that to the reader's own workspace. Rows cannot be inserted,
 * edited or deleted from the browser — only the service role writes here — so
 * this view can never become a way to send mail.
 */

export type EmailDeliveryStatus = 'pending' | 'processing' | 'sent' | 'retry' | 'failed';

export type EmailDeliveryRecord = {
  id: string;
  eventType: string;
  templateKey: string;
  recipientEmail: string;
  recipientRole: 'customer' | 'admin';
  status: EmailDeliveryStatus;
  attemptCount: number;
  lastError: string;
  createdAt: string;
  sentAt: string;
  failedAt: string;
  nextAttemptAt: string;
  entityId: string;
};

type Row = {
  id: string;
  event_type: string;
  template_key: string;
  recipient_email: string | null;
  recipient_role: 'customer' | 'admin';
  status: EmailDeliveryStatus;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  failed_at: string | null;
  next_attempt_at: string | null;
  entity_id: string;
};

function toRecord(row: Row): EmailDeliveryRecord {
  return {
    id: row.id,
    eventType: row.event_type,
    templateKey: row.template_key,
    // An admin row enqueued without a recipient is resolved at send time from
    // the configured notification address.
    recipientEmail: row.recipient_email || 'Configured admin address',
    recipientRole: row.recipient_role,
    status: row.status,
    attemptCount: row.attempt_count,
    lastError: row.last_error || '',
    createdAt: row.created_at,
    sentAt: row.sent_at || '',
    failedAt: row.failed_at || '',
    nextAttemptAt: row.next_attempt_at || '',
    entityId: row.entity_id,
  };
}

export async function fetchEmailDelivery(limit = 100): Promise<EmailDeliveryRecord[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const workspace = await requireAdminWorkspace();

  const { data, error } = await supabase
    .from('email_outbox')
    .select(
      'id, event_type, template_key, recipient_email, recipient_role, status, attempt_count, last_error, created_at, sent_at, failed_at, next_attempt_at, entity_id',
    )
    .eq('admin_account_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    // A missing relation means the email migrations have not been applied yet.
    if (error.code === '42P01') {
      throw new Error('Email delivery is not set up yet. Apply the transactional email migrations.');
    }
    throw error;
  }

  return ((data ?? []) as Row[]).map(toRecord);
}

export function summarizeDelivery(records: EmailDeliveryRecord[]) {
  return records.reduce(
    (totals, record) => ({ ...totals, [record.status]: (totals[record.status] ?? 0) + 1 }),
    {} as Record<EmailDeliveryStatus, number>,
  );
}
