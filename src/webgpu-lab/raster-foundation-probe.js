import { createTemporalInputFoundation } from './temporal-input-foundation.js';
import { RASTER_FOUNDATION_RECEIPT, validateRasterFoundationReceipt } from './raster-foundation-receipt.js';

function attachmentNames(resources) {
  return [
    resources.color.name,
    resources.depth.name,
    resources.velocity.name,
    resources.reactiveMask.name,
    resources.transparencyAndCompositionMask.name
  ];
}

/**
 * Initializes an actual Three r185 WebGPU renderer and submits one small MRT
 * frame. WebGL fallback is explicitly rejected. This remains an isolated lab
 * proof and does not render SPECTER's game scene.
 */
export async function probeWebgpuRasterFoundation({
  THREE,
  importTsl = () => import('three/tsl'),
  canvasFactory = () => document.createElement('canvas')
} = {}) {
  if (!THREE?.WebGPURenderer || String(THREE.REVISION) !== '185') {
    throw new TypeError('Vendored Three r185 WebGPU module is required.');
  }
  const TSL = await importTsl();
  const canvas = canvasFactory();
  canvas.width = RASTER_FOUNDATION_RECEIPT.width;
  canvas.height = RASTER_FOUNDATION_RECEIPT.height;

  let renderer;
  let pipeline;
  let foundation;
  let geometry;
  let material;
  let deviceLost = false;
  const errorScopeErrors = [];
  const scopeKinds = ['validation', 'out-of-memory', 'internal'];
  let pushedScopes = 0;
  let poppedScopes = 0;
  try {
    renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: false,
      alpha: false,
      forceWebGL: false
    });
    renderer.setPixelRatio(1);
    renderer.setSize(RASTER_FOUNDATION_RECEIPT.width, RASTER_FOUNDATION_RECEIPT.height, false);
    await renderer.init();
    if (renderer.backend?.isWebGPUBackend !== true) {
      throw new Error('Three selected a WebGL fallback; the WebGPU raster receipt is refused.');
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 20);
    camera.position.set(0, 0, 3);
    camera.updateMatrixWorld();
    geometry = new THREE.BoxGeometry(1, 1, 1);
    material = new THREE.MeshStandardMaterial({ color: 0x8196a3, roughness: 0.7, metalness: 0.15 });
    scene.add(new THREE.Mesh(geometry, material));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2));

    foundation = createTemporalInputFoundation({
      THREE, TSL, scene, camera,
      renderWidth: RASTER_FOUNDATION_RECEIPT.width,
      renderHeight: RASTER_FOUNDATION_RECEIPT.height,
      presentationWidth: RASTER_FOUNDATION_RECEIPT.width,
      presentationHeight: RASTER_FOUNDATION_RECEIPT.height
    });
    pipeline = new THREE.RenderPipeline(renderer, foundation.resources.nodes.color);
    const device = renderer.backend.device;
    if (!device?.pushErrorScope || !device?.popErrorScope) {
      throw new Error('WebGPU error scopes are required for the raster receipt.');
    }
    for (const kind of scopeKinds) {
      device.pushErrorScope(kind);
      pushedScopes++;
    }
    const frame = foundation.beginFrame({
      frameIndex: 0,
      jitterPhaseCount: 8,
      backendId: 'three-r185-webgpu',
      deviceEpoch: 1,
      qualityMode: 'native-aa',
      cameraPosition: camera.position.toArray(),
      projectionSignature: 'perspective:60:1:0.1:20',
      sceneTopologyRevision: 1
    });
    try {
      pipeline.render();
      await device.queue.onSubmittedWorkDone();
    } finally {
      frame.cameraJitter.restore();
    }
    const historyReadIndex = foundation.endFrame({ accepted: true });

    for (let index = scopeKinds.length - 1; index >= 0; index--) {
      const error = await device.popErrorScope();
      poppedScopes++;
      if (error) errorScopeErrors.push(`${scopeKinds[index]}: ${String(error.message || error)}`);
    }
    if (errorScopeErrors.length) throw new Error(`WebGPU raster error scope failure: ${errorScopeErrors.join('; ')}`);

    const drawingBuffer = new THREE.Vector2();
    renderer.getDrawingBufferSize(drawingBuffer);
    const lostPromise = device.lost;
    if (lostPromise && typeof Promise.race === 'function') {
      const result = await Promise.race([
        lostPromise.then(() => 'lost'),
        new Promise(resolve => setTimeout(() => resolve('active'), 0))
      ]);
      deviceLost = result === 'lost';
    }

    const receipt = Object.freeze({
      schema: RASTER_FOUNDATION_RECEIPT.schema,
      testId: RASTER_FOUNDATION_RECEIPT.testId,
      backend: 'webgpu',
      rendererRevision: Number(THREE.REVISION),
      drawingBufferWidth: drawingBuffer.x,
      drawingBufferHeight: drawingBuffer.y,
      attachmentNames: Object.freeze(attachmentNames(foundation.resources)),
      frameSubmitted: true,
      queueCompleted: true,
      historyReadIndex,
      errorScopeErrors: Object.freeze(errorScopeErrors),
      deviceLost
    });
    const validation = validateRasterFoundationReceipt(receipt);
    if (!validation.valid) throw new Error(`Raster receipt validation failed: ${validation.missing.join(', ')}`);
    return receipt;
  } finally {
    const device = renderer?.backend?.device;
    for (let index = pushedScopes - poppedScopes - 1; index >= 0; index--) {
      try { await device?.popErrorScope?.(); } catch { /* device already lost or scope already drained */ }
    }
    pipeline?.dispose?.();
    foundation?.dispose?.();
    geometry?.dispose?.();
    material?.dispose?.();
    renderer?.dispose?.();
  }
}
