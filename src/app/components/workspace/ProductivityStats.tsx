import { Calendar, Users, Video } from 'lucide-react';

const emptyStats = [
  { id: 'meetings-today', title: 'Meetings Today', value: '0', caption: 'No meetings scheduled', icon: Video },
  { id: 'team-members', title: 'Team Members', value: '0', caption: 'Invite teammates to begin', icon: Users },
  { id: 'this-week', title: 'This Week', value: '0', caption: 'No meetings this week', icon: Calendar },
];

export function ProductivityStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {emptyStats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.id} className="bg-white rounded-2xl shadow-sm border border-[#E5E9F2] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#E8F1FF] rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#0B5CFF]" />
              </div>
              <h3 className="text-[#1F2937]">{stat.title}</h3>
            </div>
            <p className="text-3xl text-[#1F2937] mb-1">{stat.value}</p>
            <p className="text-sm text-[#6B7280]">{stat.caption}</p>
          </div>
        );
      })}
    </div>
  );
}
