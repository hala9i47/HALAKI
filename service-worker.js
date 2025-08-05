const CACHE_NAME = 'barber-app-v1';
const assets = [
    './',
    './index.html',
    './css/style.css',
    './css/customer.css',
    './js/customer-dashboard.js',
    './js/firebase-config.js',
    './pages/customer-dashboard.html',
    './pages/welcome.html',
    './splash.html',
    './manifest.json',
    './images/logo.png'
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(assets);
            })
    );
});

// Activate Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

// Fetch Event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});
