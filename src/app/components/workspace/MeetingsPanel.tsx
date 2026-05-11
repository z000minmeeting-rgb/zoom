import { Clock, Users, Video } from 'lucide-react';
import { upcomingMeetings } from '../../data/workspaceData';

type MeetingsPanelProps = {
  expanded?: boolean;
};

export function MeetingsPanel({ expanded = false }: MeetingsPanelProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E5E9F2] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl text-[#1F2937]">Upcoming Meetings</h2>
        {!expanded && <button className="text-sm text-[#0B5CFF] hover:underline">View all</button>}
      </div>
      <div className="space-y-4">
        {upcomingMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-[#F7F9FC] rounded-xl">
            <div className="w-12 h-12 bg-[#E8F1FF] rounded-xl flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-[#0B5CFF]" />
            </div>
            <h3 className="text-[#1F2937] mb-1">No upcoming meetings</h3>
            <p className="text-sm text-[#6B7280]">Your scheduled meetings will appear here.</p>
          </div>
        ) : (
          upcomingMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="flex items-start gap-4 p-4 bg-[#F7F9FC] rounded-xl hover:bg-[#E8F1FF] transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 bg-[#0B5CFF] rounded-xl flex items-center justify-center flex-shrink-0">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[#1F2937] mb-1">{meeting.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {meeting.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {meeting.participants} participants
                  </span>
                  {expanded && <span>{meeting.type}</span>}
                  {expanded && <span>{meeting.duration}</span>}
                </div>
              </div>
              <button className="px-4 py-2 bg-[#0B5CFF] text-white text-sm rounded-lg hover:bg-[#0056D2] transition-colors">
                Join
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
