import { DETERMINISTIC_SCENE_BVH_CASE } from './scene-bvh-pack.js';

export const SCENE_BVH_DISPATCH_CASE = Object.freeze({
  schema: 'specter.webgpu.scene-bvh-dispatch-receipt/v1',
  testId: DETERMINISTIC_SCENE_BVH_CASE.testId,
  packSha256: DETERMINISTIC_SCENE_BVH_CASE.expectedPackSha256,
  dispatchWorkgroups: Object.freeze([1, 1, 1]),
  // Little-endian: hit, triangle, object, visited nodes, distance, barycentric xyz.
  expectedReadbackHex: '01000000000000000100000008000000000000400000003f0000803e0000803e',
  expectedReadbackByteLength: 32
});

function exactNumberArray(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((item, index) => Number(item) === expected[index]);
}
export function validateSceneBvhDispatchReceipt(receipt) {
  const missing = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return Object.freeze({ valid: false, missing: Object.freeze(['sceneBvhDispatchReceipt']) });
  }
  if (receipt.schema !== SCENE_BVH_DISPATCH_CASE.schema) missing.push('sceneBvhDispatchReceipt.schema');
  if (receipt.testId !== SCENE_BVH_DISPATCH_CASE.testId) missing.push('sceneBvhDispatchReceipt.testId');
  if (receipt.backend !== 'webgpu-compute-bvh') missing.push('sceneBvhDispatchReceipt.backend');
  if (receipt.algorithm !== 'TLAS/BLAS stack traversal + Moller-Trumbore') missing.push('sceneBvhDispatchReceipt.algorithm');
  if (receipt.packSource !== 'three-mesh-bvh@0.9.13 BVHComputeData.update') missing.push('sceneBvhDispatchReceipt.packSource');
  if (receipt.readbackSource !== 'GPUBuffer.mapAsync') missing.push('sceneBvhDispatchReceipt.readbackSource');
  if (receipt.packSha256 !== SCENE_BVH_DISPATCH_CASE.packSha256) missing.push('sceneBvhDispatchReceipt.packSha256');
  if (!/^[a-f0-9]{64}$/.test(String(receipt.kernelSha256 || '')) || /^0+$/.test(String(receipt.kernelSha256 || ''))) {
    missing.push('sceneBvhDispatchReceipt.kernelSha256');
  }
  if (!exactNumberArray(receipt.dispatchWorkgroups, SCENE_BVH_DISPATCH_CASE.dispatchWorkgroups)) {
    missing.push('sceneBvhDispatchReceipt.dispatchWorkgroups');
  }
  if (receipt.readbackByteLength !== SCENE_BVH_DISPATCH_CASE.expectedReadbackByteLength) {
    missing.push('sceneBvhDispatchReceipt.readbackByteLength');
  }
  if (String(receipt.readbackHex || '').toLowerCase() !== SCENE_BVH_DISPATCH_CASE.expectedReadbackHex) {
    missing.push('sceneBvhDispatchReceipt.readbackHex');
  }
  if (!Array.isArray(receipt.errorScopeErrors) || receipt.errorScopeErrors.length !== 0) {
    missing.push('sceneBvhDispatchReceipt.errorScopeErrors');
  }
  if (receipt.deviceLost !== false) missing.push('sceneBvhDispatchReceipt.deviceLost');
  return Object.freeze({ valid: missing.length === 0, missing: Object.freeze(missing) });
}
