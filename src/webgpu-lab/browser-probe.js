import { WEBGPU_COMPUTE_MINIMUMS } from '../experimental/webgpu-advanced-contract.js';
import { runKnownTriangleDispatch } from './known-triangle-dispatch.js';

function limitSnapshot(adapter) {
  return Object.freeze(Object.fromEntries(
    Object.keys(WEBGPU_COMPUTE_MINIMUMS).map(name => [name, Number(adapter?.limits?.[name] || 0)])
  ));
}

function featureSnapshot(adapter) {
  try {
    return Object.freeze(Array.from(adapter?.features || [], String).sort());
  } catch {
    return Object.freeze([]);
  }
}

export async function probeWebgpuEnvironment({
  navigatorObject = globalThis.navigator,
  secureContext = globalThis.isSecureContext === true
} = {}) {
  const gpu = navigatorObject?.gpu;
  const base = {
    secureContext,
    navigatorGpu: Boolean(gpu),
    adapterFound: false,
    deviceAcquired: false,
    adapterFallback: null,
    limits: Object.freeze({}),
    features: Object.freeze([]),
    knownTriangleDispatchReceipt: null,
    error: null
  };
  if (!secureContext) return Object.freeze({ ...base, error: 'A secure context is required for WebGPU.' });
  if (!gpu?.requestAdapter) return Object.freeze({ ...base, error: 'navigator.gpu is unavailable.' });

  let adapter;
  try {
    adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch (error) {
    return Object.freeze({ ...base, error: `Adapter request failed: ${String(error?.message || error)}` });
  }
  if (!adapter) return Object.freeze({ ...base, error: 'No WebGPU adapter was returned.' });

  const limits = limitSnapshot(adapter);
  const limitBlockers = Object.entries(WEBGPU_COMPUTE_MINIMUMS)
    .filter(([name, minimum]) => limits[name] < minimum)
    .map(([name]) => name);
  if (limitBlockers.length > 0) {
    return Object.freeze({
      ...base,
      adapterFound: true,
      limits,
      features: featureSnapshot(adapter),
      error: `Adapter is below the lab compute minimums: ${limitBlockers.join(', ')}.`
    });
  }

  let device;
  let knownTriangleDispatchReceipt = null;
  try {
    device = await adapter.requestDevice({ requiredLimits: { ...WEBGPU_COMPUTE_MINIMUMS } });
    knownTriangleDispatchReceipt = await runKnownTriangleDispatch(device);
  } catch (error) {
    device?.destroy?.();
    return Object.freeze({
      ...base,
      adapterFound: true,
      deviceAcquired: Boolean(device),
      limits,
      features: featureSnapshot(adapter),
      error: `${device ? 'Known-triangle dispatch' : 'Device request'} failed: ${String(error?.message || error)}`
    });
  }
  device.destroy?.();

  return Object.freeze({
    ...base,
    adapterFound: true,
    deviceAcquired: true,
    limits,
    features: featureSnapshot(adapter),
    knownTriangleDispatchReceipt
  });
}
