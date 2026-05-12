import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { FloatingVerificationChatButton } from './verification/FloatingVerificationChatButton';
import { getClientAvatarImage, refreshClientProfilesFromRemote } from '../data/clientProfiles';

function isImageAvatarValue(value: string) {
  return /^(data:image\/|https?:\/\/|\/)/.test(value);
}

export function JoinMeetingScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const meetingLinkToken = searchParams.get('meetingLink')?.trim() || '';
  const clientId = searchParams.get('clientId')?.trim() || '';
  const hostName = searchParams.get('hostName')?.trim() || '';
  const hostAvatar = searchParams.get('hostAvatar') || '#0B5CFF';
  const hostInitials = searchParams.get('hostInitials') || hostName.slice(0, 2).toUpperCase();
  const [clientAvatarImage, setClientAvatarImage] = useState(() => getClientAvatarImage(clientId));
  const hostAvatarImage = clientAvatarImage || (isImageAvatarValue(hostAvatar) ? hostAvatar : '');
  const hostAvatarColor = isImageAvatarValue(hostAvatar) ? '#0B5CFF' : hostAvatar;
  const hasSharedMeetingLink = Boolean(meetingLinkToken);
  const hasGeneratedClientMeetingLink = Boolean(meetingLinkToken && clientId);
  const [meetingId, setMeetingId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberName, setRememberName] = useState(true);
  const [activeTab, setActiveTab] = useState<'meeting' | 'event'>('meeting');
  const [audioDisabled, setAudioDisabled] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);

  useEffect(() => {
    setClientAvatarImage(getClientAvatarImage(clientId));
    refreshClientProfilesFromRemote().then(() => {
      setClientAvatarImage(getClientAvatarImage(clientId));
    });
  }, [clientId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingId.trim()) {
      navigate('/loading');
    }
  };

  const openSubscriptionPage = () => {
    const subscriptionParams = new URLSearchParams(searchParams);

    if (hostName && !subscriptionParams.get('hostName')) {
      subscriptionParams.set('hostName', hostName);
    }

    navigate(`/subscription?${subscriptionParams.toString()}`);
  };

  const hostSummary = hostName ? (
    <div className="mb-6 rounded-2xl border border-[#E5E9F2] bg-[#F7F9FC] p-4 text-center">
      <div
        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-white"
        style={{ backgroundColor: hostAvatarImage ? undefined : hostAvatarColor }}
      >
        {hostAvatarImage ? (
          <img src={hostAvatarImage} alt={hostName} className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg" style={{ fontWeight: 700 }}>{hostInitials || 'Z'}</span>
        )}
      </div>
      <p className="text-sm text-[#6B7280]">You are about to have a Zoom meeting with</p>
      <h2 className="mt-1 text-xl text-[#1F2937]" style={{ fontWeight: 600 }}>{hostName}</h2>
      <p className="mt-2 text-xs text-[#6B7280]">Enter the meeting ID before starting or booking this meeting.</p>
    </div>
  ) : null;

  const meetingIdHelpLink = hasSharedMeetingLink ? (
    <button
      type="button"
      onClick={openSubscriptionPage}
      className="text-center text-[#2D8CFF] py-2 hover:underline"
    >
      Don't have the meeting ID? Click here to get the meeting ID for this call.
    </button>
  ) : (
    <p className="text-center text-sm leading-6 text-[#6B7280]">
      Don't have the meeting ID? Please contact the meeting host to get your meeting ID.
    </p>
  );

  return (
    <div className="h-dvh flex flex-col overflow-y-auto bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-center border-b border-[#E5E9F2] px-4 py-4 relative">
        <button
          onClick={() => navigate('/login')}
          className="absolute left-4 p-2 text-[#2D8CFF]"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl text-[#1F2937]">Join</h1>
      </div>

      {/* Desktop/Mobile Content */}
      <div className="flex-1 flex justify-center p-4 py-6 lg:p-8 lg:py-10">
        <div className="w-full max-w-md">
          {/* Mobile Tabs */}
          <div className="lg:hidden flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('meeting')}
              className={`flex-1 py-3 px-6 rounded-full transition-colors text-base ${
                activeTab === 'meeting'
                  ? 'bg-white text-[#1F2937] shadow-sm'
                  : 'bg-[#F5F5F7] text-[#6B7280]'
              }`}
              style={{ fontWeight: 500 }}
            >
              Meeting
            </button>
            <button
              onClick={() => setActiveTab('event')}
              className={`flex-1 py-3 px-6 rounded-full transition-colors text-base ${
                activeTab === 'event'
                  ? 'bg-white text-[#1F2937] shadow-sm'
                  : 'bg-[#F5F5F7] text-[#6B7280]'
              }`}
              style={{ fontWeight: 500 }}
            >
              Event
            </button>
          </div>

          {/* Desktop Modal Style */}
          <div className="hidden lg:block bg-white rounded-2xl shadow-xl border border-[#E5E9F2] p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E5E9F2]">
              <h2 className="text-xl text-[#1F2937]">Join meeting</h2>
              <button
                onClick={() => navigate('/login')}
                className="text-[#6B7280] hover:text-[#1F2937]"
              >
                ×
              </button>
            </div>

            {hostSummary}

            <form onSubmit={handleJoin} className="flex flex-col gap-5">
              <input
                type="text"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="Meeting ID"
                className="w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent text-[#1F2937]"
              />

              {meetingIdHelpLink}

              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent text-[#1F2937]"
              />

              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberName}
                    onChange={(e) => setRememberName(e.target.checked)}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#2D8CFF] focus:ring-[#2D8CFF]"
                  />
                  <span className="text-sm text-[#1F2937]">Remember my name for future meetings</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioDisabled}
                    onChange={(e) => setAudioDisabled(e.target.checked)}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#2D8CFF] focus:ring-[#2D8CFF]"
                  />
                  <span className="text-sm text-[#1F2937]">Don't connect to audio</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={videoDisabled}
                    onChange={(e) => setVideoDisabled(e.target.checked)}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#2D8CFF] focus:ring-[#2D8CFF]"
                  />
                  <span className="text-sm text-[#1F2937]">Turn off my video</span>
                </label>
              </div>

              <p className="text-xs text-[#6B7280]">
                By clicking "Join", you agree to our{' '}
                <a href="#" className="text-[#2D8CFF] hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-[#2D8CFF] hover:underline">Privacy Statement</a>
              </p>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-6 bg-[#2D8CFF] text-white rounded-lg hover:bg-[#1E7BE5] transition-colors"
                >
                  Join
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-6 py-3 bg-[#F5F5F7] text-[#6B7280] rounded-lg hover:bg-[#E5E5EA] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Mobile Form */}
          <div className="lg:hidden flex flex-col gap-6">
            {hostSummary}

            <form onSubmit={handleJoin} className="flex flex-col gap-6">
              <div className="bg-white border-b border-[#E5E9F2] pb-4">
                <input
                  type="text"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="Meeting ID"
                  className="w-full py-3 px-0 bg-transparent border-none focus:outline-none text-center text-lg text-[#6B7280] placeholder-[#9CA3AF]"
                />
              </div>

              {meetingIdHelpLink}

              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full py-3 px-4 bg-[#F7F9FC] border border-[#E5E9F2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D8CFF] focus:border-transparent text-center text-[#1F2937]"
              />

              <button
                type="submit"
                disabled={!meetingId.trim()}
                className={`w-full py-4 px-6 rounded-full text-lg transition-colors ${
                  meetingId.trim()
                    ? 'bg-[#2D8CFF] text-white hover:bg-[#1E7BE5]'
                    : 'bg-[#E8E8ED] text-[#AEAEB2] cursor-not-allowed'
                }`}
                style={{ fontWeight: 500 }}
              >
                Join
              </button>

              <p className="text-sm text-[#6B7280] text-center px-4">
                If you received an invitation link, tap on the link to join the meeting
              </p>

              <div className="mt-4">
                <h3 className="text-base text-[#6B7280] mb-4">Join options</h3>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between py-3 border-b border-[#E5E9F2]">
                    <span className="text-[#1F2937] text-lg">Don't connect to audio</span>
                    <button
                      type="button"
                      onClick={() => setAudioDisabled(!audioDisabled)}
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        audioDisabled ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                          audioDisabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-[#E5E9F2]">
                    <span className="text-[#1F2937] text-lg">Turn off my video</span>
                    <button
                      type="button"
                      onClick={() => setVideoDisabled(!videoDisabled)}
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        videoDisabled ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                          videoDisabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      {hasGeneratedClientMeetingLink && <FloatingVerificationChatButton />}
    </div>
  );
}
