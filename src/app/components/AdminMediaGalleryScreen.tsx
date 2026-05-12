import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Search, X } from 'lucide-react';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';
import { ChatAttachment, VERIFICATION_EVENT_NAME, readThreads, refreshThreadsFromRemote } from '../data/verificationChat';

type GalleryItem = {
  attachment: ChatAttachment;
  subscriberName: string;
  packageName: string;
  createdAt: string;
};

function getGalleryItems() {
  return readThreads().flatMap((thread) => (
    thread.messages.flatMap((message) => (
      message.attachments.map((attachment) => ({
        attachment,
        subscriberName: thread.fullName,
        packageName: thread.packageName,
        createdAt: message.createdAt,
      }))
    ))
  ));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function AdminMediaGalleryScreen() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);
  const [galleryItems, setGalleryItems] = useState(() => getGalleryItems());

  useEffect(() => {
    const refreshGallery = () => setGalleryItems(getGalleryItems());
    window.addEventListener(VERIFICATION_EVENT_NAME, refreshGallery);
    const refreshFromRemote = () => refreshThreadsFromRemote().then(refreshGallery);
    const intervalId = window.setInterval(refreshFromRemote, 10000);

    refreshFromRemote();
    refreshGallery();

    return () => {
      window.removeEventListener(VERIFICATION_EVENT_NAME, refreshGallery);
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return galleryItems;
    }

    return galleryItems.filter((item) => (
      item.attachment.name.toLowerCase().includes(query)
      || item.subscriberName.toLowerCase().includes(query)
      || item.packageName.toLowerCase().includes(query)
      || item.attachment.type.toLowerCase().includes(query)
    ));
  }, [galleryItems, searchValue]);

  return (
    <div className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-[#F7F9FC]">
      <div className="sticky top-0 z-20 shrink-0 bg-white">
        <WorkspaceTopBar />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <button onClick={() => navigate('/admin/chats')} className="mb-6 inline-flex items-center gap-2 text-sm text-[#0B5CFF] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to support chats
          </button>

          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-[#0B5CFF]" style={{ fontWeight: 900 }}>Media gallery</p>
              <h1 className="mt-1 text-3xl text-[#172033]" style={{ fontWeight: 900 }}>Sent and received files</h1>
              <p className="mt-2 text-sm text-[#6B7280]">Review all screenshots, proofs, videos, PDFs, and chat attachments.</p>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search media..."
                className="w-full rounded-2xl border border-[#E5E9F2] bg-white py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5CFF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <button
                key={item.attachment.id}
                type="button"
                onClick={() => setPreviewItem(item)}
                className="overflow-hidden rounded-[1.5rem] border border-[#E5E9F2] bg-white text-left shadow-sm transition-transform hover:-translate-y-1"
              >
                {item.attachment.type.startsWith('image/') ? (
                  <img src={item.attachment.dataUrl} alt={item.attachment.name} className="h-52 w-full object-cover" />
                ) : item.attachment.type.startsWith('video/') ? (
                  <video src={item.attachment.dataUrl} className="h-52 w-full bg-black object-cover" />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-[#F4F8FF]">
                    <FileText className="h-12 w-12 text-[#0B5CFF]" />
                  </div>
                )}
                <div className="p-4">
                  <p className="truncate text-sm text-[#172033]" style={{ fontWeight: 900 }}>{item.attachment.name}</p>
                  <p className="mt-1 truncate text-xs text-[#6B7280]">{item.subscriberName} - {item.packageName}</p>
                  <p className="mt-2 text-xs text-[#8A94A6]">{formatDate(item.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-[#172033]" style={{ fontWeight: 900 }}>{previewItem.attachment.name}</p>
                <p className="text-sm text-[#6B7280]">{previewItem.subscriberName} - {formatDate(previewItem.createdAt)}</p>
              </div>
              <button onClick={() => setPreviewItem(null)} className="rounded-full p-2 text-[#6B7280] hover:bg-[#F7F9FC]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {previewItem.attachment.type.startsWith('image/') ? (
              <img src={previewItem.attachment.dataUrl} alt={previewItem.attachment.name} className="max-h-[72dvh] w-full rounded-2xl object-contain" />
            ) : previewItem.attachment.type.startsWith('video/') ? (
              <video src={previewItem.attachment.dataUrl} controls className="max-h-[72dvh] w-full rounded-2xl bg-black" />
            ) : (
              <div className="rounded-2xl border border-[#E5E9F2] bg-[#F7F9FC] p-10 text-center">
                <FileText className="mx-auto mb-4 h-14 w-14 text-[#0B5CFF]" />
                <p className="text-[#172033]" style={{ fontWeight: 900 }}>Document file</p>
              </div>
            )}

            <a href={previewItem.attachment.dataUrl} download={previewItem.attachment.name} className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#0B5CFF] px-5 py-3 text-white">
              <Download className="h-5 w-5" />
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
