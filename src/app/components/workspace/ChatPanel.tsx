import { recentChats } from '../../data/workspaceData';

type ChatPanelProps = {
  expanded?: boolean;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function ChatPanel({ expanded = false }: ChatPanelProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E5E9F2] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl text-[#1F2937]">Recent Chats</h2>
        {!expanded && <button className="text-sm text-[#0B5CFF] hover:underline">View all</button>}
      </div>
      <div className="space-y-3">
        {recentChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-[#F7F9FC] rounded-xl">
            <div className="w-12 h-12 bg-[#E8F1FF] rounded-full flex items-center justify-center mb-4">
              <span className="text-sm text-[#0B5CFF]">+</span>
            </div>
            <h3 className="text-[#1F2937] mb-1">No recent chats</h3>
            <p className="text-sm text-[#6B7280]">Your conversations will appear here after you start chatting.</p>
          </div>
        ) : (
          recentChats.map((chat) => (
            <div
              key={chat.id}
              className="flex items-center gap-4 p-4 hover:bg-[#F7F9FC] rounded-xl transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-[#0B5CFF] to-[#0056D2] rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-white">{getInitials(chat.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[#1F2937] truncate">{chat.name}</h3>
                  <span className="text-xs text-[#6B7280] flex-shrink-0 ml-2">{chat.time}</span>
                </div>
                <p data-no-translate className="text-sm text-[#6B7280] truncate">{expanded ? `${chat.message} Let's keep this thread moving.` : chat.message}</p>
              </div>
              {chat.unread > 0 && (
                <div className="w-6 h-6 bg-[#0B5CFF] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-white">{chat.unread}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
