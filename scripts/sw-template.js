// Generated into dist/sw.js by scripts/build-sw.mjs, which replaces the two
// placeholders below with the real cache name and precache list.
//
// Scope is this app's own directory, so a project site cannot intercept
// requests for anything else on the same GitHub Pages host. It never contacts
// another origin: every non-same-origin request is passed straight through.
const CACHE_NAME = "__CACHE_NAME__";
const PRECACHE = "__PRECACHE__";
const INDEX_URL = new URL("index.html", self.location.href).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Network first, so a new deployment is picked up as soon as it is online.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(INDEX_URL)
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  // Build assets carry a content hash in their name, so a cache hit is always
  // the correct bytes for that exact file.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
