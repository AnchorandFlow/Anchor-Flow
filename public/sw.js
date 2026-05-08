// Anchor & Flow — Service Worker
// Handles notifications even when the app tab is closed or the phone screen is off.

const CACHE_NAME = "anchor-flow-v6";

// ── Install: cache critical assets for fast load ─────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/index.html"])
    )
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache when offline, network-first otherwise ─────────────
self.addEventListener("fetch", (event) => {
  // Only cache GET requests for same-origin or CDN assets
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Don't cache Supabase or Anthropic API calls
  if (url.hostname.includes("supabase") || url.hostname.includes("anthropic")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for offline use
        if (response.ok && (url.origin === self.location.origin || url.hostname.includes("fonts.googleapis"))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Message: receive notification requests from the app ──────────────────────
// The app sends { type: "SHOW_NOTIFICATION", title, body, icon } via postMessage.
// This fires the notification even if the tab is backgrounded on mobile.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    const { title, body, icon = "/favicon.svg", tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge: "/favicon.svg",
        tag: tag || "anchor-flow",
        renotify: true,
        requireInteraction: false,
        vibrate: [100, 50, 100],
      })
    );
  }

  // Schedule a future notification (fires even if tab is closed via SW alarm)
  if (event.data?.type === "SCHEDULE_NOTIFICATION") {
    const { title, body, icon = "/favicon.svg", fireAt, tag } = event.data;
    const delay = new Date(fireAt).getTime() - Date.now();
    if (delay <= 0) {
      // Fire immediately
      event.waitUntil(
        self.registration.showNotification(title, { body, icon, badge: "/favicon.svg", tag: tag || "anchor-flow-sched", vibrate: [100,50,100] })
      );
    } else if (delay < 86400000) {
      // Schedule with setTimeout (works while SW is alive)
      setTimeout(() => {
        self.registration.showNotification(title, { body, icon, badge: "/favicon.svg", tag: tag || "anchor-flow-sched", vibrate: [100,50,100] });
      }, delay);
    }
  }
});

// ── Push: handle server-sent push events (for future Twilio/Web Push) ────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "Anchor & Flow", {
        body: data.body || "",
        icon: data.icon || "/favicon.svg",
        badge: "/favicon.svg",
        tag: "anchor-flow-push",
        vibrate: [100, 50, 100],
      })
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification("Anchor & Flow", {
        body: event.data.text(),
        icon: "/favicon.svg",
      })
    );
  }
});

// ── Notification click: open/focus the app ────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
