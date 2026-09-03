import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquareText, Search, Trash2, UserRound, X } from 'lucide-react';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';
import { VERIFICATION_EVENT_NAME, deleteThread, formatStatusColor, readThreads, refreshThreadsFromRemote, VerificationThread } from '../data/verificationChat';
import { useLocalization } from '../context/LocalizationContext';

export function AdminSubscribersScreen() {
  const { formatDate } = useLocalization();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [selectedSubscriber, setSelectedSubscriber] = useState<VerificationThread | null>(null);
  const [threads, setThreads] = useState<VerificationThread[]>(() => readThreads());

  useEffect(() => {
    const refreshThreads = () => setThreads(readThreads());
    window.addEventListener(VERIFICATION_EVENT_NAME, refreshThreads);
    let channel: BroadcastChannel | null = null;

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(VERIFICATION_EVENT_NAME);
      channel.onmessage = refreshThreads;
    }

    const refreshFromRemote = () => refreshThreadsFromRemote().then(setThreads);
    const intervalId = window.setInterval(refreshFromRemote, 10000);

    refreshFromRemote();
    refreshThreads();

    return () => {
      window.removeEventListener(VERIFICATION_EVENT_NAME, refreshThreads);
      channel?.close();
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredThreads = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return threads;
    }

    return threads.filter((thread) => (
      thread.fullName.toLowerCase().includes(query)
      || thread.email.toLowerCase().includes(query)
      || thread.hostName.toLowerCase().includes(query)
      || thread.packageName.toLowerCase().includes(query)
      || thread.status.toLowerCase().includes(query)
    ));
  }, [searchValue, threads]);

  const handleDeleteSubscriber = async (subscriber: VerificationThread) => {
    const shouldDelete = window.confirm(`Delete ${subscriber.fullName} and their verification chat history?`);

    if (!shouldDelete) {
      return;
    }

    try {
      setThreads(await deleteThread(subscriber.id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete subscriber.');
    }

    if (selectedSubscriber?.id === subscriber.id) {
      setSelectedSubscriber(null);
    }
  };

  return (
    <div className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-[#F7F9FC]">
      <div className="sticky top-0 z-20 shrink-0 bg-white">
        <WorkspaceTopBar />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <button onClick={() => navigate('/admin/chats')} className="mb-6 inline-flex items-center gap-2 text-sm text-[#0B5CFF] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to support chats
          </button>

          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 900 }}>Subscribers</p>
              <h1 className="mt-1 text-3xl text-[#172033]" style={{ fontWeight: 900 }}>All registered subscribers</h1>
              <p className="mt-2 text-sm text-[#6B7280]">View every subscriber who has entered the verification chat flow.</p>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search subscribers..."
                className="w-full rounded-2xl border border-[#E5E9F2] bg-white py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredThreads.map((thread) => (
              <article
                key={thread.id}
                className="rounded-[1.5rem] border border-[#E5E9F2] bg-white p-5 text-left shadow-sm transition-colors hover:bg-[#F7FAFF]"
              >
                <button
                  type="button"
                  onClick={() => setSelectedSubscriber(thread)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8F1FF]">
                      <UserRound className="h-6 w-6 text-[#0B5CFF]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[#172033]" style={{ fontWeight: 900 }}>{thread.fullName}</p>
                      <p className="truncate text-sm text-[#6B7280]">{thread.email}</p>
                      <p className="mt-2 text-sm text-[#6B7280]">{thread.packageName} - {thread.packagePrice}</p>
                    </div>
                  </div>
                </button>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`rounded-full border px-3 py-1 text-xs ${formatStatusColor(thread.status)}`} style={{ fontWeight: 800 }}>{thread.status}</span>
                    <span className="ml-2 text-xs text-[#8A94A6]">{formatDate(thread.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSubscriber(thread)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#FEE4E2] bg-white px-3 py-1.5 text-xs text-[#B42318] hover:bg-[#FFF5F4]"
                    style={{ fontWeight: 800 }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>

      {selectedSubscriber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 900 }}>Subscriber profile</p>
                <h2 className="mt-1 text-2xl text-[#172033]" style={{ fontWeight: 900 }}>{selectedSubscriber.fullName}</h2>
              </div>
              <button onClick={() => setSelectedSubscriber(null)} className="rounded-full p-2 text-[#6B7280] hover:bg-[#F7F9FC]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['Username/Nickname', selectedSubscriber.username],
                ['Country/Location', selectedSubscriber.country],
                ['Date of Birth', selectedSubscriber.dateOfBirth],
                ['Email Address', selectedSubscriber.email],
                ['Phone Number', selectedSubscriber.phone || 'Not added'],
                ['Gender', selectedSubscriber.gender || 'Not added'],
                ['Selected Package', `${selectedSubscriber.packageName} - ${selectedSubscriber.packagePrice}`],
                ['Host Client', selectedSubscriber.hostName],
                ['Status', selectedSubscriber.status],
                ['Appointment', selectedSubscriber.appointment || 'Not scheduled'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#E5E9F2] bg-[#F7F9FC] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
                  <p className="mt-2 break-words text-sm text-[#172033]" style={{ fontWeight: 800 }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate(`/admin/chats/${selectedSubscriber.id}`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0B5CFF] px-5 py-3 text-white"
              >
                <MessageSquareText className="h-5 w-5" />
                Open support chats
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSubscriber(selectedSubscriber)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#FEE4E2] bg-white px-5 py-3 text-[#B42318] hover:bg-[#FFF5F4]"
                style={{ fontWeight: 800 }}
              >
                <Trash2 className="h-5 w-5" />
                Delete subscriber
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
