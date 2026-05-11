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
};

export const VERIFICATION_THREADS_KEY = 'celebrity-verification-threads-v1';
export const VERIFICATION_EVENT_NAME = 'celebrity-verification-chat-updated';
export const VERIFICATION_SESSION_KEY = 'celebrity-verification-session-v1';
export const MANAGEMENT_PAYMENT_WELCOME_MESSAGE =
  'Welcome. The management team will communicate the means of payment to you in a few minutes.';

const LEGACY_ADMIN_WELCOME_PATTERN = /^Welcome .+\. Thank you for registering for the .+ subscription\. Please upload your payment proof here, and management will verify it and guide you through scheduling your meeting appointment\.$/;
const LEGACY_PAYMENT_PROOF_SYSTEM_MESSAGE =
  'Payment proof submitted successfully. Please wait 20-40 minutes while our management team verifies your payment and schedules your appointment.';

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

export function getThread(threadId: string) {
  return readThreads().find((thread) => thread.id === threadId) || null;
}

export function saveThreadSession(threadId: string) {
  window.localStorage.setItem(VERIFICATION_SESSION_KEY, threadId);
}

export function getSavedThreadSession() {
  return window.localStorage.getItem(VERIFICATION_SESSION_KEY) || '';
}

export function createVerificationThread(payload: RegistrationPayload) {
  const now = new Date().toISOString();
  const openingMessage = `Hello Management, I am interested in completing payment verification for the ${payload.packageName} plan (${payload.packagePrice}) with ${payload.hostName}. Please guide me through the payment confirmation process.`;
  const thread: VerificationThread = {
    id: createId('thread'),
    ...payload,
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
  saveThreadSession(thread.id);
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
  return nextThreads.find((thread) => thread.id === threadId) || null;
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

  return updateThread(threadId, (thread) => ({
    ...thread,
    unreadForAdmin: sender === 'user' ? thread.unreadForAdmin + 1 : thread.unreadForAdmin,
    unreadForUser: sender === 'admin' || sender === 'system' ? thread.unreadForUser + 1 : thread.unreadForUser,
    messages: [...thread.messages, message],
  }));
}

export function deleteMessage(threadId: string, messageId: string) {
  return updateThread(threadId, (thread) => ({
    ...thread,
    messages: thread.messages.filter((message) => message.id !== messageId),
  }));
}

export function deleteThread(threadId: string) {
  const nextThreads = readThreads().filter((thread) => thread.id !== threadId);
  writeThreads(nextThreads);

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
  return updateThread(threadId, (thread) => ({
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

export function findReturningThread(name: string, contact: string) {
  const normalizedName = name.trim().toLowerCase();
  const normalizedContact = contact.trim().toLowerCase();

  return readThreads().find((thread) => {
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
