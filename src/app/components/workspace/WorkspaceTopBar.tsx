import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, ChevronDown, Search, Trash2, X } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { markThreadSeen, readThreads, refreshThreadsFromRemote, VERIFICATION_EVENT_NAME } from '../../data/verificationChat';

const DISMISSED_NOTIFICATIONS_KEY = 'celebrity-admin-dismissed-notifications-v1';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type WorkspaceTopBarProps = {
  leadingContent?: ReactNode;
};

export function WorkspaceTopBar({ leadingContent }: WorkspaceTopBarProps = {}) {
  const { user } = useUser();
  const [threads, setThreads] = useState(() => readThreads());
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY) || '[]') as string[];
    } catch {
      return [];
    }
  });

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

    return () => {
      window.removeEventListener(VERIFICATION_EVENT_NAME, refreshThreads);
      channel?.close();
      window.clearInterval(intervalId);
    };
  }, []);

  const notifications = useMemo(() => (
    threads.flatMap((thread) => (
      thread.messages
        .filter((message) => message.sender === 'user' && !dismissedIds.includes(message.id))
        .map((message) => ({
          id: message.id,
          threadId: thread.id,
          name: thread.fullName,
          text: message.text || message.attachments[0]?.name || 'Media file uploaded',
          createdAt: message.createdAt,
          unread: thread.unreadForAdmin > 0,
        }))
    )).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  ), [dismissedIds, threads]);

  const unreadCount = threads.reduce((total, thread) => total + thread.unreadForAdmin, 0);

  const dismissNotification = (notificationId: string) => {
    const nextDismissedIds = [...dismissedIds, notificationId];
    setDismissedIds(nextDismissedIds);
    window.localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(nextDismissedIds));
  };

  const markAllAsRead = () => {
    threads.forEach((thread) => markThreadSeen(thread.id, 'admin'));
  };

  return (
    <div className="bg-white border-b border-[#E5E9F2] px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-2xl">
          {leadingContent || (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Search meetings, contacts, messages..."
                className="w-full py-3 pl-12 pr-4 bg-[#F7F9FC] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5CFF] focus:border-transparent focus:bg-white"
              />
            </div>
          )}
        </div>

        <div className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((isOpen) => !isOpen)}
            className="relative p-2 hover:bg-[#F7F9FC] rounded-xl transition-colors"
          >
            <Bell className="w-5 h-5 text-[#6B7280]" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D92D20] px-1 text-[10px] text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="fixed inset-x-4 top-20 z-50 rounded-2xl border border-[#E5E9F2] bg-white p-3 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
              <div className="mb-3 flex items-center justify-between gap-3 px-2">
                <div>
                  <p className="text-sm text-[#172033]" style={{ fontWeight: 900 }}>Messages</p>
                  <p className="text-xs text-[#6B7280]">{unreadCount} unread</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={markAllAsRead} className="text-xs text-[#0B5CFF] hover:underline">
                    Mark all read
                  </button>
                  <button type="button" onClick={() => setIsNotificationsOpen(false)} className="rounded-full p-1 text-[#6B7280] hover:bg-[#F7F9FC]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="rounded-xl bg-[#F7F9FC] p-5 text-center text-sm text-[#6B7280]">
                    No message notifications.
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div key={notification.id} className="mb-2 rounded-xl bg-[#F7F9FC] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            markThreadSeen(notification.threadId, 'admin');
                            window.location.href = `/admin/chats/${notification.threadId}`;
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm text-[#172033]" style={{ fontWeight: 900 }}>
                            {notification.unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#0B5CFF]" />}
                            {notification.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-[#6B7280]">{notification.text}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissNotification(notification.id)}
                          className="rounded-full p-1 text-[#6B7280] hover:bg-white hover:text-[#B42318]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <button className="flex items-center gap-3 p-2 hover:bg-[#F7F9FC] rounded-xl transition-colors">
            <div className="w-8 h-8 bg-gradient-to-br from-[#0B5CFF] to-[#0056D2] rounded-full flex items-center justify-center">
              <span className="text-sm text-white">{getInitials(user?.fullName || 'User')}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>
      </div>
    </div>
  );
}
