import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, ShieldCheck } from 'lucide-react';
import { VerificationChatPanel } from './verification/VerificationChatPanel';
import {
  VERIFICATION_EVENT_NAME,
  MANAGEMENT_PAYMENT_WELCOME_MESSAGE,
  addMessage,
  formatStatusColor,
  getThread,
  markThreadSeen,
  refreshThreadsFromRemote,
  saveThreadSession,
  setThreadTyping,
  updateThread,
  VerificationThread,
} from '../data/verificationChat';

export function UserVerificationChatScreen() {
  const navigate = useNavigate();
  const { threadId = '' } = useParams();
  const [thread, setThread] = useState<VerificationThread | null>(() => getThread(threadId));

  useEffect(() => {
    if (threadId) {
      const currentThread = getThread(threadId);
      if (currentThread) {
        saveThreadSession(threadId, currentThread);
      }
      markThreadSeen(threadId, 'user');
    }

    const refreshThread = () => setThread(getThread(threadId));
    window.addEventListener(VERIFICATION_EVENT_NAME, refreshThread);
    refreshThreadsFromRemote().then(() => {
      const refreshedThread = getThread(threadId);
      if (refreshedThread) {
        saveThreadSession(threadId, refreshedThread);
      }
      setThread(refreshedThread);
    });
    refreshThread();

    return () => window.removeEventListener(VERIFICATION_EVENT_NAME, refreshThread);
  }, [threadId]);

  useEffect(() => {
    if (!thread || thread.onboardingAutoReplySent) {
      return;
    }

    setThreadTyping(thread.id, 'admin', true);
    const timeoutId = window.setTimeout(() => {
      addMessage(
        thread.id,
        'admin',
        MANAGEMENT_PAYMENT_WELCOME_MESSAGE
      );
      updateThread(thread.id, (currentThread) => ({
        ...currentThread,
        typingAdmin: false,
        onboardingAutoReplySent: true,
      }));
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [thread?.id, thread?.onboardingAutoReplySent]);

  if (!thread) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#F7FAFF] p-6 text-center">
        <div className="rounded-3xl border border-[#E5E9F2] bg-white p-8 shadow-sm">
          <h1 className="text-2xl text-[#172033]" style={{ fontWeight: 900 }}>Verification chat not found</h1>
          <button onClick={() => navigate('/subscription/register')} className="mt-5 rounded-full bg-[#0B5CFF] px-6 py-3 text-white">
            Go to registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[linear-gradient(135deg,#FFFFFF,#F4F8FF)] text-[#172033]">
      <header className="shrink-0 border-b border-[#E5E9F2] bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[#0B5CFF] hover:bg-[#E8F1FF]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[#172033]" style={{ fontWeight: 900 }}>Payment Verification Chat</p>
            <p className="truncate text-xs text-[#6B7280]">{thread.hostName} - {thread.packageName}</p>
          </div>

          <span className={`hidden rounded-full border px-3 py-1 text-xs sm:inline-flex ${formatStatusColor(thread.status)}`} style={{ fontWeight: 800 }}>
            {thread.status}
          </span>
        </div>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-4 p-3 lg:grid-cols-[320px_1fr] lg:p-6">
        <aside className="hidden min-h-0 rounded-[1.5rem] border border-[#D8E4FF] bg-white/80 p-5 shadow-sm backdrop-blur lg:block">
          <div className="rounded-3xl bg-[#F7FAFF] p-5">
            <ShieldCheck className="mb-4 h-8 w-8 text-[#0B5CFF]" />
            <p className="text-sm uppercase tracking-[0.16em] text-[#0B5CFF]" style={{ fontWeight: 900 }}>Verification status</p>
            <p className="mt-2 text-2xl text-[#172033]" style={{ fontWeight: 900 }}>{thread.status}</p>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              Upload your payment proof and keep this chat open for management updates.
            </p>
          </div>

          {thread.appointment && (
            <div className="mt-4 rounded-3xl border border-[#C7D7FE] bg-[#EEF4FF] p-5">
              <CalendarCheck className="mb-3 h-6 w-6 text-[#155EEF]" />
              <p className="text-sm text-[#155EEF]" style={{ fontWeight: 900 }}>Appointment</p>
              <p className="mt-2 text-sm leading-6 text-[#172033]">{thread.appointment}</p>
            </div>
          )}
        </aside>

        <section className="min-h-0">
          <VerificationChatPanel threadId={thread.id} viewer="user" />
        </section>
      </main>
    </div>
  );
}
