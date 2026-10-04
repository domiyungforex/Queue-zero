/* Cache only the generic offline page, never tickets, authentication or API data. */
const CACHE = 'turnmark-shell-v3';
const OFFLINE = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => (key.startsWith('queuezero-shell-') || key.startsWith('turnmark-shell-')) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  // Network first preserves redirects, normal navigation, and authoritative queue state.
  event.respondWith(fetch(event.request).catch(async () =>
    (await caches.match(OFFLINE)) ?? new Response('You are offline. Reconnect and reload to check your queue.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })));
});
self.addEventListener('push', event => {
  let message;
  try { message = event.data.json(); } catch { return; }
  if (!message || typeof message.title !== 'string') return;
  const url = typeof message.url === 'string' && /^\/ticket\/[0-9a-f-]{36}$/.test(message.url) ? message.url : '/';
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: message.tag, renotify: false, data: { url },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (client.url === target.href) { await client.focus(); return; }
    }
    await self.clients.openWindow(target.href);
  }));
});
