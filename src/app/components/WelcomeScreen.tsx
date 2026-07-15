import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { DesktopAuthShell } from './auth/DesktopAuthShell';
import { notifyAppEntry } from '../data/adminNotifications';

function MobileWelcomeHome() {
  const navigate = useNavigate();
  const { logout } = useUser();

  const navigateToAuth = (path: '/login' | '/signup') => {
    logout();
    navigate(path);
  };

  return (
    <div className="size-full flex flex-col bg-[#2D8CFF] relative overflow-hidden">
      {/* Settings icon */}
      <div className="absolute top-6 left-6 z-10">
        <button className="w-10 h-10 flex items-center justify-center text-white/90">
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Top section with branding */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-6xl text-white tracking-tight" style={{ fontWeight: 600 }}>zoom</h1>
          <h2 className="text-5xl text-white tracking-tight" style={{ fontWeight: 400 }}>Workplace</h2>
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="bg-[#F5F5F7] rounded-t-[32px] px-6 pt-8 pb-10 shadow-2xl">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-2xl text-[#1F2937]" style={{ fontWeight: 500 }}>Welcome</h3>
            <p className="text-[#6B7280] text-center">
              Get started with your account
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => navigateToAuth('/login')}
              className="w-full py-4 px-6 bg-[#2D8CFF] text-white rounded-full hover:bg-[#1E7BE5] transition-colors text-lg"
              style={{ fontWeight: 500 }}
            >
              Sign in
            </button>

            <button
              onClick={() => navigateToAuth('/signup')}
              className="w-full py-4 px-6 bg-[#E8E8ED] text-[#2D8CFF] rounded-full hover:bg-[#D8D8DD] transition-colors text-lg"
              style={{ fontWeight: 500 }}
            >
              Sign up
            </button>

            <button
              onClick={() => navigate('/join')}
              className="w-full py-4 px-6 bg-[#E8E8ED] text-[#2D8CFF] rounded-full hover:bg-[#D8D8DD] transition-colors text-lg"
              style={{ fontWeight: 500 }}
            >
              Join a meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { logout } = useUser();

  useEffect(() => {
    notifyAppEntry();
  }, []);

  const navigateToAuth = (path: '/login' | '/signup') => {
    logout();
    navigate(path);
  };

  return (
    <>
      <DesktopAuthShell>
        <div className="w-full max-w-[420px] flex flex-col items-center text-center">
          <div className="mb-8">
            <h1 className="text-3xl text-[#0B5CFF] leading-none" style={{ fontWeight: 600 }}>zoom</h1>
            <h2 className="text-4xl text-[#1F2937] leading-tight" style={{ fontWeight: 600 }}>Workplace</h2>
          </div>

          <div className="mb-8">
            <h3 className="text-2xl text-[#1F2937]" style={{ fontWeight: 600 }}>Welcome</h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              Sign in or create an account to start using Zoom Workplace.
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => navigateToAuth('/login')}
              className="w-full py-3 px-6 bg-[#2D8CFF] text-white rounded-xl hover:bg-[#1E7BE5] transition-colors"
              style={{ fontWeight: 500 }}
            >
              Sign in
            </button>
            <button
              onClick={() => navigateToAuth('/signup')}
              className="w-full py-3 px-6 bg-[#E8F1FF] text-[#0B5CFF] rounded-xl hover:bg-[#D9E8FF] transition-colors"
              style={{ fontWeight: 500 }}
            >
              Create account
            </button>
            <button
              onClick={() => navigate('/join')}
              className="w-full py-3 px-6 bg-white border border-[#D1D5DB] text-[#1F2937] rounded-xl hover:bg-[#F7F9FC] transition-colors"
              style={{ fontWeight: 500 }}
            >
              Join a meeting
            </button>
          </div>
        </div>
      </DesktopAuthShell>

      <div className="block lg:hidden size-full">
        <MobileWelcomeHome />
      </div>
    </>
  );
}
