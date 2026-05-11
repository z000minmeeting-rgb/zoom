import { Home, Video, MessageSquare, Mail, Calendar, Layers, Users, Settings, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Video, label: 'Meetings', path: '/meetings' },
    { icon: MessageSquare, label: 'Team Chat', path: '/team-chat' },
    { icon: Mail, label: 'Mail', path: '/mail' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: Layers, label: 'Whiteboards', path: '/whiteboards' },
    { icon: Users, label: 'Contacts', path: '/contacts' },
    { icon: ShieldCheck, label: 'Admin', path: '/admin' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="hidden lg:flex flex-col w-20 bg-white border-r border-[#E5E9F2] py-6">
      <div className="flex flex-col items-center gap-8">
        <div className="w-10 h-10 bg-[#0B5CFF] rounded-xl flex items-center justify-center">
          <svg viewBox="0 0 48 48" className="w-6 h-6" fill="white">
            <path d="M24 8C15.163 8 8 15.163 8 24s7.163 16 16 16 16-7.163 16-16S32.837 8 24 8zm0 4c6.627 0 12 5.373 12 12s-5.373 12-12 12-12-5.373-12-12S17.373 12 24 12z"/>
            <circle cx="18" cy="20" r="2.5"/>
            <circle cx="30" cy="20" r="2.5"/>
            <path d="M18 28c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
          </svg>
        </div>

        <nav className="flex flex-col gap-2 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/admin'
              ? location.pathname.startsWith('/admin')
              : location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all group ${
                  isActive
                    ? 'bg-[#E8F1FF] text-[#0B5CFF]'
                    : 'text-[#6B7280] hover:bg-[#F7F9FC] hover:text-[#1F2937]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
