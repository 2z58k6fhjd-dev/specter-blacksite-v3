import { advanceTemporalHistory } from '../experimental/webgpu-advanced-contract.js';

export const TEMPORAL_INPUT_FOUNDATION = Object.freeze({
  id: 'specter-webgpu-temporal-inputs-v1',
  runtimeIntegrated: false,
  amdFsr2Implemented: false,
  resources: Object.freeze({
    color: Object.freeze({ resolution: 'render', format: 'rgba16float', jittered: true }),
    depth: Object.freeze({ resolution: 'render', format: 'depth32float', jittered: true }),
    velocity: Object.freeze({ resolution: 'render', format: 'rg16float', jittered: false }),
    reactiveMask: Object.freeze({ resolution: 'render', format: 'r8unorm', jittered: true }),
    transparencyAndCompositionMask: Object.freeze({ resolution: 'render', format: 'r8unorm', jittered: true }),
    exposure: Object.freeze({ resolution: '1x1', format: 'r32float', jittered: false }),
    history: Object.freeze({ resolution: 'presentation', format: 'rgba16float', buffers: 2 })
  })
});

function positiveInteger(value, label) {
  const result = Math.floor(Number(value));
  if (!Number.isFinite(result) || result < 1) throw new RangeError(`${label} must be a positive integer.`);
  return result;
}

function requireApi(source, names, label) {
  const missing = names.filter(name => source?.[name] === undefined);
  if (missing.length) throw new TypeError(`${label} is missing: ${missing.join(', ')}.`);
}

export function halton(index, base) {
  index = Math.max(0, Math.floor(Number(index) || 0));
  base = Math.floor(Number(base));
  if (base < 2) throw new RangeError('Halton base must be at least 2.');
  let fraction = 1;
  let result = 0;
  while (index > 0) {
    fraction /= base;
    result += fraction * (index % base);
    index = Math.floor(index / base);
  }
  return result;
}

export function resolveTemporalJitter(frameIndex, phaseCount, renderWidth, renderHeight) {
  const width = positiveInteger(renderWidth, 'renderWidth');
  const height = positiveInteger(renderHeight, 'renderHeight');
  const phases = positiveInteger(phaseCount, 'phaseCount');
  const phase = ((Math.floor(Number(frameIndex) || 0) % phases) + phases) % phases;
  const sampleIndex = phase + 1;
  const pixelX = halton(sampleIndex, 2) - 0.5;
  const pixelY = halton(sampleIndex, 3) - 0.5;
  return Object.freeze({
    phase,
    phaseCount: phases,
    pixelX,
    pixelY,
    ndcX: (2 * pixelX) / width,
    ndcY: (-2 * pixelY) / height
  });
}

export function beginCameraJitter(camera, jitter) {
  if (!camera?.projectionMatrix?.clone || !camera?.projectionMatrixInverse?.copy) {
    throw new TypeError('A Three.js camera with projection matrices is required.');
  }
  const originalProjection = camera.projectionMatrix.clone();
  const originalInverse = camera.projectionMatrixInverse.clone();
  camera.projectionMatrix.elements[8] += Number(jitter?.ndcX || 0);
  camera.projectionMatrix.elements[9] += Number(jitter?.ndcY || 0);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  let restored = false;
  return Object.freeze({
    restore() {
      if (restored) return false;
      camera.projectionMatrix.copy(originalProjection);
      camera.projectionMatrixInverse.copy(originalInverse);
      restored = true;
      return true;
    }
  });
}

function configureTexture(texture, { name, type, format, colorSpace }) {
  texture.name = name;
  texture.type = type;
  texture.format = format;
  if (colorSpace !== undefined) texture.colorSpace = colorSpace;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Allocates the real Three r185 MRT/resource graph required before a faithful
 * FSR 2 port can exist. It deliberately does not perform upscaling or use the
 * FSR 2 name: no AMD shader stage has been ported in this module.
 */
export function createTemporalInputFoundation({
  THREE,
  TSL,
  scene,
  camera,
  renderWidth,
  renderHeight,
  presentationWidth,
  presentationHeight
}) {
  requireApi(THREE, [
    'DataTexture', 'RenderTarget', 'FloatType', 'HalfFloatType',
    'UnsignedByteType', 'RGBAFormat', 'RGFormat', 'RedFormat',
    'DepthFormat', 'LinearSRGBColorSpace', 'NoColorSpace'
  ], 'Three WebGPU module');
  requireApi(TSL, ['pass', 'mrt', 'output', 'velocity', 'float'], 'Three TSL module');
  if (!scene?.isScene || !camera?.isCamera) throw new TypeError('A Three.js scene and camera are required.');

  let dimensions = Object.freeze({
    renderWidth: positiveInteger(renderWidth, 'renderWidth'),
    renderHeight: positiveInteger(renderHeight, 'renderHeight'),
    presentationWidth: positiveInteger(presentationWidth, 'presentationWidth'),
    presentationHeight: positiveInteger(presentationHeight, 'presentationHeight')
  });

  const scenePass = TSL.pass(scene, camera);
  scenePass.setMRT(TSL.mrt({
    output: TSL.output,
    velocity: TSL.velocity,
    reactive: TSL.float(0),
    composition: TSL.float(0)
  }));

  const color = configureTexture(scenePass.getTexture('output'), {
    name: 'specter-temporal-hdr-color', type: THREE.HalfFloatType,
    format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace
  });
  const depth = configureTexture(scenePass.getTexture('depth'), {
    name: 'specter-temporal-depth', type: THREE.FloatType,
    format: THREE.DepthFormat, colorSpace: THREE.NoColorSpace
  });
  const velocity = configureTexture(scenePass.getTexture('velocity'), {
    name: 'specter-temporal-velocity', type: THREE.HalfFloatType,
    format: THREE.RGFormat, colorSpace: THREE.NoColorSpace
  });
  const reactiveMask = configureTexture(scenePass.getTexture('reactive'), {
    name: 'specter-temporal-reactive-mask', type: THREE.UnsignedByteType,
    format: THREE.RedFormat, colorSpace: THREE.NoColorSpace
  });
  const transparencyAndCompositionMask = configureTexture(scenePass.getTexture('composition'), {
    name: 'specter-temporal-composition-mask', type: THREE.UnsignedByteType,
    format: THREE.RedFormat, colorSpace: THREE.NoColorSpace
  });

  const exposure = configureTexture(new THREE.DataTexture(
    new Float32Array([1]), 1, 1, THREE.RedFormat, THREE.FloatType
  ), {
    name: 'specter-temporal-exposure', type: THREE.FloatType,
    format: THREE.RedFormat, colorSpace: THREE.NoColorSpace
  });
  exposure.needsUpdate = true;

  const createHistoryTarget = index => {
    const target = new THREE.RenderTarget(dimensions.presentationWidth, dimensions.presentationHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: false,
      stencilBuffer: false
    });
    configureTexture(target.texture, {
      name: `specter-temporal-history-${index}`, type: THREE.HalfFloatType,
      format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace
    });
    return target;
  };
  const historyTargets = [createHistoryTarget(0), createHistoryTarget(1)];
  let historyReadIndex = 0;
  let temporalState = null;
  let disposed = false;

  scenePass.setSize(dimensions.renderWidth, dimensions.renderHeight);

  const resources = Object.freeze({
    color, depth, velocity, reactiveMask, transparencyAndCompositionMask,
    exposure, historyTargets: Object.freeze(historyTargets),
    nodes: Object.freeze({
      color: scenePass.getTextureNode('output'),
      depth: scenePass.getTextureNode('depth'),
      velocity: scenePass.getTextureNode('velocity'),
      reactiveMask: scenePass.getTextureNode('reactive'),
      transparencyAndCompositionMask: scenePass.getTextureNode('composition')
    })
  });

  return Object.freeze({
    contract: TEMPORAL_INPUT_FOUNDATION,
    scenePass,
    resources,
    get dimensions() { return dimensions; },
    get history() {
      return Object.freeze({
        read: historyTargets[historyReadIndex],
        write: historyTargets[1 - historyReadIndex],
        readIndex: historyReadIndex,
        state: temporalState
      });
    },
    resize(next) {
      if (disposed) throw new Error('Temporal input foundation is disposed.');
      const resolved = Object.freeze({
        renderWidth: positiveInteger(next.renderWidth, 'renderWidth'),
        renderHeight: positiveInteger(next.renderHeight, 'renderHeight'),
        presentationWidth: positiveInteger(next.presentationWidth, 'presentationWidth'),
        presentationHeight: positiveInteger(next.presentationHeight, 'presentationHeight')
      });
      const changed = Object.keys(resolved).some(key => resolved[key] !== dimensions[key]);
      dimensions = resolved;
      scenePass.setSize(resolved.renderWidth, resolved.renderHeight);
      historyTargets.forEach(target => target.setSize(resolved.presentationWidth, resolved.presentationHeight));
      if (changed) temporalState = null;
      return changed;
    },
    beginFrame(frame) {
      if (disposed) throw new Error('Temporal input foundation is disposed.');
      temporalState = advanceTemporalHistory(temporalState, {
        ...frame,
        renderWidth: dimensions.renderWidth,
        renderHeight: dimensions.renderHeight,
        displayWidth: dimensions.presentationWidth,
        displayHeight: dimensions.presentationHeight
      });
      const jitter = resolveTemporalJitter(
        frame.frameIndex,
        frame.jitterPhaseCount,
        dimensions.renderWidth,
        dimensions.renderHeight
      );
      return Object.freeze({ temporalState, jitter, cameraJitter: beginCameraJitter(camera, jitter) });
    },
    endFrame({ accepted = true } = {}) {
      if (disposed) throw new Error('Temporal input foundation is disposed.');
      if (accepted) historyReadIndex = 1 - historyReadIndex;
      return historyReadIndex;
    },
    resetHistory() {
      temporalState = null;
      historyReadIndex = 0;
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      scenePass.dispose?.();
      historyTargets.forEach(target => target.dispose());
      exposure.dispose();
      return true;
    }
  });
}
