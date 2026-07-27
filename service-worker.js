const CACHE='specter-v0.9-power';
const FILES=['./','./index.html','./manifest.webmanifest',
'./assets/wall_concrete.png','./assets/wall_steel.png','./assets/wall_red.png','./assets/floor.png','./assets/ceiling.png',
'./assets/enemy_rifle_0.png','./assets/enemy_rifle_1.png','./assets/enemy_rifle_2.png','./assets/enemy_rifle_dead.png',
'./assets/enemy_heavy_0.png','./assets/enemy_heavy_1.png','./assets/enemy_heavy_2.png','./assets/enemy_heavy_dead.png',
'./assets/weapon_rifle_0.png','./assets/weapon_rifle_1.png','./assets/weapon_pistol_0.png','./assets/weapon_pistol_1.png',
'./assets/icon-192.png','./assets/icon-512.png','./assets/specter_portrait.jpg','./assets/specter_turnaround.jpg','./assets/specter_equipment.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
