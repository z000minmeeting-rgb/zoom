import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCheck, CheckCircle2, FileText, Image as ImageIcon, LoaderCircle, Paperclip, Reply, Send, Trash2, X, XCircle } from 'lucide-react';
import {
  ChatAttachment,
  ChatMessage,
  ChatReply,
  VERIFICATION_EVENT_NAME,
  addMessage,
  createAttachmentFromFile,
  deleteMessage,
  formatStatusColor,
  getThread,
  markThreadSeen,
  refreshThreadsFromRemote,
  setThreadTyping,
  updateAttachmentPaymentStatus,
  updateThread,
  VerificationThread,
} from '../../data/verificationChat';

type VerificationChatPanelProps = {
  threadId: string;
  viewer: 'user' | 'admin';
  compact?: boolean;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatDateGroup(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function messagePreview(message: ChatMessage) {
  if (message.text.trim()) {
    return message.text.trim().slice(0, 120);
  }

  return message.attachments[0]?.name || 'Attachment';
}

function PaymentStatusNotice({
  status,
  floating = false,
}: {
  status: NonNullable<ChatAttachment['paymentStatus']>;
  floating?: boolean;
}) {
  const config = {
    'Awaiting Approval': {
      title: 'Pending verification',
      description: 'Management is reviewing this payment proof.',
      className: 'border-white/70 bg-white/92 text-[#172033]',
      icon: <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#0B5CFF]" />,
    },
    Approved: {
      title: 'Payment approved',
      description: 'Management has approved this payment proof.',
      className: 'border-[#BFE7D1] bg-[#EEFBF4]/95 text-[#157347]',
      icon: <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#157347]" />,
    },
    Declined: {
      title: 'Payment declined',
      description: 'Management declined this payment proof.',
      className: 'border-[#FEE4E2] bg-[#FFF5F4]/95 text-[#B42318]',
      icon: <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#B42318]" />,
    },
  }[status];

  return (
    <div className={`${floating ? 'absolute inset-x-3 top-3 shadow-xl backdrop-blur' : 'mb-3'} rounded-2xl border p-3 ${config.className}`}>
      <div className="flex items-start gap-3">
        {config.icon}
        <div>
          <p className="text-sm" style={{ fontWeight: 900 }}>{config.title}</p>
          <p className="mt-1 text-xs leading-5 opacity-75">{config.description}</p>
        </div>
      </div>
    </div>
  );
}

function MessageReceipt({ status }: { status: ChatMessage['status'] }) {
  const isSeen = status === 'Seen';

  return (
    <span
      className={`inline-flex items-center ${isSeen ? 'text-[#0B5CFF]' : 'text-[#8A94A6]'}`}
      aria-label={isSeen ? 'Read' : 'Unread'}
      title={isSeen ? 'Read' : 'Unread'}
    >
      <CheckCheck className="h-4 w-4" />
    </span>
  );
}

function AttachmentPreview({
  attachment,
  messageSender,
  threadId,
  viewer,
}: {
  attachment: ChatAttachment;
  messageSender: 'user' | 'admin' | 'system';
  threadId: string;
  viewer: 'user' | 'admin';
}) {
  const [showApprovalActions, setShowApprovalActions] = useState(false);
  const isImage = attachment.type.startsWith('image/');
  const isVideo = attachment.type.startsWith('video/');
  const isPaymentProof = messageSender === 'user' && Boolean(attachment.paymentStatus);
  const paymentStatus = attachment.paymentStatus;

  const approvePayment = () => {
    updateAttachmentPaymentStatus(threadId, attachment.id, 'Approved');
    addMessage(threadId, 'admin', 'Payment approved. Please wait while we schedule you for a meeting appointment.');
    setShowApprovalActions(false);
  };

  const declinePayment = () => {
    updateAttachmentPaymentStatus(threadId, attachment.id, 'Declined');
    addMessage(threadId, 'admin', 'Payment was declined. Management will communicate the reason for declining through this chat.');
    setShowApprovalActions(false);
  };

  const adminPaymentActions = viewer === 'admin' && isPaymentProof && paymentStatus && (
    paymentStatus === 'Awaiting Approval' ? (
      <div className="mt-2 rounded-2xl border border-[#D8E4FF] bg-white p-2">
        <button
          type="button"
          onClick={() => setShowApprovalActions((isOpen) => !isOpen)}
          className="w-full rounded-xl bg-[#F4F8FF] px-3 py-2 text-sm text-[#0B5CFF]"
          style={{ fontWeight: 900 }}
        >
          Awaiting your approval
        </button>

        {showApprovalActions && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={approvePayment}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#12A150] px-3 py-2 text-sm text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </button>
            <button
              type="button"
              onClick={declinePayment}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B42318] px-3 py-2 text-sm text-white"
            >
              <XCircle className="h-4 w-4" />
              Decline
            </button>
          </div>
        )}
      </div>
    ) : (
      <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${
        paymentStatus === 'Approved' ? 'bg-[#EEFBF4] text-[#157347]' : 'bg-[#FFF5F4] text-[#B42318]'
      }`} style={{ fontWeight: 900 }}>
        {paymentStatus}
      </p>
    )
  );

  if (isImage) {
    return (
      <div className="mt-3">
        <a href={attachment.dataUrl} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-2xl border border-white/60 bg-white/70">
          <img src={attachment.dataUrl} alt={attachment.name} className="max-h-72 w-full object-cover" />

          {viewer === 'user' && isPaymentProof && paymentStatus && <PaymentStatusNotice status={paymentStatus} floating />}
        </a>

        {adminPaymentActions}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-black">
          <video src={attachment.dataUrl} controls className="max-h-72 w-full bg-black" />
          {viewer === 'user' && isPaymentProof && paymentStatus && <PaymentStatusNotice status={paymentStatus} floating />}
        </div>
        {adminPaymentActions}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <a
        href={attachment.dataUrl}
        download={attachment.name}
        className="block rounded-2xl border border-[#E5E9F2] bg-white/80 p-3 text-left"
      >
        {viewer === 'user' && isPaymentProof && paymentStatus && <PaymentStatusNotice status={paymentStatus} />}
        <span className="flex items-center gap-3">
          <FileText className="h-5 w-5 shrink-0 text-[#0B5CFF]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-[#172033]" style={{ fontWeight: 700 }}>{attachment.name}</span>
            <span className="text-xs text-[#6B7280]">{formatSize(attachment.size)}</span>
          </span>
        </span>
      </a>
      {adminPaymentActions}
    </div>
  );
}

export function VerificationChatPanel({ threadId, viewer, compact = false }: VerificationChatPanelProps) {
  const [thread, setThread] = useState<VerificationThread | null>(() => getThread(threadId));
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [replyTo, setReplyTo] = useState<ChatReply | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const oppositeTyping = viewer === 'user' ? thread?.typingAdmin : thread?.typingUser;
  const oppositeTypingText = viewer === 'user' ? 'Management is typing...' : 'User is typing...';

  useEffect(() => {
    const refreshThread = () => {
      setThread(getThread(threadId));
    };

    window.addEventListener(VERIFICATION_EVENT_NAME, refreshThread);
    let channel: BroadcastChannel | null = null;

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(VERIFICATION_EVENT_NAME);
      channel.onmessage = refreshThread;
    }

    const refreshFromRemote = () => refreshThreadsFromRemote().then(() => {
      setThread(getThread(threadId));
    });
    const intervalId = window.setInterval(refreshFromRemote, 5000);

    refreshFromRemote();
    refreshThread();

    return () => {
      window.removeEventListener(VERIFICATION_EVENT_NAME, refreshThread);
      channel?.close();
      window.clearInterval(intervalId);
    };
  }, [threadId]);

  useEffect(() => {
    if (!thread) {
      return;
    }

    const hasUnreadMessages = viewer === 'admin'
      ? thread.unreadForAdmin > 0 || thread.messages.some((message) => message.sender === 'user' && message.status !== 'Seen')
      : thread.unreadForUser > 0 || thread.messages.some((message) => message.sender === 'admin' && message.status !== 'Seen');

    if (hasUnreadMessages) {
      markThreadSeen(threadId, viewer);
    }
  }, [threadId, viewer, thread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length, attachments.length, oppositeTyping]);

  const groupedMessages = useMemo(() => {
    const groups: Array<{ label: string; messages: ChatMessage[] }> = [];

    thread?.messages.forEach((message) => {
      const label = formatDateGroup(message.createdAt);
      const existingGroup = groups.find((group) => group.label === label);

      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({ label, messages: [message] });
      }
    });

    return groups;
  }, [thread?.messages]);

  const handleTyping = (value: string) => {
    setMessageText(value);
    setThreadTyping(threadId, viewer, true);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      setThreadTyping(threadId, viewer, false);
    }, 1200);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    setIsUploading(true);

    try {
      const nextAttachments = await Promise.all(Array.from(files).map((file) => createAttachmentFromFile(file)));
      setAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = () => {
    const trimmedMessage = messageText.trim();

    if (!trimmedMessage && attachments.length === 0) {
      return;
    }

    const sentWithAttachments = attachments.length > 0;
    const outgoingAttachments = viewer === 'user'
      ? attachments.map((attachment) => ({
          ...attachment,
          paymentStatus: attachment.paymentStatus || 'Awaiting Approval' as const,
        }))
      : attachments;

    addMessage(threadId, viewer, trimmedMessage, outgoingAttachments, replyTo);

    if (viewer === 'user' && sentWithAttachments) {
      updateThread(threadId, (currentThread) => ({
        ...currentThread,
        status: currentThread.status === 'Verified' || currentThread.status === 'Appointment Scheduled'
          ? currentThread.status
          : 'Under Review',
      }));
    }

    setMessageText('');
    setAttachments([]);
    setReplyTo(undefined);
    setThreadTyping(threadId, viewer, false);
  };

  if (!thread) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl border border-[#E5E9F2] bg-white p-8 text-center text-[#6B7280]">
        Verification chat not found.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-[#D8E4FF] bg-white/90 shadow-[0_24px_80px_rgba(11,92,255,0.10)] backdrop-blur-xl">
      {!compact && (
        <div className="border-b border-[#E5E9F2] bg-white/90 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[#172033]" style={{ fontWeight: 900 }}>{thread.fullName}</p>
              <p className="truncate text-sm text-[#6B7280]">{thread.packageName} - {thread.packagePrice}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${formatStatusColor(thread.status)}`} style={{ fontWeight: 800 }}>
              {thread.status}
            </span>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#FFFFFF_48%,#F4F8FF_100%)] px-3 py-4 sm:px-5">
        {groupedMessages.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 z-10 mx-auto mb-4 w-fit rounded-full border border-[#E5E9F2] bg-white/90 px-3 py-1 text-xs text-[#6B7280] shadow-sm backdrop-blur">
              {group.label}
            </div>

            {group.messages.map((message) => {
              const isMine = message.sender === viewer;
              const isSystem = message.sender === 'system';

              return (
                <motion.div
                  key={message.id}
                  className={`group mb-3 flex ${isSystem ? 'justify-center' : isMine ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setReplyTo({ messageId: message.id, sender: message.sender, text: messagePreview(message) });
                  }}
                >
                  <div className={`max-w-[86%] sm:max-w-[72%] ${isSystem ? 'max-w-[92%]' : ''}`}>
                    <div
                      className={`rounded-[1.35rem] px-4 py-3 shadow-sm ${
                        isSystem
                          ? 'border border-[#D8E4FF] bg-white/90 text-center text-[#4B5563]'
                          : isMine
                            ? 'bg-[#0B5CFF] text-white'
                            : 'border border-[#E5E9F2] bg-white text-[#172033]'
                      }`}
                    >
                      {message.replyTo && (
                        <div className={`mb-2 rounded-2xl border-l-4 px-3 py-2 text-left ${
                          isMine ? 'border-white/70 bg-white/15 text-white/90' : 'border-[#0B5CFF] bg-[#F4F8FF] text-[#4B5563]'
                        }`}>
                          <p className="text-xs" style={{ fontWeight: 900 }}>
                            Reply to {message.replyTo.sender === 'admin' ? 'Management' : message.replyTo.sender === 'user' ? 'User' : 'System'}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs">{message.replyTo.text}</p>
                        </div>
                      )}

                      {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>}
                      {message.attachments.map((attachment) => (
                        <AttachmentPreview
                          key={attachment.id}
                          attachment={attachment}
                          messageSender={message.sender}
                          threadId={threadId}
                          viewer={viewer}
                        />
                      ))}
                    </div>

                    {!isSystem && (
                      <div className={`mt-1 flex items-center gap-2 text-xs text-[#8A94A6] ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <span>{formatTime(message.createdAt)}</span>
                        {isMine && <MessageReceipt status={message.status} />}
                        <button
                          type="button"
                          onClick={() => setReplyTo({ messageId: message.id, sender: message.sender, text: messagePreview(message) })}
                          className="inline-flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Reply className="h-3.5 w-3.5" />
                          Reply
                        </button>
                        {viewer === 'admin' && (
                          <button
                            type="button"
                            onClick={() => deleteMessage(threadId, message.id)}
                            className="inline-flex items-center gap-1 text-[#B42318] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}

        {oppositeTyping && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-full border border-[#E5E9F2] bg-white px-4 py-2 text-sm text-[#6B7280] shadow-sm">
              {oppositeTypingText}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#E5E9F2] bg-white/95 p-3 sm:p-4">
        {replyTo && (
          <div className="mb-3 flex items-start gap-3 rounded-2xl border border-[#D8E4FF] bg-[#F4F8FF] px-4 py-3">
            <Reply className="mt-0.5 h-4 w-4 shrink-0 text-[#0B5CFF]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#0B5CFF]" style={{ fontWeight: 900 }}>Replying</p>
              <p className="truncate text-sm text-[#4B5563]">{replyTo.text}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(undefined)} className="text-[#6B7280]">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center gap-3 rounded-2xl border border-[#E5E9F2] bg-[#F7F9FC] p-2">
                {attachment.type.startsWith('image/') ? (
                  <img src={attachment.dataUrl} alt={attachment.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F1FF]">
                    <ImageIcon className="h-5 w-5 text-[#0B5CFF]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#172033]" style={{ fontWeight: 700 }}>{attachment.name}</p>
                  <p className="text-xs text-[#6B7280]">{formatSize(attachment.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachments((currentAttachments) => currentAttachments.filter((item) => item.id !== attachment.id))}
                  className="rounded-full p-1 text-[#6B7280] hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            id={`verification-file-${viewer}-${threadId}`}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <label
            htmlFor={`verification-file-${viewer}-${threadId}`}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F4F8FF] text-[#0B5CFF] hover:bg-[#E8F1FF]"
          >
            <Paperclip className="h-5 w-5" />
          </label>

          <textarea
            value={messageText}
            onChange={(event) => handleTyping(event.target.value)}
            placeholder={viewer === 'user' ? 'Message management or describe your payment proof...' : 'Reply to subscriber...'}
            rows={1}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[1.35rem] border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 text-sm text-[#172033] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
          />

          <button
            type="button"
            onClick={sendMessage}
            disabled={isUploading || (!messageText.trim() && attachments.length === 0)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0B5CFF] text-white shadow-[0_12px_30px_rgba(11,92,255,0.22)] disabled:bg-[#B6C2D6]"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
