import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, ShieldCheck } from 'lucide-react';
import { VerificationChatPanel } from './verification/VerificationChatPanel';
import { formatStatusColor, VerificationThread } from '../data/verificationChat';
import { resolveGuestToken } from '../data/guestSession';
import { loadGuestThread, sendGuestOnboardingReply, type GuestThread } from '../data/guestChat';

/**
 * The customer's booking conversation.
 *
 * Access is authorised by a guest token, never by knowing the thread ID. The
 * token arrives either from this browser's own booking or from a link in an
 * email, and it authorises exactly this one conversation.
 */
export function UserVerificationChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { threadId = '' } = useParams();
  const [guestToken] = useState(() => resolveGuestToken(threadId, location.search));
  const [thread, setThread] = useState<GuestThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessError, setAccessError] = useState('');

  // The token is saved to this browser on arrival, so leaving it in the address
  // bar only risks it being copied out of history or a screenshot.
  useEffect(() => {
    if (!new URLSearchParams(location.search).get('access')) {
      return;
    }

    window.history.replaceState({}, '', `/verification-chat/${threadId}`);
  }, [location.search, threadId]);

  useEffect(() => {
    if (!guestToken) {
      setIsLoading(false);
      setAccessError('This chat link is missing or has expired.');
      return;
    }

    let active = true;

    loadGuestThread(guestToken)
      .then((loaded) => {
        if (!active) return;
        setThread(loaded);
        setAccessError('');
      })
      .catch((error) => {
        if (!active) return;
        setAccessError(error instanceof Error ? error.message : 'This chat link is no longer valid.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [guestToken]);

  // The onboarding reply is written by the server under a conditional update, so
  // two open tabs produce one reply rather than two, and it is flagged not to
  // email the customer who is already reading the chat.
  useEffect(() => {
    if (!thread || thread.onboardingAutoReplySent || !guestToken) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      sendGuestOnboardingReply(guestToken)
        .then(() => loadGuestThread(guestToken))
        .then(setThread)
        .catch(() => undefined);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [thread?.id, thread?.onboardingAutoReplySent, guestToken]);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#F7FAFF] p-6 text-center">
        <p className="text-sm text-[#6B7280]">Opening your conversation...</p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#F7FAFF] p-6 text-center">
        <div className="max-w-md rounded-3xl border border-[#E5E9F2] bg-white p-8 shadow-sm">
          <h1 className="text-2xl text-[#172033]" style={{ fontWeight: 900 }}>Chat link not valid</h1>
          <p className="mt-3 text-sm leading-6 text-[#6B7280]">
            {accessError || 'This conversation could not be opened.'} Chat links are private and expire, so ask us to
            email you a fresh one.
          </p>
          <button
            onClick={() => navigate('/subscription/register?focus=returning')}
            className="mt-5 rounded-full bg-[#0B5CFF] px-6 py-3 text-white"
            style={{ fontWeight: 800 }}
          >
            Email me a new link
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
        <aside className="hidden min-h-0 overflow-y-auto rounded-[1.5rem] border border-[#D8E4FF] bg-white/80 p-5 shadow-sm backdrop-blur lg:block">
          <div className="rounded-3xl bg-[#F7FAFF] p-5">
            <ShieldCheck className="mb-4 h-8 w-8 text-[#0B5CFF]" />
            <p className="text-sm uppercase tracking-[0.16em] text-[#0B5CFF]" style={{ fontWeight: 900 }}>Verification status</p>
            <p className="mt-2 text-2xl text-[#172033]" style={{ fontWeight: 900 }}>{thread.status}</p>
            {thread.bookingReference && (
              <p className="mt-3 text-sm text-[#6B7280]">
                Reference <span className="text-[#172033]" style={{ fontWeight: 800 }}>{thread.bookingReference}</span>
              </p>
            )}
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              Upload your payment proof and keep this chat open for management updates.
            </p>
          </div>

          {thread.appointment && (
            <div className="mt-4 rounded-3xl border border-[#C7D7FE] bg-[#EEF4FF] p-5">
              <CalendarCheck className="mb-3 h-6 w-6 text-[#155EEF]" />
              <p className="text-sm text-[#155EEF]" style={{ fontWeight: 900 }}>Appointment</p>
              <p className="mt-2 text-sm leading-6 text-[#172033]">{thread.appointment}</p>
              {thread.appointmentTimezone && (
                <p className="mt-1 text-xs text-[#155EEF]">Timezone: {thread.appointmentTimezone}</p>
              )}
            </div>
          )}
        </aside>

        <section className="min-h-0">
          <VerificationChatPanel
            threadId={thread.id}
            viewer="user"
            guestToken={guestToken}
            onGuestThreadLoaded={(next) => setThread(next as VerificationThread as GuestThread)}
          />
        </section>
      </main>
    </div>
  );
}
