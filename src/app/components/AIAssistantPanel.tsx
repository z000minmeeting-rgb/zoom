import { useState } from 'react';
import { X, Minimize2, Send, Mic, Paperclip, Sparkles } from 'lucide-react';

export function AIAssistantPanel() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    "Hello! I'm your AI Companion. I can help you schedule meetings, summarize conversations, and boost your productivity. What can I help you with today?",
  ]);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleSend = () => {
    const nextMessage = message.trim();

    if (!nextMessage) {
      return;
    }

    setMessages((currentMessages) => [...currentMessages, nextMessage, 'Error. Please try again.']);
    setMessage('');
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#0B5CFF] text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-[#0056D2] transition-colors lg:hidden xl:flex"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="hidden xl:flex flex-col w-80 bg-white border-l border-[#E5E9F2] h-full">
      <div className="flex items-center justify-between p-4 border-b border-[#E5E9F2]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#0B5CFF] to-[#0056D2] rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-[#1F2937]">AI Companion</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-[#F7F9FC] rounded-lg transition-colors"
          >
            <Minimize2 className="w-4 h-4 text-[#6B7280]" />
          </button>
          <button className="p-1.5 hover:bg-[#F7F9FC] rounded-lg transition-colors">
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="space-y-3">
          {messages.map((chatMessage, index) => (
            <div key={`${chatMessage}-${index}`} className="flex gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-[#0B5CFF] to-[#0056D2] rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 bg-[#F7F9FC] rounded-2xl rounded-tl-none p-3">
                <p className="text-sm text-[#1F2937]">{chatMessage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-[#E5E9F2]">
        <div className="flex items-center gap-2 bg-[#F7F9FC] rounded-xl p-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask AI Companion..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#1F2937] placeholder-[#6B7280] px-2"
          />
          <button className="p-2 hover:bg-white rounded-lg transition-colors">
            <Paperclip className="w-4 h-4 text-[#6B7280]" />
          </button>
          <button className="p-2 hover:bg-white rounded-lg transition-colors">
            <Mic className="w-4 h-4 text-[#6B7280]" />
          </button>
          <button onClick={handleSend} className="p-2 bg-[#0B5CFF] hover:bg-[#0056D2] rounded-lg transition-colors">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
