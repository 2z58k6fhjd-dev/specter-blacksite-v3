import {
  DETERMINISTIC_SCENE_BVH_CASE,
  packDeterministicSceneBvh
} from './scene-bvh-pack.js';
import { tracePackedSceneBvhCpu } from './scene-bvh-cpu-oracle.js';
import { runDeterministicSceneBvhDispatch } from './scene-bvh-dispatch.js';
import { validateSceneBvhDispatchReceipt } from './scene-bvh-receipt.js';

export function validateSceneBvhPackEvidence(evidence) {
  const missing = [];
  if (!evidence || typeof evidence !== 'object') missing.push('sceneBvhPackEvidence');
  if (evidence?.schema !== DETERMINISTIC_SCENE_BVH_CASE.schema) missing.push('schema');
  if (evidence?.testId !== DETERMINISTIC_SCENE_BVH_CASE.testId) missing.push('testId');
  if (evidence?.packSource !== 'three-mesh-bvh@0.9.13 BVHComputeData.update') missing.push('packSource');
  if (evidence?.packSha256 !== DETERMINISTIC_SCENE_BVH_CASE.expectedPackSha256) missing.push('packSha256');
  const facts = evidence?.facts;
  if (facts?.nodeCount !== 8 || facts?.transformCount !== 3 || facts?.packedTriangleCount !== 12
    || facts?.packedVertexCount !== 36 || facts?.tlasLeafCount !== 3 || facts?.blasNodeCount !== 3) {
    missing.push('facts');
  }
  const oracle = evidence?.cpuOracle;
  if (oracle?.backend !== 'cpu-oracle' || oracle?.gpuEvidence !== false || oracle?.hit !== true
    || oracle?.triangleIndex !== 0 || oracle?.objectIndex !== 1 || oracle?.distance !== 2
    || JSON.stringify(oracle?.barycentric) !== JSON.stringify([0.5, 0.25, 0.25])) {
    missing.push('cpuOracle');
  }
  return Object.freeze({ valid: missing.length === 0, missing: Object.freeze(missing) });
}

/**
 * Packs the deterministic scene through BVHComputeData, verifies the CPU
 * oracle, and attempts a real WebGPU TLAS/BLAS traversal. CPU evidence can
 * prove packing, but only an exact GPUBuffer.mapAsync receipt proves dispatch.
 */
export async function probeSceneBvhFoundation({
  threeModule,
  meshBvhModule,
  navigatorObject = globalThis.navigator
} = {}) {
  const pack = await packDeterministicSceneBvh({ threeModule, meshBvhModule });
  const cpuOracle = tracePackedSceneBvhCpu(pack);
  const packEvidence = Object.freeze({
    schema: pack.schema,
    testId: pack.testId,
    packSource: 'three-mesh-bvh@0.9.13 BVHComputeData.update',
    packSha256: pack.packSha256,
    facts: pack.facts,
    cpuOracle
  });
  const packValidation = validateSceneBvhPackEvidence(packEvidence);
  if (!packValidation.valid) throw new Error(`Scene BVH pack evidence failed: ${packValidation.missing.join(', ')}`);

  const gpu = navigatorObject?.gpu;
  if (!gpu?.requestAdapter) {
    return Object.freeze({ packEvidence, dispatchReceipt: null, dispatchError: 'navigator.gpu unavailable' });
  }
  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) {
    return Object.freeze({ packEvidence, dispatchReceipt: null, dispatchError: 'No WebGPU adapter returned' });
  }

  let device;
  try {
    device = await adapter.requestDevice();
    const dispatchReceipt = await runDeterministicSceneBvhDispatch(device, pack);
    const dispatchValidation = validateSceneBvhDispatchReceipt(dispatchReceipt);
    if (!dispatchValidation.valid) {
      throw new Error(`Scene BVH dispatch receipt failed: ${dispatchValidation.missing.join(', ')}`);
    }
    return Object.freeze({ packEvidence, dispatchReceipt, dispatchError: null });
  } catch (error) {
    return Object.freeze({ packEvidence, dispatchReceipt: null, dispatchError: String(error?.message || error) });
  } finally {
    device?.destroy?.();
  }
}
