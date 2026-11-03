// Due Board service worker: the app opens offline. Network first, so a new version shows up as soon as you are online.
const CACHE = "dueboard-v3";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./config.js", "./vendor/supabase.js",
  "./css/app.css", "./js/core.js", "./js/store.js", "./js/ui.js", "./js/account.js", "./js/editor.js", "./js/search.js", "./js/app.js",
  "./js/pages/home.js", "./js/pages/calendar.js", "./js/pages/planner.js", "./js/pages/progress.js", "./js/pages/focus.js", "./js/pages/settings.js", "./js/pages/archive.js", "./js/pages/auth.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  // Only our own files. Supabase, fonts and the ManageBac relay always go straight to the network.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html")))
  );
});
