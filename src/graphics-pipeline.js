import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Post-processing budgets tuned for a browser FPS. The Intel tier is a direct
 * renderer path for older integrated GPUs; Extreme expects a modern 10 GB GPU.
 */
export const GRAPHICS_QUALITY_PRESETS = Object.freeze({
  intel: Object.freeze({
    // A deliberately clean, competition-style profile: prioritize motion
    // clarity and stable input over surface detail or cinematic effects.
    label: 'Competitive Low',
    recommendedVRAMMB: 512,
    pixelRatioCap: 0.65,
    postProcessing: false,
    shadows: false,
    shadowMapSize: 0,
    textureAnisotropy: 1,
    textureTier: 'low',
    ambientOcclusion: false,
    screenSpaceReflections: false,
    ssrMaxDistance: 0,
    ssrThickness: 0.06,
    ssrOpacity: 0,
    aoKernelRadius: 0,
    aoMinDistance: 0.003,
    aoMaxDistance: 0.07,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    grassEnabled: false,
    forestDensity: 'low',
    fogEnabled: true
  }),
  performance: Object.freeze({
    label: 'Performance',
    recommendedVRAMMB: 4096,
    pixelRatioCap: 1,
    postProcessing: true,
    shadows: true,
    shadowMapSize: 1024,
    textureAnisotropy: 2,
    textureTier: 'standard',
    ambientOcclusion: false,
    screenSpaceReflections: false,
    ssrMaxDistance: 0,
    ssrThickness: 0.06,
    ssrOpacity: 0,
    aoKernelRadius: 4,
    aoMinDistance: 0.003,
    aoMaxDistance: 0.07,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    grassEnabled: false,
    forestDensity: 'low',
    fogEnabled: true
  }),
  balanced: Object.freeze({
    label: 'Balanced',
    recommendedVRAMMB: 6144,
    pixelRatioCap: 1.1,
    postProcessing: true,
    shadows: true,
    shadowMapSize: 1536,
    textureAnisotropy: 4,
    textureTier: 'standard',
    ambientOcclusion: true,
    screenSpaceReflections: false,
    ssrMaxDistance: 0,
    ssrThickness: 0.06,
    ssrOpacity: 0,
    aoKernelRadius: 5,
    aoMinDistance: 0.0025,
    aoMaxDistance: 0.08,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    grassEnabled: true,
    forestDensity: 'medium',
    fogEnabled: true
  }),
  high: Object.freeze({
    label: 'High (6 GB)',
    recommendedVRAMMB: 6144,
    pixelRatioCap: 1.25,
    postProcessing: true,
    shadows: true,
    shadowMapSize: 2048,
    textureAnisotropy: 8,
    textureTier: 'high',
    ambientOcclusion: true,
    screenSpaceReflections: false,
    ssrMaxDistance: 0,
    ssrThickness: 0.06,
    ssrOpacity: 0,
    aoKernelRadius: 6,
    aoMinDistance: 0.0025,
    aoMaxDistance: 0.1,
    bloom: true,
    bloomStrength: 0.07,
    bloomRadius: 0.08,
    bloomThreshold: 0.94,
    grassEnabled: true,
    forestDensity: 'high',
    fogEnabled: true
  }),
  ultra: Object.freeze({
    label: 'Ultra',
    recommendedVRAMMB: 8192,
    pixelRatioCap: 1.5,
    postProcessing: true,
    shadows: true,
    shadowMapSize: 3072,
    textureAnisotropy: 12,
    textureTier: 'high',
    ambientOcclusion: true,
    screenSpaceReflections: true,
    ssrMaxDistance: 72,
    ssrThickness: 0.055,
    ssrOpacity: 0.17,
    aoKernelRadius: 8,
    aoMinDistance: 0.002,
    aoMaxDistance: 0.12,
    bloom: true,
    bloomStrength: 0.1,
    bloomRadius: 0.12,
    bloomThreshold: 0.91,
    grassEnabled: true,
    forestDensity: 'ultra',
    fogEnabled: true
  }),
  extreme: Object.freeze({
    label: 'Extreme (10 GB)',
    recommendedVRAMMB: 10240,
    pixelRatioCap: 2,
    postProcessing: true,
    shadows: true,
    shadowMapSize: 4096,
    textureAnisotropy: 16,
    // The loader prefers a native 4K environment pack when one is bundled.
    // Current shipped environment maps are intentionally reported as 2K.
    textureTier: '4k-preferred',
    ambientOcclusion: true,
    screenSpaceReflections: true,
    ssrMaxDistance: 112,
    ssrThickness: 0.035,
    ssrOpacity: 0.23,
    aoKernelRadius: 12,
    aoMinDistance: 0.0015,
    aoMaxDistance: 0.16,
    bloom: true,
    bloomStrength: 0.13,
    bloomRadius: 0.16,
    bloomThreshold: 0.88,
    grassEnabled: true,
    forestDensity: 'extreme',
    fogEnabled: true
  })
});

const DEFAULT_QUALITY = 'high';
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

function positiveDimension(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.floor(numeric)) : fallback;
}

function positiveRatio(value, fallback = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function qualityName(value) {
  return Object.hasOwn(GRAPHICS_QUALITY_PRESETS, value) ? value : DEFAULT_QUALITY;
}

const CUSTOM_BOOLEAN_FIELDS = new Set(['postProcessing', 'shadows', 'ambientOcclusion', 'screenSpaceReflections', 'bloom', 'grassEnabled', 'fogEnabled']);
const CUSTOM_NUMBER_FIELDS = Object.freeze({
  pixelRatioCap: [0.45, 2], shadowMapSize: [0, 4096], textureAnisotropy: [1, 16],
  aoKernelRadius: [0, 16], aoMinDistance: [0.001, 0.02], aoMaxDistance: [0.03, 0.3],
  ssrMaxDistance: [0, 140], ssrThickness: [0.01, 0.12], ssrOpacity: [0, 0.35],
  bloomStrength: [0, 0.25], bloomRadius: [0, 0.35], bloomThreshold: [0.7, 1]
});
const CUSTOM_TEXTURE_TIERS = new Set(['low', 'standard', 'high', '4k-preferred']);
const CUSTOM_FOREST_DENSITIES = new Set(['off', 'low', 'medium', 'high', 'ultra', 'extreme']);

function sanitizeCustomSettings(value) {
  if (!value || typeof value !== 'object') return null;
  const result = {};
  for (const field of CUSTOM_BOOLEAN_FIELDS) if (typeof value[field] === 'boolean') result[field] = value[field];
  for (const [field, range] of Object.entries(CUSTOM_NUMBER_FIELDS)) {
    const numeric = Number(value[field]);
    if (Number.isFinite(numeric)) result[field] = THREE.MathUtils.clamp(numeric, range[0], range[1]);
  }
  if (CUSTOM_TEXTURE_TIERS.has(value.textureTier)) result.textureTier = value.textureTier;
  if (CUSTOM_FOREST_DENSITIES.has(value.forestDensity)) result.forestDensity = value.forestDensity;
  return Object.keys(result).length ? Object.freeze(result) : null;
}

function viewportSize(renderer, width, height) {
  const canvas = renderer.domElement;
  return {
    width: positiveDimension(width, positiveDimension(canvas?.clientWidth, positiveDimension(canvas?.width, DEFAULT_WIDTH))),
    height: positiveDimension(height, positiveDimension(canvas?.clientHeight, positiveDimension(canvas?.height, DEFAULT_HEIGHT)))
  };
}

/**
 * Creates a resilient post-processing wrapper around an existing Three.js
 * renderer, scene, and camera.
 *
 * @returns {Promise<object>} A graphics pipeline with render, resize,
 * setQuality, setEnabled, getDiagnostics, and dispose methods.
 */
export async function createGraphicsPipeline({
  renderer,
  scene,
  camera,
  quality = DEFAULT_QUALITY,
  width,
  height,
  pixelRatio = globalThis.devicePixelRatio || 1,
  ambientOcclusion = true,
  bloom = true,
  aoKernelSize = 16,
  configureRenderer = true,
  updateCameraOnResize = true,
  updateCanvasStyle = false,
  toneMapping = THREE.ACESFilmicToneMapping,
  toneMappingExposure = renderer?.toneMappingExposure ?? 1.05,
  outputColorSpace = THREE.SRGBColorSpace,
  onWarning = (message, error) => console.warn(message, error || '')
} = {}) {
  if (!renderer?.isWebGLRenderer) throw new TypeError('createGraphicsPipeline requires a THREE.WebGLRenderer.');
  if (!scene?.isScene) throw new TypeError('createGraphicsPipeline requires a THREE.Scene.');
  if (!camera?.isCamera) throw new TypeError('createGraphicsPipeline requires a THREE.Camera.');

  let currentQuality = qualityName(quality);
  let customSettings = null;
  let requestedPixelRatio = positiveRatio(pixelRatio, renderer.getPixelRatio?.() || 1);
  let composer = null;
  let renderPass = null;
  let ssaoPass = null;
  let ssrPass = null;
  let bloomPass = null;
  let ssaoInitialization = null;
  let ssrInitialization = null;
  let bloomInitialization = null;
  let ssaoUnavailable = false;
  let ssrUnavailable = false;
  let bloomUnavailable = false;
  let outputPass = null;
  let enabled = true;
  let runtimeFallback = false;
  let disposed = false;
  let fallbackReason = null;
  const warnings = [];
  const warned = new Set();
  const initialSize = viewportSize(renderer, width, height);
  let currentWidth = initialSize.width;
  let currentHeight = initialSize.height;
  let effectivePixelRatio = renderer.getPixelRatio?.() || 1;
  const clearColorBeforeRender = new THREE.Color();

  function activePreset() {
    const base = GRAPHICS_QUALITY_PRESETS[currentQuality];
    return customSettings ? Object.freeze({ ...base, ...customSettings, label: `${base.label} Custom` }) : base;
  }

  function warnOnce(code, message, error) {
    if (warned.has(code)) return;
    warned.add(code);
    const detail = error instanceof Error ? error.message : error ? String(error) : '';
    warnings.push({ code, message, detail });
    try { onWarning(`[graphics-pipeline] ${message}`, error); } catch { /* Warning hooks must never break rendering. */ }
  }

  if (configureRenderer) {
    renderer.outputColorSpace = outputColorSpace;
    renderer.toneMapping = toneMapping;
    renderer.toneMappingExposure = toneMappingExposure;
  }

  function insertionIndex(beforePass = outputPass) {
    if (!composer) return 0;
    const index = composer.passes.indexOf(beforePass);
    return index >= 0 ? index : composer.passes.length;
  }

  function releaseComposerResources() {
    for (const pass of [ssaoPass, ssrPass, bloomPass, outputPass, renderPass]) {
      try { pass?.dispose?.(); } catch (error) { warnOnce('pass-dispose-failed', 'A post-processing pass did not dispose cleanly.', error); }
    }
    try { composer?.dispose?.(); } catch (error) { warnOnce('composer-dispose-failed', 'The post-processing buffers did not dispose cleanly.', error); }
    composer = null;
    renderPass = null;
    ssaoPass = null;
    ssrPass = null;
    bloomPass = null;
    outputPass = null;
  }

  function ensureComposer() {
    if (disposed || runtimeFallback || composer) return composer;
    try {
      composer = new EffectComposer(renderer);
      renderPass = new RenderPass(scene, camera);
      outputPass = new OutputPass();
      composer.addPass(renderPass);
      composer.addPass(outputPass);
    } catch (error) {
      runtimeFallback = true;
      fallbackReason = error;
      warnOnce('composer-unavailable', 'Post-processing could not be initialized; using renderer.render().', error);
      releaseComposerResources();
    }
    return composer;
  }

  async function ensureSSAOPass() {
    if (!composer || ssaoPass || ssaoInitialization || ssaoUnavailable || !ambientOcclusion || disposed) return ssaoInitialization;
    ssaoInitialization = (async () => {
      try {
        const { SSAOPass } = await import('three/addons/postprocessing/SSAOPass.js');
        if (disposed || !composer || ssaoPass) return;
        const samples = THREE.MathUtils.clamp(Math.round(aoKernelSize), 8, 32);
        ssaoPass = new SSAOPass(scene, camera, currentWidth, currentHeight, samples);
        if (SSAOPass.OUTPUT?.Default !== undefined) ssaoPass.output = SSAOPass.OUTPUT.Default;
        composer.insertPass(ssaoPass, insertionIndex(ssrPass || bloomPass || outputPass));
      } catch (error) {
        ssaoUnavailable = true;
        warnOnce('ssao-unavailable', 'Ambient occlusion could not be initialized; continuing without it.', error);
      } finally {
        ssaoInitialization = null;
      }
    })();
    return ssaoInitialization;
  }

  async function ensureSSRPass() {
    if (!composer || ssrPass || ssrInitialization || ssrUnavailable || disposed) return ssrInitialization;
    ssrInitialization = (async () => {
      try {
        const { SSRPass } = await import('three/addons/postprocessing/SSRPass.js');
        if (disposed || !composer || ssrPass) return;
        ssrPass = new SSRPass({ renderer, scene, camera, width: currentWidth, height: currentHeight });
        ssrPass.blur = true;
        ssrPass.bouncing = false;
        // Reflections must be calculated before bloom and the output transform.
        composer.insertPass(ssrPass, insertionIndex(bloomPass || outputPass));
      } catch (error) {
        ssrUnavailable = true;
        warnOnce('ssr-unavailable', 'Screen-space reflections could not be initialized; continuing without them.', error);
      } finally {
        ssrInitialization = null;
      }
    })();
    return ssrInitialization;
  }

  async function ensureBloomPass() {
    if (!composer || bloomPass || bloomInitialization || bloomUnavailable || !bloom || disposed) return bloomInitialization;
    bloomInitialization = (async () => {
      try {
        const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
        if (disposed || !composer || bloomPass) return;
        bloomPass = new UnrealBloomPass(new THREE.Vector2(currentWidth, currentHeight), 0.07, 0.08, 0.94);
        composer.insertPass(bloomPass, insertionIndex(outputPass));
      } catch (error) {
        bloomUnavailable = true;
        warnOnce('bloom-unavailable', 'Bloom could not be initialized; continuing without it.', error);
      } finally {
        bloomInitialization = null;
      }
    })();
    return bloomInitialization;
  }

  const initialPreset = activePreset();
  if (initialPreset.postProcessing !== false && ensureComposer()) {
    if (initialPreset.ambientOcclusion) await ensureSSAOPass();
    if (initialPreset.screenSpaceReflections) await ensureSSRPass();
    if (initialPreset.bloom) await ensureBloomPass();
  }

  function resize(nextWidth = currentWidth, nextHeight = currentHeight, nextPixelRatio = requestedPixelRatio) {
    if (disposed) return getDiagnostics();
    currentWidth = positiveDimension(nextWidth, currentWidth);
    currentHeight = positiveDimension(nextHeight, currentHeight);
    requestedPixelRatio = positiveRatio(nextPixelRatio, requestedPixelRatio);
    const preset = activePreset();
    effectivePixelRatio = Math.min(requestedPixelRatio, preset.pixelRatioCap);

    if (updateCameraOnResize && camera.isPerspectiveCamera) {
      camera.aspect = currentWidth / currentHeight;
      camera.updateProjectionMatrix();
    }

    renderer.setPixelRatio(effectivePixelRatio);
    renderer.setSize(currentWidth, currentHeight, updateCanvasStyle);
    if (composer) {
      composer.setPixelRatio(effectivePixelRatio);
      composer.setSize(currentWidth, currentHeight);
    }
    return getDiagnostics();
  }

  function applyQuality(nextQuality = currentQuality, { preserveCustom = false } = {}) {
    currentQuality = qualityName(nextQuality);
    if (!preserveCustom) customSettings = null;
    const preset = activePreset();

    // Add expensive passes only when a user elects a tier that needs them.
    // This keeps an Intel-HD boot free of SSAO, bloom, and SSR allocations.
    if (preset.postProcessing !== false && ensureComposer()) {
      if (ambientOcclusion && preset.ambientOcclusion && !ssaoPass && !ssaoUnavailable) Promise.resolve(ensureSSAOPass()).then(() => applyQuality(currentQuality, { preserveCustom: true }));
      if (bloom && preset.bloom && !bloomPass && !bloomUnavailable) Promise.resolve(ensureBloomPass()).then(() => applyQuality(currentQuality, { preserveCustom: true }));
      if (preset.screenSpaceReflections && !ssrPass && !ssrUnavailable) Promise.resolve(ensureSSRPass()).then(() => applyQuality(currentQuality, { preserveCustom: true }));
    } else if (preset.postProcessing === false && composer) {
      // Competitive Low must really relinquish composer/pass render targets on
      // a live down-switch, rather than merely disable their visual output.
      releaseComposerResources();
    }

    if (ssaoPass) {
      ssaoPass.enabled = preset.postProcessing !== false && ambientOcclusion && preset.ambientOcclusion;
      ssaoPass.kernelRadius = preset.aoKernelRadius;
      ssaoPass.minDistance = preset.aoMinDistance;
      ssaoPass.maxDistance = preset.aoMaxDistance;
    }
    if (bloomPass) {
      bloomPass.enabled = preset.postProcessing !== false && bloom && preset.bloom;
      bloomPass.strength = preset.bloomStrength;
      bloomPass.radius = preset.bloomRadius;
      bloomPass.threshold = preset.bloomThreshold;
    }
    if (ssrPass) {
      ssrPass.enabled = preset.postProcessing !== false && Boolean(preset.screenSpaceReflections);
      ssrPass.maxDistance = preset.ssrMaxDistance;
      ssrPass.thickness = preset.ssrThickness;
      ssrPass.opacity = preset.ssrOpacity;
    }
    resize(currentWidth, currentHeight, requestedPixelRatio);
    return getDiagnostics();
  }

  function consumeComposerGlError() {
    const gl = renderer.getContext?.();
    if (!gl?.getError) return 0;
    const first = gl.getError();
    // Drain the small error queue so the direct fallback starts from a clean
    // state. Some embedded/mobile WebGL implementations only report an
    // unsupported post-process shader through VALIDATE_STATUS/INVALID_OPERATION.
    for (let remaining = 12; remaining > 0 && gl.getError() !== gl.NO_ERROR; remaining--) { /* drain */ }
    return first;
  }

  function render(deltaTime) {
    const preset = activePreset();
    if (!disposed && enabled && preset.postProcessing !== false && composer && !runtimeFallback) {
      const autoClearBeforeRender = renderer.autoClear;
      const clearAlphaBeforeRender = renderer.getClearAlpha();
      const overrideMaterialBeforeRender = scene.overrideMaterial;
      renderer.getClearColor(clearColorBeforeRender);
      try {
        composer.render(deltaTime);
        const glError = consumeComposerGlError();
        if (glError && glError !== renderer.getContext().NO_ERROR) {
          throw new Error(`WebGL post-processing validation failed (0x${glError.toString(16)}).`);
        }
        return 'composer';
      } catch (error) {
        runtimeFallback = true;
        fallbackReason = error;
        renderer.autoClear = autoClearBeforeRender;
        renderer.setClearColor(clearColorBeforeRender, clearAlphaBeforeRender);
        renderer.setRenderTarget(null);
        scene.overrideMaterial = overrideMaterialBeforeRender;
        releaseComposerResources();
        warnOnce('composer-render-failed', 'Post-processing failed during a frame; all later frames use renderer.render().', error);
      }
    }
    // A failed pass can leave an internal render target bound. Always direct
    // fallback frames explicitly to the visible canvas.
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    return 'renderer';
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    return getDiagnostics();
  }

  function setCustomSettings(nextSettings) {
    customSettings = sanitizeCustomSettings(nextSettings);
    return applyQuality(currentQuality, { preserveCustom: true });
  }

  function clearCustomSettings() {
    customSettings = null;
    return applyQuality(currentQuality, { preserveCustom: true });
  }

  function getDiagnostics() {
    const preset = activePreset();
    return {
      mode: !disposed && enabled && preset.postProcessing !== false && composer && !runtimeFallback ? 'composer' : 'renderer',
      enabled,
      disposed,
      quality: currentQuality,
      preset,
      customSettings: customSettings ? { ...customSettings } : null,
      width: currentWidth,
      height: currentHeight,
      requestedPixelRatio,
      effectivePixelRatio,
      composerAvailable: Boolean(composer),
      postProcessingEnabled: preset.postProcessing !== false,
      ambientOcclusionAvailable: Boolean(ssaoPass),
      ambientOcclusionEnabled: Boolean(ssaoPass?.enabled),
      screenSpaceReflectionsAvailable: Boolean(ssrPass),
      screenSpaceReflectionsEnabled: Boolean(ssrPass?.enabled),
      bloomAvailable: Boolean(bloomPass),
      bloomEnabled: Boolean(bloomPass?.enabled),
      fallback: runtimeFallback || !composer,
      fallbackReason: fallbackReason instanceof Error ? fallbackReason.message : fallbackReason ? String(fallbackReason) : null,
      warnings: warnings.map(entry => ({ ...entry }))
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    releaseComposerResources();
  }

  applyQuality(currentQuality);

  return Object.freeze({
    render,
    resize,
    setQuality: applyQuality,
    setCustomSettings,
    clearCustomSettings,
    setEnabled,
    getDiagnostics,
    dispose,
    get composer() { return composer; },
    get passes() {
      return Object.freeze({ render: renderPass, ambientOcclusion: ssaoPass, reflections: ssrPass, bloom: bloomPass, output: outputPass });
    }
  });
}

export default createGraphicsPipeline;
