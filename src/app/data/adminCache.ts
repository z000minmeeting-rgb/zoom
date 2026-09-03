export type AdminCacheArea = 'threads' | 'clients' | 'subscription-content' | 'notifications';

const EVENT_PREFIX = 'zoo-admin-cloud-cache:';
const cache = new Map<AdminCacheArea, unknown>();

export function readCloudCache<T>(area: AdminCacheArea, fallback: T): T {
  return (cache.get(area) as T | undefined) ?? fallback;
}

export function writeCloudCache<T>(area: AdminCacheArea, value: T) {
  cache.set(area, value);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`${EVENT_PREFIX}${area}`));
  }
  return value;
}

export function clearCloudCache() {
  cache.clear();
}

export function cacheEventName(area: AdminCacheArea) {
  return `${EVENT_PREFIX}${area}`;
}
