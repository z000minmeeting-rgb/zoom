import { Home, Video, MessageSquare, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Video, label: 'Meetings', path: '/meetings' },
    { icon: MessageSquare, label: 'Chat', path: '/team-chat' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E9F2] safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all min-w-[70px] ${
                isActive
                  ? 'text-[#0B5CFF]'
                  : 'text-[#6B7280]'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
