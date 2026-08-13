/**
 * Experimental WebGPU advanced-renderer contract.
 *
 * This module is intentionally not imported by the shipped game. It is a pure,
 * deterministic specification for a future renderer migration and must not be
 * treated as proof that WebGPU, geometry ray tracing, or AMD FSR 2 is active.
 */

export const ADVANCED_RENDERER_CONTRACT = Object.freeze({
  version: '0.1.0',
  stage: 'design-and-qa-only',
  runtimeIntegrated: false,
  currentRuntimeBackend: 'webgl',
  minimumThreeRevision: 185,
  rayTracingClaim: 'WebGPU compute BVH geometry ray tracing',
  hardwareRayTracingClaimAllowed: false,
  hardwareRayTracingReason: 'The standardized WebGPU API exposes no acceleration-structure or ray-query feature.',
  fsr2ClaimAllowedWithoutValidatedPort: false,
  sources: Object.freeze({
    webgpuFeatures: 'https://gpuweb.github.io/types/types/GPUFeatureName.html',
    threeWebgpuMigration: 'https://threejs.org/manual/en/webgpurenderer',
    threeWebgpuPostProcessing: 'https://threejs.org/manual/en/webgpu-postprocessing.html',
    bvhComputeData: 'https://github.com/gkjohnson/three-mesh-bvh/blob/master/WEBGPU_API.md',
    amdFsr2: 'https://gpuopen.com/fidelityfx-superresolution-2/',
    amdFsr2Source: 'https://github.com/GPUOpen-Effects/FidelityFX-FSR2'
  })
});

export const WEBGPU_COMPUTE_MINIMUMS = Object.freeze({
  maxStorageBufferBindingSize: 128 * 1024 * 1024,
  maxStorageBuffersPerShaderStage: 8,
  maxStorageTexturesPerShaderStage: 4,
  maxComputeInvocationsPerWorkgroup: 256
});

export const FSR2_REQUIRED_INPUTS = Object.freeze([
  'color',
  'depth',
  'velocity',
  'jitter',
  'previousTransforms',
  'historyReset',
  'frameTimeDelta',
  'cameraParameters'
]);

// Exposure and both masks can be omitted by the native API in some modes, but
// SPECTER requires them before shipping a WebGPU port because muzzle flashes,
// alpha foliage, particles, scopes, and ray-traced effects are all present.
export const FSR2_RELEASE_QUALITY_INPUTS = Object.freeze([
  'exposure',
  'reactiveMask',
  'transparencyAndCompositionMask'
]);

export const FSR2_REQUIRED_PASSES = Object.freeze([
  'luminance-pyramid',
  'reconstruct-and-dilate',
  'depth-clip',
  'create-locks',
  'reproject-and-accumulate',
  'rcas'
]);

export const FSR2_QUALITY_MODES = Object.freeze({
  'native-aa': Object.freeze({ label: 'Native AA', ratio: 1, jitterPhaseCount: 8, optional: false }),
  quality: Object.freeze({ label: 'Quality', ratio: 1.5, jitterPhaseCount: 18, optional: false }),
  balanced: Object.freeze({ label: 'Balanced', ratio: 1.7, jitterPhaseCount: 23, optional: false }),
  performance: Object.freeze({ label: 'Performance', ratio: 2, jitterPhaseCount: 32, optional: false }),
  'ultra-performance': Object.freeze({ label: 'Ultra Performance', ratio: 3, jitterPhaseCount: 72, optional: true })
});

const TEMPORAL_RESET_ORDER = Object.freeze([
  'explicit-reset',
  'device-change',
  'backend-change',
  'render-resolution-change',
  'presentation-resolution-change',
  'quality-mode-change',
  'camera-cut',
  'camera-teleport',
  'projection-change',
  'scene-topology-change'
]);

function positiveInteger(value, name) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) throw new RangeError(`${name} must be a positive number.`);
  return Math.max(1, Math.floor(result));
}

function revisionNumber(value) {
  const match = String(value ?? '').match(/(?:^|\D)(\d{2,4})(?:\D|$)/);
  return match ? Number(match[1]) : 0;
}

function missingTrue(record, names, prefix) {
  return names.filter(name => record?.[name] !== true).map(name => `${prefix}.${name}`);
}

function missingMinimums(limits = {}) {
  return Object.entries(WEBGPU_COMPUTE_MINIMUMS)
    .filter(([name, minimum]) => Number(limits[name] || 0) < minimum)
    .map(([name]) => `limits.${name}`);
}

/**
 * Evaluates evidence for a future renderer. Callers must provide affirmative
 * evidence; browser-brand or GPU-name heuristics never unlock a claim.
 */
export function evaluateAdvancedRendererCapabilities(probe = {}) {
  const secureWebgpu = probe.secureContext === true && probe.navigatorGpu === true && probe.adapterFound === true;
  const rendererMigrationReady = secureWebgpu
    && probe.backend === 'webgpu'
    && revisionNumber(probe.threeRevision) >= ADVANCED_RENDERER_CONTRACT.minimumThreeRevision
    && probe.tslPostProcessing === true;
  const computeLimitGaps = missingMinimums(probe.limits);
  const computeReady = rendererMigrationReady
    && probe.computeShaders === true
    && probe.storageBuffers === true
    && probe.storageTextures === true
    && computeLimitGaps.length === 0;
  const computeBvhGeometryRayTracing = computeReady && probe.bvhComputeData === true;

  const fsr2 = probe.fsr2 || {};
  const missingFsr2 = [
    ...missingTrue(fsr2.inputs, FSR2_REQUIRED_INPUTS, 'fsr2.inputs'),
    ...missingTrue(fsr2.inputs, FSR2_RELEASE_QUALITY_INPUTS, 'fsr2.inputs'),
    ...missingTrue(fsr2.formats, ['hdrColorStorage', 'floatDepth', 'rg16FloatVelocity'], 'fsr2.formats')
  ];
  for (const pass of FSR2_REQUIRED_PASSES) {
    if (!fsr2.wgslPasses?.includes(pass)) missingFsr2.push(`fsr2.wgslPasses.${pass}`);
  }
  if (!/^2\.\d+\.\d+$/.test(String(fsr2.sourceVersion || ''))) missingFsr2.push('fsr2.sourceVersion');
  if (fsr2.mitLicenseNoticeRetained !== true) missingFsr2.push('fsr2.mitLicenseNoticeRetained');
  if (fsr2.referenceValidated !== true) missingFsr2.push('fsr2.referenceValidated');
  if (fsr2.motionCoverageValidated !== true) missingFsr2.push('fsr2.motionCoverageValidated');
  if (fsr2.disocclusionValidated !== true) missingFsr2.push('fsr2.disocclusionValidated');
  if (fsr2.separateTaaDisabled !== true) missingFsr2.push('fsr2.separateTaaDisabled');

  const genuineFsr2Ready = computeReady && missingFsr2.length === 0;
  const webgpuMissing = [];
  if (probe.secureContext !== true) webgpuMissing.push('secureContext');
  if (probe.navigatorGpu !== true) webgpuMissing.push('navigatorGpu');
  if (probe.adapterFound !== true) webgpuMissing.push('adapterFound');
  if (probe.backend !== 'webgpu') webgpuMissing.push('backend.webgpu');
  if (revisionNumber(probe.threeRevision) < ADVANCED_RENDERER_CONTRACT.minimumThreeRevision) webgpuMissing.push('threeRevision.r185+');
  if (probe.tslPostProcessing !== true) webgpuMissing.push('tslPostProcessing');
  if (probe.computeShaders !== true) webgpuMissing.push('computeShaders');
  if (probe.storageBuffers !== true) webgpuMissing.push('storageBuffers');
  if (probe.storageTextures !== true) webgpuMissing.push('storageTextures');
  webgpuMissing.push(...computeLimitGaps);

  return Object.freeze({
    contractStage: ADVANCED_RENDERER_CONTRACT.stage,
    webgpuRasterReady: rendererMigrationReady,
    computeReady,
    computeBvhGeometryRayTracing,
    geometryRayTracingLabel: computeBvhGeometryRayTracing
      ? 'WebGPU compute BVH ray tracing'
      : 'Geometry ray tracing unavailable',
    hardwareRayTracing: Object.freeze({
      available: false,
      exposedByStandardWebgpu: false,
      label: 'Hardware ray tracing unavailable',
      reason: ADVANCED_RENDERER_CONTRACT.hardwareRayTracingReason
    }),
    fsr2: Object.freeze({
      ready: genuineFsr2Ready,
      label: genuineFsr2Ready ? 'AMD FSR 2' : 'Spatial scaling only — AMD FSR 2 unavailable',
      missing: Object.freeze(computeReady ? missingFsr2 : ['webgpu.compute', ...missingFsr2])
    }),
    missing: Object.freeze(webgpuMissing)
  });
}

/** Returns deterministic render dimensions and official FSR 2 mode metadata. */
export function resolveFsr2QualityMode(mode, displayWidth, displayHeight) {
  const profile = FSR2_QUALITY_MODES[mode];
  if (!profile) throw new RangeError(`Unsupported FSR 2 quality mode: ${mode}`);
  const width = positiveInteger(displayWidth, 'displayWidth');
  const height = positiveInteger(displayHeight, 'displayHeight');
  const renderWidth = Math.ceil(width / profile.ratio);
  const renderHeight = Math.ceil(height / profile.ratio);
  return Object.freeze({
    mode,
    label: profile.label,
    optional: profile.optional,
    ratio: profile.ratio,
    displayWidth: width,
    displayHeight: height,
    renderWidth,
    renderHeight,
    jitterPhaseCount: profile.jitterPhaseCount,
    mipLodBias: Math.log2(renderWidth / width) - 1
  });
}

function normalizePosition(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const position = value.slice(0, 3).map(Number);
  return position.every(Number.isFinite) ? Object.freeze(position) : null;
}

function positionDistance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function temporalSnapshot(frame = {}) {
  return Object.freeze({
    backendId: String(frame.backendId || ''),
    deviceEpoch: Number(frame.deviceEpoch || 0),
    renderWidth: positiveInteger(frame.renderWidth, 'renderWidth'),
    renderHeight: positiveInteger(frame.renderHeight, 'renderHeight'),
    displayWidth: positiveInteger(frame.displayWidth, 'displayWidth'),
    displayHeight: positiveInteger(frame.displayHeight, 'displayHeight'),
    qualityMode: String(frame.qualityMode || 'native'),
    cameraPosition: normalizePosition(frame.cameraPosition),
    projectionSignature: String(frame.projectionSignature || ''),
    sceneTopologyRevision: Number(frame.sceneTopologyRevision || 0)
  });
}

/**
 * Advances temporal history and returns ordered reset reasons. The caller owns
 * the actual textures; this function only makes reset policy testable.
 */
export function advanceTemporalHistory(previous, frame, { teleportThresholdMeters = 4 } = {}) {
  const snapshot = temporalSnapshot(frame);
  if (!previous?.snapshot) {
    return Object.freeze({ reset: true, reasons: Object.freeze(['first-frame']), historyFrameCount: 0, snapshot });
  }

  const prior = previous.snapshot;
  const requestedThreshold = Number(teleportThresholdMeters);
  const teleportThreshold = Number.isFinite(requestedThreshold) && requestedThreshold > 0 ? requestedThreshold : 4;
  const changed = new Set();
  if (frame.explicitReset === true) changed.add('explicit-reset');
  if (snapshot.deviceEpoch !== prior.deviceEpoch) changed.add('device-change');
  if (snapshot.backendId !== prior.backendId) changed.add('backend-change');
  if (snapshot.renderWidth !== prior.renderWidth || snapshot.renderHeight !== prior.renderHeight) changed.add('render-resolution-change');
  if (snapshot.displayWidth !== prior.displayWidth || snapshot.displayHeight !== prior.displayHeight) changed.add('presentation-resolution-change');
  if (snapshot.qualityMode !== prior.qualityMode) changed.add('quality-mode-change');
  if (frame.cameraCut === true) changed.add('camera-cut');
  if (positionDistance(snapshot.cameraPosition, prior.cameraPosition) >= teleportThreshold) changed.add('camera-teleport');
  if (snapshot.projectionSignature !== prior.projectionSignature) changed.add('projection-change');
  if (snapshot.sceneTopologyRevision !== prior.sceneTopologyRevision) changed.add('scene-topology-change');

  const reasons = TEMPORAL_RESET_ORDER.filter(reason => changed.has(reason));
  const reset = reasons.length > 0;
  return Object.freeze({
    reset,
    reasons: Object.freeze(reasons),
    historyFrameCount: reset ? 0 : Math.max(0, Number(previous.historyFrameCount || 0)) + 1,
    snapshot
  });
}
