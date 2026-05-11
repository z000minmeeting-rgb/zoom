import { ChatPanel } from './workspace/ChatPanel';
import { MeetingHeader } from './workspace/MeetingHeader';
import { MeetingsPanel } from './workspace/MeetingsPanel';
import { ProductivityStats } from './workspace/ProductivityStats';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';

export function DashboardScreen() {
  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] overflow-auto">
      <WorkspaceTopBar />

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <MeetingHeader />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MeetingsPanel />
            <ChatPanel />
          </div>

          <ProductivityStats />
        </div>
      </div>
    </div>
  );
}
