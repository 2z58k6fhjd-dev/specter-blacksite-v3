import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEBGPU_LAB_DEPENDENCIES, WEBGPU_LAB_STAGE } from '../src/webgpu-lab/dependency-manifest.js';
import { resolveVendoredWebgpuDependencies } from '../src/webgpu-lab/dependency-loader.js';
import { createWebgpuLabReport } from '../src/webgpu-lab/diagnostics.js';
import { KNOWN_TRIANGLE_WGSL } from '../src/webgpu-lab/known-triangle-dispatch.js';
import {
  KNOWN_TRIANGLE_DISPATCH_CASE,
  validateKnownTriangleDispatchReceipt
} from '../src/webgpu-lab/dispatch-receipt.js';
import {
  RASTER_FOUNDATION_RECEIPT,
  validateRasterFoundationReceipt
} from '../src/webgpu-lab/raster-foundation-receipt.js';
import { probeWebgpuRasterFoundation } from '../src/webgpu-lab/raster-foundation-probe.js';
import { DETERMINISTIC_SCENE_BVH_CASE } from '../src/webgpu-lab/scene-bvh-pack.js';
import { SCENE_BVH_DISPATCH_CASE } from '../src/webgpu-lab/scene-bvh-receipt.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
function check(value, message) { checks++; assert.ok(value, message); }

const [html, shippedMain, labMain, knownTriangleDispatchSource, docs] = await Promise.all([
  readFile(resolve(ROOT, 'webgpu-lab.html'), 'utf8'),
  readFile(resolve(ROOT, 'src/main.js'), 'utf8'),
  readFile(resolve(ROOT, 'src/webgpu-lab/main.js'), 'utf8'),
  readFile(resolve(ROOT, 'src/webgpu-lab/known-triangle-dispatch.js'), 'utf8'),
  readFile(resolve(ROOT, 'docs/QA/WEBGPU_LAB.md'), 'utf8')
]);

check(!/https?:\/\//i.test(html), 'The lab HTML must contain no network dependency URL.');
check(!html.includes('src/main.js'), 'The lab must not load the game entry point.');
check(!shippedMain.includes('src/webgpu-lab') && !shippedMain.includes('webgpu-lab/'), 'The shipped game must not import the lab.');
check(labMain.includes('resolveVendoredWebgpuDependencies') && labMain.includes('probeWebgpuEnvironment'), 'The lab entry must use the isolated dependency and device probes.');
check(!/catch\(error\)[\s\S]*?innerHTML\s*=/.test(labMain), 'Fatal probe errors must not be inserted through unescaped innerHTML.');
check(/detail\.textContent\s*=\s*String\(error\?\.message \|\| error\)/.test(labMain), 'Fatal probe errors must be rendered through textContent.');
check(!labMain.includes('.innerHTML'), 'The lab entry must use DOM construction instead of HTML-string insertion.');
check(WEBGPU_LAB_DEPENDENCIES.three.version === '0.185.1', 'Three must be locked to 0.185.1.');
check(WEBGPU_LAB_DEPENDENCIES.meshBvh.version === '0.9.13', 'three-mesh-bvh must be locked to 0.9.13.');
check(Object.values(WEBGPU_LAB_DEPENDENCIES).every(item => item.license === 'MIT'), 'Both vendored dependencies must require MIT metadata.');
check(WEBGPU_LAB_STAGE.runtimeIntegrated === false, 'The lab stage must not imply game integration.');
check(WEBGPU_LAB_STAGE.triangleKernelImplemented === true, 'The known-input ray/triangle compute kernel must be part of this stage.');
check(WEBGPU_LAB_STAGE.triangleDispatchValidated === true, 'The stage must accept only a validated mapped-readback receipt.');
check(WEBGPU_LAB_STAGE.fsr2PortImplemented === false, 'The lab stage must not imply AMD FSR 2.');
check(/@compute\s+@workgroup_size\(1, 1, 1\)/.test(KNOWN_TRIANGLE_WGSL), 'The proof must contain an actual WGSL compute entry point.');
check(KNOWN_TRIANGLE_WGSL.includes('cross(') && KNOWN_TRIANGLE_WGSL.includes('determinant'), 'The compute proof must perform geometric ray/triangle intersection math.');
check(knownTriangleDispatchSource.includes('device?.lost') && knownTriangleDispatchSource.includes('deviceLossObserver.requireNotLost()'), 'Known-triangle receipts must observe GPUDevice.lost through the receipt checkpoint.');
check(!knownTriangleDispatchSource.includes('deviceLost: false'), 'Known-triangle receipts must not assert an unmeasured device-loss boolean.');
check(docs.includes('There is no CDN fallback'), 'The isolated lab documentation must preserve its fail-closed boundary.');

const rasterReceipt = {
  schema: RASTER_FOUNDATION_RECEIPT.schema,
  testId: RASTER_FOUNDATION_RECEIPT.testId,
  backend: 'webgpu',
  rendererRevision: 185,
  drawingBufferWidth: 64,
  drawingBufferHeight: 64,
  attachmentNames: [...RASTER_FOUNDATION_RECEIPT.attachmentNames],
  frameSubmitted: true,
  queueCompleted: true,
  historyReadIndex: 1,
  errorScopeErrors: [],
  deviceLost: false
};
check(validateRasterFoundationReceipt(rasterReceipt).valid, 'The exact raster receipt must satisfy its validator.');
check(!validateRasterFoundationReceipt({ ...rasterReceipt, backend: 'webgl' }).valid, 'A WebGL fallback must never satisfy the WebGPU raster receipt.');
check(!validateRasterFoundationReceipt({ ...rasterReceipt, attachmentNames: rasterReceipt.attachmentNames.slice(0, -1) }).valid, 'A missing temporal MRT attachment must invalidate the raster receipt.');
await assert.rejects(
  probeWebgpuRasterFoundation({
    THREE: {
      REVISION: '185',
      WebGPURenderer: class {
        constructor() { this.backend = { isWebGPUBackend: false }; }
        setPixelRatio() {}
        setSize() {}
        async init() {}
        dispose() {}
      }
    },
    importTsl: async () => ({}),
    canvasFactory: () => ({ width: 0, height: 0 })
  }),
  /WebGL fallback/
);
checks++;

let importCalls = 0;
const missingFetch = async url => ({
  ok: false,
  status: 404,
  json: async () => ({ url })
});
const missing = await resolveVendoredWebgpuDependencies({
  fetchImpl: missingFetch,
  importer: async () => { importCalls++; return {}; },
  baseUrl: 'https://specter.invalid/src/webgpu-lab/dependency-loader.js'
});
check(missing.ready === false && missing.imported === false, 'Missing local files must fail closed.');
check(importCalls === 0, 'No module may be evaluated after a failed metadata/file preflight.');
check(missing.blockers.length === 4, 'Every absent package manifest and module must be diagnosed.');

const packagesByUrl = new Map(Object.values(WEBGPU_LAB_DEPENDENCIES).map(item => [
  new URL(item.packageManifestUrl, 'https://specter.invalid/src/webgpu-lab/dependency-loader.js').href,
  { name: item.packageName, version: item.version, license: item.license }
]));
const validFetch = async (url, options = {}) => {
  if (options.method === 'HEAD') return { ok: true, status: 200 };
  const body = packagesByUrl.get(String(url));
  return { ok: Boolean(body), status: body ? 200 : 404, json: async () => body };
};
const exportsBySpecifier = {
  '@specter-lab/three-webgpu': { WebGPURenderer: class {} },
  '@specter-lab/three-mesh-bvh': { BVHComputeData: class {} }
};
const valid = await resolveVendoredWebgpuDependencies({
  fetchImpl: validFetch,
  importer: async specifier => exportsBySpecifier[specifier],
  baseUrl: 'https://specter.invalid/src/webgpu-lab/dependency-loader.js'
});
check(valid.ready && valid.imported, 'Exact local metadata, files, and exports should satisfy only the dependency gate.');

const idealProbe = {
  secureContext: true,
  navigatorGpu: true,
  adapterFound: true,
  deviceAcquired: true,
  limits: {
    maxStorageBufferBindingSize: 134217728,
    maxStorageBuffersPerShaderStage: 8,
    maxStorageTexturesPerShaderStage: 4,
    maxComputeInvocationsPerWorkgroup: 256
  },
  features: []
};
const report = createWebgpuLabReport({ environment: idealProbe, dependencyResolution: valid });
check(report.runtimeIntegrated === false, 'An ideal probe must remain isolated from the game.');
check(report.claims.geometryRayTracingActive === false, 'Dependencies and a device must not imply geometry rays.');
check(report.claims.hardwareRayTracingActive === false, 'The lab must never fabricate hardware RT.');
check(report.claims.amdFsr2Active === false, 'The lab must never fabricate AMD FSR 2.');
check(report.triangleDispatchReady === false, 'An ideal dependency/device probe is still not triangle dispatch.');
assert.deepEqual(report.triangleDispatchBlockers, ['renderer-init', 'scene-bvh', 'triangle-dispatch', 'scene-bvh-dispatch']);
checks++;
check(!report.dispatchEvidence.valid && report.dispatchEvidence.missing.includes('knownTriangleDispatchReceipt'), 'The browser probe must report the missing deterministic GPU receipt.');

const deterministicReceipt = {
  schema: KNOWN_TRIANGLE_DISPATCH_CASE.schema,
  testId: KNOWN_TRIANGLE_DISPATCH_CASE.testId,
  backend: 'webgpu-compute',
  readbackSource: 'GPUBuffer.mapAsync',
  inputSha256: KNOWN_TRIANGLE_DISPATCH_CASE.inputSha256,
  kernelSha256: 'd65c51d5ec449c8e6bd79b14e84a30ff12fccdbbd6f6c803ab8ba69f50985296',
  dispatchWorkgroups: KNOWN_TRIANGLE_DISPATCH_CASE.dispatchWorkgroups,
  readbackByteLength: KNOWN_TRIANGLE_DISPATCH_CASE.expectedReadbackByteLength,
  readbackHex: KNOWN_TRIANGLE_DISPATCH_CASE.expectedReadbackHex,
  errorScopeErrors: [],
  deviceLost: false
};
check(!validateKnownTriangleDispatchReceipt(true).valid, 'A boolean must not count as known-triangle dispatch evidence.');
check(!validateKnownTriangleDispatchReceipt({ passed: true }).valid, 'A generic success object must not count as dispatch evidence.');
check(!validateKnownTriangleDispatchReceipt({ ...deterministicReceipt, readbackHex: deterministicReceipt.readbackHex.replace(/^01/, '00') }).valid, 'An altered readback must fail deterministic receipt validation.');
const receiptOnlyReport = createWebgpuLabReport({
  environment: { ...idealProbe, knownTriangleDispatchReceipt: deterministicReceipt },
  dependencyResolution: valid
});
check(receiptOnlyReport.dispatchEvidence.valid, 'The exact known-triangle receipt should satisfy the receipt validator.');
check(!receiptOnlyReport.contractEvaluation.computeBvhGeometryRayTracing, 'A receipt without renderer initialization and scene BVH coverage must not unlock geometry rays.');
check(!receiptOnlyReport.triangleDispatchBlockers.includes('triangle-dispatch'), 'The exact mapped-readback receipt must satisfy only the known-triangle dispatch gate.');
check(receiptOnlyReport.triangleDispatchBlockers.includes('renderer-init') && receiptOnlyReport.triangleDispatchBlockers.includes('scene-bvh'), 'A unit-triangle receipt must not imply renderer or game-scene BVH coverage.');

const sceneBvhPackEvidence = {
  schema: DETERMINISTIC_SCENE_BVH_CASE.schema,
  testId: DETERMINISTIC_SCENE_BVH_CASE.testId,
  packSource: 'three-mesh-bvh@0.9.13 BVHComputeData.update',
  packSha256: DETERMINISTIC_SCENE_BVH_CASE.expectedPackSha256,
  facts: {
    nodeCount: 8, transformCount: 3, packedTriangleCount: 12,
    packedVertexCount: 36, tlasLeafCount: 3, blasNodeCount: 3
  },
  cpuOracle: {
    backend: 'cpu-oracle', gpuEvidence: false, hit: true,
    triangleIndex: 0, objectIndex: 1, distance: 2,
    barycentric: [0.5, 0.25, 0.25]
  }
};
const sceneBvhDispatchReceipt = {
  schema: SCENE_BVH_DISPATCH_CASE.schema,
  testId: SCENE_BVH_DISPATCH_CASE.testId,
  backend: 'webgpu-compute-bvh',
  algorithm: 'TLAS/BLAS stack traversal + Moller-Trumbore',
  packSource: 'three-mesh-bvh@0.9.13 BVHComputeData.update',
  readbackSource: 'GPUBuffer.mapAsync',
  packSha256: SCENE_BVH_DISPATCH_CASE.packSha256,
  kernelSha256: '67a2c7b639ccecaee621cfe36599d966632aa80f0b745c041f89a7083e3c9b51',
  dispatchWorkgroups: SCENE_BVH_DISPATCH_CASE.dispatchWorkgroups,
  readbackByteLength: SCENE_BVH_DISPATCH_CASE.expectedReadbackByteLength,
  readbackHex: SCENE_BVH_DISPATCH_CASE.expectedReadbackHex,
  errorScopeErrors: [],
  deviceLost: false
};
const fullProofReport = createWebgpuLabReport({
  environment: {
    ...idealProbe,
    knownTriangleDispatchReceipt: deterministicReceipt,
    webgpuRasterReceipt: rasterReceipt,
    sceneBvhPackEvidence,
    sceneBvhDispatchReceipt
  },
  dependencyResolution: valid
});
check(fullProofReport.claims.webgpuRasterActive, 'An exact WebGPU raster receipt may activate only the isolated raster proof.');
check(fullProofReport.claims.geometryRayTracingActive, 'Exact raster + mapped TLAS/BLAS evidence may activate only the isolated geometry-ray proof.');
check(fullProofReport.runtimeIntegrated === false && !fullProofReport.claims.hardwareRayTracingActive && !fullProofReport.claims.amdFsr2Active, 'A complete lab proof must not imply game integration, hardware RT, or AMD FSR 2.');
check(fullProofReport.triangleDispatchReady, 'Every exact proof receipt must clear the isolated lab blocker list.');

console.log(`WebGPU lab QA: ${checks} checks, 0 failures.`);
