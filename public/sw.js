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
      icon: data.icon || '/icon.png',
      badge: '/icon.png',
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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      // If app is already open, send it a message to open the Ripple feed
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIF_CLICK' });
          return client.focus();
        }
      }
      // App is not open — open it with ?ripple=1 so it auto-opens the Ripple feed
      if (self.clients.openWindow) {
        return self.clients.openWindow('/?ripple=1');
      }
    })
  );
});
