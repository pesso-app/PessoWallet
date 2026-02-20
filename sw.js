// ==================== PESSO SERVICE WORKER ====================
// Cache Name with Version
const CACHE_NAME = 'pesso-v1.2.0';
const STATIC_CACHE = 'pesso-static-v1.2.0';
const DYNAMIC_CACHE = 'pesso-dynamic-v1.2.0';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/goals.html',
  '/alerts.html',
  '/profile.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  // External resources
  'https://unpkg.com/ionicons@5.0.0/dist/ionicons/ionicons.js',
  'https://fonts.googleapis.com/css2?family=Varela+Round&display=swap'
];

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Pesso Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error caching static assets:', error);
      })
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Pesso Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch Event - Serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Strategy: Cache First for static assets, Network First for dynamic
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          // Update cache in background (stale-while-revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(DYNAMIC_CACHE)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
            })
            .catch(() => {
              // Network failed, but we have cached version
            });
          
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone response to cache it
            const responseClone = networkResponse.clone();
            
            // Determine which cache to use
            const cacheToUse = isStaticAsset(url) ? STATIC_CACHE : DYNAMIC_CACHE;
            
            caches.open(cacheToUse)
              .then((cache) => {
                cache.put(request, responseClone);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            
            // Return offline fallback for HTML pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            throw error;
          });
      })
  );
});

// Helper function to check if URL is a static asset
function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    console.log('[SW] Syncing transactions...');
    event.waitUntil(syncTransactions());
  }
});

// Push Notifications (preparado para futuro)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: 'assets/icon/icon-192.png',
      badge: 'assets/icon/icon-72.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      },
      actions: [
        {
          action: 'open',
          title: 'Abrir Pesso'
        },
        {
          action: 'close',
          title: 'Cerrar'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification('Pesso', options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Message handler from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data === 'getVersion') {
    event.ports[0].postMessage(CACHE_NAME);
  }
});

// Helper: Sync transactions (placeholder for future implementation)
async function syncTransactions() {
  // Implementar sincronización de transacciones pendientes
  console.log('[SW] Transactions synced');
  return Promise.resolve();
}

// Periodic background sync (preparado para futuro)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-data') {
    console.log('[SW] Periodic sync triggered');
    event.waitUntil(updateData());
  }
});

async function updateData() {
  // Actualizar datos en segundo plano
  console.log('[SW] Data updated in background');
  return Promise.resolve();
}

console.log('[SW] Pesso Service Worker loaded');