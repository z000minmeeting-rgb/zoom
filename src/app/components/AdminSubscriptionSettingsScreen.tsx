import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';
import {
  HOST_NAME_TOKEN,
  SubscriptionPageContent,
  createSubscriptionPackage,
  loadSubscriptionContent,
  refreshSubscriptionContentFromRemote,
  resetSubscriptionContent,
  saveSubscriptionContent,
} from '../data/subscriptionPackages';
import { disablePushNotifications, enablePushNotifications, getPushRegistrationState, type PushRegistrationState } from '../data/adminPushSettings';

function toLines(items: string[]) {
  return items.join('\n');
}

function fromLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeContent(content: SubscriptionPageContent): SubscriptionPageContent {
  return {
    ...content,
    eyebrow: content.eyebrow.trim() || 'Private fan booking',
    titleTemplate: content.titleTemplate.trim() || `Exclusive Celebrity Video Call Packages with "${HOST_NAME_TOKEN}"`,
    introTemplate: content.introTemplate.trim(),
    availablePackagesTitle: content.availablePackagesTitle.trim() || 'Available Packages',
    whyTitle: content.whyTitle.trim() || 'Why the Premium Fee Applies',
    whyItems: content.whyItems.map((item) => item.trim()).filter(Boolean),
    closingTemplate: content.closingTemplate.trim(),
    packages: content.packages.map((subscriptionPackage, index) => ({
      ...subscriptionPackage,
      id: subscriptionPackage.id || `package-${index + 1}`,
      name: subscriptionPackage.name.trim() || `Package ${index + 1}`,
      summary: subscriptionPackage.summary.trim(),
      price: subscriptionPackage.price.trim() || '$0',
      duration: subscriptionPackage.duration.trim() || 'Every package subscription lasts for 3 months.',
      highlights: subscriptionPackage.highlights.map((highlight) => highlight.trim()).filter(Boolean),
    })).filter((subscriptionPackage) => subscriptionPackage.name),
  };
}

export function AdminSubscriptionSettingsScreen() {
  const navigate = useNavigate();
  const [content, setContent] = useState<SubscriptionPageContent>(() => loadSubscriptionContent());
  const [saveStatus, setSaveStatus] = useState('');
  const [pushState, setPushState] = useState<PushRegistrationState>(() => getPushRegistrationState());
  const [pushStatus, setPushStatus] = useState('');

  useEffect(() => {
    refreshSubscriptionContentFromRemote().then(setContent);
  }, []);

  const updateContent = <Key extends keyof SubscriptionPageContent>(
    key: Key,
    value: SubscriptionPageContent[Key]
  ) => {
    setContent((currentContent) => ({ ...currentContent, [key]: value }));
    setSaveStatus('');
  };

  const updatePackage = (
    packageId: string,
    key: 'name' | 'summary' | 'price' | 'duration',
    value: string
  ) => {
    setContent((currentContent) => ({
      ...currentContent,
      packages: currentContent.packages.map((subscriptionPackage) => (
        subscriptionPackage.id === packageId
          ? { ...subscriptionPackage, [key]: value }
          : subscriptionPackage
      )),
    }));
    setSaveStatus('');
  };

  const updatePackageHighlights = (packageId: string, value: string) => {
    setContent((currentContent) => ({
      ...currentContent,
      packages: currentContent.packages.map((subscriptionPackage) => (
        subscriptionPackage.id === packageId
          ? { ...subscriptionPackage, highlights: fromLines(value) }
          : subscriptionPackage
      )),
    }));
    setSaveStatus('');
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const nextContent = normalizeContent(content);
    saveSubscriptionContent(nextContent);
    setContent(nextContent);
    setSaveStatus('Subscription package page saved.');
  };

  const handleReset = () => {
    setContent(resetSubscriptionContent());
    setSaveStatus('Default subscription content restored.');
  };

  const refreshPushRegistration = () => {
    setPushState(getPushRegistrationState());
    setPushStatus('Registration status refreshed.');
  };

  const enablePush = async () => {
    try {
      setPushState(await enablePushNotifications());
      setPushStatus('Push notifications are enabled on this device.');
    } catch (error) {
      setPushState(getPushRegistrationState());
      setPushStatus(error instanceof Error ? error.message : 'Unable to enable push notifications.');
    }
  };

  const disablePush = async () => {
    await disablePushNotifications();
    setPushState(getPushRegistrationState());
    setPushStatus('Push notifications are disabled on this device.');
  };

  return (
    <div className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-[#F7F9FC]">
      <div className="sticky top-0 z-20 shrink-0 bg-white">
        <WorkspaceTopBar />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-6 pb-28 lg:p-8">
        <form onSubmit={handleSave} className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="mb-4 inline-flex items-center gap-2 text-sm text-[#0B5CFF] hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to admin
              </button>
              <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 700 }}>Admin settings</p>
              <h1 className="mt-1 text-3xl text-[#1F2937]" style={{ fontWeight: 700 }}>Subscription package editor</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">
                Update the public fan membership subscription page without changing code. Use {HOST_NAME_TOKEN} anywhere the selected host client's name should appear.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D6DCE8] bg-white px-5 py-3 text-[#4B5563] hover:bg-[#F7F9FC]"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B5CFF] px-5 py-3 text-white hover:bg-[#0056D2]"
              >
                <Save className="h-4 w-4" />
                Save changes
              </button>
            </div>
          </div>

          {saveStatus && (
            <div className="mb-5 rounded-xl border border-[#BFE7D1] bg-[#EEFBF4] px-4 py-3 text-sm text-[#157347]">
              {saveStatus}
            </div>
          )}

          <section className="mb-6 rounded-2xl border border-[#E5E9F2] bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-xl text-[#1F2937]" style={{ fontWeight: 700 }}>Admin Push Notifications</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
              <div><p className="text-[#6B7280]">Status</p><p className="mt-1 text-[#172033]">{pushState.active ? 'Active on this device' : 'Not active'}</p></div>
              <div><p className="text-[#6B7280]">Notification Permission</p><p className="mt-1 text-[#172033]">{pushState.permission}</p></div>
              <div><p className="text-[#6B7280]">Current Device</p><p className="mt-1 text-[#172033]">{pushState.supported ? 'Push supported' : 'Push unsupported'}</p></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={enablePush} className="rounded-xl bg-[#0B5CFF] px-4 py-3 text-sm text-white hover:bg-[#0056D2]">Enable on this Device</button>
              <button type="button" onClick={disablePush} className="rounded-xl border border-[#FEE4E2] bg-white px-4 py-3 text-sm text-[#B42318] hover:bg-[#FFF5F4]">Disable Notifications</button>
              <button type="button" onClick={refreshPushRegistration} className="rounded-xl border border-[#D6DCE8] bg-white px-4 py-3 text-sm text-[#4B5563] hover:bg-[#F7F9FC]">Refresh Registration</button>
            </div>
            {pushStatus && <p className="mt-4 text-sm text-[#157347]">{pushStatus}</p>}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-2xl border border-[#E5E9F2] bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-xl text-[#1F2937]" style={{ fontWeight: 700 }}>Page copy</h2>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm text-[#4B5563]">Eyebrow</span>
                  <input
                    value={content.eyebrow}
                    onChange={(event) => updateContent('eyebrow', event.target.value)}
                    className="w-full rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-[#4B5563]">Page title</span>
                  <textarea
                    value={content.titleTemplate}
                    onChange={(event) => updateContent('titleTemplate', event.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-[#4B5563]">Intro paragraph</span>
                  <textarea
                    value={content.introTemplate}
                    onChange={(event) => updateContent('introTemplate', event.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-[#4B5563]">Packages heading</span>
                  <input
                    value={content.availablePackagesTitle}
                    onChange={(event) => updateContent('availablePackagesTitle', event.target.value)}
                    className="w-full rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-[#4B5563]">Premium fee heading</span>
                  <input
                    value={content.whyTitle}
                    onChange={(event) => updateContent('whyTitle', event.target.value)}
                    className="w-full rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-[#4B5563]">Premium fee bullet points</span>
                  <textarea
                    value={toLines(content.whyItems)}
                    onChange={(event) => updateContent('whyItems', fromLines(event.target.value))}
                    rows={6}
                    className="w-full resize-none rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-[#4B5563]">Closing message</span>
                  <textarea
                    value={content.closingTemplate}
                    onChange={(event) => updateContent('closingTemplate', event.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[#E5E9F2] bg-[#F7F9FC] px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-[#E5E9F2] bg-white p-5 shadow-sm lg:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl text-[#1F2937]" style={{ fontWeight: 700 }}>Packages</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">Edit names, prices, duration, and package details.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateContent('packages', [...content.packages, createSubscriptionPackage()]);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B5CFF] px-4 py-3 text-sm text-white hover:bg-[#0056D2]"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              <div className="mt-5 space-y-5">
                {content.packages.map((subscriptionPackage, index) => (
                  <div key={subscriptionPackage.id} className="rounded-2xl border border-[#E5E9F2] bg-[#F7F9FC] p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 700 }}>Package {index + 1}</p>
                      {content.packages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => updateContent('packages', content.packages.filter((item) => item.id !== subscriptionPackage.id))}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#B42318] hover:bg-[#FEE4E2]"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm text-[#4B5563]">Name</span>
                        <input
                          value={subscriptionPackage.name}
                          onChange={(event) => updatePackage(subscriptionPackage.id, 'name', event.target.value)}
                          className="w-full rounded-xl border border-[#E5E9F2] bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm text-[#4B5563]">Price</span>
                        <input
                          value={subscriptionPackage.price}
                          onChange={(event) => updatePackage(subscriptionPackage.id, 'price', event.target.value)}
                          className="w-full rounded-xl border border-[#E5E9F2] bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                        />
                      </label>
                    </div>

                    <label className="mt-3 block">
                      <span className="mb-2 block text-sm text-[#4B5563]">Package offer</span>
                      <input
                        value={subscriptionPackage.summary}
                        onChange={(event) => updatePackage(subscriptionPackage.id, 'summary', event.target.value)}
                        className="w-full rounded-xl border border-[#E5E9F2] bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                      />
                    </label>

                    <label className="mt-3 block">
                      <span className="mb-2 block text-sm text-[#4B5563]">Subscription duration</span>
                      <input
                        value={subscriptionPackage.duration}
                        onChange={(event) => updatePackage(subscriptionPackage.id, 'duration', event.target.value)}
                        className="w-full rounded-xl border border-[#E5E9F2] bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                      />
                    </label>

                    <label className="mt-3 block">
                      <span className="mb-2 block text-sm text-[#4B5563]">Package details</span>
                      <textarea
                        value={toLines(subscriptionPackage.highlights)}
                        onChange={(event) => updatePackageHighlights(subscriptionPackage.id, event.target.value)}
                        rows={5}
                        className="w-full resize-none rounded-xl border border-[#E5E9F2] bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </form>
      </main>
    </div>
  );
}
