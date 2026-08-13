import assert from 'node:assert/strict';
import * as THREE from '../vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js';
import * as TSL from '../vendor/webgpu-lab/three-0.185.1/build/three.tsl.js';
import {
  TEMPORAL_INPUT_FOUNDATION,
  beginCameraJitter,
  createTemporalInputFoundation,
  halton,
  resolveTemporalJitter
} from '../src/webgpu-lab/temporal-input-foundation.js';

let checks = 0;
function check(value, message) { checks++; assert.ok(value, message); }

check(THREE.REVISION === '185', 'The temporal foundation must execute against vendored Three r185.');
check(TEMPORAL_INPUT_FOUNDATION.runtimeIntegrated === false, 'The foundation must remain isolated from the game.');
check(TEMPORAL_INPUT_FOUNDATION.amdFsr2Implemented === false, 'MRT inputs must not imply AMD FSR 2.');
check(halton(1, 2) === 0.5 && halton(2, 2) === 0.25, 'Halton base-2 samples must be deterministic.');
check(Math.abs(halton(1, 3) - 1 / 3) < 1e-12, 'Halton base-3 samples must be deterministic.');
assert.throws(() => halton(1, 1), /at least 2/); checks++;

const jitter = resolveTemporalJitter(0, 18, 1280, 720);
check(jitter.phase === 0 && jitter.pixelX === 0, 'The first deterministic jitter sample must be centered horizontally.');
check(Math.abs(jitter.pixelY + 1 / 6) < 1e-12, 'The first deterministic jitter sample must use the Halton base-3 offset.');
check(jitter.ndcX === 0 && Math.abs(jitter.ndcY - 1 / 2160) < 1e-12, 'Jitter must convert from pixels to render-resolution NDC.');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 400);
camera.updateProjectionMatrix();
const projectionBefore = camera.projectionMatrix.clone();
const jitterHandle = beginCameraJitter(camera, resolveTemporalJitter(4, 18, 1280, 720));
check(!camera.projectionMatrix.equals(projectionBefore), 'Camera jitter must alter the active projection matrix.');
check(jitterHandle.restore() && camera.projectionMatrix.equals(projectionBefore), 'Camera jitter must restore the exact projection matrix.');
check(jitterHandle.restore() === false, 'A camera-jitter handle must restore only once.');

const foundation = createTemporalInputFoundation({
  THREE, TSL, scene, camera,
  renderWidth: 1280, renderHeight: 720,
  presentationWidth: 1920, presentationHeight: 1080
});
const { resources } = foundation;
check(foundation.scenePass.getMRT().has('velocity'), 'The real Three scene pass must contain a velocity MRT attachment.');
check(foundation.scenePass.getMRT().has('reactive') && foundation.scenePass.getMRT().has('composition'), 'The scene pass must contain both FSR temporal mask attachments.');
check(resources.color.type === THREE.HalfFloatType && resources.color.format === THREE.RGBAFormat, 'HDR color must be RGBA16F.');
check(resources.depth.type === THREE.FloatType && resources.depth.format === THREE.DepthFormat, 'Depth must be a floating-point depth texture.');
check(resources.velocity.type === THREE.HalfFloatType && resources.velocity.format === THREE.RGFormat, 'Velocity must be RG16F.');
check(resources.reactiveMask.type === THREE.UnsignedByteType && resources.reactiveMask.format === THREE.RedFormat, 'Reactive mask must be R8 UNORM.');
check(resources.transparencyAndCompositionMask.type === THREE.UnsignedByteType && resources.transparencyAndCompositionMask.format === THREE.RedFormat, 'Composition mask must be R8 UNORM.');
check(resources.exposure.image.width === 1 && resources.exposure.image.height === 1 && resources.exposure.type === THREE.FloatType, 'Exposure must be a 1x1 floating-point resource.');
check(resources.historyTargets.length === 2 && resources.historyTargets.every(target => target.width === 1920 && target.height === 1080), 'History must be a presentation-resolution ping-pong pair.');
check(Object.values(resources.nodes).every(node => node?.isNode === true), 'Every MRT/depth resource must expose a real TSL texture node.');

const frameBase = {
  frameIndex: 0, jitterPhaseCount: 18,
  backendId: 'webgpu-lab', deviceEpoch: 1,
  qualityMode: 'quality', cameraPosition: [0, 1.72, 0],
  projectionSignature: 'perspective:70:16/9:0.1:400', sceneTopologyRevision: 1
};
const first = foundation.beginFrame(frameBase);
check(first.temporalState.reset && first.temporalState.reasons.join() === 'first-frame', 'The first frame must reset temporal history.');
first.cameraJitter.restore();
check(foundation.endFrame() === 1 && foundation.history.readIndex === 1, 'An accepted frame must swap history buffers.');
const second = foundation.beginFrame({ ...frameBase, frameIndex: 1, cameraPosition: [0.1, 1.72, 0] });
check(!second.temporalState.reset && second.temporalState.historyFrameCount === 1, 'A compatible second frame must accumulate history.');
second.cameraJitter.restore();
check(foundation.endFrame({ accepted: false }) === 1, 'A rejected frame must not swap history buffers.');

check(foundation.resize({ renderWidth: 1920, renderHeight: 1080, presentationWidth: 2560, presentationHeight: 1440 }), 'A changed resolution must resize the foundation.');
check(foundation.scenePass.renderTarget.width === 1920 && foundation.scenePass.renderTarget.height === 1080, 'The scene MRT must resize to render resolution.');
check(resources.historyTargets.every(target => target.width === 2560 && target.height === 1440), 'History buffers must resize to presentation resolution.');
const afterResize = foundation.beginFrame({ ...frameBase, frameIndex: 2, jitterPhaseCount: 23 });
check(afterResize.temporalState.reset && afterResize.temporalState.reasons.join() === 'first-frame', 'Resize must invalidate temporal history before the next frame.');
afterResize.cameraJitter.restore();

check(foundation.dispose(), 'The foundation must dispose its resources exactly once.');
check(foundation.dispose() === false, 'Repeated disposal must be harmless.');
assert.throws(() => foundation.beginFrame(frameBase), /disposed/); checks++;

console.log(`WebGPU temporal-input QA: ${checks} checks, 0 failures.`);
