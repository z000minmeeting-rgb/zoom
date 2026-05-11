import { AlertCircle, LoaderCircle } from 'lucide-react';

type AuthProcessingScreenProps = {
  mode: 'sign in' | 'sign up';
  hasError: boolean;
  onTryAgain: () => void;
};

export function AuthProcessingScreen({ mode, hasError, onTryAgain }: AuthProcessingScreenProps) {
  return (
    <div className="size-full min-h-dvh flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm rounded-3xl border border-[#E5E9F2] bg-white p-8 text-center shadow-[0_24px_80px_rgba(11,92,255,0.12)]">
        {hasError ? (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF5F4] text-[#B42318]">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl text-[#172033]" style={{ fontWeight: 900 }}>
              Processing failed
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              Error while processing your {mode}. Please try again.
            </p>
            <button
              type="button"
              onClick={onTryAgain}
              className="mt-6 w-full rounded-full bg-[#0B5CFF] px-6 py-3 text-white hover:bg-[#0056D2]"
              style={{ fontWeight: 800 }}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F1FF] text-[#0B5CFF]">
              <LoaderCircle className="h-9 w-9 animate-spin" />
            </div>
            <h1 className="text-2xl text-[#172033]" style={{ fontWeight: 900 }}>
              Processing your {mode}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              Please wait while we verify your request.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
