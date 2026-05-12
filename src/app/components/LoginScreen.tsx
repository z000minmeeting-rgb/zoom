import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { AuthProcessingScreen } from './auth/AuthProcessingScreen';
import { DesktopAuthShell } from './auth/DesktopAuthShell';

const AUTH_PROCESSING_DELAY_MS = 5 * 60 * 1000;
const ADMIN_ENTRY_CLICK_TARGET = 5;

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [adminEntryClickCount, setAdminEntryClickCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessingError, setHasProcessingError] = useState(false);
  const processingTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (processingTimerRef.current) {
      window.clearTimeout(processingTimerRef.current);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHasProcessingError(false);
    setIsProcessing(true);

    if (processingTimerRef.current) {
      window.clearTimeout(processingTimerRef.current);
    }

    processingTimerRef.current = window.setTimeout(() => {
      setIsProcessing(false);
      setHasProcessingError(true);
    }, AUTH_PROCESSING_DELAY_MS);
  };

  const handleAdminEntryClick = () => {
    const nextCount = adminEntryClickCount + 1;

    if (nextCount >= ADMIN_ENTRY_CLICK_TARGET) {
      setAdminEntryClickCount(0);
      navigate('/admin');
      return;
    }

    setAdminEntryClickCount(nextCount);
  };

  const resetProcessing = () => {
    if (processingTimerRef.current) {
      window.clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }

    setIsProcessing(false);
    setHasProcessingError(false);
  };

  if (isProcessing || hasProcessingError) {
    return <AuthProcessingScreen mode="sign in" hasError={hasProcessingError} onTryAgain={resetProcessing} />;
  }

  return (
    <>
      <DesktopAuthShell>
        <form onSubmit={handleLogin} className="w-full max-w-[350px] flex flex-col gap-3">
          <div className="mb-4 text-center">
            <h1 className="text-2xl text-[#0B5CFF] leading-none" style={{ fontWeight: 600 }}>zoom</h1>
            <h2 className="text-3xl text-[#1F2937] leading-tight" style={{ fontWeight: 600 }}>Workplace</h2>
          </div>

          <div className="mb-2 text-center">
            <button type="button" onClick={handleAdminEntryClick} className="cursor-default">
              <h3 className="text-lg text-[#1F2937]" style={{ fontWeight: 500 }}>Sign in</h3>
            </button>
            <p className="text-xs text-[#6B7280]">Welcome back to Zoom Workplace</p>
          </div>

          {error && <p className="text-sm text-center text-[#6B7280]">{error}</p>}

          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full py-3 px-4 bg-white border border-[#9CA3AF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full py-3 px-4 bg-white border border-[#9CA3AF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
          />

          <button
            type="submit"
            className="w-full py-3 px-6 bg-[#2D8CFF] text-white rounded-xl hover:bg-[#1E7BE5] transition-colors mt-1"
            style={{ fontWeight: 500 }}
          >
            Sign in
          </button>

          <button type="button" onClick={() => navigate('/signup')} className="mt-2 text-xs text-[#005BFF] hover:underline">
            Create a new account
          </button>
        </form>
      </DesktopAuthShell>

      <div className="lg:hidden size-full flex bg-white overflow-auto">
        <div className="flex-1 flex flex-col p-6">
          <div className="w-full max-w-md mx-auto">
            <button
              onClick={() => navigate('/welcome')}
              className="flex items-center gap-2 text-[#2D8CFF] hover:text-[#1E7BE5] mb-8"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            <button type="button" onClick={handleAdminEntryClick} className="mb-8 w-full cursor-default text-center">
              <h1 className="text-3xl text-[#1F2937] mb-2" style={{ fontWeight: 600 }}>Sign in</h1>
              <p className="text-[#6B7280]">Welcome back to Zoom Workplace</p>
            </button>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              {error && <p className="text-sm text-center text-[#6B7280]">{error}</p>}

              <div className="flex flex-col gap-2">
                <label className="text-sm text-[#1F2937]">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-[#1F2937]">Password</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-[#2D8CFF] text-white rounded-full hover:bg-[#1E7BE5] transition-colors mt-2 text-lg"
                style={{ fontWeight: 500 }}
              >
                Sign in
              </button>
            </form>

            <p className="text-sm text-[#6B7280] text-center mt-6">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-[#2D8CFF] hover:underline"
                style={{ fontWeight: 500 }}
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
