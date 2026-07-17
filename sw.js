const CACHE_NAME = 'spese-casa-v1';
const ASSETS = [
  '/spese-casa/',
  '/spese-casa/index.html',
  '/spese-casa/manifest.json',
];

// ── INSTALLAZIONE – metti in cache le risorse base ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cache installata');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ── ATTIVAZIONE – elimina cache vecchie ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Cache eliminata:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH – strategia: rete prima, poi cache ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Le richieste al Google Sheet vanno sempre in rete
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('accounts.google.com')) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ ok:false, errore:'Offline' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // Tutto il resto: rete prima, fallback su cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Aggiorna la cache con la risposta più recente
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline: servi dalla cache
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          // Fallback per navigazione
          if (e.request.mode === 'navigate') {
            return caches.match('/spese-casa/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ── MESSAGGI – forza aggiornamento ──
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
