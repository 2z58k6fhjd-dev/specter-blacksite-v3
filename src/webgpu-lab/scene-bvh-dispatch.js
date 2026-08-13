import {
  DETERMINISTIC_SCENE_BVH_CASE,
  computePackedSceneBvhSha256,
  inspectPackedSceneBvh
} from './scene-bvh-pack.js';
import { SCENE_BVH_DISPATCH_CASE } from './scene-bvh-receipt.js';

// Raw WGSL mirror of the pinned three-mesh-bvh 0.9.13 packed node protocol.
// This is a deterministic proof kernel, not a raster renderer, denoiser, game
// scene integration, hardware RT API, or AMD FSR 2 implementation.
export const SCENE_BVH_TRAVERSAL_WGSL = /* wgsl */`
struct BvhNode {
  minX: f32,
  minY: f32,
  minZ: f32,
  maxX: f32,
  maxY: f32,
  maxZ: f32,
  rightChildOrTriangleOffset: u32,
  splitAxisOrTriangleCount: u32,
}

struct TransformData {
  matrixWorld: mat4x4f,
  inverseMatrixWorld: mat4x4f,
  visible: u32,
  alignment0: u32,
  alignment1: u32,
  alignment2: u32,
}

struct VertexData {
  position: vec4f,
}

struct RayInput {
  origin: vec4f,
  direction: vec4f,
}

struct Ray {
  origin: vec3f,
  direction: vec3f,
}

struct TraversalResult {
  hit: u32,
  triangleIndex: u32,
  objectIndex: u32,
  visitedNodes: u32,
  distance: f32,
  barycentricX: f32,
  barycentricY: f32,
  barycentricZ: f32,
}

@group(0) @binding(0) var<storage, read> bvhNodes: array<BvhNode>;
@group(0) @binding(1) var<storage, read> transforms: array<TransformData>;
@group(0) @binding(2) var<storage, read> triangleIndices: array<u32>;
@group(0) @binding(3) var<storage, read> vertices: array<VertexData>;
@group(0) @binding(4) var<storage, read> inputRay: RayInput;
@group(0) @binding(5) var<storage, read_write> result: TraversalResult;

fn boundsDistance(ray: Ray, node: BvhNode) -> f32 {
  let minimum = vec3f(node.minX, node.minY, node.minZ);
  let maximum = vec3f(node.maxX, node.maxY, node.maxZ);
  let inverseDirection = 1.0 / ray.direction;
  let minimumPlane = (minimum - ray.origin) * inverseDirection;
  let maximumPlane = (maximum - ray.origin) * inverseDirection;
  let nearPlane = min(minimumPlane, maximumPlane);
  let farPlane = max(minimumPlane, maximumPlane);
  let nearDistance = max(max(nearPlane.x, nearPlane.y), max(nearPlane.z, 0.0));
  let farDistance = min(min(farPlane.x, farPlane.y), farPlane.z);
  if (farDistance < nearDistance) { return -1.0; }
  return nearDistance;
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id != vec3u(0u))) { return; }

  result.hit = 0u;
  result.triangleIndex = 0xffffffffu;
  result.objectIndex = 0xffffffffu;
  result.visitedNodes = 0u;
  result.distance = -1.0;
  result.barycentricX = 0.0;
  result.barycentricY = 0.0;
  result.barycentricZ = 0.0;

  var bestDistance = 3.402823466e+38;
  var bestBarycentric = vec3f(0.0);
  var worldRay: Ray;
  worldRay.origin = inputRay.origin.xyz;
  worldRay.direction = normalize(inputRay.direction.xyz);
  var localRay = worldRay;
  var rayScalar = 1.0;

  var isTlas = true;
  var stackPointer: i32 = 0;
  var stack: array<u32, 64>;
  stack[0] = 0u;
  var tlasReset: i32 = 0;
  var activeObject = 0u;

  loop {
    if (!isTlas && tlasReset == stackPointer) {
      isTlas = true;
      activeObject = 0u;
      localRay = worldRay;
      rayScalar = 1.0;
    }
    if (stackPointer < 0 || stackPointer >= 64) { break; }

    let nodeIndex = stack[stackPointer];
    stackPointer -= 1;
    let node = bvhNodes[nodeIndex];
    result.visitedNodes += 1u;
    let nodeDistance = boundsDistance(localRay, node);
    if (nodeDistance < 0.0 || (result.hit != 0u && nodeDistance * rayScalar >= bestDistance)) {
      continue;
    }

    let infoX = node.splitAxisOrTriangleCount;
    let infoY = node.rightChildOrTriangleOffset;
    let isLeaf = (infoX & 0xffff0000u) != 0u;
    if (isLeaf) {
      if (isTlas) {
        activeObject = infoX & 0x00ffffffu;
        let transform = transforms[activeObject];
        if (transform.visible != 0u) {
          let localDirectionUnnormalized = (transform.inverseMatrixWorld * vec4f(worldRay.direction, 0.0)).xyz;
          let localDirectionLength = length(localDirectionUnnormalized);
          if (localDirectionLength > 0.0) {
            localRay.origin = (transform.inverseMatrixWorld * vec4f(worldRay.origin, 1.0)).xyz;
            localRay.direction = localDirectionUnnormalized / localDirectionLength;
            rayScalar = 1.0 / localDirectionLength;
            tlasReset = stackPointer;
            isTlas = false;
            stackPointer += 1;
            stack[stackPointer] = infoY;
          }
        }
      } else {
        let triangleCount = infoX & 0x0000ffffu;
        for (var triangle = infoY; triangle < infoY + triangleCount; triangle += 1u) {
          let i0 = triangleIndices[triangle * 3u];
          let i1 = triangleIndices[triangle * 3u + 1u];
          let i2 = triangleIndices[triangle * 3u + 2u];
          let a = vertices[i0].position.xyz;
          let b = vertices[i1].position.xyz;
          let c = vertices[i2].position.xyz;
          let edge1 = b - a;
          let edge2 = c - a;
          let normal = cross(edge1, edge2);
          let determinant = -dot(localRay.direction, normal);
          if (abs(determinant) < 1e-15) { continue; }
          let inverseDeterminant = 1.0 / determinant;
          let fromA = localRay.origin - a;
          let directionCross = cross(fromA, localRay.direction);
          let barycentricY = dot(edge2, directionCross) * inverseDeterminant;
          if (barycentricY < 0.0 || barycentricY > 1.0) { continue; }
          let barycentricZ = -dot(edge1, directionCross) * inverseDeterminant;
          if (barycentricZ < 0.0 || barycentricY + barycentricZ > 1.0) { continue; }
          let localDistance = dot(fromA, normal) * inverseDeterminant;
          if (localDistance < 0.0) { continue; }
          let worldDistance = localDistance * rayScalar;
          if (result.hit == 0u || worldDistance < bestDistance) {
            result.hit = 1u;
            result.triangleIndex = triangle;
            result.objectIndex = activeObject;
            bestDistance = worldDistance;
            bestBarycentric = vec3f(1.0 - barycentricY - barycentricZ, barycentricY, barycentricZ);
          }
        }
      }
    } else {
      let leftIndex = nodeIndex + 1u;
      let rightIndex = nodeIndex + infoY;
      let splitAxis = infoX & 0x0000ffffu;
      var first = rightIndex;
      var second = leftIndex;
      if (localRay.direction[splitAxis] >= 0.0) {
        first = leftIndex;
        second = rightIndex;
      }
      stackPointer += 1;
      stack[stackPointer] = second;
      stackPointer += 1;
      stack[stackPointer] = first;
    }
  }

  if (result.hit != 0u) {
    result.distance = bestDistance;
    result.barycentricX = bestBarycentric.x;
    result.barycentricY = bestBarycentric.y;
    result.barycentricZ = bestBarycentric.z;
  }
}
`;

const RAY_INPUT_F32 = new Float32Array([
  ...DETERMINISTIC_SCENE_BVH_CASE.ray.origin, 1,
  ...DETERMINISTIC_SCENE_BVH_CASE.ray.direction, 0
]);

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value, cryptoObject) {
  if (!cryptoObject?.subtle?.digest) throw new Error('Web Crypto SHA-256 is required for BVH dispatch evidence.');
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return bytesToHex(new Uint8Array(await cryptoObject.subtle.digest('SHA-256', bytes)));
}

function requireWebgpuConstants(bufferUsage, mapMode) {
  const requiredUsage = ['STORAGE', 'COPY_SRC', 'COPY_DST', 'MAP_READ'];
  const missing = requiredUsage.filter(name => !Number.isFinite(Number(bufferUsage?.[name])));
  if (!Number.isFinite(Number(mapMode?.READ))) missing.push('MAP_MODE_READ');
  if (missing.length) throw new Error(`WebGPU constants unavailable: ${missing.join(',')}`);
}

async function collectCompilationErrors(shaderModule) {
  if (typeof shaderModule.getCompilationInfo !== 'function') return [];
  const info = await shaderModule.getCompilationInfo();
  return info.messages
    .filter(message => message.type === 'error')
    .map(message => `${message.lineNum || 0}:${message.linePos || 0} ${message.message}`);
}

function createDeviceLossObserver(device) {
  const lostPromise = device?.lost;
  if (!lostPromise || typeof lostPromise.then !== 'function') {
    throw new Error('GPUDevice.lost observation is required for BVH dispatch evidence.');
  }

  let lossInfo = null;
  lostPromise.then(info => { lossInfo = info || { reason: 'unknown' }; });
  return Object.freeze({
    async requireNotLost() {
      // Flush promise reactions before creating the receipt. A loss observed at
      // any point through this checkpoint invalidates the proof.
      await Promise.resolve();
      if (lossInfo) {
        const reason = String(lossInfo.reason || 'unknown');
        const message = String(lossInfo.message || 'GPU device was lost.');
        throw new Error(`WebGPU device lost during deterministic BVH dispatch (${reason}): ${message}`);
      }
      return false;
    }
  });
}

function createStorageBuffer(device, label, words, bufferUsage) {
  const buffer = device.createBuffer({
    label,
    size: words.byteLength,
    usage: bufferUsage.STORAGE | bufferUsage.COPY_DST
  });
  device.queue.writeBuffer(buffer, 0, words);
  return buffer;
}

/**
 * Dispatch a real TLAS/BLAS traversal over buffers created by the pinned
 * BVHComputeData packer. The caller owns the GPUDevice. A receipt is emitted
 * only after exact mapped readback, a recomputed pack hash, a compiled kernel,
 * completed queue work, and clean WebGPU error scopes.
 */
export async function runDeterministicSceneBvhDispatch(device, pack, {
  cryptoObject = globalThis.crypto,
  bufferUsage = globalThis.GPUBufferUsage,
  mapMode = globalThis.GPUMapMode
} = {}) {
  if (!device?.queue?.submit || !device.createComputePipelineAsync) {
    throw new TypeError('A WebGPU GPUDevice with async compute-pipeline support is required.');
  }
  if (!device.pushErrorScope || !device.popErrorScope) throw new Error('WebGPU error scopes are required for BVH dispatch evidence.');
  const deviceLossObserver = createDeviceLossObserver(device);
  requireWebgpuConstants(bufferUsage, mapMode);
  inspectPackedSceneBvh(pack);
  const packHash = await computePackedSceneBvhSha256(pack, { cryptoObject });
  if (packHash !== SCENE_BVH_DISPATCH_CASE.packSha256 || pack.packSha256 !== packHash) {
    throw new Error(`Deterministic scene BVH pack hash mismatch: ${packHash}`);
  }

  const kernelHash = await sha256(SCENE_BVH_TRAVERSAL_WGSL, cryptoObject);
  const outputSize = SCENE_BVH_DISPATCH_CASE.expectedReadbackByteLength;
  const scopeKinds = ['validation', 'out-of-memory', 'internal'];
  const errorScopeErrors = [];
  const buffers = [];
  let readbackBuffer;
  let mapped = false;
  let poppedScopes = 0;
  for (const kind of scopeKinds) device.pushErrorScope(kind);

  try {
    const nodeBuffer = createStorageBuffer(device, 'specter-scene-bvh-nodes', pack.nodesU32, bufferUsage);
    const transformBuffer = createStorageBuffer(device, 'specter-scene-bvh-transforms', pack.transformsU32, bufferUsage);
    const indexBuffer = createStorageBuffer(device, 'specter-scene-bvh-indices', pack.indicesU32, bufferUsage);
    const attributeBuffer = createStorageBuffer(device, 'specter-scene-bvh-attributes', pack.attributesU32, bufferUsage);
    const rayBuffer = createStorageBuffer(device, 'specter-scene-bvh-ray', RAY_INPUT_F32, bufferUsage);
    const outputBuffer = device.createBuffer({
      label: 'specter-scene-bvh-output',
      size: outputSize,
      usage: bufferUsage.STORAGE | bufferUsage.COPY_SRC
    });
    readbackBuffer = device.createBuffer({
      label: 'specter-scene-bvh-readback',
      size: outputSize,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ
    });
    buffers.push(nodeBuffer, transformBuffer, indexBuffer, attributeBuffer, rayBuffer, outputBuffer, readbackBuffer);
    device.queue.writeBuffer(outputBuffer, 0, new Uint8Array(outputSize));

    const shaderModule = device.createShaderModule({
      label: 'specter-scene-bvh-stack-traversal',
      code: SCENE_BVH_TRAVERSAL_WGSL
    });
    const compilationErrors = await collectCompilationErrors(shaderModule);
    if (compilationErrors.length) throw new Error(`BVH WGSL compilation failed: ${compilationErrors.join('; ')}`);
    const pipeline = await device.createComputePipelineAsync({
      label: 'specter-scene-bvh-pipeline',
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'main' }
    });
    const bindGroup = device.createBindGroup({
      label: 'specter-scene-bvh-bind-group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: nodeBuffer } },
        { binding: 1, resource: { buffer: transformBuffer } },
        { binding: 2, resource: { buffer: indexBuffer } },
        { binding: 3, resource: { buffer: attributeBuffer } },
        { binding: 4, resource: { buffer: rayBuffer } },
        { binding: 5, resource: { buffer: outputBuffer } }
      ]
    });

    const encoder = device.createCommandEncoder({ label: 'specter-scene-bvh-encoder' });
    const computePass = encoder.beginComputePass({ label: 'specter-scene-bvh-pass' });
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(...SCENE_BVH_DISPATCH_CASE.dispatchWorkgroups);
    computePass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, outputSize);
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    await readbackBuffer.mapAsync(mapMode.READ, 0, outputSize);
    mapped = true;
    const readbackBytes = new Uint8Array(new Uint8Array(readbackBuffer.getMappedRange(0, outputSize)));
    const readbackHex = bytesToHex(readbackBytes);
    if (readbackHex !== SCENE_BVH_DISPATCH_CASE.expectedReadbackHex) {
      throw new Error(`Deterministic scene BVH GPU readback mismatch: ${readbackHex}`);
    }

    for (let index = scopeKinds.length - 1; index >= 0; index--) {
      const error = await device.popErrorScope();
      poppedScopes++;
      if (error) errorScopeErrors.push(`${scopeKinds[index]}: ${String(error.message || error)}`);
    }
    if (errorScopeErrors.length) throw new Error(`WebGPU error scope failure: ${errorScopeErrors.join('; ')}`);
    const deviceLost = await deviceLossObserver.requireNotLost();

    return Object.freeze({
      schema: SCENE_BVH_DISPATCH_CASE.schema,
      testId: SCENE_BVH_DISPATCH_CASE.testId,
      backend: 'webgpu-compute-bvh',
      algorithm: 'TLAS/BLAS stack traversal + Moller-Trumbore',
      packSource: 'three-mesh-bvh@0.9.13 BVHComputeData.update',
      readbackSource: 'GPUBuffer.mapAsync',
      packSha256: packHash,
      kernelSha256: kernelHash,
      dispatchWorkgroups: SCENE_BVH_DISPATCH_CASE.dispatchWorkgroups,
      readbackByteLength: readbackBytes.byteLength,
      readbackHex,
      errorScopeErrors: Object.freeze([]),
      deviceLost
    });
  } catch (error) {
    for (let index = scopeKinds.length - 1 - poppedScopes; index >= 0; index--) {
      try { await device.popErrorScope(); } catch { /* device already lost or scope already popped */ }
    }
    throw error;
  } finally {
    if (mapped) readbackBuffer?.unmap();
    for (const buffer of buffers) buffer?.destroy();
  }
}
