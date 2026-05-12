import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Images,
  MessageSquareText,
  Search,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  UsersRound,
} from 'lucide-react';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';
import { VerificationChatPanel } from './verification/VerificationChatPanel';
import {
  VERIFICATION_EVENT_NAME,
  VerificationStatus,
  VerificationThread,
  addMessage,
  formatStatusColor,
  markThreadSeen,
  readThreads,
  refreshThreadsFromRemote,
  updateThread,
} from '../data/verificationChat';

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function latestMessage(thread: VerificationThread) {
  const message = thread.messages[thread.messages.length - 1];

  if (!message) {
    return 'No messages yet';
  }

  if (message.text) {
    return message.text;
  }

  return message.attachments[0]?.name || 'Attachment';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AdminVerificationChatsScreen() {
  const navigate = useNavigate();
  const { threadId = '' } = useParams();
  const [threads, setThreads] = useState<VerificationThread[]>(() => readThreads());
  const [searchValue, setSearchValue] = useState('');
  const [appointmentValue, setAppointmentValue] = useState('');

  useEffect(() => {
    const refreshThreads = () => setThreads(readThreads());
    window.addEventListener(VERIFICATION_EVENT_NAME, refreshThreads);
    let channel: BroadcastChannel | null = null;

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(VERIFICATION_EVENT_NAME);
      channel.onmessage = refreshThreads;
    }

    const refreshFromRemote = () => refreshThreadsFromRemote().then(setThreads);
    const intervalId = window.setInterval(refreshFromRemote, 8000);

    refreshFromRemote();
    refreshThreads();

    return () => {
      window.removeEventListener(VERIFICATION_EVENT_NAME, refreshThreads);
      channel?.close();
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setAppointmentValue('');
  }, [threadId]);

  const filteredThreads = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return threads;
    }

    return threads.filter((thread) => (
      thread.fullName.toLowerCase().includes(query)
      || thread.email.toLowerCase().includes(query)
      || thread.packageName.toLowerCase().includes(query)
      || thread.packagePrice.toLowerCase().includes(query)
      || thread.hostName.toLowerCase().includes(query)
      || thread.status.toLowerCase().includes(query)
    ));
  }, [searchValue, threads]);

  const activeThread = threadId ? threads.find((thread) => thread.id === threadId) || null : null;

  const openThread = (thread: VerificationThread) => {
    markThreadSeen(thread.id, 'admin');
    navigate(`/admin/chats/${thread.id}`);
  };

  const setStatus = (status: VerificationStatus, message: string) => {
    if (!activeThread) {
      return;
    }

    updateThread(activeThread.id, (thread) => ({ ...thread, status }));
    addMessage(activeThread.id, 'admin', message);
  };

  const scheduleAppointment = () => {
    if (!activeThread || !appointmentValue.trim()) {
      return;
    }

    updateThread(activeThread.id, (thread) => ({
      ...thread,
      status: 'Appointment Scheduled',
      appointment: appointmentValue.trim(),
    }));
    addMessage(activeThread.id, 'admin', `Your appointment has been scheduled: ${appointmentValue.trim()}`);
    setAppointmentValue('');
  };

  if (threadId) {
    if (!activeThread) {
      return (
        <div className="flex h-dvh min-w-0 flex-1 items-center justify-center bg-[#F7FAFF] p-6 text-center">
          <div className="rounded-3xl border border-[#E5E9F2] bg-white p-8 shadow-sm">
            <h1 className="text-2xl text-[#172033]" style={{ fontWeight: 900 }}>Verification chat not found</h1>
            <button onClick={() => navigate('/admin/chats')} className="mt-5 rounded-full bg-[#0B5CFF] px-6 py-3 text-white">
              Back to conversations
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(135deg,#FFFFFF,#F4F8FF)] text-[#172033]">
        <header className="shrink-0 border-b border-[#E5E9F2] bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin/chats')}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[#0B5CFF] hover:bg-[#E8F1FF]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[#172033]" style={{ fontWeight: 900 }}>Payment Verification Chat</p>
              <p className="truncate text-xs text-[#6B7280]">{activeThread.fullName} - {activeThread.packageName}</p>
            </div>

            <span className={`hidden rounded-full border px-3 py-1 text-xs sm:inline-flex ${formatStatusColor(activeThread.status)}`} style={{ fontWeight: 800 }}>
              {activeThread.status}
            </span>
          </div>
        </header>

        <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-4 p-3 lg:grid-cols-[320px_1fr] lg:p-6">
          <aside className="hidden min-h-0 overflow-y-auto rounded-[1.5rem] border border-[#D8E4FF] bg-white/80 p-5 shadow-sm backdrop-blur lg:block">
            <div className="rounded-3xl bg-[#F7FAFF] p-5">
              <ShieldCheck className="mb-4 h-8 w-8 text-[#0B5CFF]" />
              <p className="text-sm uppercase tracking-[0.16em] text-[#0B5CFF]" style={{ fontWeight: 900 }}>Verification status</p>
              <p className="mt-2 text-2xl text-[#172033]" style={{ fontWeight: 900 }}>{activeThread.status}</p>
              <p className="mt-3 text-sm leading-6 text-[#6B7280]">{activeThread.packageName} - {activeThread.packagePrice}</p>
              <p className="mt-1 truncate text-sm text-[#6B7280]">{activeThread.email}</p>
            </div>

            <div className="mt-4 rounded-3xl border border-[#E5E9F2] bg-white p-4">
              <p className="text-sm text-[#172033]" style={{ fontWeight: 900 }}>Management actions</p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('Verified', 'Payment approved. Your subscription has been verified by management.')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#12A150] px-4 py-3 text-sm text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Rejected', 'Payment could not be verified. Please contact management or submit a corrected proof.')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#B42318] px-4 py-3 text-sm text-white"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Pending Verification', 'Please upload another payment proof so management can continue verification.')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D8E4FF] bg-white px-4 py-3 text-sm text-[#0B5CFF]"
                >
                  <UploadCloud className="h-4 w-4" />
                  Request Proof
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-[#C7D7FE] bg-[#EEF4FF] p-5">
              <CalendarClock className="mb-3 h-6 w-6 text-[#155EEF]" />
              <p className="text-sm text-[#155EEF]" style={{ fontWeight: 900 }}>Schedule appointment</p>
              <input
                value={appointmentValue}
                onChange={(event) => setAppointmentValue(event.target.value)}
                placeholder="Date, time, or schedule note"
                className="mt-3 w-full rounded-2xl border border-[#C7D7FE] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
              />
              <button
                type="button"
                onClick={scheduleAppointment}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B5CFF] px-4 py-3 text-sm text-white"
              >
                <CalendarCheck className="h-4 w-4" />
                Schedule
              </button>
            </div>

            {activeThread.appointment && (
              <div className="mt-4 rounded-3xl border border-[#C7D7FE] bg-white p-5">
                <CalendarCheck className="mb-3 h-6 w-6 text-[#155EEF]" />
                <p className="text-sm text-[#155EEF]" style={{ fontWeight: 900 }}>Current appointment</p>
                <p className="mt-2 text-sm leading-6 text-[#172033]">{activeThread.appointment}</p>
              </div>
            )}
          </aside>

          <section className="min-h-0">
            <VerificationChatPanel threadId={activeThread.id} viewer="admin" />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-[#F7F9FC]">
      <div className="sticky top-0 z-20 shrink-0 bg-white">
        <WorkspaceTopBar
          leadingContent={(
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 rounded-full border border-[#D8E4FF] bg-[#F7FAFF] px-4 py-2.5 text-sm text-[#0B5CFF] hover:bg-[#E8F1FF]"
              style={{ fontWeight: 900 }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </button>
          )}
        />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 900 }}>Verification chats</p>
              <h1 className="mt-1 text-3xl text-[#172033]" style={{ fontWeight: 900 }}>Subscriber conversations</h1>
              <p className="mt-2 text-sm text-[#6B7280]">All saved subscriber verification threads.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/admin/subscribers')}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#D8E4FF] bg-white px-4 py-3 text-sm text-[#172033] hover:bg-[#E8F1FF]"
              >
                <UsersRound className="h-4 w-4 text-[#0B5CFF]" />
                All subscribers
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/media')}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#D8E4FF] bg-white px-4 py-3 text-sm text-[#172033] hover:bg-[#E8F1FF]"
              >
                <Images className="h-4 w-4 text-[#0B5CFF]" />
                Media gallery
              </button>
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-2xl border border-[#E5E9F2] bg-white py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
              />
            </div>
            <p className="text-sm text-[#6B7280]">
              {filteredThreads.length} conversation{filteredThreads.length === 1 ? '' : 's'}
            </p>
          </div>

          {filteredThreads.length === 0 ? (
            <div className="rounded-[1.5rem] border border-[#E5E9F2] bg-white p-8 text-center text-sm text-[#6B7280] shadow-sm">
              No verification conversations found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => openThread(thread)}
                  className="w-full rounded-[1.5rem] border border-[#E5E9F2] bg-white p-4 text-left shadow-sm transition-colors hover:border-[#D8E4FF] hover:bg-[#F7FAFF]"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B5CFF] text-sm text-white" style={{ fontWeight: 900 }}>
                      {getInitials(thread.fullName)}
                      {thread.unreadForAdmin > 0 && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#D92D20]" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[#172033]" style={{ fontWeight: 900 }}>{thread.fullName}</p>
                          <p className="truncate text-xs text-[#6B7280]">{thread.email}</p>
                        </div>
                        <span className="shrink-0 text-xs text-[#8A94A6]">{formatTime(thread.updatedAt)}</span>
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm text-[#6B7280]">{latestMessage(thread)}</p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] ${formatStatusColor(thread.status)}`} style={{ fontWeight: 800 }}>
                          {thread.status}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
                          <MessageSquareText className="h-3.5 w-3.5" />
                          {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
