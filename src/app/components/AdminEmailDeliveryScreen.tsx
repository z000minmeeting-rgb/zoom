import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';
import {
  fetchEmailDelivery,
  summarizeDelivery,
  type EmailDeliveryRecord,
  type EmailDeliveryStatus,
} from '../data/emailDelivery';
import { useLocalization } from '../context/LocalizationContext';

const STATUS_STYLE: Record<EmailDeliveryStatus, { label: string; className: string }> = {
  sent: { label: 'Sent', className: 'bg-[#EEFBF4] text-[#157347] border-[#BFE7D1]' },
  pending: { label: 'Queued', className: 'bg-[#F4F8FF] text-[#0B5CFF] border-[#D8E4FF]' },
  processing: { label: 'Sending', className: 'bg-[#F4F8FF] text-[#0B5CFF] border-[#D8E4FF]' },
  retry: { label: 'Retrying', className: 'bg-[#FFF8E6] text-[#A16207] border-[#F4D680]' },
  failed: { label: 'Failed', className: 'bg-[#FFF5F4] text-[#B42318] border-[#FEE4E2]' },
};

const EVENT_LABEL: Record<string, string> = {
  BOOKING_SUBMITTED: 'Booking submitted',
  CUSTOMER_MESSAGE: 'Customer message',
  ADMIN_REPLY: 'Support reply',
  CALL_SCHEDULED: 'Call scheduled',
  CALL_RESCHEDULED: 'Call rescheduled',
  CHAT_ACCESS_REQUESTED: 'Chat access link',
};

/**
 * Delivery visibility.
 *
 * A booking is never rolled back because its email failed, which means a
 * failure is invisible unless it is surfaced somewhere. This is that place.
 */
export function AdminEmailDeliveryScreen() {
  const navigate = useNavigate();
  const { formatDate } = useLocalization();
  const [records, setRecords] = useState<EmailDeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setIsLoading(true);
    return fetchEmailDelivery()
      .then((next) => {
        setRecords(next);
        setError('');
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load email delivery.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
    const intervalId = window.setInterval(load, 30000);
    return () => window.clearInterval(intervalId);
  }, [load]);

  const totals = summarizeDelivery(records);
  const needsAttention = records.filter((record) => record.status === 'failed' || record.status === 'retry');

  return (
    <div className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-[#F7F9FC]">
      <div className="sticky top-0 z-20 shrink-0 bg-white">
        <WorkspaceTopBar />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <button onClick={() => navigate('/admin')} className="mb-6 inline-flex items-center gap-2 text-sm text-[#0B5CFF] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to admin
          </button>

          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 900 }}>Email delivery</p>
              <h1 className="mt-1 text-3xl text-[#172033]" style={{ fontWeight: 900 }}>Transactional email status</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
                Every booking confirmation, chat notification and session email. A failure here never affects the
                booking itself &mdash; the business record stands on its own.
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#D8E4FF] bg-white px-4 py-3 text-sm text-[#172033] hover:bg-[#E8F1FF] disabled:text-[#B6C2D6]"
            >
              <RefreshCw className={`h-4 w-4 text-[#0B5CFF] ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-[#F4D680] bg-[#FFF8E6] p-4 text-sm text-[#854D0E]">
              {error}
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ['sent', 'Sent', CheckCircle2, '#157347'],
              ['retry', 'Retrying', Clock, '#A16207'],
              ['failed', 'Failed', XCircle, '#B42318'],
              ['pending', 'Queued', AlertTriangle, '#0B5CFF'],
            ] as const).map(([key, label, Icon, color]) => (
              <div key={key} className="rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm">
                <Icon className="mb-2 h-5 w-5" style={{ color }} />
                <p className="text-2xl text-[#172033]" style={{ fontWeight: 900 }}>{totals[key] ?? 0}</p>
                <p className="text-xs text-[#6B7280]">{label}</p>
              </div>
            ))}
          </div>

          {needsAttention.length > 0 && (
            <div className="mb-6 rounded-2xl border border-[#FEE4E2] bg-[#FFF5F4] p-4">
              <p className="text-sm text-[#B42318]" style={{ fontWeight: 900 }}>
                {needsAttention.length} message{needsAttention.length === 1 ? '' : 's'} did not reach the recipient
              </p>
              <p className="mt-1 text-sm leading-6 text-[#B42318]">
                A syntactically valid address can still be undeliverable. Check the address with the customer in chat
                rather than assuming the mailbox does not exist.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-[#E5E9F2] bg-white shadow-sm">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E9F2] bg-[#F7FAFF] text-xs uppercase tracking-[0.08em] text-[#6B7280]">
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Sent</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-[#F1F4F9] last:border-b-0 align-top">
                    <td className="px-4 py-3">
                      <p className="text-[#172033]" style={{ fontWeight: 700 }}>
                        {EVENT_LABEL[record.eventType] || record.eventType}
                      </p>
                      <p className="mt-0.5 text-xs text-[#6B7280]">{record.templateKey}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="break-all text-[#172033]">{record.recipientEmail}</p>
                      <p className="mt-0.5 text-xs capitalize text-[#6B7280]">{record.recipientRole}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${STATUS_STYLE[record.status].className}`} style={{ fontWeight: 800 }}>
                        {STATUS_STYLE[record.status].label}
                      </span>
                      {record.lastError && (
                        <p className="mt-2 max-w-xs break-words text-xs leading-5 text-[#B42318]">{record.lastError}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#4B5563]">{record.attemptCount}</td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">
                      {formatDate(record.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">
                      {record.sentAt
                        ? formatDate(record.sentAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {records.length === 0 && !isLoading && !error && (
              <p className="p-8 text-center text-sm text-[#6B7280]">
                No transactional email has been queued yet.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
