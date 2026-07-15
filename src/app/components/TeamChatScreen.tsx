import { useState } from 'react';
import { Send } from 'lucide-react';
import { ChatPanel } from './workspace/ChatPanel';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';

export function TeamChatScreen() {
  const [message, setMessage] = useState('');
  const [threadMessages, setThreadMessages] = useState([
    'Thanks for the update!',
    'New campaign ideas...',
    'Can we reschedule?',
  ]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextMessage = message.trim();

    if (!nextMessage) {
      return;
    }

    setThreadMessages((currentMessages) => [...currentMessages, nextMessage]);
    setMessage('');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] overflow-auto">
      <WorkspaceTopBar />

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChatPanel expanded />

          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E9F2] p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl text-[#1F2937]">Marketing Team</h2>
              <span className="text-sm text-[#6B7280]">8 online</span>
            </div>

            <div className="flex-1 space-y-3 overflow-auto">
              {threadMessages.map((threadMessage, index) => (
                <div key={`${threadMessage}-${index}`} className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#0B5CFF] to-[#0056D2] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-white">{index % 2 === 0 ? 'SJ' : 'MT'}</span>
                  </div>
                  <div className="flex-1 bg-[#F7F9FC] rounded-2xl rounded-tl-none p-3">
                    <p data-no-translate className="text-sm text-[#1F2937]">{threadMessage}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2 bg-[#F7F9FC] rounded-xl p-2">
              <input
                type="text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Message Marketing Team..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-[#1F2937] placeholder-[#6B7280] px-2"
              />
              <button type="submit" className="p-2 bg-[#0B5CFF] hover:bg-[#0056D2] rounded-lg transition-colors">
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
