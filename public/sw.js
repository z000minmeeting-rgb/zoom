const CACHE_NAME = 'zoom-pwa-v3';
const APP_ENTRY_URL = '/';
const APP_SHELL = [
  APP_ENTRY_URL,
  '/manifest.webmanifest',
  '/icons/zoom-192.png',
  '/icons/zoom-512.png'
];

function fetchFresh(request) {
  return fetch(new Request(request, { cache: 'reload' }));
}

async function cacheResponse(cacheKey, response) {
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKey, response.clone());
  }
}

async function handleNavigation(request) {
  try {
    const response = await fetchFresh(request);
    await cacheResponse(APP_ENTRY_URL, response);
    return response;
  } catch {
    const cachedResponse = await caches.match(request) || await caches.match(APP_ENTRY_URL);

    if (cachedResponse) {
      return cachedResponse;
    }

    return Response.error();
  }
}

async function handleAsset(request) {
  try {
    const response = await fetchFresh(request);
    await cacheResponse(request, response);
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    return cachedResponse || Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isCacheableScheme = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';

  if (event.request.method !== 'GET' || !isCacheableScheme || !isSameOrigin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  event.respondWith(handleAsset(event.request));
});
