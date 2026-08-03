import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export class AssetManager {
  constructor(config) {
    this.config = config;
    this.loader = new GLTFLoader();
    this.models = new Map();
  }

  status(name, state, detail = '') {
    const el = document.getElementById(`diag-${name}`);
    if (el) {
      el.textContent = `${name.toUpperCase()}: ${state}${detail ? ` — ${detail}` : ''}`;
      el.className = state === 'LOADED' ? 'ok' : state === 'FAILED' ? 'bad' : 'loading';
    }
    console.log(`[AssetManager] ${name}: ${state}`, detail);
  }

  async loadModel(name, url) {
    this.status(name, 'LOADING');
    try {
      const gltf = await this.loader.loadAsync(url);
      const scene = gltf.scene;
      scene.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.filter(Boolean).forEach(mat => {
          if ('envMapIntensity' in mat) mat.envMapIntensity = 0.55;
          mat.needsUpdate = true;
        });
      });
      this.models.set(name, { scene, animations: gltf.animations || [] });
      let meshCount = 0;
      scene.traverse(o => { if (o.isMesh) meshCount++; });
      this.status(name, 'LOADED', `${meshCount} meshes`);
      return this.models.get(name);
    } catch (error) {
      this.status(name, 'FAILED', error?.message || String(error));
      return null;
    }
  }

  clone(name, skinned = false) {
    const asset = this.models.get(name);
    if (!asset) return null;
    return skinned ? cloneSkeleton(asset.scene) : asset.scene.clone(true);
  }

  normalize(object, maxDimension, floorAlign = false) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z) || 1;
    object.scale.multiplyScalar(maxDimension / largest);
    object.updateMatrixWorld(true);

    const scaled = new THREE.Box3().setFromObject(object);
    const center = scaled.getCenter(new THREE.Vector3());
    object.position.sub(center);

    if (floorAlign) {
      object.updateMatrixWorld(true);
      const aligned = new THREE.Box3().setFromObject(object);
      object.position.y -= aligned.min.y;
    }
    return object;
  }
}
