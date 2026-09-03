import { useEffect, useState } from 'react';
import {
  SUBSCRIPTION_EVENT_NAME,
  fetchPublicSubscriptionContent,
  loadSubscriptionContent,
  type SubscriptionPageContent,
} from './subscriptionPackages';

/** Prices change rarely, so this only has to be faster than "notice and reload". */
const REFRESH_INTERVAL_MS = 60000;

/**
 * Live package content for the public booking pages.
 *
 * Reads through the `public_subscription_content` projection, which is the only
 * route a visitor has to admin-edited pricing, and re-reads it when the page is
 * likely to be stale: on return to the tab, on focus, on a slow interval, and
 * immediately when an admin saves in this browser.
 *
 * Without this an open page kept whatever it fetched on mount, so a price
 * change was invisible until someone reloaded.
 */
export function usePublicSubscriptionContent(clientId: string) {
  const [content, setContent] = useState<SubscriptionPageContent>(() => loadSubscriptionContent());

  useEffect(() => {
    let active = true;

    const refreshFromRemote = () => fetchPublicSubscriptionContent(clientId)
      .then((next) => {
        if (active && next) {
          setContent(next);
        }
      })
      .catch(() => undefined);

    // Polling a hidden tab wastes a request and cannot be seen anyway.
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshFromRemote();
      }
    };

    // An admin saving in this browser already wrote the new content to the
    // shared cache, so there is nothing to fetch.
    const readFromCache = () => setContent(loadSubscriptionContent());

    refreshFromRemote();

    const intervalId = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener(SUBSCRIPTION_EVENT_NAME, readFromCache);

    let channel: BroadcastChannel | null = null;

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(SUBSCRIPTION_EVENT_NAME);
      channel.onmessage = refreshFromRemote;
    }

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener(SUBSCRIPTION_EVENT_NAME, readFromCache);
      channel?.close();
    };
  }, [clientId]);

  return content;
}
