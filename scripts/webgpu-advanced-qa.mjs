import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVANCED_RENDERER_CONTRACT,
  FSR2_QUALITY_MODES,
  FSR2_REQUIRED_PASSES,
  WEBGPU_COMPUTE_MINIMUMS,
  advanceTemporalHistory,
  evaluateAdvancedRendererCapabilities,
  resolveFsr2QualityMode
} from '../src/experimental/webgpu-advanced-contract.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;

async function test(name, operation) {
  try {
    await operation();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

function check(value, message) {
  checks++;
  assert.ok(value, message);
}

const baseWebgpuProbe = Object.freeze({
  secureContext: true,
  navigatorGpu: true,
  adapterFound: true,
  backend: 'webgpu',
  threeRevision: 185,
  tslPostProcessing: true,
  computeShaders: true,
  storageBuffers: true,
  storageTextures: true,
  bvhComputeData: true,
  limits: WEBGPU_COMPUTE_MINIMUMS
});

const completeFsr2Evidence = Object.freeze({
  sourceVersion: '2.2.1',
  mitLicenseNoticeRetained: true,
  wgslPasses: FSR2_REQUIRED_PASSES,
  inputs: Object.freeze({
    color: true, depth: true, velocity: true, jitter: true,
    previousTransforms: true, historyReset: true, frameTimeDelta: true,
    cameraParameters: true, exposure: true, reactiveMask: true,
    transparencyAndCompositionMask: true
  }),
  formats: Object.freeze({ hdrColorStorage: true, floatDepth: true, rg16FloatVelocity: true }),
  referenceValidated: true,
  motionCoverageValidated: true,
  disocclusionValidated: true,
  separateTaaDisabled: true
});

await test('contract remains staged and cannot claim hardware ray tracing', async () => {
  check(ADVANCED_RENDERER_CONTRACT.runtimeIntegrated === false, 'The contract must not imply runtime integration.');
  check(ADVANCED_RENDERER_CONTRACT.stage === 'design-and-qa-only', 'The contract must identify its non-runtime stage.');
  check(ADVANCED_RENDERER_CONTRACT.hardwareRayTracingClaimAllowed === false, 'Hardware RT claims must remain prohibited.');
  const main = await readFile(resolve(ROOT, 'src/main.js'), 'utf8');
  check(!main.includes('experimental/webgpu-advanced-contract'), 'The shipped runtime must not import the staged contract.');
});

await test('capability evaluation distinguishes compute BVH rays from hardware RT', () => {
  const unavailable = evaluateAdvancedRendererCapabilities({});
  check(!unavailable.webgpuRasterReady && !unavailable.computeBvhGeometryRayTracing, 'An empty probe must unlock no WebGPU feature.');
  check(unavailable.hardwareRayTracing.available === false, 'Hardware RT must remain unavailable without standardized API exposure.');

  const geometryRt = evaluateAdvancedRendererCapabilities({
    ...baseWebgpuProbe,
    hardwareRayTracing: true,
    features: ['ray-tracing', 'acceleration-structure']
  });
  check(geometryRt.webgpuRasterReady, 'A complete WebGPU renderer probe should pass raster capability.');
  check(geometryRt.computeBvhGeometryRayTracing, 'BVHComputeData plus compute storage should unlock geometry ray traversal.');
  check(geometryRt.geometryRayTracingLabel.includes('compute BVH'), 'Geometry RT must be labeled by its actual algorithm.');
  check(geometryRt.hardwareRayTracing.available === false, 'Untrusted feature strings must never fabricate hardware RT.');
  check(!geometryRt.fsr2.ready && geometryRt.fsr2.label.includes('unavailable'), 'Geometry RT readiness must not imply FSR 2 readiness.');

  const oldRenderer = evaluateAdvancedRendererCapabilities({ ...baseWebgpuProbe, threeRevision: 184 });
  check(!oldRenderer.webgpuRasterReady, 'Three.js below the declared migration baseline must stay ineligible.');
  const insufficientStorage = evaluateAdvancedRendererCapabilities({
    ...baseWebgpuProbe,
    limits: { ...WEBGPU_COMPUTE_MINIMUMS, maxStorageBufferBindingSize: WEBGPU_COMPUTE_MINIMUMS.maxStorageBufferBindingSize - 1 }
  });
  check(!insufficientStorage.computeReady && insufficientStorage.missing.includes('limits.maxStorageBufferBindingSize'), 'A compute-limit shortfall must fail closed and name the limit.');
  const noBvh = evaluateAdvancedRendererCapabilities({ ...baseWebgpuProbe, bvhComputeData: false });
  check(noBvh.computeReady && !noBvh.computeBvhGeometryRayTracing, 'General WebGPU compute must not imply BVH ray traversal.');
});

await test('FSR 2 requires the complete port, temporal evidence, formats, license, and validation', () => {
  const incomplete = evaluateAdvancedRendererCapabilities({
    ...baseWebgpuProbe,
    fsr2: { ...completeFsr2Evidence, inputs: { ...completeFsr2Evidence.inputs, velocity: false } }
  });
  check(!incomplete.fsr2.ready, 'Missing velocity must prevent an AMD FSR 2 claim.');
  check(incomplete.fsr2.missing.includes('fsr2.inputs.velocity'), 'The missing velocity input must be diagnosed.');

  const incompletePass = evaluateAdvancedRendererCapabilities({
    ...baseWebgpuProbe,
    fsr2: { ...completeFsr2Evidence, wgslPasses: FSR2_REQUIRED_PASSES.slice(0, -1) }
  });
  check(!incompletePass.fsr2.ready, 'Missing RCAS must prevent an AMD FSR 2 claim.');
  check(incompletePass.fsr2.missing.includes('fsr2.wgslPasses.rcas'), 'The missing official pass must be diagnosed.');

  const ready = evaluateAdvancedRendererCapabilities({ ...baseWebgpuProbe, fsr2: completeFsr2Evidence });
  check(ready.fsr2.ready, 'Only complete validated evidence may unlock the AMD FSR 2 label.');
  check(ready.fsr2.label === 'AMD FSR 2', 'A validated implementation may use the precise product name.');
  check(ready.fsr2.missing.length === 0, 'Complete evidence must have no missing prerequisites.');
});

await test('official FSR 2 quality ratios resolve deterministic render dimensions', () => {
  const expected4k = {
    'native-aa': [3840, 2160, 8],
    quality: [2560, 1440, 18],
    balanced: [2259, 1271, 23],
    performance: [1920, 1080, 32],
    'ultra-performance': [1280, 720, 72]
  };
  for (const [mode, expected] of Object.entries(expected4k)) {
    const result = resolveFsr2QualityMode(mode, 3840, 2160);
    check(result.renderWidth === expected[0] && result.renderHeight === expected[1], `${mode} must resolve the expected 4K render size.`);
    check(result.jitterPhaseCount === expected[2], `${mode} must retain its deterministic jitter phase count.`);
    check(result.ratio === FSR2_QUALITY_MODES[mode].ratio, `${mode} must expose the official per-dimension ratio.`);
  }
  const quality1080 = resolveFsr2QualityMode('quality', 1920, 1080);
  check(quality1080.renderWidth === 1280 && quality1080.renderHeight === 720, '1080p Quality must render at 1280x720.');
  check(Math.abs(quality1080.mipLodBias - (Math.log2(2 / 3) - 1)) < 1e-12, 'Mip bias must derive from the actual resolved width ratio.');
  assert.throws(() => resolveFsr2QualityMode('marketing-ultra', 1920, 1080), /Unsupported FSR 2 quality mode/);
  checks++;
});

function frame(overrides = {}) {
  return {
    backendId: 'webgpu-adapter-0', deviceEpoch: 1,
    renderWidth: 1280, renderHeight: 720,
    displayWidth: 1920, displayHeight: 1080,
    qualityMode: 'quality', cameraPosition: [0, 1.72, 0],
    projectionSignature: 'perspective:70:16/9:0.1:400',
    sceneTopologyRevision: 7,
    ...overrides
  };
}

await test('temporal history initializes and accumulates only across compatible frames', () => {
  const first = advanceTemporalHistory(null, frame());
  check(first.reset && first.reasons.join() === 'first-frame', 'The first temporal frame must reset history.');
  check(first.historyFrameCount === 0, 'The first frame must start a new history sequence.');
  const stable = advanceTemporalHistory(first, frame({ cameraPosition: [0.1, 1.72, 0] }));
  check(!stable.reset && stable.reasons.length === 0, 'Ordinary sub-threshold camera motion must preserve history.');
  check(stable.historyFrameCount === 1, 'A compatible frame must advance the history age.');
  const stableAgain = advanceTemporalHistory(stable, frame({ cameraPosition: [0.2, 1.72, 0] }));
  check(stableAgain.historyFrameCount === 2, 'History age must advance deterministically.');
});

await test('temporal reset reasons are complete and deterministically ordered', () => {
  const first = advanceTemporalHistory(null, frame());
  const changed = advanceTemporalHistory(first, frame({
    explicitReset: true,
    deviceEpoch: 2,
    backendId: 'webgpu-adapter-1',
    renderWidth: 1920,
    displayWidth: 2560,
    qualityMode: 'balanced',
    cameraCut: true,
    cameraPosition: [10, 1.72, 0],
    projectionSignature: 'perspective:80:16/9:0.1:400',
    sceneTopologyRevision: 8
  }));
  assert.deepEqual(changed.reasons, [
    'explicit-reset', 'device-change', 'backend-change',
    'render-resolution-change', 'presentation-resolution-change',
    'quality-mode-change', 'camera-cut', 'camera-teleport',
    'projection-change', 'scene-topology-change'
  ]);
  checks++;
  check(changed.reset && changed.historyFrameCount === 0, 'Any incompatible change must restart temporal accumulation.');

  const belowThreshold = advanceTemporalHistory(first, frame({ cameraPosition: [3.999, 1.72, 0] }));
  check(!belowThreshold.reasons.includes('camera-teleport'), 'Motion below the teleport threshold must preserve history.');
  const atThreshold = advanceTemporalHistory(first, frame({ cameraPosition: [4, 1.72, 0] }));
  check(atThreshold.reasons.includes('camera-teleport'), 'Motion at the teleport threshold must reset history.');
  const invalidThreshold = advanceTemporalHistory(first, frame({ cameraPosition: [3, 1.72, 0] }), { teleportThresholdMeters: -1 });
  check(!invalidThreshold.reasons.includes('camera-teleport'), 'An invalid threshold must fail back to the safe four-meter contract default.');
});

console.log(`\nWebGPU advanced renderer QA: ${checks} checks, 0 failures.`);
