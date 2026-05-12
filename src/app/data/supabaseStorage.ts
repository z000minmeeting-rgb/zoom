import { isSupabaseConfigured, supabase } from '../lib/supabase';

export const ZOOM_ASSETS_BUCKET = 'zoom-assets';

function createStorageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeFileName(name: string) {
  const cleanedName = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);

  return cleanedName || 'upload';
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read file'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAssetFile(file: File, folder: string) {
  if (!isSupabaseConfigured || !supabase) {
    return readFileAsDataUrl(file);
  }

  const path = `${folder}/${createStorageId()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(ZOOM_ASSETS_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    console.error('Supabase storage upload failed', error);
    return readFileAsDataUrl(file);
  }

  const { data } = supabase.storage.from(ZOOM_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
