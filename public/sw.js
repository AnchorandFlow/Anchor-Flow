const CACHE_VERSION = "anchor-flow-v20260726-210211-660df2e";
const STATIC_CACHE = CACHE_VERSION;

// On install: do NOT skip waiting immediately.
// The page detects the waiting worker and shows an update banner.
// When the user clicks "Refresh Now", the page posts {type:"SKIP_WAITING"}
// and the SW calls skipWaiting() then, giving clients.claim() below a chance
// to take over all tabs before the page reloads.
self.addEventListener("install", function(event) {
  // Intentionally no skipWaiting() — app controls adoption timing.
});

// Page sends SKIP_WAITING when the user taps "Refresh Now" in the update banner.
self.addEventListener("message", function(event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title || "Anchor & Flow", {
      body: event.data.body || "",
      icon: event.data.icon || "/icon.png",
      badge: "/icon.png",
      tag: "af-local",
      data: { url: event.data.url || "/" }
    });
  }
});

// On activate: delete ALL old caches, then claim all clients immediately
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== STATIC_CACHE) {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch strategy:
// - index.html and navigation requests: network-first, fall back to cache
// - JS/CSS assets (hashed filenames): cache-first after first load
// - API calls: network only, never cache
self.addEventListener("fetch", function(event) {
  var url = new URL(event.request.url);

  // Never intercept API or Supabase calls
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("googleapis") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // index.html and all navigation requests: network-first
  if (event.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.ok) {
          var clone = response.clone();
          caches.open(STATIC_CACHE).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // JS and CSS assets with content hashes in filename: cache-first
  // Vite puts hashes in filenames so stale cache is not a risk here
  if (url.pathname.match(/\.(js|css)$/) && url.pathname.includes("-")) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response && response.ok) {
            var clone = response.clone();
            caches.open(STATIC_CACHE).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (icons, fonts, etc): network-first
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});

// Push notifications (unchanged from original)
self.addEventListener("push", function(event) {
  var data = { title: "Ripple", body: "You have a new message from Anchor & Flow." };
  try {
    if (event.data) {
      var parsed = event.data.json();
      data = Object.assign({}, data, parsed);
    }
  } catch(e) {
    try { data.body = event.data.text() || data.body; } catch {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icon.png",
      badge: "/icon.png",
      data: data.data || {},
      vibrate: [100, 50, 100],
      tag: (data.data && data.data.type) || "ripple",
      renotify: true,
      actions: [
        { action: "open", title: "Open app" },
        { action: "dismiss", title: "Dismiss" }
      ]
    })
  );
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  if (event.action === "dismiss") return;
  var dest = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "NOTIF_CLICK", url: dest });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(dest);
      }
    })
  );
});
