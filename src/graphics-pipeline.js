import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Post-processing budgets tuned for a desktop browser FPS. The "high" preset
 * is the recommended starting point for a 6 GB GPU at 1080p.
 */
export const GRAPHICS_QUALITY_PRESETS = Object.freeze({
  performance: Object.freeze({
    label: 'Performance',
    recommendedVRAMMB: 4096,
    pixelRatioCap: 1,
    ambientOcclusion: false,
    aoKernelRadius: 4,
    aoMinDistance: 0.003,
    aoMaxDistance: 0.07,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1
  }),
  balanced: Object.freeze({
    label: 'Balanced',
    recommendedVRAMMB: 6144,
    pixelRatioCap: 1.1,
    ambientOcclusion: true,
    aoKernelRadius: 5,
    aoMinDistance: 0.0025,
    aoMaxDistance: 0.08,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1
  }),
  high: Object.freeze({
    label: 'High (6 GB)',
    recommendedVRAMMB: 6144,
    pixelRatioCap: 1.25,
    ambientOcclusion: true,
    aoKernelRadius: 6,
    aoMinDistance: 0.0025,
    aoMaxDistance: 0.1,
    bloom: true,
    bloomStrength: 0.07,
    bloomRadius: 0.08,
    bloomThreshold: 0.94
  }),
  ultra: Object.freeze({
    label: 'Ultra',
    recommendedVRAMMB: 8192,
    pixelRatioCap: 1.5,
    ambientOcclusion: true,
    aoKernelRadius: 8,
    aoMinDistance: 0.002,
    aoMaxDistance: 0.12,
    bloom: true,
    bloomStrength: 0.1,
    bloomRadius: 0.12,
    bloomThreshold: 0.91
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
  let requestedPixelRatio = positiveRatio(pixelRatio, renderer.getPixelRatio?.() || 1);
  let composer = null;
  let renderPass = null;
  let ssaoPass = null;
  let bloomPass = null;
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

  try {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    if (ambientOcclusion) {
      try {
        const { SSAOPass } = await import('three/addons/postprocessing/SSAOPass.js');
        const samples = THREE.MathUtils.clamp(Math.round(aoKernelSize), 8, 32);
        ssaoPass = new SSAOPass(scene, camera, currentWidth, currentHeight, samples);
        if (SSAOPass.OUTPUT?.Default !== undefined) ssaoPass.output = SSAOPass.OUTPUT.Default;
        composer.addPass(ssaoPass);
      } catch (error) {
        warnOnce('ssao-unavailable', 'Ambient occlusion could not be initialized; continuing without it.', error);
      }
    }

    if (bloom) {
      try {
        const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
        bloomPass = new UnrealBloomPass(new THREE.Vector2(currentWidth, currentHeight), 0.07, 0.08, 0.94);
        composer.addPass(bloomPass);
      } catch (error) {
        warnOnce('bloom-unavailable', 'Bloom could not be initialized; continuing without it.', error);
      }
    }

    // OutputPass is required when tone mapping a post-processed render target.
    outputPass = new OutputPass();
    composer.addPass(outputPass);
  } catch (error) {
    runtimeFallback = true;
    fallbackReason = error;
    warnOnce('composer-unavailable', 'Post-processing could not be initialized; using renderer.render().', error);
    try { composer?.dispose(); } catch { /* Best-effort cleanup. */ }
    composer = null;
  }

  function resize(nextWidth = currentWidth, nextHeight = currentHeight, nextPixelRatio = requestedPixelRatio) {
    if (disposed) return getDiagnostics();
    currentWidth = positiveDimension(nextWidth, currentWidth);
    currentHeight = positiveDimension(nextHeight, currentHeight);
    requestedPixelRatio = positiveRatio(nextPixelRatio, requestedPixelRatio);
    const preset = GRAPHICS_QUALITY_PRESETS[currentQuality];
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

  function applyQuality(nextQuality = currentQuality) {
    currentQuality = qualityName(nextQuality);
    const preset = GRAPHICS_QUALITY_PRESETS[currentQuality];

    if (ssaoPass) {
      ssaoPass.enabled = ambientOcclusion && preset.ambientOcclusion;
      ssaoPass.kernelRadius = preset.aoKernelRadius;
      ssaoPass.minDistance = preset.aoMinDistance;
      ssaoPass.maxDistance = preset.aoMaxDistance;
    }
    if (bloomPass) {
      bloomPass.enabled = bloom && preset.bloom;
      bloomPass.strength = preset.bloomStrength;
      bloomPass.radius = preset.bloomRadius;
      bloomPass.threshold = preset.bloomThreshold;
    }
    resize(currentWidth, currentHeight, requestedPixelRatio);
    return getDiagnostics();
  }

  function render(deltaTime) {
    if (!disposed && enabled && composer && !runtimeFallback) {
      const autoClearBeforeRender = renderer.autoClear;
      const clearAlphaBeforeRender = renderer.getClearAlpha();
      const overrideMaterialBeforeRender = scene.overrideMaterial;
      renderer.getClearColor(clearColorBeforeRender);
      try {
        composer.render(deltaTime);
        return 'composer';
      } catch (error) {
        runtimeFallback = true;
        fallbackReason = error;
        renderer.autoClear = autoClearBeforeRender;
        renderer.setClearColor(clearColorBeforeRender, clearAlphaBeforeRender);
        renderer.setRenderTarget(null);
        scene.overrideMaterial = overrideMaterialBeforeRender;
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

  function getDiagnostics() {
    const preset = GRAPHICS_QUALITY_PRESETS[currentQuality];
    return {
      mode: !disposed && enabled && composer && !runtimeFallback ? 'composer' : 'renderer',
      enabled,
      disposed,
      quality: currentQuality,
      preset,
      width: currentWidth,
      height: currentHeight,
      requestedPixelRatio,
      effectivePixelRatio,
      composerAvailable: Boolean(composer),
      ambientOcclusionAvailable: Boolean(ssaoPass),
      ambientOcclusionEnabled: Boolean(ssaoPass?.enabled),
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
    for (const pass of [ssaoPass, bloomPass, outputPass, renderPass]) {
      try { pass?.dispose?.(); } catch (error) { warnOnce('pass-dispose-failed', 'A post-processing pass did not dispose cleanly.', error); }
    }
    try { composer?.dispose(); } catch (error) { warnOnce('composer-dispose-failed', 'The post-processing buffers did not dispose cleanly.', error); }
    composer = null;
    renderPass = null;
    ssaoPass = null;
    bloomPass = null;
    outputPass = null;
  }

  applyQuality(currentQuality);

  return Object.freeze({
    render,
    resize,
    setQuality: applyQuality,
    setEnabled,
    getDiagnostics,
    dispose,
    get composer() { return composer; },
    get passes() {
      return Object.freeze({ render: renderPass, ambientOcclusion: ssaoPass, bloom: bloomPass, output: outputPass });
    }
  });
}

export default createGraphicsPipeline;
