import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUp,
  FileText,
  Home,
  MessageSquare,
  Minus,
  Monitor,
  MoreHorizontal,
  Paperclip,
  Phone,
  Scissors,
  Settings,
  Sparkles,
  Square,
  X,
} from 'lucide-react';

type DesktopAuthShellProps = {
  children: ReactNode;
};

type GuestPrompt = {
  title: string;
  message: string;
};

const desktopNavItems = [
  {
    icon: Home,
    label: 'Home',
    prompt: 'Sign in to view your home dashboard and continue from where you left off.',
  },
  {
    icon: MessageSquare,
    label: 'Team Chat',
    prompt: 'Sign in to chat with team and continue with meeting discussion.',
  },
  {
    icon: Phone,
    label: 'Phone',
    prompt: 'Sign in to make calls, review voicemail, and manage your phone activity.',
  },
  {
    icon: FileText,
    label: 'Docs',
    prompt: 'Sign in to open docs, collaborate on files, and keep your work in sync.',
  },
  {
    icon: Monitor,
    label: 'Whiteboards',
    prompt: 'Sign in to create whiteboards and collaborate visually with your team.',
  },
  {
    icon: Scissors,
    label: 'Clips',
    prompt: 'Sign in to record, view, and share clips with your workspace.',
  },
  {
    icon: MoreHorizontal,
    label: 'More',
    prompt: 'Sign in to access more Zoom Workplace tools and settings.',
  },
];

const settingsPrompt = {
  title: 'Sign in required',
  message: 'Sign in to manage your profile, preferences, and workspace settings.',
};

export function DesktopAuthShell({ children }: DesktopAuthShellProps) {
  const navigate = useNavigate();
  const [guestPrompt, setGuestPrompt] = useState<GuestPrompt | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  const showPrompt = (message: string) => {
    setGuestPrompt({ title: 'Sign in required', message });
  };

  const handleAiSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedInput = aiInput.trim();

    if (!trimmedInput) {
      return;
    }

    setAiMessages((messages) => [
      ...messages,
      { role: 'user', text: trimmedInput },
      { role: 'assistant', text: 'Error. Please try again.' },
    ]);
    setAiInput('');
  };

  return (
    <div className="hidden lg:flex h-dvh w-full min-w-0 overflow-hidden bg-[#DDE2E8] p-3">
      <div className="w-full h-full min-w-0 bg-[#DDE2E8] shadow-2xl flex flex-col overflow-hidden">
        <div className="h-[58px] shrink-0 flex items-center justify-between px-6">
          <div className="leading-none text-[#1F2937]">
            <p className="text-xs" style={{ fontWeight: 500 }}>zoom</p>
            <p className="text-base" style={{ fontWeight: 600 }}>Workplace</p>
          </div>

          <div className="flex items-center gap-6 text-[#6B7280]">
            <div className="w-8 h-8 bg-[#E8F1FF] rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#0B5CFF]" />
            </div>
            <Minus className="w-4 h-4" />
            <Square className="w-3.5 h-3.5" />
            <X className="w-5 h-5" />
          </div>
        </div>

        <div className="flex flex-1 min-h-0 min-w-0">
          <aside className="w-[86px] shrink-0 bg-[#DDE2E8] flex flex-col items-center justify-between pt-0 pb-7">
            <nav className="w-full flex flex-col items-center gap-1">
              {desktopNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => showPrompt(item.prompt)}
                    className="w-[70px] flex flex-col items-center gap-2 py-3 rounded-lg text-[#111827] hover:bg-white transition-colors"
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                    <span className="text-xs">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setGuestPrompt(settingsPrompt)}
              className="w-[70px] flex flex-col items-center gap-2 py-3 rounded-lg text-[#111827] hover:bg-white transition-colors"
            >
              <Settings className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </aside>

          <main className="flex-1 min-w-0 bg-white rounded-lg mb-2 mr-2 overflow-hidden flex">
            <section className="flex-1 min-w-0 overflow-auto flex flex-col items-center justify-center relative p-8">
              {children}
              <p className="absolute bottom-5 text-xs text-[#111827]">Version: 6.7.8 (32670)</p>
            </section>

            <aside className="w-[360px] xl:w-[420px] shrink-0 m-3 rounded-lg bg-white p-[2px] bg-gradient-to-b from-[#FF7A1A] via-[#AE45FF] to-[#0B8CFF]">
              <div className="size-full min-h-0 rounded-[7px] bg-white p-6 flex flex-col">
                <div className="flex items-start gap-3 mb-6">
                  <Sparkles className="w-12 h-12 text-[#0B5CFF] shrink-0" />
                  <div>
                    <p className="text-base text-[#374151]">Get more done with</p>
                    <h2 className="text-4xl leading-none bg-gradient-to-r from-[#0B5CFF] via-[#6F48FF] to-[#FF6B6B] bg-clip-text text-transparent" style={{ fontWeight: 700 }}>
                      AI Companion
                    </h2>
                  </div>
                </div>

                <div className="flex justify-end mb-5">
                  <button type="button" className="px-3 py-2 bg-[#DBEAFE] text-[#111827] rounded-md text-sm">
                    What is AI Companion?
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-auto pr-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-[#0B5CFF]" />
                    <span className="text-xs text-[#4B5563]">AI Companion</span>
                  </div>

                  <div className="text-sm text-[#3F3F46] leading-relaxed space-y-3">
                    <p>I'm AI Companion, your personal Zoom assistant. I can help you with:</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Searching meetings, chats, emails, or files using keywords, attendees, or dates</li>
                      <li>Summarizing or answering questions about meetings, chats, emails, or files</li>
                      <li>Preparing for upcoming meetings with relevant materials</li>
                      <li>Finding people based on relationships like team members or managers</li>
                      <li>Getting someone's profile details such as email, location, or job title</li>
                      <li>Answering questions using up-to-date information from web searches</li>
                    </ul>
                    <p>Let me know how I can assist you!</p>
                  </div>

                  {aiMessages.length > 0 && (
                    <div className="mt-6 space-y-3">
                      {aiMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`rounded-xl px-3 py-2 text-sm ${
                            message.role === 'user'
                              ? 'ml-8 bg-[#E8F1FF] text-[#111827]'
                              : 'mr-8 bg-[#F7F9FC] text-[#D92D20]'
                          }`}
                        >
                          {message.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAiSubmit} className="mt-5 flex items-center gap-2 border border-[#E5E9F2] rounded-full px-4 py-2 text-[#6B7280]">
                  <Paperclip className="w-4 h-4 shrink-0" />
                  <input
                    value={aiInput}
                    onChange={(event) => setAiInput(event.target.value)}
                    placeholder="Message AI Companion"
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none"
                  />
                  <button type="submit" className="w-7 h-7 rounded-full bg-[#0B5CFF] flex items-center justify-center">
                    <ArrowUp className="w-4 h-4 text-white" />
                  </button>
                </form>
              </div>
            </aside>
          </main>
        </div>
      </div>

      {guestPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-[380px] rounded-2xl bg-white p-6 shadow-2xl text-center">
            <h2 className="text-xl text-[#1F2937]" style={{ fontWeight: 600 }}>{guestPrompt.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">{guestPrompt.message}</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3 px-5 rounded-xl bg-[#2D8CFF] text-white hover:bg-[#1E7BE5] transition-colors"
                style={{ fontWeight: 500 }}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="w-full py-3 px-5 rounded-xl bg-[#E8F1FF] text-[#0B5CFF] hover:bg-[#D9E8FF] transition-colors"
                style={{ fontWeight: 500 }}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setGuestPrompt(null)}
                className="text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
