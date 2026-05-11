import { MeetingHeader } from './workspace/MeetingHeader';
import { MeetingsPanel } from './workspace/MeetingsPanel';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';

export function MeetingsScreen() {
  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] overflow-auto">
      <WorkspaceTopBar />

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <MeetingHeader />
          <MeetingsPanel expanded />
        </div>
      </div>
    </div>
  );
}
