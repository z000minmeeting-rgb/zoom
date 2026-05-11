import { Calendar as CalendarIcon, Plus, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { upcomingMeetings } from '../../data/workspaceData';

function getFirstName(name: string) {
  return name.trim().split(' ')[0] || 'there';
}

export function MeetingHeader() {
  const navigate = useNavigate();
  const { user } = useUser();

  return (
    <div className="bg-gradient-to-br from-[#0B5CFF] to-[#0056D2] rounded-2xl p-8 text-white">
      <h1 className="text-3xl mb-2">Good morning, {getFirstName(user?.fullName || 'there')}!</h1>
      <p className="text-white/80 mb-6">You have {upcomingMeetings.length} meetings scheduled for today</p>
      <div className="flex flex-wrap gap-3">
        <button className="flex items-center gap-2 px-6 py-3 bg-white text-[#0B5CFF] rounded-xl hover:bg-white/90 transition-colors">
          <Video className="w-5 h-5" />
          New Meeting
        </button>
        <button className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl hover:bg-white/20 transition-colors">
          <CalendarIcon className="w-5 h-5" />
          Schedule
        </button>
        <button
          onClick={() => navigate('/join')}
          className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl hover:bg-white/20 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Join Meeting
        </button>
      </div>
    </div>
  );
}
