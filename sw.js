const CACHE_NAME = 'pesso-v1.2.19';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/goals.html',
    '/alerts.html',
    '/profile.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/assets/img/favicon.png',
    '/assets/icon/iconicon-192.png',
    '/assets/icon/iconicon-512.png'
];

// Instalar: Cachear recursos estáticos esenciales
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando recursos estáticos...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Recursos cacheados correctamente');
                return self.skipWaiting(); // Activar inmediatamente
            })
            .catch((error) => {
                console.error('[SW] Error cacheando recursos:', error);
            })
    );
});

// Activar: Limpiar cachés viejas y tomar control
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Eliminando caché vieja:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Service Worker activado y controlando página');
            return self.clients.claim(); // Tomar control inmediato
        })
    );
});

// Fetch: Estrategia de caché
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Estrategia 1: Cache First para recursos estáticos locales
    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Actualizar caché en segundo plano (Stale-While-Revalidate)
                    fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, networkResponse);
                            });
                        }
                    }).catch(() => {});
                    
                    return cachedResponse;
                }
                
                // Si no está en caché, ir a la red y cachear
                return fetch(request).then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }
                    
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                    
                    return networkResponse;
                });
            })
        );
        return;
    }
    
    // Estrategia 2: Network First para APIs/CDN externos (Ionicons, etc)
    if (isExternalResource(url)) {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match(request);
            })
        );
        return;
    }
    
    // Estrategia 3: Network Only para todo lo demás (IndexedDB se maneja en app.js)
    event.respondWith(fetch(request));
});

// Helper: Identificar si es un recurso estático local
function isStaticAsset(url) {
    const staticExtensions = ['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.svg', '.ico'];
    const isLocal = url.origin === self.location.origin;
    const isStatic = staticExtensions.some(ext => url.pathname.endsWith(ext));
    return isLocal && isStatic;
}

// Helper: Identificar recursos externos (CDNs)
function isExternalResource(url) {
    const externalDomains = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
    return externalDomains.some(domain => url.hostname.includes(domain));
}

// Manejar mensajes desde la app (opcional, para updates)
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data === 'GET_VERSION') {
        event.ports[0].postMessage(CACHE_NAME);
    }
});

// Sincronización en segundo plano (opcional, para cuando vuelva la conexión)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-transactions') {
        console.log('[SW] Sincronizando transacciones pendientes...');
        // Aquí podrías manejar sincronización de datos si tuvieras backend
    }
});