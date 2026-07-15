import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLocalization } from '../context/LocalizationContext';
import { settingsSections } from '../data/workspaceData';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const { language, setLanguage } = useLocalization();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] overflow-auto">
      <div className="bg-white border-b border-[#E5E9F2] px-6 py-6">
        <h1 className="text-2xl text-[#1F2937]">Settings</h1>
        <p className="text-[#6B7280] mt-1">Manage your workspace preferences</p>
      </div>

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E9F2] overflow-hidden">
            {settingsSections.map((section, index) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.label}
                  className={`w-full flex items-center gap-4 p-6 hover:bg-[#F7F9FC] transition-colors ${
                    index !== settingsSections.length - 1 ? 'border-b border-[#E5E9F2]' : ''
                  }`}
                >
                  <div className="w-12 h-12 bg-[#E8F1FF] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-[#0B5CFF]" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[#1F2937] mb-1">{section.label}</h3>
                    <p className="text-sm text-[#6B7280]">{section.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                </button>
              );
            })}
          </div>

          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-[#E5E9F2] p-6">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-[#E5E9F2] pb-4">
              <div>
                <h2 className="text-lg text-[#1F2937]">Language</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Choose the language used across the application</p>
              </div>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as 'en' | 'it')}
                aria-label="Language"
                className="rounded-xl border border-[#D7DDE8] bg-white px-3 py-2 text-sm text-[#1F2937] outline-none focus:ring-2 focus:ring-[#0B5CFF]"
              >
                <option value="en">English</option>
                <option value="it">Italiano</option>
              </select>
            </div>
            <h2 className="text-lg text-[#1F2937] mb-4">Account Information</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-[#E5E9F2]">
                <span className="text-[#6B7280]">Email</span>
                <span className="text-[#1F2937]">{user?.email || 'No email added'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-[#E5E9F2]">
                <span className="text-[#6B7280]">Version</span>
                <span className="text-[#1F2937]">5.14.0 (2024)</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-[#6B7280]">Plan</span>
                <span className="text-[#0B5CFF]">Pro</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full mt-6 py-4 px-6 bg-white border border-[#E5E9F2] text-[#6B7280] rounded-xl hover:bg-[#F7F9FC] hover:text-[#1F2937] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
