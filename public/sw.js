// Offline shell ONLY. Caches build-hashed static assets and the icon.
// Never caches HTML, API responses, chat, or anything personal.
const CACHE = "static-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const OFFLINE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title><body style="font-family:system-ui,sans-serif;background:#faf7f0;color:#191613;padding:40px 16px;max-width:36rem;margin:auto">
<h1 style="font-size:26px">You're offline</h1><p style="color:#57504a">Nothing private is stored on this device, so trips and chats need a connection. Reconnect and reload.</p>
<button onclick="location.reload()" style="min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #e4dccf;background:#fff;font:inherit">Try again</button></body></html>`;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    e.respondWith(
      caches.open(CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (r.ok && c.put(req, r.clone()), r))),
    );
  } else if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
  }
});
