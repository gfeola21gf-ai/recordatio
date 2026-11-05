/* sw.js — il SERVICE WORKER: un aiutante che vive nel telefono anche ad app chiusa.
   Versione 1
   1. Tiene una COPIA dei file dell'app ("prima la rete": con internet prende la versione nuova, senza usa la copia).
   2. Riceve le NOTIFICHE PUSH da Supabase, le mostra e aggiorna il numerino sull'icona; toccandole apre l'app. */
const COPIA = "recordatio-file";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.hostname.endsWith("supabase.co") || u.protocol === "blob:") return;   // dati e allegati li gestisce l'app
  const nostro = u.origin === self.location.origin;
  e.respondWith(
    fetch(r, nostro ? { cache: "no-cache" } : {})
      .then(risposta => {
        if (risposta.ok || risposta.type === "opaque") {
          const copia = risposta.clone();
          caches.open(COPIA).then(c => c.put(r, copia));
        }
        return risposta;
      })
      .catch(() => caches.match(r, { ignoreSearch: true }))
  );
});

self.addEventListener("push", e => {
  const d = e.data ? e.data.json() : {};
  const n = Number(new URL(d.url || "./", self.registration.scope).searchParams.get("b") || 0);
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.titolo || "Recordatio", {
      body: d.testo || "", icon: "icona-192.png", badge: "icona-192.png", tag: d.tag || "recordatio", data: { url: "./" },
    }),
    n && self.navigator.setAppBadge ? self.navigator.setAppBadge(n).catch(() => { }) : null,
  ]));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of finestre) { if ("focus" in f) return f.focus(); }
    return self.clients.openWindow(url);
  })());
});
