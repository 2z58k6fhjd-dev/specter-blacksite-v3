import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DETERMINISTIC_SCENE_BVH_CASE,
  SCENE_BVH_BUFFER_LAYOUT
} from '../src/webgpu-lab/scene-bvh-pack.js';
import {
  SCENE_BVH_DISPATCH_CASE,
  validateSceneBvhDispatchReceipt
} from '../src/webgpu-lab/scene-bvh-receipt.js';
import {
  SCENE_BVH_TRAVERSAL_WGSL,
  runDeterministicSceneBvhDispatch
} from '../src/webgpu-lab/scene-bvh-dispatch.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
function check(value, message) { checks++; assert.ok(value, message); }

const [gameMain, labMain, packSource, oracleSource, dispatchSource, harnessHtml, harnessSource] = await Promise.all([
  readFile(resolve(ROOT, 'src/main.js'), 'utf8'),
  readFile(resolve(ROOT, 'src/webgpu-lab/main.js'), 'utf8'),
  readFile(resolve(ROOT, 'src/webgpu-lab/scene-bvh-pack.js'), 'utf8'),
  readFile(resolve(ROOT, 'src/webgpu-lab/scene-bvh-cpu-oracle.js'), 'utf8'),
  readFile(resolve(ROOT, 'src/webgpu-lab/scene-bvh-dispatch.js'), 'utf8'),
  readFile(resolve(ROOT, 'src/webgpu-lab/scene-bvh-harness.html'), 'utf8'),
  readFile(resolve(ROOT, 'src/webgpu-lab/scene-bvh-harness.js'), 'utf8')
]);

check(!gameMain.includes('scene-bvh-'), 'The shipped game must not import the isolated scene BVH proof.');
check(labMain.includes('probeSceneBvhFoundation') && labMain.includes('sceneBvhDispatchReceipt'), 'The lab must integrate the scene BVH proof only through strict evidence fields.');
check(!/https?:\/\//i.test(harnessHtml), 'The deterministic harness must contain no network dependency URL.');
check(harnessHtml.includes('three-mesh-bvh-0.9.13') && harnessHtml.includes('three-0.185.1'), 'The harness must map only the pinned local dependency versions.');
check(packSource.includes('new BVHComputeData') && packSource.includes('bvhData.update()'), 'The pack must use the vendored BVHComputeData update path.');
check(packSource.includes("attributes: { position: 'vec4f' }"), 'The packed vertex layout must be explicit.');
check(DETERMINISTIC_SCENE_BVH_CASE.expectedPackSha256 === '3df2fa772816a233c21326f2135065e30579713615b3988b07cdaab70e9b3bba', 'The exact browser-verified pack hash must remain pinned.');
check(DETERMINISTIC_SCENE_BVH_CASE.sourceObjectCount === 3 && DETERMINISTIC_SCENE_BVH_CASE.sourceTriangleCount === 12, 'The proof scene must remain a non-trivial TLAS + BLAS case.');
check(SCENE_BVH_BUFFER_LAYOUT.nodeStrideWords === 8 && SCENE_BVH_BUFFER_LAYOUT.transformStrideWords === 36, 'Packed node and transform strides must mirror three-mesh-bvh 0.9.13.');
check(oracleSource.includes("backend: 'cpu-oracle'") && oracleSource.includes('gpuEvidence: false'), 'CPU traversal must be explicitly ineligible as GPU evidence.');
check(harnessSource.includes('No WebGPU adapter returned'), 'The browser harness must fail closed when no adapter is returned.');

check(/@compute\s+@workgroup_size\(1, 1, 1\)/.test(SCENE_BVH_TRAVERSAL_WGSL), 'The BVH proof must contain a real WGSL compute entry point.');
check((SCENE_BVH_TRAVERSAL_WGSL.match(/@group\(0\) @binding\(/g) || []).length === 6, 'The kernel must bind nodes, transforms, indices, vertices, ray, and output.');
check(SCENE_BVH_TRAVERSAL_WGSL.includes('var stack: array<u32, 64>'), 'The kernel must use an explicit bounded traversal stack.');
check(SCENE_BVH_TRAVERSAL_WGSL.includes('0x00ffffffu') && SCENE_BVH_TRAVERSAL_WGSL.includes('0x0000ffffu'), 'The kernel must decode pinned TLAS and BLAS leaf payloads.');
check(SCENE_BVH_TRAVERSAL_WGSL.includes('inverseMatrixWorld') && SCENE_BVH_TRAVERSAL_WGSL.includes('cross(edge1, edge2)'), 'The kernel must transform rays and intersect real geometry.');
check(dispatchSource.includes('computePackedSceneBvhSha256') && dispatchSource.includes('pack.packSha256 !== packHash'), 'Dispatch must recompute the packed bytes hash instead of trusting metadata.');
check(dispatchSource.includes('device.queue.submit') && dispatchSource.includes('device.queue.onSubmittedWorkDone'), 'Dispatch must submit and await GPU queue work.');
check(dispatchSource.includes('readbackBuffer.mapAsync') && dispatchSource.includes("readbackSource: 'GPUBuffer.mapAsync'"), 'GPU evidence must come from mapped readback bytes.');
check(dispatchSource.includes('device.pushErrorScope') && dispatchSource.includes('device.popErrorScope'), 'GPU validation, OOM, and internal error scopes must gate the receipt.');
check(dispatchSource.includes('device?.lost') && dispatchSource.includes('deviceLossObserver.requireNotLost()'), 'BVH receipts must observe GPUDevice.lost through the receipt checkpoint.');
check(!dispatchSource.includes('deviceLost: false'), 'BVH receipts must not assert an unmeasured device-loss boolean.');

const exactReceipt = {
  schema: SCENE_BVH_DISPATCH_CASE.schema,
  testId: SCENE_BVH_DISPATCH_CASE.testId,
  backend: 'webgpu-compute-bvh',
  algorithm: 'TLAS/BLAS stack traversal + Moller-Trumbore',
  packSource: 'three-mesh-bvh@0.9.13 BVHComputeData.update',
  readbackSource: 'GPUBuffer.mapAsync',
  packSha256: SCENE_BVH_DISPATCH_CASE.packSha256,
  kernelSha256: '67a2c7b639ccecaee621cfe36599d966632aa80f0b745c041f89a7083e3c9b51',
  dispatchWorkgroups: SCENE_BVH_DISPATCH_CASE.dispatchWorkgroups,
  readbackByteLength: SCENE_BVH_DISPATCH_CASE.expectedReadbackByteLength,
  readbackHex: SCENE_BVH_DISPATCH_CASE.expectedReadbackHex,
  errorScopeErrors: [],
  deviceLost: false
};
check(validateSceneBvhDispatchReceipt(exactReceipt).valid, 'Only the exact deterministic BVH receipt should validate.');
check(!validateSceneBvhDispatchReceipt(true).valid, 'A boolean must not count as BVH dispatch evidence.');
check(!validateSceneBvhDispatchReceipt({ passed: true }).valid, 'A generic success object must not count as BVH dispatch evidence.');
check(!validateSceneBvhDispatchReceipt({ ...exactReceipt, packSha256: '0'.repeat(64) }).valid, 'An altered pack hash must invalidate the receipt.');
check(!validateSceneBvhDispatchReceipt({ ...exactReceipt, readbackHex: exactReceipt.readbackHex.replace(/^01/, '00') }).valid, 'An altered hit result must invalidate the receipt.');
check(!validateSceneBvhDispatchReceipt({ ...exactReceipt, errorScopeErrors: ['validation'] }).valid, 'Any WebGPU error scope result must invalidate the receipt.');

const readback = Uint8Array.from(SCENE_BVH_DISPATCH_CASE.expectedReadbackHex.match(/.{2}/g), byte => Number.parseInt(byte, 16));
const view = new DataView(readback.buffer);
check(view.getUint32(0, true) === 1 && view.getUint32(4, true) === 0, 'Expected readback must identify a hit on packed triangle zero.');
check(view.getUint32(8, true) === 1 && view.getUint32(12, true) === 8, 'Expected readback must identify object one after eight visited nodes.');
check(view.getFloat32(16, true) === 2, 'Expected readback distance must be exactly two meters.');
check(view.getFloat32(20, true) === 0.5 && view.getFloat32(24, true) === 0.25 && view.getFloat32(28, true) === 0.25, 'Expected readback barycentrics must be exact.');
await assert.rejects(() => runDeterministicSceneBvhDispatch(null, null), /GPUDevice/);
checks++;

console.log(`Scene BVH proof QA: ${checks} checks, 0 failures.`);
