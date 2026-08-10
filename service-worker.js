const CACHE_PREFIX = 'specter-blacksite-overhaul-foundation-';
const CACHE_VERSION = 'v521-hostile-diagnostics';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// The application shell is deliberately small and atomic: if any of these files
// are unavailable, installing a worker that cannot boot the game would be worse
// than leaving the current worker active.
const REQUIRED_SHELL_URLS = [
  './',
  './index.html',
  './player-model.html',
  './styles.css',
  './manifest.webmanifest',
  './service-worker.js',

  './src/main.js',
  './src/specter-operator.js',
  './src/player-preview.js',
  './src/world-overhaul.js',
  './src/enemy-ai.js',
  './src/audio-overhaul.js',
  './src/graphics-pipeline.js',
  './src/tactical-animation.js'
];

// Large local assets and release documentation are filled in independently after
// the shell. A transient response or storage-quota failure is reported but does
// not reject installation. Third-party Three.js modules remain runtime-cached
// after a successful network response.
const OPTIONAL_PRECACHE_URLS = [
  './assets/ar15/scene.gltf',
  './assets/ar15/scene.bin',
  './assets/ar15/license.txt',
  './assets/ar15/textures/Base_and_Stock_0_baseColor.png',
  './assets/ar15/textures/Base_and_Stock_0_metallicRoughness.png',
  './assets/ar15/textures/Base_and_Stock_0_normal.png',
  './assets/ar15/textures/Base_and_Stock_baseColor.png',
  './assets/ar15/textures/Base_and_Stock_metallicRoughness.png',
  './assets/ar15/textures/Base_and_Stock_normal.png',
  './assets/ar15/textures/ground_baseColor.png',
  './assets/ar15/textures/Handguard_baseColor.png',
  './assets/ar15/textures/Handguard_metallicRoughness.png',
  './assets/ar15/textures/Handguard_normal.png',
  './assets/ar15/textures/Scope_Handle_Mag_baseColor.png',
  './assets/ar15/textures/Scope_Handle_Mag_metallicRoughness.png',
  './assets/ar15/textures/Scope_Handle_Mag_normal.png',

  './assets/m9/scene.gltf',
  './assets/m9/scene.bin',
  './assets/m9/license.txt',
  './assets/m9/textures/Mat_Black_baseColor.png',
  './assets/m9/textures/Mat_Black_metallicRoughness.png',
  './assets/m9/textures/Mat_Gold_baseColor.png',
  './assets/m9/textures/Mat_Gold_metallicRoughness.png',
  './assets/m9/textures/Mat_Gold_normal.png',

  './assets/soldier/scene.gltf',
  './assets/soldier/scene.bin',
  './assets/soldier/license.txt',
  './assets/soldier/textures/5_Russian_Soldier.Material73_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material74_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material75_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material76_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material77_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material78_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material79_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material81_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material82_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Material83_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Russian_Head.eye.eye_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Russian_Head.gogglel.gogglel_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Russian_Head.Goggles_5.Material36_1_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Russian_Head.mask.mask_0_0_0_baseColor.png',
  './assets/soldier/textures/5_Russian_Soldier.Russian_Head.RSA05h.RSA05h_0_0_0_baseColor.png',

  './assets/environment/pbr-v2/concrete-albedo.webp',
  './assets/environment/pbr-v2/concrete-normal.webp',
  './assets/environment/pbr-v2/concrete-orm.webp',
  './assets/environment/pbr-v2/painted-metal-albedo.webp',
  './assets/environment/pbr-v2/painted-metal-normal.webp',
  './assets/environment/pbr-v2/painted-metal-orm.webp',
  './assets/environment/pbr-v2/diamond-plate-albedo.webp',
  './assets/environment/pbr-v2/diamond-plate-normal.webp',
  './assets/environment/pbr-v2/diamond-plate-orm.webp',
  './assets/environment/pbr-v2/asphalt-albedo.webp',
  './assets/environment/pbr-v2/asphalt-normal.webp',
  './assets/environment/pbr-v2/asphalt-orm.webp',
  './assets/environment/pbr-v2/utility-panel-albedo.webp',
  './assets/environment/pbr-v2/utility-panel-normal.webp',
  './assets/environment/pbr-v2/utility-panel-orm.webp',
  './assets/environment/pbr-v2/vehicle-paint-albedo.webp',
  './assets/environment/pbr-v2/vehicle-paint-orm.webp',
  './assets/environment/pbr-v2/vehicle-rubber-albedo.webp',
  './assets/environment/pbr-v2/vehicle-rubber-normal.webp',
  './assets/environment/pbr-v2/vehicle-rubber-orm.webp',
  './assets/environment/pbr-v2/grass-soil-albedo.webp',
  './assets/environment/pbr-v2/grass-soil-normal.webp',
  './assets/environment/pbr-v2/grass-soil-orm.webp',

  './assets/environment/polyhaven-steel-frame-shelves-01/README.md',
  './assets/environment/polyhaven-steel-frame-shelves-01/LICENSE.txt',
  './assets/environment/polyhaven-steel-frame-shelves-01/steel_frame_shelves_01_2k.gltf',
  './assets/environment/polyhaven-steel-frame-shelves-01/steel_frame_shelves_01.bin',
  './assets/environment/polyhaven-steel-frame-shelves-01/textures/steel_frame_shelves_01_diff_2k.jpg',
  './assets/environment/polyhaven-steel-frame-shelves-01/textures/steel_frame_shelves_01_nor_gl_2k.jpg',
  './assets/environment/polyhaven-steel-frame-shelves-01/textures/steel_frame_shelves_01_arm_2k.jpg',

  './assets/environment/polyhaven-power-box-01/README.md',
  './assets/environment/polyhaven-power-box-01/LICENSE.txt',
  './assets/environment/polyhaven-power-box-01/power_box_01_2k.gltf',
  './assets/environment/polyhaven-power-box-01/power_box_01.bin',
  './assets/environment/polyhaven-power-box-01/textures/power_box_01_diff_2k.jpg',
  './assets/environment/polyhaven-power-box-01/textures/power_box_01_nor_gl_2k.jpg',
  './assets/environment/polyhaven-power-box-01/textures/power_box_01_arm_2k.jpg',

  './assets/environment/polyhaven-plastic-container/README.md',
  './assets/environment/polyhaven-plastic-container/LICENSE.txt',
  './assets/environment/polyhaven-plastic-container/plastic_container_2k.gltf',
  './assets/environment/polyhaven-plastic-container/plastic_container.bin',
  './assets/environment/polyhaven-plastic-container/textures/plastic_container_diff_2k.jpg',
  './assets/environment/polyhaven-plastic-container/textures/plastic_container_nor_gl_2k.jpg',
  './assets/environment/polyhaven-plastic-container/textures/plastic_container_arm_2k.jpg',

  './assets/environment/polyhaven-concrete-road-barrier-02/README.md',
  './assets/environment/polyhaven-concrete-road-barrier-02/LICENSE.txt',
  './assets/environment/polyhaven-concrete-road-barrier-02/concrete_road_barrier_02_2k.gltf',
  './assets/environment/polyhaven-concrete-road-barrier-02/concrete_road_barrier_02.bin',
  './assets/environment/polyhaven-concrete-road-barrier-02/textures/concrete_road_barrier_02_diff_2k.jpg',
  './assets/environment/polyhaven-concrete-road-barrier-02/textures/concrete_road_barrier_02_nor_gl_2k.jpg',
  './assets/environment/polyhaven-concrete-road-barrier-02/textures/concrete_road_barrier_02_arm_2k.jpg',

  './assets/audio/README.md',
  './assets/audio/cc-by-3.0-tabasco/LICENSE.txt',
  './assets/audio/cc-by-3.0-tabasco/rifle-sks-01.wav',
  './assets/audio/cc-by-3.0-tabasco/pistol-cz-01.wav',
  './assets/audio/cc0-kenney-voiceover/README.md',
  './assets/audio/cc0-kenney-voiceover/License.txt',
  './assets/audio/cc0-kenney-voiceover/Credits.txt',
  './assets/audio/cc0-kenney-voiceover/Male-war_target_engaged.ogg',
  './assets/audio/cc0-kenney-voiceover/Female-war_target_engaged.ogg',
  './assets/audio/cc0-kenney-voiceover/Male-war_look_out.ogg',
  './assets/audio/cc0-kenney-voiceover/Female-war_look_out.ogg',
  './assets/audio/cc0-kenney-voiceover/Male-war_call_for_backup.ogg',
  './assets/audio/cc0-kenney-voiceover/Female-war_call_for_backup.ogg',
  './assets/audio/cc0-kenney-voiceover/Male-war_cover_me.ogg',
  './assets/audio/cc0-kenney-voiceover/Female-war_cover_me.ogg',
  './assets/audio/cc0-kenney-voiceover/Male-war_get_down.ogg',
  './assets/audio/cc0-kenney-voiceover/Female-war_get_down.ogg',
  './assets/audio/cc0-kenney-voiceover/Male-war_suppressing_fire.ogg',
  './assets/audio/cc0-kenney-voiceover/Female-war_supressing_fire.ogg',
  './assets/audio/cc0-kenney-voiceover/Male-war_medic.ogg',
  './assets/audio/cc0-kenney-voiceover/Female-war_medic.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/README.md',
  './assets/audio/cc0-kenney-rpg-footsteps/License.txt',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep00.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep01.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep02.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep03.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep04.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep05.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep06.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep07.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep08.ogg',
  './assets/audio/cc0-kenney-rpg-footsteps/footstep09.ogg',

  './README.md',
  './THIRD_PARTY_ASSETS.md',
  './assets/player/README.txt',
  './assets/environment/README.txt',
  './assets/environment/pbr-v2/README.md',
  './assets/environment/pbr-v2/manifest.json'
];

const OPTIONAL_PRECACHE_CONCURRENCY = 3;

function isHttpGet(request) {
  if (request.method !== 'GET') return false;
  const protocol = new URL(request.url).protocol;
  return protocol === 'http:' || protocol === 'https:';
}

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function canonicalLocalKey(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return url.href;
}

function canStore(request, response) {
  if (request.headers.has('range')) return false;
  return response && (response.ok || response.type === 'opaque');
}

async function storeFreshResponse(request, response) {
  if (!canStore(request, response)) return;
  const cache = await caches.open(CACHE_NAME);
  const key = isSameOrigin(request) ? canonicalLocalKey(request) : request;
  await cache.put(key, response);
}

async function offlineMatch(request) {
  const cache = await caches.open(CACHE_NAME);
  const local = isSameOrigin(request);
  const cached = await cache.match(request, local ? { ignoreSearch: true } : undefined);
  if (cached) return cached;

  // Unknown same-origin navigations still receive the application shell. Known
  // pages, including query-suffixed player-model.html, match above first.
  if (local && request.mode === 'navigate') {
    return cache.match('./index.html', { ignoreSearch: true });
  }
  return undefined;
}

async function networkFirst(request, event) {
  try {
    const response = await fetch(request);
    if (canStore(request, response)) {
      event.waitUntil(storeFreshResponse(request, response.clone()).catch(() => undefined));
    }
    return response;
  } catch (networkError) {
    const cached = await offlineMatch(request);
    if (cached) return cached;
    throw networkError;
  }
}

async function precacheOptionalPayload(cache) {
  let nextIndex = 0;
  const failures = [];
  const workerCount = Math.min(OPTIONAL_PRECACHE_CONCURRENCY, OPTIONAL_PRECACHE_URLS.length);

  async function cacheNext() {
    while (nextIndex < OPTIONAL_PRECACHE_URLS.length) {
      const url = OPTIONAL_PRECACHE_URLS[nextIndex++];
      try {
        await cache.add(url);
      } catch (error) {
        failures.push({ url, error });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => cacheNext()));
  if (failures.length) {
    console.warn(
      `[service-worker] Optional precache completed with ${failures.length} failure(s).`,
      failures.map(({ url, error }) => ({ url, detail: error?.message || String(error) }))
    );
  }
  return failures;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(REQUIRED_SHELL_URLS);
        await precacheOptionalPayload(cache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!isHttpGet(event.request)) return;
  event.respondWith(networkFirst(event.request, event));
});
