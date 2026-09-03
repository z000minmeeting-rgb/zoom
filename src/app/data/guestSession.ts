/**
 * Guest chat credentials held in this browser.
 *
 * A booking hands the customer's own browser a long-lived token; every email
 * link carries a fresh short-lived one. Both authorise exactly one conversation
 * and nothing else, and the database stores only their hashes.
 *
 * The thread UUID on its own is not a credential and is never treated as one.
 */

const GUEST_TOKEN_PREFIX = 'zoo-guest-chat-token:';

export function readGuestToken(threadId: string) {
  if (!threadId || typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(`${GUEST_TOKEN_PREFIX}${threadId}`) || '';
  } catch {
    return '';
  }
}

export function saveGuestToken(threadId: string, token: string) {
  if (!threadId || !token || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${GUEST_TOKEN_PREFIX}${threadId}`, token);
  } catch {
    // Private browsing or blocked storage: the link in the customer's email
    // still works, so this is not worth failing the flow over.
  }
}

export function clearGuestToken(threadId: string) {
  if (!threadId || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(`${GUEST_TOKEN_PREFIX}${threadId}`);
  } catch {
    // Nothing to do.
  }
}

/**
 * Resolves the token for a thread, preferring one supplied in the URL by an
 * email link. A fresh token from an email supersedes whatever this browser
 * held, so a customer arriving on a new device is not blocked.
 */
export function resolveGuestToken(threadId: string, search: string) {
  const fromUrl = new URLSearchParams(search).get('access')?.trim() || '';

  if (fromUrl) {
    saveGuestToken(threadId, fromUrl);
    return fromUrl;
  }

  return readGuestToken(threadId);
}
