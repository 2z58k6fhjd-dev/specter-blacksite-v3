import { KNOWN_TRIANGLE_DISPATCH_CASE } from './dispatch-receipt.js';

// This is deliberately a known-input proof, not a game renderer. It proves
// that a WebGPU compute queue compiled and executed a real ray/triangle
// intersection, copied the storage result, and returned exact mapped bytes.
export const KNOWN_TRIANGLE_WGSL = /* wgsl */`
struct RayTriangleInput {
  v0: vec4f,
  v1: vec4f,
  v2: vec4f,
  origin: vec4f,
  direction: vec4f,
}

struct RayTriangleResult {
  hit: u32,
  triangle: u32,
  distance: f32,
  barycentricX: f32,
  barycentricY: f32,
  barycentricZ: f32,
}

@group(0) @binding(0) var<storage, read> testCase: RayTriangleInput;
@group(0) @binding(1) var<storage, read_write> result: RayTriangleResult;

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id != vec3u(0u))) { return; }

  result.hit = 0u;
  result.triangle = 0xffffffffu;
  result.distance = -1.0;
  result.barycentricX = 0.0;
  result.barycentricY = 0.0;
  result.barycentricZ = 0.0;

  let edge1 = testCase.v1.xyz - testCase.v0.xyz;
  let edge2 = testCase.v2.xyz - testCase.v0.xyz;
  let p = cross(testCase.direction.xyz, edge2);
  let determinant = dot(edge1, p);
  if (abs(determinant) < 0.000001) { return; }

  let inverseDeterminant = 1.0 / determinant;
  let fromV0 = testCase.origin.xyz - testCase.v0.xyz;
  let barycentricY = dot(fromV0, p) * inverseDeterminant;
  if (barycentricY < 0.0 || barycentricY > 1.0) { return; }

  let q = cross(fromV0, edge1);
  let barycentricZ = dot(testCase.direction.xyz, q) * inverseDeterminant;
  if (barycentricZ < 0.0 || barycentricY + barycentricZ > 1.0) { return; }

  let distance = dot(edge2, q) * inverseDeterminant;
  if (distance <= 0.000001) { return; }

  result.hit = 1u;
  result.triangle = 0u;
  result.distance = distance;
  result.barycentricX = 1.0 - barycentricY - barycentricZ;
  result.barycentricY = barycentricY;
  result.barycentricZ = barycentricZ;
}
`;

const INPUT_BYTES = new Float32Array([
  // v0, v1, v2
  0, 0, 0, 0,
  1, 0, 0, 0,
  0, 1, 0, 0,
  // ray origin and direction
  0.25, 0.25, 1, 1,
  0, 0, -1, 0
]);

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value, cryptoObject) {
  if (!cryptoObject?.subtle?.digest) throw new Error('Web Crypto SHA-256 is required for dispatch receipts.');
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return bytesToHex(new Uint8Array(await cryptoObject.subtle.digest('SHA-256', bytes)));
}

function requireWebgpuConstants(bufferUsage, mapMode) {
  const requiredUsage = ['STORAGE', 'COPY_SRC', 'COPY_DST', 'MAP_READ'];
  const missing = requiredUsage.filter(name => !Number.isFinite(Number(bufferUsage?.[name])));
  if (missing.length || !Number.isFinite(Number(mapMode?.READ))) {
    throw new Error(`WebGPU constants unavailable: ${[...missing, ...(Number.isFinite(Number(mapMode?.READ)) ? [] : ['MAP_MODE_READ'])].join(', ')}`);
  }
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
    throw new Error('GPUDevice.lost observation is required for validated dispatch.');
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
        throw new Error(`WebGPU device lost during known-triangle dispatch (${reason}): ${message}`);
      }
      return false;
    }
  });
}

/**
 * Runs a real WebGPU compute dispatch over one known triangle and ray.
 * The caller owns the GPUDevice lifetime. A receipt is returned only after
 * exact readback, shader/input hashes, clean error scopes, and queue completion.
 */
export async function runKnownTriangleDispatch(device, {
  cryptoObject = globalThis.crypto,
  bufferUsage = globalThis.GPUBufferUsage,
  mapMode = globalThis.GPUMapMode
} = {}) {
  if (!device?.queue?.submit || !device.createComputePipelineAsync) {
    throw new TypeError('A WebGPU GPUDevice with async compute-pipeline support is required.');
  }
  requireWebgpuConstants(bufferUsage, mapMode);
  if (!device.pushErrorScope || !device.popErrorScope) throw new Error('WebGPU error scopes are required for validated dispatch.');
  const deviceLossObserver = createDeviceLossObserver(device);

  const inputHash = await sha256(KNOWN_TRIANGLE_DISPATCH_CASE.canonicalInput, cryptoObject);
  if (inputHash !== KNOWN_TRIANGLE_DISPATCH_CASE.inputSha256) {
    throw new Error(`Known-triangle input hash mismatch: ${inputHash}`);
  }
  const kernelHash = await sha256(KNOWN_TRIANGLE_WGSL, cryptoObject);
  const outputSize = KNOWN_TRIANGLE_DISPATCH_CASE.expectedReadbackByteLength;
  let inputBuffer;
  let outputBuffer;
  let readbackBuffer;
  let mapped = false;
  const scopeKinds = ['validation', 'out-of-memory', 'internal'];
  const errorScopeErrors = [];
  let poppedScopes = 0;

  for (const kind of scopeKinds) device.pushErrorScope(kind);
  try {
    inputBuffer = device.createBuffer({
      label: 'specter-known-triangle-input',
      size: INPUT_BYTES.byteLength,
      usage: bufferUsage.STORAGE | bufferUsage.COPY_DST
    });
    outputBuffer = device.createBuffer({
      label: 'specter-known-triangle-output',
      size: outputSize,
      usage: bufferUsage.STORAGE | bufferUsage.COPY_SRC
    });
    readbackBuffer = device.createBuffer({
      label: 'specter-known-triangle-readback',
      size: outputSize,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ
    });
    device.queue.writeBuffer(inputBuffer, 0, INPUT_BYTES);
    device.queue.writeBuffer(outputBuffer, 0, new Uint8Array(outputSize));

    const shaderModule = device.createShaderModule({
      label: 'specter-known-triangle-moller-trumbore',
      code: KNOWN_TRIANGLE_WGSL
    });
    const compilationErrors = await collectCompilationErrors(shaderModule);
    if (compilationErrors.length) throw new Error(`WGSL compilation failed: ${compilationErrors.join('; ')}`);
    const pipeline = await device.createComputePipelineAsync({
      label: 'specter-known-triangle-pipeline',
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'main' }
    });
    const bindGroup = device.createBindGroup({
      label: 'specter-known-triangle-bind-group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder({ label: 'specter-known-triangle-encoder' });
    const compute = encoder.beginComputePass({ label: 'specter-known-triangle-pass' });
    compute.setPipeline(pipeline);
    compute.setBindGroup(0, bindGroup);
    compute.dispatchWorkgroups(...KNOWN_TRIANGLE_DISPATCH_CASE.dispatchWorkgroups);
    compute.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, outputSize);
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    await readbackBuffer.mapAsync(mapMode.READ, 0, outputSize);
    mapped = true;
    const mappedBytes = new Uint8Array(readbackBuffer.getMappedRange(0, outputSize));
    const readbackBytes = new Uint8Array(mappedBytes);
    const readbackHex = bytesToHex(readbackBytes);
    if (readbackHex !== KNOWN_TRIANGLE_DISPATCH_CASE.expectedReadbackHex) {
      throw new Error(`Known-triangle GPU readback mismatch: ${readbackHex}`);
    }

    // Pop scopes only after readback so asynchronous validation failures are
    // part of the evidence. Scopes unwind in reverse order.
    for (let index = scopeKinds.length - 1; index >= 0; index--) {
      const error = await device.popErrorScope();
      poppedScopes++;
      if (error) errorScopeErrors.push(`${scopeKinds[index]}: ${String(error.message || error)}`);
    }
    if (errorScopeErrors.length) throw new Error(`WebGPU error scope failure: ${errorScopeErrors.join('; ')}`);
    const deviceLost = await deviceLossObserver.requireNotLost();

    return Object.freeze({
      schema: KNOWN_TRIANGLE_DISPATCH_CASE.schema,
      testId: KNOWN_TRIANGLE_DISPATCH_CASE.testId,
      backend: 'webgpu-compute',
      algorithm: 'Moller-Trumbore ray-triangle intersection',
      readbackSource: 'GPUBuffer.mapAsync',
      inputSha256: inputHash,
      kernelSha256: kernelHash,
      dispatchWorkgroups: KNOWN_TRIANGLE_DISPATCH_CASE.dispatchWorkgroups,
      readbackByteLength: readbackBytes.byteLength,
      readbackHex,
      errorScopeErrors: Object.freeze([]),
      deviceLost
    });
  } catch (error) {
    // Drain any scopes not already popped before propagating the fail-closed
    // result. Ignore secondary pop failures; the original error is stronger.
    for (let index = scopeKinds.length - 1 - poppedScopes; index >= 0; index--) {
      try { await device.popErrorScope(); } catch { /* already lost or popped */ }
    }
    throw error;
  } finally {
    if (mapped) readbackBuffer?.unmap();
    inputBuffer?.destroy();
    outputBuffer?.destroy();
    readbackBuffer?.destroy();
  }
}
