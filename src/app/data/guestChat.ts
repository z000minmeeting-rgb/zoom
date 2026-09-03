import { callEdgeFunction } from '../lib/edgeFunctions';
import type { ChatAttachment, ChatMessage, ChatReply, VerificationThread } from './verificationChat';

/**
 * Customer-side chat, authorised by a guest token rather than by knowing a
 * thread UUID.
 *
 * Every call goes to the `guest-chat` Edge Function, which resolves the token to
 * exactly one conversation before touching anything. The browser never reads or
 * writes verification_* tables directly.
 */

type ThreadRow = {
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
  meeting_link_token: string | null;
  booking_reference: string | null;
  status: VerificationThread['status'];
  appointment: string;
  appointment_timezone: string | null;
  created_at: string;
  updated_at: string;
  unread_for_admin: number;
  unread_for_user: number;
  typing_user: boolean;
  typing_admin: boolean;
  onboarding_auto_reply_sent: boolean;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender: ChatMessage['sender'];
  text: string;
  status: ChatMessage['status'];
  reply_to: ChatReply | null;
  created_at: string;
};

type AttachmentRow = {
  id: string;
  message_id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  payment_status: ChatAttachment['paymentStatus'] | null;
  payment_status_updated_at: string | null;
};

type LoadResponse = {
  thread: ThreadRow;
  messages: MessageRow[];
  attachments: AttachmentRow[];
};

export type GuestThread = VerificationThread & { bookingReference: string; appointmentTimezone: string };

function toGuestThread(response: LoadResponse): GuestThread {
  const attachmentsByMessage = response.attachments.reduce<Record<string, ChatAttachment[]>>(
    (groups, attachment) => {
      const next: ChatAttachment = {
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        dataUrl: attachment.storage_path,
        paymentStatus: attachment.payment_status || undefined,
        paymentStatusUpdatedAt: attachment.payment_status_updated_at || undefined,
      };

      groups[attachment.message_id] = [...(groups[attachment.message_id] || []), next];
      return groups;
    },
    {},
  );

  const thread = response.thread;

  return {
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
    bookingReference: thread.booking_reference || '',
    status: thread.status,
    appointment: thread.appointment,
    appointmentTimezone: thread.appointment_timezone || '',
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    unreadForAdmin: thread.unread_for_admin,
    unreadForUser: thread.unread_for_user,
    typingUser: thread.typing_user,
    typingAdmin: thread.typing_admin,
    onboardingAutoReplySent: thread.onboarding_auto_reply_sent,
    messages: response.messages.map((message) => ({
      id: message.id,
      threadId: message.thread_id,
      sender: message.sender,
      text: message.text,
      createdAt: message.created_at,
      status: message.status,
      replyTo: message.reply_to || undefined,
      attachments: attachmentsByMessage[message.id] || [],
    })),
  };
}

function headers(token: string) {
  return { 'x-guest-token': token };
}

export async function loadGuestThread(token: string) {
  const response = await callEdgeFunction<LoadResponse>('guest-chat', { action: 'load' }, headers(token));
  return toGuestThread(response);
}

export async function sendGuestMessage(
  token: string,
  text: string,
  attachments: ChatAttachment[] = [],
  replyTo?: ChatReply,
) {
  return callEdgeFunction<{ messageId: string; createdAt: string }>(
    'guest-chat',
    {
      action: 'send',
      text,
      replyTo: replyTo ?? null,
      attachments: attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        dataUrl: attachment.dataUrl,
      })),
    },
    headers(token),
  );
}

export async function markGuestThreadSeen(token: string) {
  return callEdgeFunction<{ ok: boolean }>('guest-chat', { action: 'seen' }, headers(token));
}

export async function setGuestTyping(token: string, isTyping: boolean) {
  return callEdgeFunction<{ ok: boolean }>('guest-chat', { action: 'typing', isTyping }, headers(token));
}

/**
 * Asks the server to write the onboarding auto-reply. The server applies it
 * conditionally on `onboarding_auto_reply_sent`, so two open tabs cannot
 * produce two replies the way the previous client-side version could.
 */
export async function sendGuestOnboardingReply(token: string) {
  return callEdgeFunction<{ ok: boolean }>('guest-chat', { action: 'onboarding' }, headers(token));
}
