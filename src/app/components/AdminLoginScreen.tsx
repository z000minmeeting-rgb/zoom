import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export function AdminLoginScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdminAuthenticated, loginAdmin } = useAdminAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = searchParams.get('next') || '/admin';

  if (isAdminAuthenticated) {
    return <Navigate to={nextPath} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await loginAdmin({ pin });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message || 'Unable to sign in.');
      return;
    }

    navigate(nextPath, { replace: true });
  };

  return (
    <div className="flex min-h-dvh w-full overflow-hidden bg-[linear-gradient(135deg,#FFFFFF,#F4F8FF)] p-4 text-[#172033]">
      <main className="mx-auto flex w-full max-w-md flex-col justify-center">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mb-5 inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-sm text-[#0B5CFF] hover:bg-[#E8F1FF]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <form onSubmit={handleSubmit} className="rounded-[1.75rem] border border-[#D8E4FF] bg-white/95 p-6 shadow-[0_24px_80px_rgba(11,92,255,0.12)] backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F1FF] text-[#0B5CFF]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 900 }}>Management only</p>
              <h1 className="text-2xl text-[#172033]" style={{ fontWeight: 900 }}>Admin sign in</h1>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-[#FEE4E2] bg-[#FFF5F4] p-4 text-sm text-[#B42318]">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-[#4B5563]">4-digit admin PIN</span>
              <input
                type="password"
                required
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
                  setError('');
                }}
                placeholder="Enter PIN"
                className="w-full rounded-2xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 text-center text-2xl tracking-[0.35em] text-[#172033] outline-none focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#0B5CFF]"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={pin.length !== 4 || isSubmitting}
            className="mt-6 w-full rounded-full bg-[#0B5CFF] px-6 py-4 text-white shadow-[0_18px_45px_rgba(11,92,255,0.24)] disabled:bg-[#B6C2D6]"
            style={{ fontWeight: 900 }}
          >
            {isSubmitting ? 'Checking PIN...' : 'Open admin dashboard'}
          </button>
        </form>
      </main>
    </div>
  );
}
