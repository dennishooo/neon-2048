/* Neon 2048 — service worker.
 *
 * Strategy:
 *  - On install, precache the app shell (index + manifest + icons).
 *  - For navigation requests: try network, fall back to cached index (so the
 *    SPA still loads offline / on flaky connections).
 *  - For other GET requests under our scope: stale-while-revalidate.
 *  - Bumping CACHE_VERSION invalidates old caches.
 *
 * The Vite build emits hashed asset filenames, so a runtime fetch will get
 * the new bundle whenever it differs from the cached one.
 */

const CACHE_VERSION = "v2";
const CACHE = `neon-2048-${CACHE_VERSION}`;

// Resolve URLs relative to the SW scope so this works at "/" and "/neon-2048/".
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-180.png",
  "./favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirstHTML(req));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirstHTML(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached =
      (await cache.match(req)) ||
      (await cache.match("./index.html")) ||
      (await cache.match("./"));
    if (cached) return cached;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.status === 200 && res.type === "basic") {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => undefined);
  return cached || (await network) || new Response("", { status: 504 });
}

// Allow the page to ask the SW to activate immediately after an update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
