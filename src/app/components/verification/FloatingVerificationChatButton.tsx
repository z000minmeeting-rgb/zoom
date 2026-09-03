import { useState } from 'react';
import { MessageCircle, Plus, RotateCcw, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

type FloatingVerificationChatButtonProps = {
  onStartNew?: () => void;
};

export function FloatingVerificationChatButton({ onStartNew }: FloatingVerificationChatButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const registrationPath = () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('focus');
    const query = searchParams.toString();

    return `/subscription/register${query ? `?${query}` : ''}`;
  };

  const returningPath = () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('focus', 'returning');
    const query = searchParams.toString();

    return `/subscription/register${query ? `?${query}` : ''}`;
  };

  const startNewConversation = () => {
    setIsOpen(false);

    if (onStartNew) {
      onStartNew();
      return;
    }

    navigate(registrationPath());
  };

  // Chat access is a private credential, never something this menu can look up.
  // Returning customers are sent to the form that emails them a fresh link.
  const continueConversation = () => {
    setIsOpen(false);
    navigate(returningPath());
  };

  return (
    <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {isOpen && (
        <div className="w-[min(21rem,calc(100vw-2rem))] rounded-[1.5rem] border border-[#D8E4FF] bg-white/95 p-3 shadow-[0_24px_70px_rgba(11,92,255,0.22)] backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-[#172033]" style={{ fontWeight: 900 }}>Verification chat</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F4F8FF]"
              aria-label="Close verification chat menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={startNewConversation}
              className="flex items-center gap-3 rounded-2xl border border-[#D8E4FF] bg-[#F7FAFF] px-4 py-3 text-left hover:bg-[#E8F1FF]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B5CFF] text-white">
                <Plus className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-[#172033]" style={{ fontWeight: 900 }}>Start new conversation</span>
                <span className="block text-xs text-[#6B7280]">Create a fresh verification chat.</span>
              </span>
            </button>

            <button
              type="button"
              onClick={continueConversation}
              className="flex items-center gap-3 rounded-2xl border border-[#E5E9F2] bg-white px-4 py-3 text-left hover:bg-[#F7FAFF]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F1FF] text-[#0B5CFF]">
                <RotateCcw className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-[#172033]" style={{ fontWeight: 900 }}>Continue old chat</span>
                <span className="block text-xs text-[#6B7280]">
                  Get a secure link emailed to you.
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0B5CFF,#25B7FF)] text-white shadow-[0_18px_42px_rgba(11,92,255,0.36)] transition-transform hover:scale-105"
        aria-label="Open verification chat options"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
