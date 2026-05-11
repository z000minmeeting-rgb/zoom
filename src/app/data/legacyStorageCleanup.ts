const LEGACY_DATA_CLEANUP_KEY = 'zoom-fresh-launch-cleanup-v1';
const LEGACY_KEYS_TO_REMOVE = [
  'zoom-workspace-session',
  'zoom-workspace-users',
  'zoom-workspace-session-v2',
  'zoom-workspace-users-v2',
  'zoom-admin-unlocked-v1',
  'zoom-admin-clients-v1',
  'celebrity-verification-threads-v1',
  'celebrity-verification-session-v1',
  'celebrity-admin-dismissed-notifications-v1',
];

export function clearLegacyLaunchData() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.localStorage.getItem(LEGACY_DATA_CLEANUP_KEY) === 'done') {
    return;
  }

  LEGACY_KEYS_TO_REMOVE.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.setItem(LEGACY_DATA_CLEANUP_KEY, 'done');
}
