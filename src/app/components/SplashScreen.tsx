import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/welcome', { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="size-full flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <h1 className="text-6xl text-[#2D8CFF] tracking-tight" style={{ fontWeight: 600 }}>zoom</h1>
        <h2 className="text-5xl text-[#1F2937] tracking-tight" style={{ fontWeight: 500 }}>Workplace</h2>
      </div>
    </div>
  );
}
