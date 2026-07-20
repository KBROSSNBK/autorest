/**
 * Service worker de AutoRest: permite instalar la app en el celular con carga
 * instantanea en visitas repetidas. Sube CACHE_VERSION cuando cambien los
 * archivos precacheados para forzar a los clientes a bajar la version nueva.
 */
const CACHE_VERSION = "autorest-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];
const REMOTE_SHELL = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => {
        return caches.open(CACHE_VERSION).then((cache) => {
          return Promise.all(REMOTE_SHELL.map((url) =>
            fetch(url, { mode: "cors" }).then((res) => res.ok && cache.put(url, res)).catch(() => {})
          ));
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Firebase Realtime Database vive en su propio dominio/protocolo (websocket);
  // dejar pasar esas peticiones sin interceptarlas.
  if (request.url.indexOf("firebaseio.com") !== -1) return;

  // Navegacion (abrir/recargar la app): red primero para no quedar con datos
  // viejos; si no hay red, se sirve el shell cacheado para que la app abra igual.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Resto (manifest, iconos, SDK de Firebase): cache primero para velocidad,
  // refrescando en segundo plano cuando hay conexion.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
