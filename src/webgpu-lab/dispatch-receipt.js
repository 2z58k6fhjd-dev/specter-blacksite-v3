// Fixed GPU validation case for the first geometry-ray compute slice. The
// receipt contains exact mapped readback bytes, not a caller-supplied success
// boolean. The eventual dispatcher must create it only after queue submission,
// clean error scopes, and GPUBuffer.mapAsync.
export const KNOWN_TRIANGLE_DISPATCH_CASE = Object.freeze({
  schema: 'specter.webgpu.triangle-dispatch-receipt/v1',
  testId: 'unit-triangle-front-hit-v1',
  canonicalInput: 'triangle=0,0,0|1,0,0|0,1,0;origin=0.25,0.25,1;direction=0,0,-1',
  inputSha256: 'fd8f19d287d4531ef79c94e6e4b55c3e99e768653e38bd4522baf17165aee1f7',
  dispatchWorkgroups: Object.freeze([1, 1, 1]),
  // Little-endian: hit u32, triangle u32, t f32, barycentric xyz f32.
  expectedReadbackHex: '01000000000000000000803f0000003f0000803e0000803e',
  expectedReadbackByteLength: 24
});

function exactNumberArray(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((item, index) => Number(item) === expected[index]);
}
/**
 * Structural validation for evidence emitted by a real known-input dispatch.
 * This deliberately rejects `{ passed: true }` and capability booleans. It
 * cannot itself prove GPU provenance; the isolated dispatcher will own the
 * queue submission and create the receipt from mapped bytes.
 */
export function validateKnownTriangleDispatchReceipt(receipt) {
  const missing = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return Object.freeze({ valid: false, missing: Object.freeze(['knownTriangleDispatchReceipt']) });
  }
  if (receipt.schema !== KNOWN_TRIANGLE_DISPATCH_CASE.schema) missing.push('knownTriangleDispatchReceipt.schema');
  if (receipt.testId !== KNOWN_TRIANGLE_DISPATCH_CASE.testId) missing.push('knownTriangleDispatchReceipt.testId');
  if (receipt.backend !== 'webgpu-compute') missing.push('knownTriangleDispatchReceipt.backend');
  if (receipt.readbackSource !== 'GPUBuffer.mapAsync') missing.push('knownTriangleDispatchReceipt.readbackSource');
  if (receipt.inputSha256 !== KNOWN_TRIANGLE_DISPATCH_CASE.inputSha256) missing.push('knownTriangleDispatchReceipt.inputSha256');
  if (!/^[a-f0-9]{64}$/.test(String(receipt.kernelSha256 || '')) || /^0+$/.test(String(receipt.kernelSha256 || ''))) {
    missing.push('knownTriangleDispatchReceipt.kernelSha256');
  }
  if (!exactNumberArray(receipt.dispatchWorkgroups, KNOWN_TRIANGLE_DISPATCH_CASE.dispatchWorkgroups)) {
    missing.push('knownTriangleDispatchReceipt.dispatchWorkgroups');
  }
  if (receipt.readbackByteLength !== KNOWN_TRIANGLE_DISPATCH_CASE.expectedReadbackByteLength) {
    missing.push('knownTriangleDispatchReceipt.readbackByteLength');
  }
  if (String(receipt.readbackHex || '').toLowerCase() !== KNOWN_TRIANGLE_DISPATCH_CASE.expectedReadbackHex) {
    missing.push('knownTriangleDispatchReceipt.readbackHex');
  }
  if (!Array.isArray(receipt.errorScopeErrors) || receipt.errorScopeErrors.length !== 0) {
    missing.push('knownTriangleDispatchReceipt.errorScopeErrors');
  }
  if (receipt.deviceLost !== false) missing.push('knownTriangleDispatchReceipt.deviceLost');
  return Object.freeze({ valid: missing.length === 0, missing: Object.freeze(missing) });
}
