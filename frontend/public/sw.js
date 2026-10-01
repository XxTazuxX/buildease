/* global self, caches, URL, fetch */
const CACHE = "buildease-shell-v1";
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/buildease.svg"]))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); void caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/"))));
});
self.addEventListener("push", (event) => {
  let data = { title: "BuildEase", body: "You have a new notification." };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* plain-text payloads use the default copy */ }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/buildease.svg", data: { url: data.url || "/" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const open = clients.find((client) => "focus" in client);
    return open ? open.navigate(url).then((client) => client && client.focus()) : self.clients.openWindow(url);
  }));
});
