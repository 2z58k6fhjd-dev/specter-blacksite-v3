import * as threeModule from '@specter-lab/three-webgpu';
import * as meshBvhModule from '@specter-lab/three-mesh-bvh';
import { packDeterministicSceneBvh } from './scene-bvh-pack.js';
import { tracePackedSceneBvhCpu } from './scene-bvh-cpu-oracle.js';
import { runDeterministicSceneBvhDispatch } from './scene-bvh-dispatch.js';
import { validateSceneBvhDispatchReceipt } from './scene-bvh-receipt.js';

const resultElement = document.querySelector('#result');

try {
  const pack = await packDeterministicSceneBvh({ threeModule, meshBvhModule });
  const cpuOracle = tracePackedSceneBvhCpu(pack);
  let gpuDispatch = Object.freeze({ attempted: false, valid: false, blocker: 'navigator.gpu unavailable', receipt: null });
  if (navigator.gpu?.requestAdapter) {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (adapter) {
      let device;
      try {
        device = await adapter.requestDevice();
        const receipt = await runDeterministicSceneBvhDispatch(device, pack);
        const validation = validateSceneBvhDispatchReceipt(receipt);
        gpuDispatch = Object.freeze({
          attempted: true,
          valid: validation.valid,
          blocker: validation.valid ? null : validation.missing.join(', '),
          receipt
        });
      } catch (error) {
        gpuDispatch = Object.freeze({ attempted: true, valid: false, blocker: String(error?.message || error), receipt: null });
      } finally {
        device?.destroy();
      }
    } else {
      gpuDispatch = Object.freeze({ attempted: false, valid: false, blocker: 'No WebGPU adapter returned', receipt: null });
    }
  }
  Object.defineProperty(globalThis, '__SPECTER_SCENE_BVH_PACK__', {
    value: pack,
    configurable: true,
    enumerable: false
  });
  resultElement.textContent = JSON.stringify({
    ready: true,
    schema: pack.schema,
    testId: pack.testId,
    packSha256: pack.packSha256,
    facts: pack.facts,
    cpuOracle,
    gpuDispatch
  });
} catch (error) {
  const failure = Object.freeze({ ready: false, error: String(error?.message || error) });
  Object.defineProperty(globalThis, '__SPECTER_SCENE_BVH_FAILURE__', {
    value: failure,
    configurable: true,
    enumerable: false
  });
  resultElement.textContent = JSON.stringify(failure);
}

globalThis.dispatchEvent(new Event('specter-scene-bvh-ready'));
