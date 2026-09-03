import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ArrowLeft, Copy, ImageUp, Link, MailCheck, MessageSquareText, Plus, Settings, Trash2, UserRound, UsersRound, Video, X } from 'lucide-react';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';
import { VERIFICATION_EVENT_NAME, deleteThread, formatStatusColor, readThreads, refreshThreadsFromRemote, VerificationThread } from '../data/verificationChat';
import {
  CLIENTS_EVENT_NAME,
  ClientProfile,
  avatarColors,
  createClientId,
  getInitials,
  readClients,
  refreshClientProfilesFromRemote,
  saveClientProfiles,
  deleteClientProfile,
} from '../data/clientProfiles';
import { SUPABASE_SYNC_ERROR_EVENT_NAME, SupabaseSyncErrorDetail } from '../data/syncStatus';

function buildMeetingLink(client: ClientProfile) {
  const token = createClientId();
  const params = new URLSearchParams({
    clientId: client.id,
    clientName: client.name,
    hostName: client.name,
    hostAvatar: client.avatarColor,
    hostInitials: getInitials(client.name),
    hostHasAvatarImage: client.avatarImage ? 'true' : 'false',
  });

  return `${window.location.origin}/call/${encodeURIComponent(token)}?${params.toString()}`;
}

export function AdminDashboardScreen() {
  const navigate = useNavigate();
  const { isAdminAuthenticated } = useAdminAuth();
  const { clientId } = useParams();
  const [clients, setClients] = useState<ClientProfile[]>(() => readClients());
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientCategory, setClientCategory] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [selectedMeetingClientId, setSelectedMeetingClientId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [selectedSubscriber, setSelectedSubscriber] = useState<VerificationThread | null>(null);
  const [threads, setThreads] = useState<VerificationThread[]>(() => readThreads());
  const [syncError, setSyncError] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('');

  const activeClient = useMemo(
    () => clients.find((client) => client.id === clientId) || null,
    [clientId, clients]
  );

  const selectedMeetingClient = useMemo(
    () => clients.find((client) => client.id === selectedMeetingClientId) || null,
    [clients, selectedMeetingClientId]
  );

  const activeClientSubscribers = useMemo(
    () => activeClient ? threads.filter((thread) => thread.clientId === activeClient.id) : [],
    [activeClient, threads]
  );

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

  useEffect(() => {
    const handleSyncError = (event: Event) => {
      const detail = (event as CustomEvent<SupabaseSyncErrorDetail>).detail;
      setSyncError(`Saved in this browser, but Supabase did not save ${detail.area}: ${detail.message}`);
    };

    window.addEventListener(SUPABASE_SYNC_ERROR_EVENT_NAME, handleSyncError);
    return () => window.removeEventListener(SUPABASE_SYNC_ERROR_EVENT_NAME, handleSyncError);
  }, []);

  useEffect(() => {
    const refreshClients = () => setClients(readClients());
    window.addEventListener(CLIENTS_EVENT_NAME, refreshClients);
    let channel: BroadcastChannel | null = null;

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(CLIENTS_EVENT_NAME);
      channel.onmessage = refreshClients;
    }

    const refreshClientsFromRemote = () => refreshClientProfilesFromRemote().then(setClients);
    const intervalId = window.setInterval(refreshClientsFromRemote, 12000);

    refreshClientsFromRemote();

    return () => {
      window.removeEventListener(CLIENTS_EVENT_NAME, refreshClients);
      channel?.close();
      window.clearInterval(intervalId);
    };
  }, []);

  const persistClients = async (nextClients: ClientProfile[]) => {
    await saveClientProfiles(nextClients);
    setClients(nextClients);
  };

  const resetGeneratedLink = () => {
    setGeneratedLink('');
    setCopyLabel('Copy');
  };

  const handleCreateClient = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = clientName.trim();

    if (!trimmedName) {
      return;
    }

    const now = new Date().toISOString();
    const nextClient: ClientProfile = {
      id: createClientId(),
      name: trimmedName,
      category: clientCategory.trim() || 'Client',
      email: clientEmail.trim(),
      avatarColor: avatarColors[clients.length % avatarColors.length],
      createdAt: now,
      updatedAt: now,
    };

    try {
      await persistClients([nextClient, ...clients]);
    } catch (error) {
      setDeleteStatus(error instanceof Error ? error.message : 'Unable to save this client.');
      return;
    }
    setSelectedMeetingClientId(nextClient.id);
    setClientName('');
    setClientCategory('');
    setClientEmail('');
    setIsClientModalOpen(false);
    resetGeneratedLink();
    navigate(`/admin/clients/${nextClient.id}`);
  };

  const openAddClient = () => {
    setIsActionMenuOpen(false);
    setIsClientModalOpen(true);
  };

  const openCreateMeeting = () => {
    setIsActionMenuOpen(false);
    setSelectedMeetingClientId(activeClient?.id || clients[0]?.id || '');
    resetGeneratedLink();
    setIsMeetingModalOpen(true);
  };

  const handleGenerateLink = (client: ClientProfile | null) => {
    if (!client) {
      return;
    }

    setGeneratedLink(buildMeetingLink(client));
    setCopyLabel('Copy');
  };

  const handleCopy = async () => {
    if (!generatedLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopyLabel('Copied');
    } catch {
      setCopyLabel('Copy failed');
    }
  };

  const handleClientAvatarUpload = (client: ClientProfile, file: File | null | undefined) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }

      persistClients(clients.map((currentClient) => (
        currentClient.id === client.id
          ? { ...currentClient, avatarImage: reader.result as string, updatedAt: new Date().toISOString() }
          : currentClient
      ))).catch((error) => setDeleteStatus(error instanceof Error ? error.message : 'Unable to save client image.'));
    };

    reader.readAsDataURL(file);
  };

  const removeClientAvatarImage = (client: ClientProfile) => {
    persistClients(clients.map((currentClient) => (
      currentClient.id === client.id
        ? { ...currentClient, avatarImage: undefined, updatedAt: new Date().toISOString() }
        : currentClient
    ))).catch((error) => setDeleteStatus(error instanceof Error ? error.message : 'Unable to save client image.'));
  };

  const handleDeleteSubscriber = async (subscriber: VerificationThread) => {
    const shouldDelete = window.confirm(`Delete ${subscriber.fullName} and their verification chat history?`);

    if (!shouldDelete) {
      return;
    }

    try {
      const nextThreads = await deleteThread(subscriber.id);
      setThreads(nextThreads);
      setSelectedSubscriber(null);
    } catch (error) {
      setDeleteStatus(error instanceof Error ? error.message : 'Unable to delete subscriber.');
    }
  };

  const handleDeleteClient = async (client: ClientProfile) => {
    if (!isAdminAuthenticated) {
      setDeleteStatus('Administrator authentication is required to delete a client.');
      return;
    }
    if (!window.confirm(`Delete Client?\n\nThis action cannot be undone.\n\nDelete ${client.name} and all related client data?`)) return;
    try {
      await deleteClientProfile(client.id);
      setClients(readClients());
      setDeleteStatus(`${client.name} was deleted successfully.`);
      navigate('/admin');
    } catch (error) {
      setDeleteStatus(error instanceof Error ? error.message : 'Unable to delete this client.');
    }
  };

  const actionMenu = (
    <>
      {isActionMenuOpen && (
        <div className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-[#E5E9F2] bg-white p-2 shadow-2xl lg:left-auto lg:right-8 lg:bottom-24 lg:w-72 lg:translate-x-0">
          <button
            type="button"
            onClick={openCreateMeeting}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-[#F7F9FC]"
          >
            <Video className="w-5 h-5 text-[#0B5CFF]" />
            <span className="text-[#1F2937]">Create meeting</span>
          </button>
          <button
            type="button"
            onClick={openAddClient}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-[#F7F9FC]"
          >
            <UserRound className="w-5 h-5 text-[#0B5CFF]" />
            <span className="text-[#1F2937]">Add client profile</span>
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5E9F2] bg-white px-6 py-3 lg:hidden">
        <div className="relative mx-auto flex max-w-md items-center justify-center">
          <button
            type="button"
            onClick={() => setIsActionMenuOpen((isOpen) => !isOpen)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0B5CFF] text-white shadow-xl"
            aria-label="Admin actions"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsActionMenuOpen((isOpen) => !isOpen)}
        className="fixed bottom-8 right-8 z-30 hidden h-14 w-14 items-center justify-center rounded-full bg-[#0B5CFF] text-white shadow-2xl hover:bg-[#0056D2] lg:flex"
        aria-label="Admin actions"
      >
        <Plus className="w-7 h-7" />
      </button>
    </>
  );

  const addClientModal = isClientModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <form onSubmit={handleCreateClient} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl text-[#1F2937]" style={{ fontWeight: 600 }}>Add client profile</h2>
            <p className="text-sm text-[#6B7280]">This client can be selected as the meeting host.</p>
          </div>
          <button type="button" onClick={() => setIsClientModalOpen(false)} className="text-[#6B7280]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Client name"
            className="w-full rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
          />
          <input
            value={clientCategory}
            onChange={(event) => setClientCategory(event.target.value)}
            placeholder="Category or title"
            className="w-full rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
          />
          <input
            type="email"
            value={clientEmail}
            onChange={(event) => setClientEmail(event.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
          />
          <button type="submit" className="w-full rounded-xl bg-[#0B5CFF] px-5 py-3 text-white hover:bg-[#0056D2]">
            Save client
          </button>
        </div>
      </form>
    </div>
  );

  const createMeetingModal = isMeetingModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl text-[#1F2937]" style={{ fontWeight: 600 }}>Create meeting link</h2>
            <p className="text-sm text-[#6B7280]">Select the client hosting this meeting, or create a new client profile first.</p>
          </div>
          <button type="button" onClick={() => setIsMeetingModalOpen(false)} className="text-[#6B7280]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-2xl bg-[#F7F9FC] p-6 text-center">
            <UsersRound className="mx-auto mb-3 h-9 w-9 text-[#0B5CFF]" />
            <h3 className="text-[#1F2937]" style={{ fontWeight: 600 }}>No clients yet</h3>
            <p className="mt-2 text-sm text-[#6B7280]">Add a client profile before generating a meeting link.</p>
            <button
              type="button"
              onClick={() => {
                setIsMeetingModalOpen(false);
                setIsClientModalOpen(true);
              }}
              className="mt-5 rounded-xl bg-[#0B5CFF] px-5 py-3 text-white hover:bg-[#0056D2]"
            >
              Add client profile
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <select
              value={selectedMeetingClientId}
              onChange={(event) => {
                setSelectedMeetingClientId(event.target.value);
                resetGeneratedLink();
              }}
              className="w-full rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 text-[#1F2937] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleGenerateLink(selectedMeetingClient)}
              className="w-full rounded-xl bg-[#0B5CFF] px-5 py-3 text-white hover:bg-[#0056D2]"
            >
              Generate link
            </button>

            {generatedLink && (
              <div className="rounded-2xl bg-[#F7F9FC] p-4">
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-[#E5E9F2] bg-white p-3">
                  <Link className="mt-0.5 h-5 w-5 shrink-0 text-[#0B5CFF]" />
                  <p className="break-all text-sm text-[#1F2937]">{generatedLink}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B5CFF] px-5 py-3 text-white hover:bg-[#0056D2]"
                >
                  <Copy className="w-4 h-4" />
                  {copyLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const clientDetailPage = activeClient && (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => navigate('/admin')}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#0B5CFF] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to admin
      </button>

      <div className="rounded-2xl border border-[#E5E9F2] bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-6 border-b border-[#E5E9F2] pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-white"
              style={{ backgroundColor: activeClient.avatarColor }}
            >
              {activeClient.avatarImage ? (
                <img src={activeClient.avatarImage} alt={activeClient.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl" style={{ fontWeight: 700 }}>{getInitials(activeClient.name)}</span>
              )}
            </div>
            <div>
              <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 600 }}>Client profile</p>
              <h1 className="text-3xl text-[#1F2937]" style={{ fontWeight: 600 }}>{activeClient.name}</h1>
              <p className="text-sm text-[#6B7280]">{activeClient.category}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedMeetingClientId(activeClient.id);
                resetGeneratedLink();
                setIsMeetingModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B5CFF] px-5 py-3 text-white hover:bg-[#0056D2]"
            >
              <Video className="h-5 w-5" />
              Generate meeting link
            </button>
            <button
              type="button"
              onClick={() => handleDeleteClient(activeClient)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FEE4E2] bg-white px-5 py-3 text-[#B42318] hover:bg-[#FFF5F4]"
            >
              <Trash2 className="h-5 w-5" />
              Delete client
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-[#F7F9FC] p-6">
            <h2 className="mb-4 text-lg text-[#1F2937]" style={{ fontWeight: 600 }}>Client details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[#6B7280]">Name</span>
                <span className="text-right text-[#1F2937]">{activeClient.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B7280]">Category</span>
                <span className="text-right text-[#1F2937]">{activeClient.category}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B7280]">Email</span>
                <span className="text-right text-[#1F2937]">{activeClient.email || 'Not added'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F7F9FC] p-6">
            <h2 className="mb-4 text-lg text-[#1F2937]" style={{ fontWeight: 600 }}>Meeting link flow</h2>
            <p className="text-sm leading-relaxed text-[#6B7280]">
              Generate a link from this client page to show invitees that they are joining a meeting with {activeClient.name}. If they do not have the meeting ID, the join page can send them to the host-tailored subscription package page.
            </p>
          </div>

          <div className="rounded-2xl bg-[#F7F9FC] p-6 md:col-span-2">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg text-[#1F2937]" style={{ fontWeight: 600 }}>Client avatar image</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6B7280]">
                  Upload the client image used as the cinematic background on the subscription package page.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <input
                  id={`client-avatar-${activeClient.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleClientAvatarUpload(activeClient, event.target.files?.[0])}
                />
                <label
                  htmlFor={`client-avatar-${activeClient.id}`}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0B5CFF] px-5 py-3 text-white hover:bg-[#0056D2]"
                >
                  <ImageUp className="h-5 w-5" />
                  Upload image
                </label>
                {activeClient.avatarImage && (
                  <button
                    type="button"
                    onClick={() => removeClientAvatarImage(activeClient)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FEE4E2] bg-white px-5 py-3 text-[#B42318] hover:bg-[#FFF5F4]"
                  >
                    <Trash2 className="h-5 w-5" />
                    Remove image
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[#E5E9F2] bg-white p-4">
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-white"
                style={{ backgroundColor: activeClient.avatarColor }}
              >
                {activeClient.avatarImage ? (
                  <img src={activeClient.avatarImage} alt={activeClient.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl" style={{ fontWeight: 700 }}>{getInitials(activeClient.name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-[#1F2937]" style={{ fontWeight: 600 }}>
                  {activeClient.avatarImage ? 'Image ready for package page hero' : 'No image uploaded yet'}
                </p>
                <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                  The generated meeting link keeps this client connected to the subscription package experience.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F7F9FC] p-6 md:col-span-2">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg text-[#1F2937]" style={{ fontWeight: 600 }}>Registered subscribers</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
                  Subscribers registered through {activeClient.name}'s meeting link.
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#E8F1FF] px-3 py-1 text-sm text-[#0B5CFF]" style={{ fontWeight: 800 }}>
                {activeClientSubscribers.length} subscriber{activeClientSubscribers.length === 1 ? '' : 's'}
              </span>
            </div>

            {activeClientSubscribers.length === 0 ? (
              <div className="rounded-2xl border border-[#E5E9F2] bg-white p-6 text-center text-sm text-[#6B7280]">
                No subscribers have registered under this client yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {activeClientSubscribers.map((subscriber) => (
                  <button
                    key={subscriber.id}
                    type="button"
                    onClick={() => setSelectedSubscriber(subscriber)}
                    className="rounded-2xl border border-[#E5E9F2] bg-white p-4 text-left transition-colors hover:bg-[#F7FAFF]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[#172033]" style={{ fontWeight: 800 }}>{subscriber.fullName}</p>
                        <p className="truncate text-sm text-[#6B7280]">{subscriber.email}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${formatStatusColor(subscriber.status)}`} style={{ fontWeight: 800 }}>
                        {subscriber.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#6B7280]">{subscriber.packageName} - {subscriber.packagePrice}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const dashboardPage = (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 600 }}>Admin</p>
          <h1 className="mt-1 text-3xl text-[#1F2937]" style={{ fontWeight: 600 }}>Management dashboard</h1>
          <p className="mt-2 max-w-2xl text-[#6B7280]">
            Use the Management profile to organize clients and generate meeting links that clearly show who the meeting is with.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/settings')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D6DCE8] bg-white px-5 py-3 text-[#1F2937] shadow-sm hover:bg-[#F7F9FC]"
        >
          <Settings className="h-5 w-5 text-[#0B5CFF]" />
          Subscription settings
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/email')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D6DCE8] bg-white px-5 py-3 text-[#1F2937] shadow-sm hover:bg-[#F7F9FC]"
        >
          <MailCheck className="h-5 w-5 text-[#0B5CFF]" />
          Email delivery
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/chats')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B5CFF] px-5 py-3 text-white shadow-sm hover:bg-[#0056D2]"
        >
          <MessageSquareText className="h-5 w-5" />
          Verification chats
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-[#E5E9F2] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B5CFF] text-white">
              <UsersRound className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 600 }}>Only admin profile</p>
              <h2 className="text-xl text-[#1F2937]" style={{ fontWeight: 600 }}>Management profile</h2>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-[#6B7280]">
            This profile represents the person or team managing multiple clients. Add unlimited client profiles under this single management profile.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F7F9FC] p-4">
              <p className="text-2xl text-[#1F2937]" style={{ fontWeight: 600 }}>{clients.length}</p>
              <p className="text-xs text-[#6B7280]">Clients</p>
            </div>
            <div className="rounded-xl bg-[#F7F9FC] p-4">
              <p className="text-2xl text-[#1F2937]" style={{ fontWeight: 600 }}>1</p>
              <p className="text-xs text-[#6B7280]">Profile</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E5E9F2] bg-white p-4 shadow-sm lg:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl text-[#1F2937]" style={{ fontWeight: 600 }}>Client profiles</h2>
              <p className="text-sm text-[#6B7280]">Select a client to open their page and generate a meeting link.</p>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl bg-[#F7F9FC] p-8 text-center">
              <UserRound className="mb-4 h-10 w-10 text-[#0B5CFF]" />
              <h3 className="text-xl text-[#1F2937]" style={{ fontWeight: 600 }}>No clients yet</h3>
              <p className="mt-2 max-w-md text-sm text-[#6B7280]">Use the plus button to add your first client profile.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => navigate(`/admin/clients/${client.id}`)}
                  className="flex items-center gap-4 rounded-2xl border border-[#E5E9F2] bg-white p-4 text-left transition-colors hover:bg-[#F7F9FC]"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
                    style={{ backgroundColor: client.avatarColor }}
                  >
                    {client.avatarImage ? (
                      <img src={client.avatarImage} alt={client.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm" style={{ fontWeight: 700 }}>{getInitials(client.name)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[#1F2937]" style={{ fontWeight: 600 }}>{client.name}</p>
                    <p className="truncate text-sm text-[#6B7280]">{client.category}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );

  const subscriberDetailModal = selectedSubscriber && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 900 }}>Subscriber profile</p>
            <h2 className="mt-1 text-2xl text-[#172033]" style={{ fontWeight: 900 }}>{selectedSubscriber.fullName}</h2>
            <p className="mt-1 text-sm text-[#6B7280]">{selectedSubscriber.packageName} - {selectedSubscriber.packagePrice}</p>
          </div>
          <button type="button" onClick={() => setSelectedSubscriber(null)} className="rounded-full p-2 text-[#6B7280] hover:bg-[#F7F9FC]">
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
            ['Verification Status', selectedSubscriber.status],
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
  );

  return (
    <div className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-[#F7F9FC]">
      <div className="sticky top-0 z-20 shrink-0 bg-white">
        <WorkspaceTopBar />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-6 pb-28 lg:p-8 lg:pb-28">
        {syncError && (
          <div className="mx-auto mb-5 flex max-w-7xl items-start justify-between gap-4 rounded-2xl border border-[#F4D680] bg-[#FFF8E6] p-4 text-sm text-[#854D0E]">
            <p>{syncError}</p>
            <button type="button" onClick={() => setSyncError('')} className="shrink-0 rounded-full p-1 hover:bg-white/70" aria-label="Dismiss sync error">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {deleteStatus && (
          <div className="mx-auto mb-5 flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-[#BFE7D1] bg-[#EEFBF4] p-4 text-sm text-[#157347]">
            <p>{deleteStatus}</p>
            <button type="button" onClick={() => setDeleteStatus('')} className="rounded-full p-1 hover:bg-white/70" aria-label="Dismiss status"><X className="h-4 w-4" /></button>
          </div>
        )}
        {activeClient ? clientDetailPage : dashboardPage}
      </main>

      {actionMenu}
      {addClientModal}
      {createMeetingModal}
      {subscriberDetailModal}
    </div>
  );
}
