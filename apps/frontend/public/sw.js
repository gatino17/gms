const CACHE_NAME = 'gms-mobile-v1'
const APP_SHELL = ['/', '/mobile', '/mobile/login', '/manifest.webmanifest', '/Logo_gms.ico', '/gms-soluciones-digitales.jpg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined)
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/mobile'))),
  )
})
