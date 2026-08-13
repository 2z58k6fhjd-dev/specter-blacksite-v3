export const RASTER_FOUNDATION_RECEIPT = Object.freeze({
  schema: 'specter.webgpu.raster-foundation-receipt/v1',
  testId: 'r185-mrt-temporal-frame-v1',
  rendererRevision: 185,
  width: 64,
  height: 64,
  attachmentNames: Object.freeze([
    'specter-temporal-hdr-color',
    'specter-temporal-depth',
    'specter-temporal-velocity',
    'specter-temporal-reactive-mask',
    'specter-temporal-composition-mask'
  ])
});

export function validateRasterFoundationReceipt(receipt) {
  const missing = [];
  const expected = RASTER_FOUNDATION_RECEIPT;
  if (!receipt || typeof receipt !== 'object') missing.push('webgpuRasterReceipt');
  if (receipt?.schema !== expected.schema) missing.push('schema');
  if (receipt?.testId !== expected.testId) missing.push('testId');
  if (receipt?.backend !== 'webgpu') missing.push('backend');
  if (receipt?.rendererRevision !== expected.rendererRevision) missing.push('rendererRevision');
  if (receipt?.drawingBufferWidth !== expected.width || receipt?.drawingBufferHeight !== expected.height) missing.push('drawingBuffer');
  if (receipt?.frameSubmitted !== true) missing.push('frameSubmitted');
  if (receipt?.queueCompleted !== true) missing.push('queueCompleted');
  if (receipt?.historyReadIndex !== 1) missing.push('historySwap');
  if (receipt?.deviceLost !== false) missing.push('deviceLost');
  if (!Array.isArray(receipt?.errorScopeErrors) || receipt.errorScopeErrors.length !== 0) missing.push('errorScopeErrors');
  if (!Array.isArray(receipt?.attachmentNames) || expected.attachmentNames.some(name => !receipt.attachmentNames.includes(name))) {
    missing.push('attachments');
  }
  return Object.freeze({ valid: missing.length === 0, missing: Object.freeze(missing) });
}
