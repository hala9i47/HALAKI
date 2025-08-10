const CACHE_NAME = 'barber-app-v2';
// اكتشاف المسار الأساسي (يدعم GitHub Pages)
const SW_PATH = self.location.pathname; // مثال: /HALAKI/service-worker.js
const BASE_PATH = SW_PATH.replace(/service-worker\.js$/, ''); // مثال: /HALAKI/

// استخدم مسارات نسبية بدون / في البداية ثم سنبنيها
const assetFiles = [
  'index.html',
  'css/customer.css',
  'js/customer-dashboard.js',
  'js/firebase-config.js',
  'js/cloudinary-config.js',
  'js/booking.js',
  'js/appointments.js',
  'js/appointment-chat.js',
  'pages/customer-dashboard.html',
  'pages/barber-dashboard.html',
  'pages/booking.html',
  'pages/appointment-chat.html',
  'images/default-avatar.jpg',
  'manifest.json'
];
// موارد خارجية (قد تفشل – سنحاول كلٌ على حدة)
const externalAssets = [
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

async function safeAdd(cache, requestUrl){
  try { await cache.add(requestUrl); }
  catch(e){ console.warn('[SW] تخطي ملف فشل في التخزين:', requestUrl, e.message); }
}

self.addEventListener('install', event => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    // أضف الملفات المحلية
    for(const file of assetFiles){
      const url = BASE_PATH + file; // مثال: /HALAKI/index.html
      await safeAdd(cache, url);
    }
    // أضف الخارجية
    for(const ext of externalAssets){
      await safeAdd(cache, ext);
    }
    // تفعيل مباشر
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // إستراتيجية: Cache First للملفات الثابتة، Network First للمكالمات الأخرى
  if(req.method !== 'GET'){ return; }
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if(isSameOrigin){
    event.respondWith((async ()=>{
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if(cached) return cached;
      try {
        const resp = await fetch(req);
        // خزن نسخة إذا كان ملفاً ثابتاً
        if(resp.ok && (req.url.includes('/js/') || req.url.includes('/css/') || req.destination === 'document')){
          cache.put(req, resp.clone());
        }
        return resp;
      } catch(e){
        // يمكن إضافة صفحة offline.html لاحقاً
        return cached || new Response('OFFLINE',{status:503,statusText:'Offline'});
      }
    })());
  } else {
    // طلبات خارجية: محاولة الشبكة ثم السقوط إلى الكاش إن وجد
    event.respondWith((async ()=>{
      const cache = await caches.open(CACHE_NAME);
      try {
        const resp = await fetch(req);
        if(resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch(e){
        const cached = await cache.match(req);
        return cached || new Response('',{status:504});
      }
    })());
  }
});
