import { isBrowserOffline, isSupabaseConfigured, supabase } from '../lib/supabase';
import { reportSupabaseSyncError } from './syncStatus';
import { notifyAdmin } from './adminNotifications';

export type VerificationStatus =
  | 'Pending Verification'
  | 'Under Review'
  | 'Verified'
  | 'Rejected'
  | 'Appointment Scheduled';

export type ChatSender = 'user' | 'admin' | 'system';

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  paymentStatus?: 'Awaiting Approval' | 'Approved' | 'Declined';
  paymentStatusUpdatedAt?: string;
};

export type ChatReply = {
  messageId: string;
  sender: ChatSender;
  text: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  sender: ChatSender;
  text: string;
  createdAt: string;
  status: 'Sending' | 'Sent' | 'Delivered' | 'Seen';
  attachments: ChatAttachment[];
  replyTo?: ChatReply;
};

export type VerificationThread = {
  id: string;
  fullName: string;
  username: string;
  country: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  gender: string;
  packageId: string;
  packageName: string;
  packagePrice: string;
  hostName: string;
  hostAvatar: string;
  hostInitials: string;
  clientId: string;
  meetingLinkToken: string;
  status: VerificationStatus;
  appointment: string;
  createdAt: string;
  updatedAt: string;
  unreadForAdmin: number;
  unreadForUser: number;
  typingUser: boolean;
  typingAdmin: boolean;
  onboardingAutoReplySent?: boolean;
  messages: ChatMessage[];
};

export type RegistrationPayload = {
  fullName: string;
  username: string;
  country: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  gender: string;
  packageId: string;
  packageName: string;
  packagePrice: string;
  hostName: string;
  hostAvatar: string;
  hostInitials: string;
  clientId: string;
  meetingLinkToken?: string;
};

export type ThreadAccessContext = {
  clientId?: string;
  meetingLinkToken?: string;
  hostName?: string;
};

type VerificationThreadRow = {
  id: string;
  full_name: string;
  username: string;
  country: string;
  date_of_birth: string;
  email: string;
  phone: string;
  gender: string;
  package_id: string;
  package_name: string;
  package_price: string;
  host_name: string;
  host_avatar: string;
  host_initials: string;
  client_id: string | null;
  meeting_link_token?: string | null;
  status: VerificationStatus;
  appointment: string;
  unread_for_admin: number;
  unread_for_user: number;
  typing_user: boolean;
  typing_admin: boolean;
  onboarding_auto_reply_sent: boolean;
  created_at: string;
  updated_at: string;
};

type VerificationMessageRow = {
  id: string;
  thread_id: string;
  sender: ChatSender;
  text: string;
  status: ChatMessage['status'];
  reply_to: ChatReply | null;
  created_at: string;
};

type VerificationAttachmentRow = {
  id: string;
  message_id: string;
  thread_id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  payment_status: ChatAttachment['paymentStatus'] | null;
  payment_status_updated_at: string | null;
  created_at: string;
};

export const VERIFICATION_THREADS_KEY = 'celebrity-verification-threads-v1';
export const VERIFICATION_EVENT_NAME = 'celebrity-verification-chat-updated';
export const VERIFICATION_SESSION_KEY = 'celebrity-verification-session-v1';
export const MANAGEMENT_PAYMENT_WELCOME_MESSAGE =
  'Welcome. The management team will communicate the means of payment to you in a few minutes.';

const LEGACY_ADMIN_WELCOME_PATTERN = /^Welcome .+\. Thank you for registering for the .+ subscription\. Please upload your payment proof here, and management will verify it and guide you through scheduling your meeting appointment\.$/;
const LEGACY_PAYMENT_PROOF_SYSTEM_MESSAGE =
  'Payment proof submitted successfully. Please wait 20-40 minutes while our management team verifies your payment and schedules your appointment.';

let hasAttemptedThreadBackfill = false;

function createId(_prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeToken(value: string | undefined) {
  return (value || '').trim().toLowerCase();
}

function sessionKeyForContext(context?: ThreadAccessContext) {
  const meetingLinkToken = normalizeToken(context?.meetingLinkToken);

  if (meetingLinkToken) {
    return `${VERIFICATION_SESSION_KEY}:meeting:${meetingLinkToken}`;
  }

  const clientId = normalizeToken(context?.clientId);

  if (clientId) {
    return `${VERIFICATION_SESSION_KEY}:client:${clientId}`;
  }

  const hostName = normalizeToken(context?.hostName);

  if (hostName) {
    return `${VERIFICATION_SESSION_KEY}:host:${hostName}`;
  }

  return VERIFICATION_SESSION_KEY;
}

function contextFromThread(thread: Pick<VerificationThread, 'clientId' | 'meetingLinkToken' | 'hostName'>): ThreadAccessContext {
  return {
    clientId: thread.clientId,
    meetingLinkToken: thread.meetingLinkToken,
    hostName: thread.hostName,
  };
}

function threadMatchesContext(thread: VerificationThread | null, context?: ThreadAccessContext) {
  if (!thread) {
    return false;
  }

  const meetingLinkToken = normalizeToken(context?.meetingLinkToken);

  if (meetingLinkToken) {
    return normalizeToken(thread.meetingLinkToken) === meetingLinkToken;
  }

  const clientId = normalizeToken(context?.clientId);

  if (clientId) {
    return normalizeToken(thread.clientId) === clientId;
  }

  const hostName = normalizeToken(context?.hostName);

  if (hostName) {
    return normalizeToken(thread.hostName) === hostName;
  }

  return true;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function readThreads(): VerificationThread[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const threads = JSON.parse(window.localStorage.getItem(VERIFICATION_THREADS_KEY) || '[]') as VerificationThread[];

    return threads.map((thread) => {
      let hasOnboardingReply = false;

      const messages = thread.messages
        .filter((message) => !(message.sender === 'system' && message.text === LEGACY_PAYMENT_PROOF_SYSTEM_MESSAGE))
        .map((message) => {
          if (message.sender === 'admin' && LEGACY_ADMIN_WELCOME_PATTERN.test(message.text)) {
            hasOnboardingReply = true;
            return { ...message, text: MANAGEMENT_PAYMENT_WELCOME_MESSAGE };
          }

          if (message.sender === 'admin' && message.text === MANAGEMENT_PAYMENT_WELCOME_MESSAGE) {
            hasOnboardingReply = true;
          }

          return message;
        });

      return {
        ...thread,
        meetingLinkToken: thread.meetingLinkToken || '',
        onboardingAutoReplySent: thread.onboardingAutoReplySent || hasOnboardingReply,
        messages,
      };
    });
  } catch {
    window.localStorage.removeItem(VERIFICATION_THREADS_KEY);
    return [];
  }
}

export function writeThreads(threads: VerificationThread[]) {
  window.localStorage.setItem(VERIFICATION_THREADS_KEY, JSON.stringify(threads));
  window.dispatchEvent(new CustomEvent(VERIFICATION_EVENT_NAME));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(VERIFICATION_EVENT_NAME);
    channel.postMessage({ type: 'threads-updated' });
    channel.close();
  }
}

function threadToRow(thread: VerificationThread): VerificationThreadRow {
  return {
    id: thread.id,
    full_name: thread.fullName,
    username: thread.username,
    country: thread.country,
    date_of_birth: thread.dateOfBirth,
    email: thread.email,
    phone: thread.phone,
    gender: thread.gender,
    package_id: thread.packageId,
    package_name: thread.packageName,
    package_price: thread.packagePrice,
    host_name: thread.hostName,
    host_avatar: thread.hostAvatar,
    host_initials: thread.hostInitials,
    client_id: thread.clientId || null,
    meeting_link_token: thread.meetingLinkToken || null,
    status: thread.status,
    appointment: thread.appointment,
    unread_for_admin: thread.unreadForAdmin,
    unread_for_user: thread.unreadForUser,
    typing_user: thread.typingUser,
    typing_admin: thread.typingAdmin,
    onboarding_auto_reply_sent: Boolean(thread.onboardingAutoReplySent),
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
  };
}

function messageToRow(message: ChatMessage): VerificationMessageRow {
  return {
    id: message.id,
    thread_id: message.threadId,
    sender: message.sender,
    text: message.text,
    status: message.status,
    reply_to: message.replyTo || null,
    created_at: message.createdAt,
  };
}

function attachmentToRow(attachment: ChatAttachment, messageId: string, threadId: string): VerificationAttachmentRow {
  return {
    id: attachment.id,
    message_id: messageId,
    thread_id: threadId,
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    storage_path: attachment.dataUrl,
    payment_status: attachment.paymentStatus || null,
    payment_status_updated_at: attachment.paymentStatusUpdatedAt || null,
    created_at: attachment.paymentStatusUpdatedAt || new Date().toISOString(),
  };
}

function rowsToThreads(
  threadRows: VerificationThreadRow[],
  messageRows: VerificationMessageRow[],
  attachmentRows: VerificationAttachmentRow[]
) {
  const attachmentsByMessageId = attachmentRows.reduce<Record<string, ChatAttachment[]>>((groups, attachment) => {
    const nextAttachment: ChatAttachment = {
      id: attachment.id,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      dataUrl: attachment.storage_path,
      paymentStatus: attachment.payment_status || undefined,
      paymentStatusUpdatedAt: attachment.payment_status_updated_at || undefined,
    };

    groups[attachment.message_id] = [...(groups[attachment.message_id] || []), nextAttachment];
    return groups;
  }, {});

  const messagesByThreadId = messageRows
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .reduce<Record<string, ChatMessage[]>>((groups, message) => {
      const nextMessage: ChatMessage = {
        id: message.id,
        threadId: message.thread_id,
        sender: message.sender,
        text: message.text,
        createdAt: message.created_at,
        status: message.status,
        replyTo: message.reply_to || undefined,
        attachments: attachmentsByMessageId[message.id] || [],
      };

      groups[message.thread_id] = [...(groups[message.thread_id] || []), nextMessage];
      return groups;
    }, {});

  return threadRows.map((thread): VerificationThread => ({
    id: thread.id,
    fullName: thread.full_name,
    username: thread.username,
    country: thread.country,
    dateOfBirth: thread.date_of_birth,
    email: thread.email,
    phone: thread.phone,
    gender: thread.gender,
    packageId: thread.package_id,
    packageName: thread.package_name,
    packagePrice: thread.package_price,
    hostName: thread.host_name,
    hostAvatar: thread.host_avatar,
    hostInitials: thread.host_initials,
    clientId: thread.client_id || '',
    meetingLinkToken: thread.meeting_link_token || '',
    status: thread.status,
    appointment: thread.appointment,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    unreadForAdmin: thread.unread_for_admin,
    unreadForUser: thread.unread_for_user,
    typingUser: thread.typing_user,
    typingAdmin: thread.typing_admin,
    onboardingAutoReplySent: thread.onboarding_auto_reply_sent,
    messages: messagesByThreadId[thread.id] || [],
  }));
}

function threadUpdateTime(thread: VerificationThread) {
  return new Date(thread.updatedAt || thread.createdAt || 0).getTime();
}

function mergeThreads(localThreads: VerificationThread[], remoteThreads: VerificationThread[]) {
  const threadsById = new Map<string, VerificationThread>();

  localThreads.forEach((thread) => threadsById.set(thread.id, thread));

  remoteThreads.forEach((remoteThread) => {
    const localThread = threadsById.get(remoteThread.id);

    if (!localThread || threadUpdateTime(remoteThread) >= threadUpdateTime(localThread)) {
      threadsById.set(remoteThread.id, remoteThread);
    }
  });

  return Array.from(threadsById.values())
    .sort((first, second) => threadUpdateTime(second) - threadUpdateTime(first));
}

function shouldBackfillLocalThreads(localThreads: VerificationThread[], remoteThreads: VerificationThread[]) {
  const remoteThreadsById = new Map(remoteThreads.map((thread) => [thread.id, thread]));

  return localThreads.some((localThread) => {
    const remoteThread = remoteThreadsById.get(localThread.id);
    return !remoteThread || threadUpdateTime(localThread) > threadUpdateTime(remoteThread);
  });
}

function backfillLocalThreads(localThreads: VerificationThread[], remoteThreads: VerificationThread[]) {
  if (hasAttemptedThreadBackfill || localThreads.length === 0 || !shouldBackfillLocalThreads(localThreads, remoteThreads)) {
    return;
  }

  hasAttemptedThreadBackfill = true;
  Promise.all(localThreads.map((thread) => persistThreadRemote(thread)))
    .catch((error) => reportSupabaseSyncError('local verification backfill', error));
}

async function persistThreadRemote(thread: VerificationThread) {
  if (!isSupabaseConfigured || !supabase || !isUuid(thread.id)) {
    return;
  }

  const messageRows = thread.messages.filter((message) => isUuid(message.id)).map(messageToRow);
  const attachmentRows = thread.messages.flatMap((message) => (
    isUuid(message.id)
      ? message.attachments.filter((attachment) => isUuid(attachment.id)).map((attachment) => attachmentToRow(attachment, message.id, thread.id))
      : []
  ));

  const { error: threadError } = await supabase
    .from('verification_threads')
    .upsert(threadToRow(thread), { onConflict: 'id' });

  if (threadError) {
    throw threadError;
  }

  if (messageRows.length > 0) {
    const { error: messageError } = await supabase
      .from('verification_messages')
      .upsert(messageRows, { onConflict: 'id' });

    if (messageError) {
      throw messageError;
    }
  }

  if (attachmentRows.length > 0) {
    const { error: attachmentError } = await supabase
      .from('verification_attachments')
      .upsert(attachmentRows, { onConflict: 'id' });

    if (attachmentError) {
      throw attachmentError;
    }
  }
}

async function deleteThreadRemote(threadId: string) {
  if (!isSupabaseConfigured || !supabase || !isUuid(threadId)) {
    return;
  }

  await supabase.from('verification_threads').delete().eq('id', threadId);
}

async function deleteMessageRemote(messageId: string) {
  if (!isSupabaseConfigured || !supabase || !isUuid(messageId)) {
    return;
  }

  await supabase.from('verification_messages').delete().eq('id', messageId);
}

export async function refreshThreadsFromRemote() {
  if (!isSupabaseConfigured || !supabase || isBrowserOffline()) {
    return readThreads();
  }

  const localThreads = readThreads();

  const { data: threadRows, error: threadError } = await supabase
    .from('verification_threads')
    .select('*')
    .order('updated_at', { ascending: false });

  if (threadError || !threadRows) {
    return readThreads();
  }

  const threadIds = (threadRows as VerificationThreadRow[]).map((thread) => thread.id);

  if (threadIds.length === 0) {
    backfillLocalThreads(localThreads, []);
    return localThreads;
  }

  const [{ data: messageRows }, { data: attachmentRows }] = await Promise.all([
    supabase
      .from('verification_messages')
      .select('*')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('verification_attachments')
      .select('*')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: true }),
  ]);

  const remoteThreads = rowsToThreads(
    threadRows as VerificationThreadRow[],
    (messageRows || []) as VerificationMessageRow[],
    (attachmentRows || []) as VerificationAttachmentRow[]
  );
  const threads = mergeThreads(localThreads, remoteThreads);
  writeThreads(threads);
  backfillLocalThreads(localThreads, remoteThreads);
  return threads;
}

export function getThread(threadId: string) {
  return readThreads().find((thread) => thread.id === threadId) || null;
}

export function saveThreadSession(threadId: string, context?: ThreadAccessContext) {
  const thread = getThread(threadId);
  const resolvedContext = context || (thread ? contextFromThread(thread) : undefined);
  window.localStorage.setItem(sessionKeyForContext(resolvedContext), threadId);
  window.localStorage.setItem(VERIFICATION_SESSION_KEY, threadId);
}

export function getSavedThreadSession(context?: ThreadAccessContext) {
  const scopedThreadId = window.localStorage.getItem(sessionKeyForContext(context)) || '';
  const scopedThread = scopedThreadId ? getThread(scopedThreadId) : null;

  if (threadMatchesContext(scopedThread, context)) {
    return scopedThreadId;
  }

  const legacyThreadId = window.localStorage.getItem(VERIFICATION_SESSION_KEY) || '';
  const legacyThread = legacyThreadId ? getThread(legacyThreadId) : null;

  if (threadMatchesContext(legacyThread, context)) {
    return legacyThreadId;
  }

  return '';
}

export function createVerificationThread(payload: RegistrationPayload) {
  const now = new Date().toISOString();
  const openingMessage = `Hello Management, I am interested in completing payment verification for the ${payload.packageName} plan (${payload.packagePrice}) with ${payload.hostName}. Please guide me through the payment confirmation process.`;
  const thread: VerificationThread = {
    id: createId('thread'),
    ...payload,
    meetingLinkToken: payload.meetingLinkToken || '',
    status: 'Pending Verification',
    appointment: '',
    createdAt: now,
    updatedAt: now,
    unreadForAdmin: 1,
    unreadForUser: 0,
    typingUser: false,
    typingAdmin: true,
    onboardingAutoReplySent: false,
    messages: [
      {
        id: createId('message'),
        threadId: '',
        sender: 'user',
        text: openingMessage,
        createdAt: now,
        status: 'Delivered',
        attachments: [],
      },
    ],
  };

  thread.messages = thread.messages.map((message) => ({ ...message, threadId: thread.id }));
  writeThreads([thread, ...readThreads()]);
  persistThreadRemote(thread).catch((error) => reportSupabaseSyncError('verification thread', error));
  saveThreadSession(thread.id, contextFromThread(thread));
  notifyAdmin('subscription_submitted', {
    title: 'New Subscription Submitted',
    description: `${thread.fullName} submitted the ${thread.packageName} plan.`,
    country: thread.country,
    actionUrl: `/admin/chats/${thread.id}`,
  });
  return thread;
}

export function updateThread(threadId: string, updater: (thread: VerificationThread) => VerificationThread) {
  const threads = readThreads();
  const nextThreads = threads.map((thread) => (
    thread.id === threadId
      ? { ...updater(thread), updatedAt: new Date().toISOString() }
      : thread
  ));
  writeThreads(nextThreads);
  const updatedThread = nextThreads.find((thread) => thread.id === threadId) || null;

  if (updatedThread) {
    persistThreadRemote(updatedThread).catch((error) => reportSupabaseSyncError('verification thread', error));
  }

  return updatedThread;
}

export function addMessage(
  threadId: string,
  sender: ChatSender,
  text: string,
  attachments: ChatAttachment[] = [],
  replyTo?: ChatReply
) {
  const message: ChatMessage = {
    id: createId('message'),
    threadId,
    sender,
    text,
    createdAt: new Date().toISOString(),
    status: sender === 'system' ? 'Delivered' : 'Delivered',
    attachments,
    replyTo,
  };

  const updatedThread = updateThread(threadId, (thread) => ({
    ...thread,
    unreadForAdmin: sender === 'user' ? thread.unreadForAdmin + 1 : thread.unreadForAdmin,
    unreadForUser: sender === 'admin' || sender === 'system' ? thread.unreadForUser + 1 : thread.unreadForUser,
    messages: [...thread.messages, message],
  }));

  if (sender === 'user' && updatedThread) {
    notifyAdmin('new_chat_message', {
      title: 'New Chat Message',
      description: `${updatedThread.fullName} sent a new message. Tap to open chat.`,
      country: updatedThread.country,
      actionUrl: `/admin/chats/${threadId}`,
    });
  }

  return updatedThread;
}

export function deleteMessage(threadId: string, messageId: string) {
  deleteMessageRemote(messageId).catch((error) => reportSupabaseSyncError('verification message delete', error));

  return updateThread(threadId, (thread) => ({
    ...thread,
    messages: thread.messages.filter((message) => message.id !== messageId),
  }));
}

export function deleteThread(threadId: string) {
  const nextThreads = readThreads().filter((thread) => thread.id !== threadId);
  writeThreads(nextThreads);
  deleteThreadRemote(threadId).catch((error) => reportSupabaseSyncError('verification thread delete', error));

  if (getSavedThreadSession() === threadId) {
    window.localStorage.removeItem(VERIFICATION_SESSION_KEY);
  }

  return nextThreads;
}

export function updateAttachmentPaymentStatus(
  threadId: string,
  attachmentId: string,
  paymentStatus: 'Awaiting Approval' | 'Approved' | 'Declined'
) {
  const existingThread = getThread(threadId);
  const wasAlreadyApproved = existingThread?.messages.some((message) => message.attachments.some((attachment) => attachment.id === attachmentId && attachment.paymentStatus === 'Approved'));
  const updatedThread = updateThread(threadId, (thread) => ({
    ...thread,
    status: paymentStatus === 'Approved'
      ? 'Verified'
      : paymentStatus === 'Declined'
        ? 'Rejected'
        : thread.status,
    messages: thread.messages.map((message) => ({
      ...message,
      attachments: message.attachments.map((attachment) => (
        attachment.id === attachmentId
          ? { ...attachment, paymentStatus, paymentStatusUpdatedAt: new Date().toISOString() }
          : attachment
      )),
    })),
  }));

  if (paymentStatus === 'Approved' && updatedThread && !wasAlreadyApproved) {
    notifyAdmin('payment_successful', {
      title: 'Successful Payment',
      description: `${updatedThread.fullName}: ${updatedThread.packageName}, ${updatedThread.packagePrice}.`,
      country: updatedThread.country,
      actionUrl: `/admin/chats/${threadId}`,
    });
  }

  return updatedThread;
}

export function setThreadTyping(threadId: string, sender: 'user' | 'admin', isTyping: boolean) {
  return updateThread(threadId, (thread) => ({
    ...thread,
    typingUser: sender === 'user' ? isTyping : thread.typingUser,
    typingAdmin: sender === 'admin' ? isTyping : thread.typingAdmin,
  }));
}

export function markThreadSeen(threadId: string, viewer: 'user' | 'admin') {
  return updateThread(threadId, (thread) => ({
    ...thread,
    unreadForAdmin: viewer === 'admin' ? 0 : thread.unreadForAdmin,
    unreadForUser: viewer === 'user' ? 0 : thread.unreadForUser,
    messages: thread.messages.map((message) => {
      if ((viewer === 'admin' && message.sender === 'user') || (viewer === 'user' && message.sender === 'admin')) {
        return { ...message, status: 'Seen' };
      }

      return message;
    }),
  }));
}

export function findReturningThread(name: string, contact: string, context?: ThreadAccessContext) {
  const normalizedName = name.trim().toLowerCase();
  const normalizedContact = contact.trim().toLowerCase();

  return readThreads().find((thread) => {
    if (!threadMatchesContext(thread, context)) {
      return false;
    }

    const nameMatches = thread.fullName.trim().toLowerCase() === normalizedName;
    const emailMatches = thread.email.trim().toLowerCase() === normalizedContact;
    const phoneMatches = Boolean(thread.phone) && thread.phone.trim().toLowerCase() === normalizedContact;

    return nameMatches && (emailMatches || phoneMatches);
  }) || null;
}

export function createAttachmentFromFile(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read file'));
        return;
      }

      resolve({
        id: createId('attachment'),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: reader.result,
      });
    };

    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

export function formatStatusColor(status: VerificationStatus) {
  switch (status) {
    case 'Verified':
      return 'bg-[#EEFBF4] text-[#157347] border-[#BFE7D1]';
    case 'Rejected':
      return 'bg-[#FFF5F4] text-[#B42318] border-[#FEE4E2]';
    case 'Appointment Scheduled':
      return 'bg-[#EEF4FF] text-[#155EEF] border-[#C7D7FE]';
    case 'Under Review':
      return 'bg-[#FFF8E6] text-[#A16207] border-[#F4D680]';
    default:
      return 'bg-[#F4F8FF] text-[#0B5CFF] border-[#D8E4FF]';
  }
}
