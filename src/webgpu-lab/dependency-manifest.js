/**
 * Local-only dependency lock for the isolated WebGPU lab.
 *
 * Nothing in this graph is imported by the shipped game. At runtime, the loader
 * validates package metadata, probes module availability, and checks required
 * exports after evaluation. Release validation separately enforces the vendored
 * files' recorded hashes. Failures produce diagnostics, never a CDN fallback or
 * an accidental renderer downgrade.
 */

export const WEBGPU_LAB_DEPENDENCIES = Object.freeze({
  three: Object.freeze({
    id: 'three-webgpu',
    packageName: 'three',
    version: '0.185.1',
    revision: 185,
    license: 'MIT',
    specifier: '@specter-lab/three-webgpu',
    packageManifestUrl: '../../vendor/webgpu-lab/three-0.185.1/package.json',
    moduleUrl: '../../vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
    requiredExports: Object.freeze(['WebGPURenderer'])
  }),
  meshBvh: Object.freeze({
    id: 'three-mesh-bvh-compute',
    packageName: 'three-mesh-bvh',
    version: '0.9.13',
    license: 'MIT',
    specifier: '@specter-lab/three-mesh-bvh',
    packageManifestUrl: '../../vendor/webgpu-lab/three-mesh-bvh-0.9.13/package.json',
    moduleUrl: '../../vendor/webgpu-lab/three-mesh-bvh-0.9.13/src/webgpu/index.js',
    requiredExports: Object.freeze(['BVHComputeData'])
  })
});

export const WEBGPU_LAB_IMPORT_MAP = Object.freeze({
  '@specter-lab/three-webgpu': './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  '@specter-lab/three-mesh-bvh': './vendor/webgpu-lab/three-mesh-bvh-0.9.13/src/webgpu/index.js',
  three: './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  'three/webgpu': './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  'three/tsl': './vendor/webgpu-lab/three-0.185.1/build/three.tsl.js'
});

export const WEBGPU_LAB_STAGE = Object.freeze({
  id: 'known-triangle-compute-proof',
  runtimeIntegrated: false,
  rasterRendererInitialized: false,
  sceneBvhPacked: false,
  triangleKernelImplemented: true,
  triangleDispatchValidated: true,
  fsr2PortImplemented: false
});
