const CACHE='specter-blacksite-enemy-environment-v420';
const CORE=[
  './','./index.html','./styles.css','./src/main.js','./manifest.webmanifest',
  './assets/environment/concrete-wall.webp',
  './assets/environment/metal-floor.webp',
  './assets/environment/utility-panels.webp'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))});
