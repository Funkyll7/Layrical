/* sw.js — hors ligne. Réseau d'abord (le site se met à jour par un simple git push),
   cache en dernier recours. L'API GitHub et les polices ne sont jamais interceptées :
   une écriture doit partir sur le réseau ou échouer franchement. */
const V = "agenda-v35";
const SHELL = ["./", "index.html", "assets/css/app.css", "assets/js/app.js", "assets/js/sync.js", "manifest.webmanifest", "assets/img/favicon.svg"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: "no-cache" }).then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); return res; })
    .catch(() => caches.match(r).then((m) => m || caches.match("index.html"))));
});
/* Notifications push envoyées par la tâche GitHub « Rappels » (.github/workflows/rappels.yml). */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "🔔 Agenda", {
    body: d.body || "", tag: d.tag || "agenda", renotify: true,
    icon: "assets/img/favicon.svg", badge: "assets/img/favicon.svg", data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    const w = ws.find((c) => c.url.startsWith(self.registration.scope));
    return w ? w.focus() : clients.openWindow(url);
  }));
});
