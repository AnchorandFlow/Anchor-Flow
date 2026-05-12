const CACHE = 'anchor-flow-v6';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); } catch { payload = { title: 'Ripple', body: e.data.text() }; }

  const title = payload.title || 'Ripple';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'ripple-notif',
    renotify: true,
    data: payload.data || {},
    actions: (payload.actions || []).slice(0, 2).map(a => ({ action: a.action, title: a.title })),
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const action = e.action;
  const data = e.notification.data || {};

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('anchorandflowapp.com') && 'focus' in c);
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'NOTIF_ACTION', action, data });
      } else {
        clients.openWindow('/').then(w => {
          if (w) w.postMessage({ type: 'NOTIF_ACTION', action, data });
        });
      }
    })
  );
});
