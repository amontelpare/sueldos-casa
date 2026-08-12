/**
 * Service worker mínimo para que la app abra sin internet.
 *
 * - Los assets con hash en el nombre (/assets/...) son inmutables: cache primero.
 * - La navegación va a la red primero y cae al cache si no hay señal, así un
 *   deploy nuevo se ve enseguida y nunca queda una versión vieja pegada.
 */
const CACHE = 'sueldos-casa-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copia))
          return res
        })
        .catch(() => caches.match(req).then((r) => r ?? caches.match('./index.html'))),
    )
    return
  }

  e.respondWith(
    caches.match(req).then(
      (cacheado) =>
        cacheado ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
          }
          return res
        }),
    ),
  )
})
