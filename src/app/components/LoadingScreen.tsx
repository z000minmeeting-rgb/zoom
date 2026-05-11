import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function LoadingScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/home');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="size-full flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#E5E9F2] rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#0B5CFF] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-lg text-[#1F2937]">Connecting to meeting...</p>
          <p className="text-sm text-[#6B7280]">Please wait</p>
        </div>
      </div>
    </div>
  );
}
