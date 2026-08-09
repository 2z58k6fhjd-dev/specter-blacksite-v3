import * as THREE from 'three';

/**
 * Grounded present-day weapon factories for SPECTER.
 *
 * Canonical model space is metres, +Y up, muzzle forward along -Z, ejection on
 * +X. Factories accept the already-loaded bundled AR scene (or GLTF object) and
 * never load assets themselves, which keeps this module gesture/network neutral.
 */

export const MODERN_ARSENAL_VERSION = '1.0.0';

export const MODERN_ARSENAL_IDS = Object.freeze({
  COMPACT_CARBINE: 'c5k-compact',
  MARKSMAN_RIFLE: 'r762-marksman',
  TACTICAL_SHOTGUN: 't12-autoloader'
});

const SOURCE_LICENSE = Object.freeze({
  asset: 'Bundled high-detail rifle source',
  file: 'assets/ar15/license.txt',
  license: 'CC-BY-NC-4.0',
  commercialUse: false,
  note: 'Carbine and marksman factories can clone this source. Preserve attribution and the non-commercial restriction.'
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const RAW_SPECS = {
  [MODERN_ARSENAL_IDS.COMPACT_CARBINE]: {
    id: MODERN_ARSENAL_IDS.COMPACT_CARBINE,
    uiName: 'C5-K Compact Carbine',
    shortName: 'C5-K',
    class: 'compact-carbine',
    family: 'rifle',
    caliber: '5.56 x 45 mm',
    operatingSystem: 'gas-operated rotating bolt',
    magazineType: 'detachable box',
    capacity: 30,
    chamberSize: 1,
    reserve: 150,
    fireModes: ['safe', 'semi', 'auto'],
    defaultFireMode: 'auto',
    rpm: 780,
    damage: 34,
    damageModel: { projectiles: 1, headMultiplier: 2.15, limbMultiplier: 0.78, effectiveRangeM: 180 },
    reloadTiming: {
      tacticalSeconds: 1.82,
      emptySeconds: 2.28,
      magazineOut: 0.38,
      magazineIn: 1.18,
      boltRelease: 1.91
    },
    recoil: {
      verticalKick: 0.047,
      horizontalKick: 0.016,
      cameraKick: 0.052,
      recoveryPerSecond: 10.6,
      firstShotMultiplier: 0.82
    },
    fov: { hip: 72, ads: 48, optic: 40 },
    handling: {
      massKg: 2.78,
      lengthM: 0.748,
      barrelM: 0.267,
      aimInSeconds: 0.18,
      aimOutSeconds: 0.14,
      sprintToFireSeconds: 0.21,
      movementMultiplier: 0.98,
      swayMultiplier: 0.78,
      readyPosition: 'compact high-ready'
    },
    viewmodel: {
      hip: [0.22, -0.235, -0.47],
      ads: [0, -0.205, -0.255],
      sprint: [0.39, -0.42, -0.38],
      adsNormalScale: 1,
      recommendedNear: 0.035
    },
    provenance: SOURCE_LICENSE
  },
  [MODERN_ARSENAL_IDS.MARKSMAN_RIFLE]: {
    id: MODERN_ARSENAL_IDS.MARKSMAN_RIFLE,
    uiName: 'R7.62 Designated Rifle',
    shortName: 'R7.62',
    class: 'designated-marksman-rifle',
    family: 'rifle',
    caliber: '7.62 x 51 mm',
    operatingSystem: 'gas-operated rotating bolt',
    magazineType: 'detachable box',
    capacity: 20,
    chamberSize: 1,
    reserve: 80,
    fireModes: ['safe', 'semi'],
    defaultFireMode: 'semi',
    rpm: 420,
    damage: 68,
    damageModel: { projectiles: 1, headMultiplier: 2.1, limbMultiplier: 0.82, effectiveRangeM: 520 },
    reloadTiming: {
      tacticalSeconds: 2.24,
      emptySeconds: 2.78,
      magazineOut: 0.48,
      magazineIn: 1.52,
      boltRelease: 2.34
    },
    recoil: {
      verticalKick: 0.086,
      horizontalKick: 0.025,
      cameraKick: 0.092,
      recoveryPerSecond: 7.2,
      firstShotMultiplier: 0.76
    },
    fov: { hip: 72, ads: 34, optic: 24 },
    handling: {
      massKg: 4.32,
      lengthM: 1.055,
      barrelM: 0.457,
      aimInSeconds: 0.31,
      aimOutSeconds: 0.24,
      sprintToFireSeconds: 0.36,
      movementMultiplier: 0.88,
      swayMultiplier: 1.08,
      readyPosition: 'low-ready precision'
    },
    viewmodel: {
      hip: [0.245, -0.255, -0.5],
      ads: [0, -0.222, -0.275],
      sprint: [0.43, -0.45, -0.36],
      adsNormalScale: 0.88,
      recommendedNear: 0.035
    },
    provenance: SOURCE_LICENSE
  },
  [MODERN_ARSENAL_IDS.TACTICAL_SHOTGUN]: {
    id: MODERN_ARSENAL_IDS.TACTICAL_SHOTGUN,
    uiName: 'T12 Tactical Autoloader',
    shortName: 'T12',
    class: 'semi-auto-tactical-shotgun',
    family: 'shotgun',
    caliber: '12 gauge / 70 mm',
    operatingSystem: 'gas-operated self-loading',
    magazineType: 'under-barrel tubular',
    capacity: 9,
    chamberSize: 1,
    reserve: 45,
    fireModes: ['safe', 'semi'],
    defaultFireMode: 'semi',
    rpm: 300,
    damage: 144,
    damageModel: { projectiles: 8, damagePerProjectile: 18, headMultiplier: 1.35, limbMultiplier: 0.82, effectiveRangeM: 42 },
    reloadTiming: {
      reloadType: 'per-shell',
      startSeconds: 0.34,
      perShellSeconds: 0.61,
      endSeconds: 0.29,
      emptyChamberSeconds: 0.88,
      interruptibleAfterShell: true
    },
    recoil: {
      verticalKick: 0.132,
      horizontalKick: 0.035,
      cameraKick: 0.145,
      recoveryPerSecond: 5.8,
      firstShotMultiplier: 1
    },
    fov: { hip: 72, ads: 50, optic: 44 },
    handling: {
      massKg: 3.72,
      lengthM: 1.005,
      barrelM: 0.47,
      aimInSeconds: 0.27,
      aimOutSeconds: 0.2,
      sprintToFireSeconds: 0.33,
      movementMultiplier: 0.91,
      swayMultiplier: 0.96,
      readyPosition: 'compressed low-ready'
    },
    viewmodel: {
      hip: [0.24, -0.27, -0.5],
      ads: [0, -0.215, -0.29],
      sprint: [0.42, -0.46, -0.38],
      adsNormalScale: 0.95,
      recommendedNear: 0.035
    },
    provenance: {
      asset: 'Project-authored procedural geometry',
      license: 'No third-party model dependency',
      commercialUse: true
    }
  }
};

export const MODERN_ARSENAL_SPECS = deepFreeze(RAW_SPECS);
export const MODERN_ARSENAL_PROVENANCE = deepFreeze({
  bundledRifleSource: SOURCE_LICENSE,
  proceduralGeometry: {
    authoring: 'Project-authored in src/modern-arsenal.js',
    thirdPartyModelDependency: false
  }
});

const FORWARD = new THREE.Vector3(0, 0, -1);
const UNIT_Y = new THREE.Vector3(0, 1, 0);
const IDENTITY_EULER = new THREE.Euler();

function clamp01(value) {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function smooth01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function phase(value, start, end) {
  return smooth01((value - start) / Math.max(1e-6, end - start));
}

function pulse(value, start, peak, end) {
  if (value <= start || value >= end) return 0;
  return value <= peak
    ? phase(value, start, peak)
    : 1 - phase(value, peak, end);
}

function canonicalName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function resolveScene(value) {
  return value?.scene?.isObject3D ? value.scene : value?.isObject3D ? value : null;
}

function effectivelyVisible(object, root) {
  for (let current = object; current; current = current.parent) {
    if (!current.visible) return false;
    if (current === root) return true;
  }
  return false;
}

function boundsInSpace(root, space) {
  root.updateWorldMatrix(true, true);
  space.updateWorldMatrix(true, false);
  const result = new THREE.Box3();
  const point = new THREE.Vector3();
  let found = false;
  root.traverse((object) => {
    if (!object.isMesh || !effectivelyVisible(object, root) || !object.geometry) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    if (!box) return;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          point.set(x, y, z);
          object.localToWorld(point);
          space.worldToLocal(point);
          result.expandByPoint(point);
          found = true;
        }
      }
    }
  });
  return found ? result : null;
}

function createResources() {
  return {
    geometries: new Set(),
    materials: new Set(),
    generatedMeshes: new Set()
  };
}

function ownedMaterial(resources, material) {
  resources.materials.add(material);
  return material;
}

function materialOr(options, key, fallback) {
  const external = options.materials?.[key];
  return external?.isMaterial ? external : fallback();
}

function createMaterialLibrary(options, resources) {
  const standard = (parameters) => ownedMaterial(resources, new THREE.MeshStandardMaterial(parameters));
  const physical = (parameters) => ownedMaterial(resources, new THREE.MeshPhysicalMaterial(parameters));
  return {
    receiver: materialOr(options, 'receiver', () => standard({ color: 0x252b29, roughness: 0.34, metalness: 0.84 })),
    steel: materialOr(options, 'steel', () => standard({ color: 0x161a19, roughness: 0.27, metalness: 0.94 })),
    parkerized: materialOr(options, 'parkerized', () => standard({ color: 0x303532, roughness: 0.55, metalness: 0.72 })),
    polymer: materialOr(options, 'polymer', () => standard({ color: 0x202622, roughness: 0.78, metalness: 0.03 })),
    rubber: materialOr(options, 'rubber', () => standard({ color: 0x101312, roughness: 0.9, metalness: 0 })),
    slot: materialOr(options, 'slot', () => standard({ color: 0x070908, roughness: 0.82, metalness: 0.18 })),
    lens: materialOr(options, 'lens', () => physical({
      color: 0x32524c,
      emissive: 0x071b16,
      emissiveIntensity: 0.32,
      roughness: 0.08,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.88
    })),
    lensDark: materialOr(options, 'lensDark', () => physical({
      color: 0x101917,
      roughness: 0.12,
      metalness: 0.08,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.92
    })),
    marking: materialOr(options, 'marking', () => standard({ color: 0xb6b9af, roughness: 0.62, metalness: 0.12 })),
    shellHull: materialOr(options, 'shellHull', () => standard({ color: 0x5f1c17, roughness: 0.58, metalness: 0.04 })),
    brass: materialOr(options, 'brass', () => standard({ color: 0xb88a35, roughness: 0.3, metalness: 0.88 }))
  };
}

function registerGeometry(resources, geometry) {
  resources.geometries.add(geometry);
  return geometry;
}

function addMesh(parent, name, geometry, material, position = null, rotation = null, resources = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  if (position) mesh.position.copy(position);
  if (rotation) mesh.rotation.copy(rotation);
  parent.add(mesh);
  if (resources) resources.generatedMeshes.add(mesh);
  return mesh;
}

function addBox(parent, name, size, material, position, rotation, resources) {
  const geometry = registerGeometry(resources, new THREE.BoxGeometry(size.x, size.y, size.z));
  return addMesh(parent, name, geometry, material, position, rotation, resources);
}

function addCylinderZ(parent, name, radius, length, material, position, resources, segments = 16, radiusEnd = radius) {
  const geometry = registerGeometry(resources, new THREE.CylinderGeometry(radiusEnd, radius, length, segments, 1, false));
  return addMesh(parent, name, geometry, material, position, new THREE.Euler(Math.PI / 2, 0, 0), resources);
}

function addCylinderY(parent, name, radius, length, material, position, resources, segments = 16) {
  const geometry = registerGeometry(resources, new THREE.CylinderGeometry(radius, radius, length, segments, 1, false));
  return addMesh(parent, name, geometry, material, position, IDENTITY_EULER, resources);
}

function addCapsuleBetween(parent, name, start, end, radius, material, resources, segments = 10) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const geometry = registerGeometry(resources, new THREE.CylinderGeometry(radius, radius, length, segments));
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const mesh = addMesh(parent, name, geometry, material, midpoint, null, resources);
  mesh.quaternion.setFromUnitVectors(UNIT_Y, direction.normalize());
  return mesh;
}

function addInstancedBoxes(parent, name, size, transforms, material, resources) {
  const geometry = registerGeometry(resources, new THREE.BoxGeometry(size.x, size.y, size.z));
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.copy(transform.position);
    dummy.rotation.copy(transform.rotation || IDENTITY_EULER);
    dummy.scale.copy(transform.scale || new THREE.Vector3(1, 1, 1));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  parent.add(mesh);
  resources.generatedMeshes.add(mesh);
  return mesh;
}

function addTopRail(parent, centerZ, length, y, materials, resources, nearDetail) {
  const group = new THREE.Group();
  group.name = 'top-accessory-rail';
  parent.add(group);
  addBox(group, 'rail-spine', new THREE.Vector3(0.042, 0.018, length), materials.steel, new THREE.Vector3(0, y, centerZ), null, resources);
  const count = Math.max(4, Math.floor(length / 0.025));
  const transforms = [];
  for (let index = 0; index < count; index += 1) {
    transforms.push({
      position: new THREE.Vector3(0, y + 0.013, centerZ - length * 0.5 + (index + 0.5) * length / count),
      rotation: new THREE.Euler(0, 0, 0)
    });
  }
  addInstancedBoxes(nearDetail || group, 'rail-cross-slots', new THREE.Vector3(0.057, 0.009, 0.012), transforms, materials.parkerized, resources);
  return group;
}

function addHandguardSlots(parent, centerZ, length, radius, materials, resources, nearDetail, rows = 2) {
  const transforms = [];
  const count = Math.max(4, Math.floor(length / 0.065));
  for (let side = -1; side <= 1; side += 2) {
    for (let row = 0; row < rows; row += 1) {
      for (let index = 0; index < count; index += 1) {
        transforms.push({
          position: new THREE.Vector3(
            side * (radius + 0.002),
            0.06 - row * 0.048,
            centerZ - length * 0.5 + 0.04 + index * (length - 0.08) / Math.max(1, count - 1)
          ),
          rotation: new THREE.Euler(0, 0, side * 0.04)
        });
      }
    }
  }
  return addInstancedBoxes(
    nearDetail || parent,
    'handguard-vent-slots',
    new THREE.Vector3(0.006, 0.021, 0.048),
    transforms,
    materials.slot,
    resources
  );
}

function createAnchor(parent, name, position, extra = {}) {
  const anchor = new THREE.Group();
  anchor.name = name;
  anchor.position.copy(position);
  anchor.userData.forward = [FORWARD.x, FORWARD.y, FORWARD.z];
  Object.assign(anchor.userData, extra);
  parent.add(anchor);
  return anchor;
}

function orientBundledRifle(model, space) {
  model.rotation.set(0, -Math.PI / 2, 0);
  model.updateWorldMatrix(true, true);
  const front = model.getObjectByName('Handguard');
  const rear = model.getObjectByName('Stock');
  if (!front || !rear) return;
  const frontBounds = boundsInSpace(front, space);
  const rearBounds = boundsInSpace(rear, space);
  if (!frontBounds || !rearBounds) return;
  if (frontBounds.getCenter(new THREE.Vector3()).z > rearBounds.getCenter(new THREE.Vector3()).z) {
    model.rotation.y += Math.PI;
    model.updateWorldMatrix(true, true);
  }
}

function pruneBundledRifle(model) {
  const hiddenExact = new Set([
    'handguard', 'mag', 'stock', 'sight', 'handle', 'scope',
    'scope001', 'sight001', 'handle001', 'stock001',
    'plane001', 'plane002', 'plane003', 'box002', 'box003',
    'mag byulle', 'mag byulle001',
    // These opaque export names are duplicate long furniture from the source
    // presentation scene. Keeping them would overlap the authored barrels,
    // handguards, and stocks and add four unnecessary textured draw calls.
    'ar93fifteen low', 'ar114fifteen low', 'ar117fifteen low', 'ar82fifteen low'
  ]);
  model.traverse((object) => {
    const name = canonicalName(object.name).replaceAll(' ', '');
    const spaced = canonicalName(object.name);
    if (
      hiddenExact.has(spaced)
      || spaced.includes('ground')
      || spaced.includes('stand')
      || spaced.includes('bullet')
      || /^mag\d/.test(name)
    ) object.visible = false;
  });
}

function cloneBundledReceiver(sourceValue, parent, desiredLength, targetY, materials, resources, mode) {
  const source = resolveScene(sourceValue);
  if (!source) return null;
  const holder = new THREE.Group();
  holder.name = 'bundled-textured-receiver';
  parent.add(holder);
  const model = source.clone(true);
  model.name = 'bundled-rifle-source-clone';
  holder.add(model);
  orientBundledRifle(model, holder);
  pruneBundledRifle(model);
  holder.updateWorldMatrix(true, true);
  let box = boundsInSpace(model, holder);
  if (!box || box.isEmpty()) {
    parent.remove(holder);
    return null;
  }
  const size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(desiredLength / Math.max(0.001, size.z));
  holder.updateWorldMatrix(true, true);
  box = boundsInSpace(model, holder);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y += targetY - center.y;
  model.position.z -= center.z;
  model.updateWorldMatrix(true, true);
  holder.userData.sourceAsset = 'assets/ar15/scene.gltf';
  holder.userData.licenseFile = SOURCE_LICENSE.file;
  holder.userData.license = SOURCE_LICENSE.license;
  holder.userData.commercialUse = SOURCE_LICENSE.commercialUse;
  holder.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = mode === 'world';
    object.receiveShadow = mode === 'world';
    object.frustumCulled = mode === 'world';
  });
  // A small receiver shadow plate visually joins the textured clone to the new
  // furniture without recolouring or mutating the source material.
  addBox(parent, 'receiver-lower-shadow', new THREE.Vector3(0.108, 0.075, desiredLength * 0.56), materials.receiver, new THREE.Vector3(0, -0.018, 0.025), null, resources);
  return holder;
}

function addFallbackReceiver(parent, length, materials, resources, enlarged = false) {
  const width = enlarged ? 0.145 : 0.132;
  addBox(parent, 'upper-receiver', new THREE.Vector3(width, 0.092, length), materials.receiver, new THREE.Vector3(0, 0.066, 0), null, resources);
  addBox(parent, 'lower-receiver', new THREE.Vector3(width * 0.88, 0.105, length * 0.68), materials.parkerized, new THREE.Vector3(0, -0.017, 0.04), null, resources);
  addBox(parent, 'magazine-well', new THREE.Vector3(width * 0.8, 0.1, 0.11), materials.receiver, new THREE.Vector3(0, -0.077, -0.025), new THREE.Euler(-0.04, 0, 0), resources);
  addBox(parent, 'ejection-port-recess', new THREE.Vector3(0.005, 0.05, 0.11), materials.slot, new THREE.Vector3(width * 0.51, 0.067, -0.035), null, resources);
  addCylinderY(parent, 'rear-takedown-pin', 0.008, width + 0.008, materials.steel, new THREE.Vector3(0, 0.01, 0.11), resources, 12).rotation.z = Math.PI / 2;
}

function addPistolGrip(parent, materials, resources, position = new THREE.Vector3(0, -0.15, 0.105)) {
  const grip = new THREE.Group();
  grip.name = 'pistol-grip';
  grip.position.copy(position);
  grip.rotation.x = -0.18;
  parent.add(grip);
  addBox(grip, 'grip-core', new THREE.Vector3(0.075, 0.18, 0.09), materials.polymer, new THREE.Vector3(), null, resources);
  const ridges = [];
  for (let i = 0; i < 5; i += 1) {
    ridges.push({ position: new THREE.Vector3(0, -0.065 + i * 0.029, -0.047) });
  }
  addInstancedBoxes(grip, 'grip-stipple-ridges', new THREE.Vector3(0.064, 0.008, 0.006), ridges, materials.rubber, resources);
  return grip;
}

function addDetachableMagazine(parent, materials, resources, options = {}) {
  const group = new THREE.Group();
  group.name = options.name || 'animated-magazine';
  group.position.copy(options.position || new THREE.Vector3(0, -0.105, -0.025));
  group.rotation.x = options.angle ?? -0.055;
  parent.add(group);
  const segments = options.segments || 3;
  const width = options.width || 0.105;
  const depth = options.depth || 0.055;
  const segmentHeight = options.segmentHeight || 0.058;
  for (let index = 0; index < segments; index += 1) {
    addBox(
      group,
      `magazine-body-${index + 1}`,
      new THREE.Vector3(width - index * 0.003, segmentHeight + 0.004, depth),
      materials.parkerized,
      new THREE.Vector3(0, -segmentHeight * (index + 0.5), index * (options.curve || 0.009)),
      new THREE.Euler(-(options.curve || 0.009) * index * 2.2, 0, 0),
      resources
    );
  }
  addBox(group, 'magazine-floorplate', new THREE.Vector3(width + 0.008, 0.014, depth + 0.007), materials.polymer, new THREE.Vector3(0, -segmentHeight * segments - 0.004, (segments - 1) * (options.curve || 0.009)), null, resources);
  addBox(group, 'magazine-feed-lips', new THREE.Vector3(width * 0.78, 0.016, depth * 0.82), materials.steel, new THREE.Vector3(0, -0.006, 0), null, resources);
  return group;
}

function addFireControls(parent, materials, resources, receiverWidth, positions = {}) {
  const trigger = new THREE.Group();
  trigger.name = 'animated-trigger';
  trigger.position.copy(positions.trigger || new THREE.Vector3(0, -0.093, 0.088));
  parent.add(trigger);
  addBox(trigger, 'trigger-shoe', new THREE.Vector3(0.014, 0.05, 0.012), materials.steel, new THREE.Vector3(0, -0.018, -0.003), new THREE.Euler(-0.22, 0, 0), resources);
  const selector = new THREE.Group();
  selector.name = 'animated-selector';
  selector.position.copy(positions.selector || new THREE.Vector3(receiverWidth * 0.52, 0.005, 0.09));
  parent.add(selector);
  const selectorPin = addCylinderY(selector, 'selector-pivot', 0.009, 0.012, materials.steel, new THREE.Vector3(), resources, 12);
  selectorPin.rotation.z = Math.PI / 2;
  addBox(selector, 'selector-lever', new THREE.Vector3(0.008, 0.012, 0.043), materials.parkerized, new THREE.Vector3(0.005, 0, -0.014), new THREE.Euler(0, -0.15, 0), resources);
  return { trigger, selector };
}

function addBoltAssembly(parent, materials, resources, receiverWidth, options = {}) {
  const bolt = new THREE.Group();
  bolt.name = 'animated-bolt';
  bolt.position.copy(options.position || new THREE.Vector3(receiverWidth * 0.515, 0.068, -0.035));
  parent.add(bolt);
  addBox(bolt, 'bolt-face-visible', new THREE.Vector3(0.006, 0.04, options.length || 0.078), materials.steel, new THREE.Vector3(), null, resources);
  const chargingHandle = new THREE.Group();
  chargingHandle.name = 'animated-charging-handle';
  chargingHandle.position.copy(options.handlePosition || new THREE.Vector3(0, 0.122, 0.13));
  parent.add(chargingHandle);
  addBox(chargingHandle, 'charging-handle-stem', new THREE.Vector3(0.025, 0.012, 0.05), materials.steel, new THREE.Vector3(0, 0, -0.01), null, resources);
  addBox(chargingHandle, 'charging-handle-latches', new THREE.Vector3(0.095, 0.016, 0.02), materials.parkerized, new THREE.Vector3(0, 0, 0.012), null, resources);
  return { bolt, chargingHandle };
}

function addMicroOptic(parent, materials, resources, nearDetail, position = new THREE.Vector3(0, 0.205, -0.03)) {
  const optic = new THREE.Group();
  optic.name = 'sealed-micro-optic';
  optic.position.copy(position);
  parent.add(optic);
  addBox(optic, 'optic-mount', new THREE.Vector3(0.067, 0.035, 0.072), materials.steel, new THREE.Vector3(0, -0.036, 0), null, resources);
  addCylinderZ(optic, 'optic-body', 0.03, 0.09, materials.parkerized, new THREE.Vector3(), resources, 20);
  addCylinderZ(nearDetail || optic, 'optic-front-glass', 0.024, 0.004, materials.lens, new THREE.Vector3(0, 0, -0.047), resources, 24);
  addCylinderZ(nearDetail || optic, 'optic-rear-glass', 0.023, 0.004, materials.lensDark, new THREE.Vector3(0, 0, 0.047), resources, 24);
  addCylinderY(optic, 'optic-adjustment-dial', 0.011, 0.018, materials.steel, new THREE.Vector3(0.037, 0, 0.008), resources, 14).rotation.z = Math.PI / 2;
  return optic;
}

function addMagnifiedOptic(parent, materials, resources, nearDetail, position = new THREE.Vector3(0, 0.225, 0.015)) {
  const optic = new THREE.Group();
  optic.name = 'variable-magnification-optic';
  optic.position.copy(position);
  parent.add(optic);
  addCylinderZ(optic, 'scope-main-tube', 0.024, 0.305, materials.parkerized, new THREE.Vector3(0, 0, 0), resources, 24);
  addCylinderZ(optic, 'scope-objective-bell', 0.039, 0.092, materials.parkerized, new THREE.Vector3(0, 0, -0.185), resources, 24, 0.031);
  addCylinderZ(optic, 'scope-ocular-bell', 0.034, 0.08, materials.polymer, new THREE.Vector3(0, 0, 0.178), resources, 24, 0.028);
  addCylinderZ(nearDetail || optic, 'scope-objective-glass', 0.032, 0.004, materials.lens, new THREE.Vector3(0, 0, -0.232), resources, 24);
  addCylinderZ(nearDetail || optic, 'scope-ocular-glass', 0.027, 0.004, materials.lensDark, new THREE.Vector3(0, 0, 0.221), resources, 24);
  for (const z of [-0.075, 0.085]) {
    addCylinderZ(optic, `scope-ring-${z < 0 ? 'front' : 'rear'}`, 0.029, 0.024, materials.steel, new THREE.Vector3(0, 0, z), resources, 18);
    addBox(optic, `scope-mount-${z < 0 ? 'front' : 'rear'}`, new THREE.Vector3(0.056, 0.046, 0.026), materials.steel, new THREE.Vector3(0, -0.037, z), null, resources);
  }
  addCylinderY(optic, 'scope-elevation-turret', 0.016, 0.035, materials.steel, new THREE.Vector3(0, 0.039, 0), resources, 16);
  const windage = addCylinderY(optic, 'scope-windage-turret', 0.014, 0.032, materials.steel, new THREE.Vector3(0.04, 0, 0), resources, 16);
  windage.rotation.z = Math.PI / 2;
  addCylinderZ(optic, 'scope-throw-lever-ring', 0.029, 0.022, materials.rubber, new THREE.Vector3(0, 0, 0.12), resources, 18);
  addBox(optic, 'scope-throw-lever', new THREE.Vector3(0.012, 0.038, 0.014), materials.rubber, new THREE.Vector3(0.021, 0.026, 0.12), new THREE.Euler(0, 0, -0.45), resources);
  return optic;
}

function addWeaponLight(parent, materials, resources, position, length = 0.145) {
  const light = new THREE.Group();
  light.name = 'underbarrel-weapon-light';
  light.position.copy(position);
  parent.add(light);
  addCylinderZ(light, 'light-body', 0.018, length, materials.parkerized, new THREE.Vector3(), resources, 18);
  addCylinderZ(light, 'light-head', 0.024, 0.035, materials.steel, new THREE.Vector3(0, 0, -length * 0.5 - 0.012), resources, 18, 0.02);
  addCylinderZ(light, 'light-lens', 0.018, 0.003, materials.lens, new THREE.Vector3(0, 0, -length * 0.5 - 0.031), resources, 20);
  addBox(light, 'light-rail-clamp', new THREE.Vector3(0.045, 0.026, 0.04), materials.steel, new THREE.Vector3(-0.02, 0.012, 0.015), null, resources);
  return light;
}

function addCompactStock(parent, materials, resources) {
  const stock = new THREE.Group();
  stock.name = 'animated-compact-stock';
  parent.add(stock);
  addCylinderZ(stock, 'buffer-tube', 0.019, 0.31, materials.parkerized, new THREE.Vector3(0, 0.045, 0.29), resources, 18);
  addCapsuleBetween(stock, 'left-stock-rail', new THREE.Vector3(-0.047, 0.028, 0.15), new THREE.Vector3(-0.047, 0.018, 0.44), 0.007, materials.steel, resources, 10);
  addCapsuleBetween(stock, 'right-stock-rail', new THREE.Vector3(0.047, 0.028, 0.15), new THREE.Vector3(0.047, 0.018, 0.44), 0.007, materials.steel, resources, 10);
  addBox(stock, 'compact-stock-body', new THREE.Vector3(0.112, 0.065, 0.16), materials.polymer, new THREE.Vector3(0, 0.035, 0.37), new THREE.Euler(-0.02, 0, 0), resources);
  addBox(stock, 'compact-butt-pad', new THREE.Vector3(0.11, 0.142, 0.025), materials.rubber, new THREE.Vector3(0, -0.005, 0.465), new THREE.Euler(-0.06, 0, 0), resources);
  return stock;
}

function addPrecisionStock(parent, materials, resources) {
  const stock = new THREE.Group();
  stock.name = 'animated-precision-stock';
  parent.add(stock);
  addCylinderZ(stock, 'receiver-extension', 0.02, 0.34, materials.parkerized, new THREE.Vector3(0, 0.045, 0.31), resources, 18);
  addBox(stock, 'precision-stock-beam', new THREE.Vector3(0.115, 0.095, 0.35), materials.polymer, new THREE.Vector3(0, 0.005, 0.38), new THREE.Euler(-0.03, 0, 0), resources);
  addBox(stock, 'adjustable-cheek-riser', new THREE.Vector3(0.096, 0.034, 0.235), materials.polymer, new THREE.Vector3(0, 0.09, 0.35), new THREE.Euler(-0.025, 0, 0), resources);
  addBox(stock, 'precision-butt-pad', new THREE.Vector3(0.12, 0.17, 0.028), materials.rubber, new THREE.Vector3(0, -0.005, 0.565), new THREE.Euler(-0.045, 0, 0), resources);
  const wheel = addCylinderY(stock, 'cheek-adjustment-wheel', 0.018, 0.132, materials.steel, new THREE.Vector3(0, 0.045, 0.37), resources, 16);
  wheel.rotation.z = Math.PI / 2;
  addBox(stock, 'rear-sling-slot', new THREE.Vector3(0.07, 0.036, 0.012), materials.slot, new THREE.Vector3(0, -0.035, 0.49), null, resources);
  return stock;
}

function addMuzzleBrake(parent, materials, resources, z, length = 0.067, radius = 0.023) {
  const brake = new THREE.Group();
  brake.name = 'muzzle-brake';
  brake.position.set(0, 0.09, z);
  parent.add(brake);
  addCylinderZ(brake, 'brake-body', radius, length, materials.steel, new THREE.Vector3(), resources, 18, radius * 0.86);
  const ports = [];
  for (const side of [-1, 1]) {
    for (const offset of [-0.018, 0.006, 0.026]) {
      ports.push({ position: new THREE.Vector3(side * radius * 0.93, 0, offset) });
    }
  }
  addInstancedBoxes(brake, 'brake-side-ports', new THREE.Vector3(0.006, radius * 0.85, 0.012), ports, materials.slot, resources);
  return brake;
}

function createWeaponShell(id, options) {
  const resources = createResources();
  const materials = createMaterialLibrary(options, resources);
  const root = new THREE.Group();
  root.name = `${id}-weapon-root`;
  root.rotation.order = 'YXZ';
  const presentation = new THREE.Group();
  presentation.name = `${id}-presentation`;
  root.add(presentation);
  const model = new THREE.Group();
  model.name = `${id}-model`;
  presentation.add(model);
  const nearDetail = new THREE.Group();
  nearDetail.name = `${id}-near-detail`;
  model.add(nearDetail);
  return { root, presentation, model, nearDetail, resources, materials };
}

function captureTransform(object) {
  return {
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
    visible: object.visible
  };
}

function restoreTransform(object, state) {
  if (!object || !state) return;
  object.position.copy(state.position);
  object.quaternion.copy(state.quaternion);
  object.scale.copy(state.scale);
  object.visible = state.visible;
}

function createAnimator(presentation, parts, profile) {
  const bases = new Map();
  const tracked = { presentation, ...parts };
  for (const object of Object.values(tracked)) {
    if (object?.isObject3D && !bases.has(object)) bases.set(object, captureTransform(object));
  }

  function reset() {
    for (const [object, state] of bases) restoreTransform(object, state);
  }

  function setPartState(input = {}) {
    reset();
    const state = {
      bolt: clamp01(input.bolt),
      charge: clamp01(input.charge ?? input.bolt),
      magazine: clamp01(input.magazine),
      trigger: clamp01(input.trigger),
      selector: clamp01(input.selector),
      stock: clamp01(input.stock),
      carrier: clamp01(input.carrier),
      shell: clamp01(input.shell),
      shellVisible: Boolean(input.shellVisible),
      poseX: Number(input.poseX) || 0,
      poseY: Number(input.poseY) || 0,
      poseZ: Number(input.poseZ) || 0,
      posePitch: Number(input.posePitch) || 0,
      poseYaw: Number(input.poseYaw) || 0,
      poseRoll: Number(input.poseRoll) || 0
    };
    if (parts.bolt) parts.bolt.position.z += profile.boltTravel * state.bolt;
    if (parts.action && parts.action !== parts.bolt) parts.action.position.z += profile.boltTravel * state.bolt;
    if (parts.chargingHandle) parts.chargingHandle.position.z += profile.chargeTravel * state.charge;
    if (parts.magazine && profile.detachableMagazine) {
      parts.magazine.position.y -= profile.magazineDrop * state.magazine;
      parts.magazine.position.z += profile.magazineBack * state.magazine;
      parts.magazine.rotation.x += profile.magazineTilt * state.magazine;
    }
    if (parts.trigger) parts.trigger.rotation.x -= 0.28 * state.trigger;
    if (parts.selector) parts.selector.rotation.x += 0.75 * state.selector;
    if (parts.stock) parts.stock.position.z -= profile.stockTravel * state.stock;
    if (parts.shellCarrier) parts.shellCarrier.rotation.x -= 0.62 * state.carrier;
    if (parts.reloadShell) {
      parts.reloadShell.visible = state.shellVisible;
      parts.reloadShell.position.x += profile.shellStart.x * (1 - state.shell);
      parts.reloadShell.position.y += profile.shellStart.y * (1 - state.shell);
      parts.reloadShell.position.z += profile.shellStart.z * (1 - state.shell);
      parts.reloadShell.rotation.x += (1 - state.shell) * 1.1;
    }
    presentation.position.add(new THREE.Vector3(state.poseX, state.poseY, state.poseZ));
    presentation.rotation.x += state.posePitch;
    presentation.rotation.y += state.poseYaw;
    presentation.rotation.z += state.poseRoll;
    return state;
  }

  function animate(action, progress, animationOptions = {}) {
    const p = clamp01(progress);
    const empty = Boolean(animationOptions.empty);
    switch (action) {
      case 'fire':
        return setPartState({
          bolt: pulse(p, 0.02, 0.28, 0.74),
          trigger: 1 - phase(p, 0.46, 0.95),
          poseZ: -Math.sin(p * Math.PI) * profile.fireKick,
          posePitch: Math.sin(p * Math.PI) * profile.firePitch
        });
      case 'cycle':
      case 'charge':
        return setPartState({
          bolt: pulse(p, 0, 0.48, 1),
          charge: pulse(p, 0, 0.48, 1),
          poseRoll: -Math.sin(p * Math.PI) * 0.06
        });
      case 'reload': {
        if (!profile.detachableMagazine) return animate('reload-shell', p, animationOptions);
        const magazine = p < 0.5 ? phase(p, 0.08, 0.38) : 1 - phase(p, 0.58, 0.9);
        const charge = empty ? pulse(p, 0.84, 0.93, 1) : 0;
        return setPartState({
          magazine,
          bolt: charge,
          charge,
          poseX: Math.sin(p * Math.PI) * 0.055,
          poseY: -Math.sin(p * Math.PI) * 0.12,
          poseRoll: Math.sin(p * Math.PI) * 0.34
        });
      }
      case 'reload-shell': {
        const shell = phase(p, 0.12, 0.8);
        return setPartState({
          carrier: pulse(p, 0.05, 0.4, 0.95),
          shell,
          shellVisible: p > 0.03 && p < 0.94,
          poseY: -Math.sin(p * Math.PI) * 0.045,
          poseRoll: Math.sin(p * Math.PI) * 0.16
        });
      }
      case 'equip':
        return setPartState({
          poseY: -(1 - phase(p, 0, 0.82)) * 0.28,
          poseZ: (1 - phase(p, 0, 0.82)) * 0.12,
          poseRoll: -(1 - phase(p, 0, 0.82)) * 0.42
        });
      case 'inspect':
        return setPartState({
          bolt: pulse(p, 0.42, 0.55, 0.68) * 0.35,
          poseX: Math.sin(p * Math.PI) * 0.07,
          poseY: Math.sin(p * Math.PI) * 0.035,
          poseYaw: Math.sin(p * Math.PI) * -0.42,
          poseRoll: Math.sin(p * Math.PI * 2) * 0.08
        });
      case 'stock':
        return setPartState({ stock: p });
      case 'idle':
      default:
        return setPartState();
    }
  }

  return { reset, setPartState, animate };
}

function countDiagnostics(root, resources) {
  let visibleMeshes = 0;
  let visibleTriangles = 0;
  const materials = new Set();
  root.traverse((object) => {
    if (!object.isMesh || !effectivelyVisible(object, root)) return;
    visibleMeshes += 1;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) if (material) materials.add(material);
    const geometry = object.geometry;
    const baseTriangles = geometry?.index
      ? geometry.index.count / 3
      : (geometry?.attributes?.position?.count || 0) / 3;
    visibleTriangles += baseTriangles * (object.isInstancedMesh ? object.count : 1);
  });
  return {
    visibleDrawCallsEstimate: visibleMeshes,
    visibleMaterialCount: materials.size,
    visibleTriangleEstimate: Math.round(visibleTriangles),
    ownedGeometryCount: resources.geometries.size,
    ownedMaterialCount: resources.materials.size
  };
}

function finishWeapon(shell, definition, options) {
  const { root, presentation, nearDetail, resources } = shell;
  const modeState = { value: null };
  const animator = createAnimator(presentation, definition.parts, definition.animationProfile);

  function setMode(nextMode = 'viewmodel') {
    const mode = nextMode === 'world' ? 'world' : 'viewmodel';
    modeState.value = mode;
    nearDetail.visible = mode === 'viewmodel' && options.detail !== 'reduced';
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = mode === 'world';
      object.receiveShadow = mode === 'world';
      object.frustumCulled = mode === 'world';
      object.renderOrder = mode === 'viewmodel' ? 40 : 0;
    });
    root.userData.mode = mode;
    return root;
  }

  function dispose() {
    if (root.parent) root.parent.remove(root);
    for (const geometry of resources.geometries) geometry.dispose();
    for (const material of resources.materials) material.dispose();
    resources.geometries.clear();
    resources.materials.clear();
  }

  const spec = MODERN_ARSENAL_SPECS[definition.id];
  root.userData.weaponId = definition.id;
  root.userData.uiName = spec.uiName;
  root.userData.weaponFamily = spec.family;
  root.userData.spec = spec;
  root.userData.anchors = definition.anchors;
  root.userData.parts = definition.parts;
  root.userData.sourceCloneUsed = Boolean(definition.sourceCloneUsed);
  setMode(options.mode);
  animator.reset();

  return Object.freeze({
    id: definition.id,
    root,
    presentation,
    anchors: Object.freeze(definition.anchors),
    parts: Object.freeze(definition.parts),
    spec,
    handling: spec.handling,
    sourceCloneUsed: Boolean(definition.sourceCloneUsed),
    setMode,
    setPartState: animator.setPartState,
    animate: animator.animate,
    resetAnimation: animator.reset,
    getDiagnostics: () => countDiagnostics(root, resources),
    dispose
  });
}

function buildCompactCarbine(options) {
  const shell = createWeaponShell(MODERN_ARSENAL_IDS.COMPACT_CARBINE, options);
  const { model, nearDetail, materials, resources } = shell;
  const source = options.ar15Scene ?? options.source;
  const sourceClone = cloneBundledReceiver(source, model, 0.345, 0.015, materials, resources, options.mode);
  if (!sourceClone) addFallbackReceiver(model, 0.345, materials, resources, false);

  // Short free-float handguard and 267 mm barrel establish the compact profile.
  addCylinderZ(model, 'compact-free-float-handguard', 0.065, 0.285, materials.receiver, new THREE.Vector3(0, 0.068, -0.305), resources, 12);
  addHandguardSlots(model, -0.305, 0.27, 0.065, materials, resources, nearDetail, 2);
  addTopRail(model, -0.23, 0.49, 0.143, materials, resources, nearDetail);
  addCylinderZ(model, 'compact-barrel', 0.0135, 0.225, materials.steel, new THREE.Vector3(0, 0.09, -0.542), resources, 18);
  addCylinderZ(model, 'compact-gas-block', 0.023, 0.042, materials.parkerized, new THREE.Vector3(0, 0.09, -0.445), resources, 14);
  addMuzzleBrake(model, materials, resources, -0.685, 0.055, 0.021);
  addBox(model, 'hand-stop', new THREE.Vector3(0.045, 0.055, 0.035), materials.polymer, new THREE.Vector3(0, -0.012, -0.39), new THREE.Euler(0.14, 0, 0), resources);

  const optic = addMicroOptic(model, materials, resources, nearDetail, new THREE.Vector3(0, 0.205, -0.045));
  addBox(model, 'compact-aiming-module', new THREE.Vector3(0.052, 0.036, 0.085), materials.polymer, new THREE.Vector3(-0.045, 0.148, -0.33), null, resources);
  addCylinderZ(nearDetail, 'aiming-module-emitter', 0.008, 0.008, materials.lensDark, new THREE.Vector3(-0.045, 0.148, -0.376), resources, 12);
  const weaponLight = addWeaponLight(model, materials, resources, new THREE.Vector3(0.062, 0.015, -0.39), 0.135);

  const stock = addCompactStock(model, materials, resources);
  if (!sourceClone) addPistolGrip(model, materials, resources);
  const magazine = addDetachableMagazine(model, materials, resources, {
    name: 'animated-30-round-magazine',
    position: new THREE.Vector3(0, -0.072, -0.035),
    segments: 4,
    width: 0.104,
    depth: 0.055,
    segmentHeight: 0.052,
    curve: 0.009
  });
  const controls = addFireControls(model, materials, resources, 0.132);
  const action = addBoltAssembly(model, materials, resources, 0.132);

  const anchors = {
    muzzle: createAnchor(model, 'muzzle-anchor', new THREE.Vector3(0, 0.09, -0.716), { caliber: '5.56' }),
    ejection: createAnchor(model, 'ejection-anchor', new THREE.Vector3(0.073, 0.074, -0.042), { casing: 'rifle' }),
    underbarrelLight: createAnchor(model, 'underbarrel-light-anchor', weaponLight.position.clone(), { forwardAxis: '-Z' }),
    ads: createAnchor(model, 'ads-anchor', optic.position.clone(), { eyeReliefM: 0.08, opticFov: 40 }),
    grip: createAnchor(model, 'grip-anchor', new THREE.Vector3(0, -0.105, 0.104), { hand: 'dominant' }),
    supportGrip: createAnchor(model, 'support-grip-anchor', new THREE.Vector3(-0.018, 0.012, -0.335), { hand: 'support' }),
    stock: createAnchor(model, 'stock-anchor', new THREE.Vector3(0, 0.015, 0.477), { shoulderContact: true }),
    action: createAnchor(model, 'action-anchor', new THREE.Vector3(0.074, 0.074, -0.02), { action: 'rotating-bolt' }),
    magazine: createAnchor(model, 'magazine-anchor', new THREE.Vector3(0, -0.072, -0.035), { feed: 'detachable-box' })
  };
  anchors.light = anchors.underbarrelLight;

  const parts = {
    bolt: action.bolt,
    action: action.bolt,
    chargingHandle: action.chargingHandle,
    magazine,
    trigger: controls.trigger,
    selector: controls.selector,
    stock
  };
  return finishWeapon(shell, {
    id: MODERN_ARSENAL_IDS.COMPACT_CARBINE,
    anchors,
    parts,
    sourceCloneUsed: Boolean(sourceClone),
    animationProfile: {
      boltTravel: 0.074,
      chargeTravel: 0.072,
      detachableMagazine: true,
      magazineDrop: 0.255,
      magazineBack: 0.045,
      magazineTilt: 0.16,
      stockTravel: 0.18,
      shellStart: new THREE.Vector3(),
      fireKick: 0.052,
      firePitch: 0.046
    }
  }, options);
}

function addBipod(parent, materials, resources, nearDetail) {
  const bipod = new THREE.Group();
  bipod.name = 'folding-bipod';
  bipod.position.set(0, 0.005, -0.58);
  (nearDetail || parent).add(bipod);
  addCylinderY(bipod, 'bipod-pivot', 0.018, 0.105, materials.steel, new THREE.Vector3(), resources, 14).rotation.z = Math.PI / 2;
  addCapsuleBetween(bipod, 'left-bipod-leg', new THREE.Vector3(-0.036, -0.01, 0), new THREE.Vector3(-0.12, -0.21, 0.085), 0.008, materials.parkerized, resources, 10);
  addCapsuleBetween(bipod, 'right-bipod-leg', new THREE.Vector3(0.036, -0.01, 0), new THREE.Vector3(0.12, -0.21, 0.085), 0.008, materials.parkerized, resources, 10);
  addBox(bipod, 'left-bipod-foot', new THREE.Vector3(0.052, 0.016, 0.035), materials.rubber, new THREE.Vector3(-0.12, -0.217, 0.085), null, resources);
  addBox(bipod, 'right-bipod-foot', new THREE.Vector3(0.052, 0.016, 0.035), materials.rubber, new THREE.Vector3(0.12, -0.217, 0.085), null, resources);
  return bipod;
}

function buildMarksmanRifle(options) {
  const shell = createWeaponShell(MODERN_ARSENAL_IDS.MARKSMAN_RIFLE, options);
  const { model, nearDetail, materials, resources } = shell;
  const source = options.ar15Scene ?? options.source;
  const sourceClone = cloneBundledReceiver(source, model, 0.405, 0.018, materials, resources, options.mode);
  if (!sourceClone) addFallbackReceiver(model, 0.405, materials, resources, true);

  // Reinforced receiver shoulders, long handguard, heavy barrel and precision
  // furniture prevent this from reading as a stretched compact carbine.
  addBox(model, 'marksman-upper-reinforcement', new THREE.Vector3(0.15, 0.032, 0.31), materials.receiver, new THREE.Vector3(0, 0.112, -0.018), null, resources);
  addBox(model, 'marksman-magwell-reinforcement', new THREE.Vector3(0.135, 0.095, 0.14), materials.parkerized, new THREE.Vector3(0, -0.055, -0.045), new THREE.Euler(-0.035, 0, 0), resources);
  addCylinderZ(model, 'marksman-free-float-handguard', 0.071, 0.48, materials.receiver, new THREE.Vector3(0, 0.074, -0.39), resources, 12);
  addHandguardSlots(model, -0.39, 0.455, 0.071, materials, resources, nearDetail, 3);
  addTopRail(model, -0.245, 0.69, 0.151, materials, resources, nearDetail);
  addCylinderZ(model, 'marksman-heavy-barrel', 0.016, 0.385, materials.steel, new THREE.Vector3(0, 0.09, -0.777), resources, 20);
  addCylinderZ(model, 'marksman-gas-block', 0.025, 0.05, materials.parkerized, new THREE.Vector3(0, 0.09, -0.592), resources, 16);
  addMuzzleBrake(model, materials, resources, -1.005, 0.076, 0.025);
  addBox(model, 'angled-support-stop', new THREE.Vector3(0.052, 0.06, 0.048), materials.polymer, new THREE.Vector3(0, -0.012, -0.49), new THREE.Euler(0.22, 0, 0), resources);
  addBipod(model, materials, resources, nearDetail);

  const optic = addMagnifiedOptic(model, materials, resources, nearDetail, new THREE.Vector3(0, 0.233, 0.02));
  const weaponLight = addWeaponLight(model, materials, resources, new THREE.Vector3(0.073, 0.015, -0.48), 0.155);
  const stock = addPrecisionStock(model, materials, resources);
  if (!sourceClone) addPistolGrip(model, materials, resources, new THREE.Vector3(0, -0.155, 0.11));
  const magazine = addDetachableMagazine(model, materials, resources, {
    name: 'animated-20-round-magazine',
    position: new THREE.Vector3(0, -0.07, -0.045),
    segments: 3,
    width: 0.126,
    depth: 0.065,
    segmentHeight: 0.055,
    curve: 0.004
  });
  const controls = addFireControls(model, materials, resources, 0.145);
  const action = addBoltAssembly(model, materials, resources, 0.145, { length: 0.102, handlePosition: new THREE.Vector3(0, 0.126, 0.15) });

  const anchors = {
    muzzle: createAnchor(model, 'muzzle-anchor', new THREE.Vector3(0, 0.09, -1.047), { caliber: '7.62' }),
    ejection: createAnchor(model, 'ejection-anchor', new THREE.Vector3(0.08, 0.076, -0.045), { casing: 'full-power-rifle' }),
    underbarrelLight: createAnchor(model, 'underbarrel-light-anchor', weaponLight.position.clone(), { forwardAxis: '-Z' }),
    ads: createAnchor(model, 'ads-anchor', optic.position.clone(), { eyeReliefM: 0.092, opticFov: 24 }),
    grip: createAnchor(model, 'grip-anchor', new THREE.Vector3(0, -0.11, 0.11), { hand: 'dominant' }),
    supportGrip: createAnchor(model, 'support-grip-anchor', new THREE.Vector3(-0.02, 0.005, -0.47), { hand: 'support' }),
    stock: createAnchor(model, 'stock-anchor', new THREE.Vector3(0, -0.005, 0.58), { shoulderContact: true }),
    action: createAnchor(model, 'action-anchor', new THREE.Vector3(0.08, 0.076, -0.025), { action: 'rotating-bolt' }),
    magazine: createAnchor(model, 'magazine-anchor', new THREE.Vector3(0, -0.07, -0.045), { feed: 'detachable-box' })
  };
  anchors.light = anchors.underbarrelLight;

  const parts = {
    bolt: action.bolt,
    action: action.bolt,
    chargingHandle: action.chargingHandle,
    magazine,
    trigger: controls.trigger,
    selector: controls.selector,
    stock
  };
  return finishWeapon(shell, {
    id: MODERN_ARSENAL_IDS.MARKSMAN_RIFLE,
    anchors,
    parts,
    sourceCloneUsed: Boolean(sourceClone),
    animationProfile: {
      boltTravel: 0.087,
      chargeTravel: 0.084,
      detachableMagazine: true,
      magazineDrop: 0.285,
      magazineBack: 0.055,
      magazineTilt: 0.2,
      stockTravel: 0.055,
      shellStart: new THREE.Vector3(),
      fireKick: 0.084,
      firePitch: 0.078
    }
  }, options);
}

function addShotgunStock(parent, materials, resources) {
  const stock = new THREE.Group();
  stock.name = 'animated-shotgun-stock';
  parent.add(stock);
  addBox(stock, 'shotgun-stock-neck', new THREE.Vector3(0.095, 0.095, 0.18), materials.polymer, new THREE.Vector3(0, -0.012, 0.24), new THREE.Euler(-0.07, 0, 0), resources);
  addBox(stock, 'shotgun-stock-body', new THREE.Vector3(0.125, 0.16, 0.3), materials.polymer, new THREE.Vector3(0, -0.02, 0.43), new THREE.Euler(-0.055, 0, 0), resources);
  addBox(stock, 'shotgun-cheek-line', new THREE.Vector3(0.105, 0.036, 0.25), materials.rubber, new THREE.Vector3(0, 0.075, 0.42), new THREE.Euler(-0.05, 0, 0), resources);
  addBox(stock, 'shotgun-butt-pad', new THREE.Vector3(0.128, 0.18, 0.032), materials.rubber, new THREE.Vector3(0, -0.025, 0.595), new THREE.Euler(-0.055, 0, 0), resources);
  addBox(stock, 'shotgun-sling-slot', new THREE.Vector3(0.065, 0.03, 0.012), materials.slot, new THREE.Vector3(0, -0.075, 0.49), null, resources);
  return stock;
}

function addGhostRingSights(parent, materials, resources, nearDetail) {
  const sight = new THREE.Group();
  sight.name = 'ghost-ring-sights';
  parent.add(sight);
  addBox(sight, 'rear-sight-base', new THREE.Vector3(0.055, 0.035, 0.045), materials.steel, new THREE.Vector3(0, 0.17, 0.11), null, resources);
  const rearRing = registerGeometry(resources, new THREE.TorusGeometry(0.015, 0.0035, 8, 18));
  addMesh(nearDetail || sight, 'rear-ghost-ring', rearRing, materials.parkerized, new THREE.Vector3(0, 0.197, 0.105), null, resources);
  addBox(sight, 'front-sight-base', new THREE.Vector3(0.035, 0.035, 0.04), materials.steel, new THREE.Vector3(0, 0.145, -0.67), null, resources);
  addBox(sight, 'front-sight-post', new THREE.Vector3(0.006, 0.035, 0.006), materials.marking, new THREE.Vector3(0, 0.179, -0.67), null, resources);
  return sight;
}

function addShotgunShell(parent, materials, resources, name = 'reload-shell') {
  const shell = new THREE.Group();
  shell.name = name;
  parent.add(shell);
  addCylinderZ(shell, 'shell-hull', 0.0095, 0.056, materials.shellHull, new THREE.Vector3(), resources, 16);
  addCylinderZ(shell, 'shell-brass-head', 0.0104, 0.012, materials.brass, new THREE.Vector3(0, 0, 0.034), resources, 16);
  addCylinderZ(shell, 'shell-crimp', 0.0092, 0.003, materials.shellHull, new THREE.Vector3(0, 0, -0.0295), resources, 16);
  return shell;
}

function buildTacticalShotgun(options) {
  const shell = createWeaponShell(MODERN_ARSENAL_IDS.TACTICAL_SHOTGUN, options);
  const { model, nearDetail, materials, resources } = shell;

  // Purpose-built gas-operated receiver. No rifle source clone is used because
  // retaining an AR receiver would make the action, feed system, and silhouette
  // mechanically implausible for a tube-fed 12-gauge autoloader.
  addBox(model, 'shotgun-receiver-main', new THREE.Vector3(0.14, 0.14, 0.36), materials.receiver, new THREE.Vector3(0, 0.055, 0.005), null, resources);
  addBox(model, 'shotgun-receiver-top-radius', new THREE.Vector3(0.126, 0.045, 0.345), materials.parkerized, new THREE.Vector3(0, 0.14, 0), null, resources);
  addBox(model, 'shotgun-ejection-port', new THREE.Vector3(0.006, 0.068, 0.135), materials.slot, new THREE.Vector3(0.073, 0.075, -0.04), null, resources);
  addBox(model, 'shotgun-loading-port', new THREE.Vector3(0.075, 0.006, 0.13), materials.slot, new THREE.Vector3(0, -0.018, -0.04), null, resources);
  addTopRail(model, 0.015, 0.34, 0.177, materials, resources, nearDetail);

  addCylinderZ(model, 'shotgun-barrel', 0.0185, 0.69, materials.steel, new THREE.Vector3(0, 0.105, -0.505), resources, 20);
  addCylinderZ(model, 'shotgun-muzzle-collar', 0.024, 0.052, materials.parkerized, new THREE.Vector3(0, 0.105, -0.868), resources, 18);
  const tubeMagazine = new THREE.Group();
  tubeMagazine.name = 'animated-tube-magazine';
  model.add(tubeMagazine);
  addCylinderZ(tubeMagazine, 'tube-magazine-body', 0.021, 0.61, materials.parkerized, new THREE.Vector3(0, 0.025, -0.46), resources, 18);
  addCylinderZ(tubeMagazine, 'tube-magazine-cap', 0.025, 0.035, materials.steel, new THREE.Vector3(0, 0.025, -0.785), resources, 18);
  addBox(model, 'gas-block-collar', new THREE.Vector3(0.095, 0.115, 0.055), materials.parkerized, new THREE.Vector3(0, 0.066, -0.66), null, resources);
  addCapsuleBetween(model, 'left-action-rod', new THREE.Vector3(-0.036, 0.052, -0.14), new THREE.Vector3(-0.036, 0.052, -0.58), 0.0055, materials.steel, resources, 10);
  addCapsuleBetween(model, 'right-action-rod', new THREE.Vector3(0.036, 0.052, -0.14), new THREE.Vector3(0.036, 0.052, -0.58), 0.0055, materials.steel, resources, 10);

  addBox(model, 'shotgun-fore-end', new THREE.Vector3(0.135, 0.115, 0.37), materials.polymer, new THREE.Vector3(0, 0.045, -0.39), null, resources);
  const foreRibs = [];
  for (let index = 0; index < 9; index += 1) {
    foreRibs.push({ position: new THREE.Vector3(0, -0.014, -0.54 + index * 0.038) });
  }
  addInstancedBoxes(nearDetail, 'fore-end-grip-ribs', new THREE.Vector3(0.137, 0.012, 0.012), foreRibs, materials.rubber, resources);
  addBox(model, 'barrel-vent-rib', new THREE.Vector3(0.026, 0.014, 0.66), materials.parkerized, new THREE.Vector3(0, 0.135, -0.49), null, resources);
  const ventPosts = [];
  for (let index = 0; index < 11; index += 1) ventPosts.push({ position: new THREE.Vector3(0, 0.126, -0.78 + index * 0.057) });
  addInstancedBoxes(nearDetail, 'barrel-rib-posts', new THREE.Vector3(0.022, 0.018, 0.007), ventPosts, materials.steel, resources);

  const stock = addShotgunStock(model, materials, resources);
  addPistolGrip(model, materials, resources, new THREE.Vector3(0, -0.13, 0.17));
  addGhostRingSights(model, materials, resources, nearDetail);
  const optic = addMicroOptic(model, materials, resources, nearDetail, new THREE.Vector3(0, 0.215, 0.015));
  optic.scale.setScalar(0.82);
  const weaponLight = addWeaponLight(model, materials, resources, new THREE.Vector3(0.075, 0.025, -0.51), 0.15);

  const bolt = new THREE.Group();
  bolt.name = 'animated-shotgun-bolt';
  bolt.position.set(0.074, 0.078, -0.04);
  model.add(bolt);
  addBox(bolt, 'shotgun-bolt-face', new THREE.Vector3(0.006, 0.052, 0.105), materials.steel, new THREE.Vector3(), null, resources);
  const chargingHandle = new THREE.Group();
  chargingHandle.name = 'animated-shotgun-charging-handle';
  chargingHandle.position.set(0.098, 0.083, -0.005);
  model.add(chargingHandle);
  const handleStem = addCylinderY(chargingHandle, 'shotgun-handle-stem', 0.006, 0.045, materials.steel, new THREE.Vector3(), resources, 12);
  handleStem.rotation.z = Math.PI / 2;
  addCylinderY(chargingHandle, 'shotgun-handle-knob', 0.011, 0.032, materials.parkerized, new THREE.Vector3(0.027, 0, 0), resources, 14).rotation.z = Math.PI / 2;

  const shellCarrier = new THREE.Group();
  shellCarrier.name = 'animated-shell-carrier';
  shellCarrier.position.set(0, -0.021, -0.045);
  model.add(shellCarrier);
  addBox(shellCarrier, 'shell-carrier-gate', new THREE.Vector3(0.068, 0.009, 0.12), materials.steel, new THREE.Vector3(0, 0, -0.02), null, resources);
  const reloadShell = addShotgunShell(model, materials, resources, 'animated-reload-shell');
  reloadShell.position.set(0, -0.048, -0.055);
  reloadShell.rotation.x = Math.PI / 2;
  reloadShell.visible = false;

  const sideSaddleTransforms = [];
  for (let index = 0; index < 5; index += 1) {
    sideSaddleTransforms.push({
      position: new THREE.Vector3(-0.083, 0.075, 0.115 - index * 0.055),
      rotation: new THREE.Euler(0, Math.PI / 2, 0)
    });
  }
  const saddleGeometry = registerGeometry(resources, new THREE.CylinderGeometry(0.0095, 0.0095, 0.052, 14));
  const saddle = new THREE.InstancedMesh(saddleGeometry, materials.shellHull, sideSaddleTransforms.length);
  saddle.name = 'receiver-side-saddle-shells';
  const dummy = new THREE.Object3D();
  sideSaddleTransforms.forEach((transform, index) => {
    dummy.position.copy(transform.position);
    dummy.rotation.copy(transform.rotation);
    dummy.updateMatrix();
    saddle.setMatrixAt(index, dummy.matrix);
  });
  saddle.instanceMatrix.needsUpdate = true;
  nearDetail.add(saddle);
  resources.generatedMeshes.add(saddle);

  const controls = addFireControls(model, materials, resources, 0.14, {
    trigger: new THREE.Vector3(0, -0.084, 0.145),
    selector: new THREE.Vector3(0.074, 0.012, 0.13)
  });

  const anchors = {
    muzzle: createAnchor(model, 'muzzle-anchor', new THREE.Vector3(0, 0.105, -0.897), { caliber: '12-gauge' }),
    ejection: createAnchor(model, 'ejection-anchor', new THREE.Vector3(0.082, 0.084, -0.06), { casing: 'shot-shell' }),
    underbarrelLight: createAnchor(model, 'underbarrel-light-anchor', weaponLight.position.clone(), { forwardAxis: '-Z' }),
    ads: createAnchor(model, 'ads-anchor', optic.position.clone(), { eyeReliefM: 0.075, opticFov: 44 }),
    grip: createAnchor(model, 'grip-anchor', new THREE.Vector3(0, -0.095, 0.17), { hand: 'dominant' }),
    supportGrip: createAnchor(model, 'support-grip-anchor', new THREE.Vector3(-0.02, 0.018, -0.39), { hand: 'support' }),
    stock: createAnchor(model, 'stock-anchor', new THREE.Vector3(0, -0.025, 0.612), { shoulderContact: true }),
    action: createAnchor(model, 'action-anchor', new THREE.Vector3(0.1, 0.083, -0.005), { action: 'self-loading-bolt' }),
    magazine: createAnchor(model, 'magazine-anchor', new THREE.Vector3(0, -0.045, -0.055), { feed: 'tubular-loading-port' }),
    shellFeed: createAnchor(model, 'shell-feed-anchor', new THREE.Vector3(0, -0.045, -0.055), { feed: 'per-shell' })
  };
  anchors.light = anchors.underbarrelLight;

  const parts = {
    bolt,
    action: bolt,
    chargingHandle,
    magazine: tubeMagazine,
    trigger: controls.trigger,
    selector: controls.selector,
    stock,
    shellCarrier,
    reloadShell
  };
  return finishWeapon(shell, {
    id: MODERN_ARSENAL_IDS.TACTICAL_SHOTGUN,
    anchors,
    parts,
    sourceCloneUsed: false,
    animationProfile: {
      boltTravel: 0.105,
      chargeTravel: 0.105,
      detachableMagazine: false,
      magazineDrop: 0,
      magazineBack: 0,
      magazineTilt: 0,
      stockTravel: 0.055,
      shellStart: new THREE.Vector3(0.16, -0.19, 0.14),
      fireKick: 0.116,
      firePitch: 0.118
    }
  }, options);
}

function normalizeFactoryOptions(options = {}) {
  return {
    ...options,
    mode: options.mode === 'world' ? 'world' : 'viewmodel',
    detail: options.detail === 'reduced' ? 'reduced' : 'full'
  };
}

export function createCompactCarbine(options = {}) {
  return buildCompactCarbine(normalizeFactoryOptions(options));
}

export function createDesignatedMarksmanRifle(options = {}) {
  return buildMarksmanRifle(normalizeFactoryOptions(options));
}

export function createTacticalShotgun(options = {}) {
  return buildTacticalShotgun(normalizeFactoryOptions(options));
}

export function createModernWeapon(id, options = {}) {
  switch (id) {
    case MODERN_ARSENAL_IDS.COMPACT_CARBINE:
      return createCompactCarbine(options);
    case MODERN_ARSENAL_IDS.MARKSMAN_RIFLE:
      return createDesignatedMarksmanRifle(options);
    case MODERN_ARSENAL_IDS.TACTICAL_SHOTGUN:
      return createTacticalShotgun(options);
    default:
      throw new RangeError(`Unknown modern arsenal weapon id: ${id}`);
  }
}

export function getModernWeaponSpec(id) {
  return MODERN_ARSENAL_SPECS[id] || null;
}

export function listModernWeapons() {
  return Object.values(MODERN_ARSENAL_IDS).map((id) => MODERN_ARSENAL_SPECS[id]);
}

/**
 * Create a registry that remembers the loaded bundled rifle source.
 *
 * @param {object} options
 * @param {THREE.Object3D|object} [options.ar15Scene] THREE scene or loaded GLTF.
 * @param {'viewmodel'|'world'} [options.mode='viewmodel'] Initial render mode.
 * @param {'full'|'reduced'} [options.detail='full'] Near-detail policy.
 * @param {Record<string,THREE.Material>} [options.materials] Optional material overrides.
 */
export function createModernArsenal(options = {}) {
  const defaults = normalizeFactoryOptions(options);
  const create = (id, overrides = {}) => createModernWeapon(id, {
    ...defaults,
    ...overrides,
    ar15Scene: overrides.ar15Scene ?? defaults.ar15Scene ?? defaults.source,
    materials: { ...(defaults.materials || {}), ...(overrides.materials || {}) }
  });
  return Object.freeze({
    version: MODERN_ARSENAL_VERSION,
    ids: MODERN_ARSENAL_IDS,
    specs: MODERN_ARSENAL_SPECS,
    list: listModernWeapons,
    getSpec: getModernWeaponSpec,
    create,
    createCompactCarbine: (overrides) => create(MODERN_ARSENAL_IDS.COMPACT_CARBINE, overrides),
    createDesignatedMarksmanRifle: (overrides) => create(MODERN_ARSENAL_IDS.MARKSMAN_RIFLE, overrides),
    createTacticalShotgun: (overrides) => create(MODERN_ARSENAL_IDS.TACTICAL_SHOTGUN, overrides)
  });
}

export default createModernArsenal;
