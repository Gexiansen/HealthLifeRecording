const CACHE_NAME = "healthlife-shell-v25";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=25",
  "./app.js?v=25",
  "./model.js?v=25",
  "./data.js?v=25",
  "./calendar.js?v=25",
  "./stats.js?v=25",
  "./backup.js?v=25",
  "./interaction.js?v=25",
  "./analysis.js?v=25",
  "./guided-workout.js?v=25",
  "./training-insights.js?v=25",
  "./nutrition.js?v=25",
  "./health-stage.js?v=25",
  "./storage.js?v=25",
  "./manifest.webmanifest?v=25",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (path) => {
      const response = await fetch(new Request(path, { cache: "reload" }));
      if (!response.ok) throw new Error(`无法缓存 ${path}`);
      await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put("./index.html", response.clone());
      }
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
