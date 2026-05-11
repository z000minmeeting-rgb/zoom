import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { AuthProcessingScreen } from './auth/AuthProcessingScreen';
import { DesktopAuthShell } from './auth/DesktopAuthShell';

const AUTH_PROCESSING_DELAY_MS = 5 * 60 * 1000;

type AgeVerificationScreenProps = {
  onContinue: () => void;
};

function AgeVerificationForm({ onContinue, isDesktop = false }: AgeVerificationScreenProps & { isDesktop?: boolean }) {
  const navigate = useNavigate();
  const [birthYear, setBirthYear] = useState('');
  const [error, setError] = useState('');
  const currentYear = new Date().getFullYear();
  const parsedBirthYear = Number(birthYear);
  const isValidBirthYear = /^\d{4}$/.test(birthYear) && parsedBirthYear >= 1900 && parsedBirthYear <= currentYear;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!isValidBirthYear) {
      setError('Enter a valid 4-digit birth year.');
      return;
    }

    onContinue();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={isDesktop ? 'w-full' : 'min-h-dvh flex flex-col bg-white text-[#1F2937]'}
    >
      <div className={isDesktop ? 'w-full' : 'relative h-20 shrink-0 flex items-center justify-center px-6'}>
        <button
          type="button"
          onClick={() => navigate('/welcome')}
          className={`${isDesktop ? 'mb-7' : 'absolute left-6 top-1/2 -translate-y-1/2'} text-[#2D8CFF] hover:text-[#1E7BE5] transition-colors`}
          aria-label="Back"
        >
          <ChevronLeft className={isDesktop ? 'w-7 h-7' : 'w-6 h-6'} strokeWidth={2.2} />
        </button>
        <h1
          className={isDesktop ? 'mb-8 text-center text-2xl text-[#1F2937]' : 'text-2xl text-[#1F2937]'}
          style={{ fontWeight: 600 }}
        >
          Sign up
        </h1>
      </div>

      <div className={isDesktop ? 'w-full' : 'flex-1 overflow-auto'}>
        <div className={isDesktop ? 'w-full' : 'w-full max-w-2xl mx-auto pt-8'}>
          <h2
            className={isDesktop ? 'mb-4 text-center text-xl text-[#1F2937]' : 'px-6 mb-4 text-xl text-[#1F2937]'}
            style={{ fontWeight: 600 }}
          >
            Verify your age
          </h2>

          <div className={isDesktop ? 'mb-5' : 'px-6 mb-5'}>
            <input
              value={birthYear}
              onChange={(event) => {
                setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              inputMode="numeric"
              maxLength={4}
              placeholder="Birth year"
              aria-label="Birth year"
              className={isDesktop
                ? 'w-full h-14 bg-[#F7F9FC] border border-[#E5E9F2] rounded-xl text-center text-xl text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent caret-[#2D8CFF]'
                : 'w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg text-base text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent caret-[#2D8CFF]'
              }
            />
          </div>

          <div className={isDesktop ? 'text-center' : 'px-6'}>
            <p
              className={isDesktop ? 'text-sm leading-relaxed text-[#6B7280]' : 'text-sm leading-relaxed text-[#6B7280]'}
              style={{ fontWeight: 400 }}
            >
              Please confirm your birth year. This data will not be stored
            </p>
            {error && <p className="mt-4 text-sm text-[#D92D20]">{error}</p>}

            <button
              type="submit"
              disabled={!isValidBirthYear}
              className={`${isDesktop ? 'mt-7 h-12 rounded-xl text-base' : 'mt-6 py-4 rounded-full text-lg'} w-full transition-colors ${
                isValidBirthYear
                  ? 'bg-[#2D8CFF] text-white hover:bg-[#1E7BE5]'
                  : 'bg-[#E5E9F2] text-[#9CA3AF] cursor-not-allowed'
              }`}
              style={{ fontWeight: 700 }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function AgeVerificationScreen({ onContinue }: AgeVerificationScreenProps) {
  return (
    <>
      <DesktopAuthShell>
        <div className="w-full max-w-[430px] rounded-2xl border border-[#E5E9F2] bg-white p-8 shadow-2xl">
          <AgeVerificationForm onContinue={onContinue} isDesktop />
        </div>
      </DesktopAuthShell>

      <div className="lg:hidden">
        <AgeVerificationForm onContinue={onContinue} />
      </div>
    </>
  );
}

export function SignUpScreen() {
  const navigate = useNavigate();
  const [hasVerifiedAge, setHasVerifiedAge] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessingError, setHasProcessingError] = useState(false);
  const processingTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (processingTimerRef.current) {
      window.clearTimeout(processingTimerRef.current);
    }
  }, []);

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

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

  const resetProcessing = () => {
    if (processingTimerRef.current) {
      window.clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }

    setIsProcessing(false);
    setHasProcessingError(false);
  };

  if (!hasVerifiedAge) {
    return <AgeVerificationScreen onContinue={() => setHasVerifiedAge(true)} />;
  }

  if (isProcessing || hasProcessingError) {
    return <AuthProcessingScreen mode="sign up" hasError={hasProcessingError} onTryAgain={resetProcessing} />;
  }

  return (
    <>
      <DesktopAuthShell>
        <form onSubmit={handleSignUp} className="w-full max-w-[350px] flex flex-col gap-3">
          <div className="mb-4 text-center">
            <h1 className="text-2xl text-[#0B5CFF] leading-none" style={{ fontWeight: 600 }}>zoom</h1>
            <h2 className="text-3xl text-[#1F2937] leading-tight" style={{ fontWeight: 600 }}>Workplace</h2>
          </div>

          <div className="text-center mb-2">
            <h3 className="text-lg text-[#1F2937]" style={{ fontWeight: 500 }}>Create account</h3>
            <p className="text-xs text-[#6B7280]">Join Zoom Workplace today</p>
          </div>

          {error && <p className="text-sm text-center text-[#6B7280]">{error}</p>}

          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full py-3 px-4 bg-white border border-[#9CA3AF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full py-3 px-4 bg-white border border-[#9CA3AF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full py-3 px-4 bg-white border border-[#9CA3AF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
          />
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full py-3 px-4 bg-white border border-[#9CA3AF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
          />

          <button
            type="submit"
            className="w-full py-3 px-6 bg-[#2D8CFF] text-white rounded-xl hover:bg-[#1E7BE5] transition-colors mt-1"
            style={{ fontWeight: 500 }}
          >
            Create account
          </button>

          <button type="button" onClick={() => navigate('/login')} className="mt-2 text-xs text-[#005BFF] hover:underline">
            Already have an account? Sign in
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

            <div className="mb-8 text-center">
              <h1 className="text-3xl text-[#1F2937] mb-2" style={{ fontWeight: 600 }}>Create account</h1>
              <p className="text-[#6B7280]">Join Zoom Workplace today</p>
            </div>

            <form onSubmit={handleSignUp} className="flex flex-col gap-5">
              {error && <p className="text-sm text-center text-[#6B7280]">{error}</p>}

              <div className="flex flex-col gap-2">
                <label className="text-sm text-[#1F2937]">Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-[#1F2937]">Email</label>
                <input
                  type="email"
                  required
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-[#1F2937]">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-[#2D8CFF] text-white rounded-full hover:bg-[#1E7BE5] transition-colors mt-2 text-lg"
                style={{ fontWeight: 500 }}
              >
                Create account
              </button>
            </form>

            <p className="text-sm text-[#6B7280] text-center mt-6">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-[#2D8CFF] hover:underline"
                style={{ fontWeight: 500 }}
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
