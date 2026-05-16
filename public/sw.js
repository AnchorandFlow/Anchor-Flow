self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', function(event) {
  let data = { title: 'Ripple', body: 'You have a new message from Anchor & Flow.' };
  try {
    if (event.data) { const parsed = event.data.json(); data = { ...data, ...parsed }; }
  } catch (e) { try { data.body = event.data?.text() || data.body; } catch {} }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/favicon.svg',
      badge: '/favicon.svg',
      data: data.data || {},
      vibrate: [100, 50, 100],
      tag: data.data?.type || 'ripple',
      renotify: true,
      actions: [{ action: 'open', title: 'Open app' }, { action: 'dismiss', title: 'Dismiss' }],
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});
