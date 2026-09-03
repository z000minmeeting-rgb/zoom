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
  // Intentionally retired. Legacy keys are migration sources and must remain
  // available until a later, explicitly approved cleanup release.
  void LEGACY_DATA_CLEANUP_KEY;
  void LEGACY_KEYS_TO_REMOVE;
}
