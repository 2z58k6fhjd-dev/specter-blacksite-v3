import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { validateKnownTriangleDispatchReceipt } from '../src/webgpu-lab/dispatch-receipt.js';
import { validateRasterFoundationReceipt } from '../src/webgpu-lab/raster-foundation-receipt.js';
import { validateSceneBvhDispatchReceipt } from '../src/webgpu-lab/scene-bvh-receipt.js';
import { validateSceneBvhPackEvidence } from '../src/webgpu-lab/scene-bvh-probe.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
});

function resolveRequestPath(pathname) {
  const target = resolve(ROOT, `.${decodeURIComponent(pathname)}`);
  return relative(ROOT, target).startsWith('..') ? null : target;
}

const server = createServer(async (request, response) => {
  if (!request.url || !['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405).end();
    return;
  }
  const target = resolveRequestPath(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!target) {
    response.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', resolveListen);
});
const address = server.address();
assert.ok(address && typeof address !== 'string');

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=vulkan',
    '--disable-vulkan-surface'
  ]
});
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/webgpu-lab.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(globalThis.__SPECTER_WEBGPU_LAB__), null, { timeout: 30_000 });
  const report = await page.evaluate(() => globalThis.__SPECTER_WEBGPU_LAB__);
  const gateById = new Map(report.gates.map(item => [item.id, item]));
  const strictEvidence = Object.freeze({
    triangle: validateKnownTriangleDispatchReceipt(report.environment.knownTriangleDispatchReceipt),
    raster: validateRasterFoundationReceipt(report.environment.webgpuRasterReceipt),
    scenePack: validateSceneBvhPackEvidence(report.environment.sceneBvhPackEvidence),
    sceneDispatch: validateSceneBvhDispatchReceipt(report.environment.sceneBvhDispatchReceipt)
  });
  const expectedFullProofReady = report.environment.secureContext === true
    && report.environment.navigatorGpu === true
    && report.environment.adapterFound === true
    && report.environment.deviceAcquired === true
    && report.dependencies.every(item => item.ready)
    && Object.values(strictEvidence).every(item => item.valid)
    && gateById.get('triangle-kernel')?.ready === true;

  assert.equal(report.runtimeIntegrated, false);
  assert.equal(report.claims.hardwareRayTracingActive, false);
  assert.equal(report.claims.amdFsr2Active, false);

  assert.equal(report.dispatchEvidence.valid, strictEvidence.triangle.valid, 'Known-triangle status must be derived from the exact mapped-readback receipt.');
  assert.equal(report.rasterEvidence.valid, strictEvidence.raster.valid, 'Raster status must be derived from the exact submitted-frame receipt.');
  assert.equal(report.sceneBvhPackEvidence.valid, strictEvidence.scenePack.valid, 'Scene-pack status must be derived from the pinned BVH evidence.');
  assert.equal(report.sceneBvhDispatchEvidence.valid, strictEvidence.sceneDispatch.valid, 'Scene-dispatch status must be derived from the exact mapped-readback receipt.');
  assert.equal(gateById.get('triangle-dispatch')?.ready, strictEvidence.triangle.valid);
  assert.equal(gateById.get('renderer-init')?.ready, strictEvidence.raster.valid);
  assert.equal(gateById.get('scene-bvh')?.ready, strictEvidence.scenePack.valid);
  assert.equal(gateById.get('scene-bvh-dispatch')?.ready, strictEvidence.sceneDispatch.valid);
  assert.equal(report.claims.webgpuRasterActive, strictEvidence.raster.valid, 'Only a validated WebGPU raster receipt may activate the isolated raster claim.');
  assert.equal(
    report.claims.geometryRayTracingActive,
    report.contractEvaluation.computeBvhGeometryRayTracing === true,
    'The isolated geometry-ray claim must exactly match the evaluated evidence contract.'
  );
  assert.equal(
    report.triangleDispatchReady,
    report.triangleDispatchBlockers.length === 0,
    'The full proof path is ready only when every required gate is receipt-backed.'
  );
  assert.equal(
    report.triangleDispatchReady,
    expectedFullProofReady,
    'Adapter-capable success must require every capability, dependency, and strict proof receipt.'
  );

  if (report.claims.geometryRayTracingActive) {
    assert.equal(strictEvidence.raster.valid, true, 'Geometry-ray success requires the exact raster receipt.');
    assert.equal(strictEvidence.scenePack.valid, true, 'Geometry-ray success requires the pinned scene BVH pack.');
    assert.equal(strictEvidence.sceneDispatch.valid, true, 'Geometry-ray success requires the exact TLAS/BLAS GPU readback.');
    assert.equal(report.environment.adapterFound, true);
    assert.equal(report.environment.deviceAcquired, true);
  }

  if (report.triangleDispatchReady) {
    assert.equal(strictEvidence.triangle.valid, true);
    assert.equal(strictEvidence.raster.valid, true);
    assert.equal(strictEvidence.scenePack.valid, true);
    assert.equal(strictEvidence.sceneDispatch.valid, true);
    assert.ok(report.dependencies.every(item => item.ready), 'The full proof path requires every exact local dependency.');
    assert.ok(report.gates.filter(item => item.id !== 'fsr2-port').every(item => item.ready), 'Every non-FSR2 proof gate must be ready.');
  }

  if (report.environment.adapterFound) {
    assert.equal(gateById.get('webgpu-adapter')?.ready, true);
    if (strictEvidence.raster.valid) {
      assert.equal(report.claims.webgpuRasterActive, true, 'A validated Three r185 WebGPU frame may activate only the isolated raster claim.');
    } else {
      assert.equal(report.claims.webgpuRasterActive, false, 'A failed raster receipt must remain fail-closed even if raw compute succeeded.');
    }
  } else {
    assert.equal(report.claims.webgpuRasterActive, false, 'No adapter means no WebGPU raster receipt.');
    assert.equal(report.claims.geometryRayTracingActive, false, 'No adapter means no receipt-backed geometry-ray proof.');
    assert.equal(strictEvidence.triangle.valid, false, 'A missing adapter must fail closed without a triangle dispatch receipt.');
    assert.equal(strictEvidence.raster.valid, false, 'A missing adapter must fail closed without a raster receipt.');
    assert.equal(strictEvidence.sceneDispatch.valid, false, 'A missing adapter must fail closed without a scene dispatch receipt.');
    assert.ok(strictEvidence.triangle.missing.includes('knownTriangleDispatchReceipt'));
    assert.ok(report.triangleDispatchBlockers.includes('triangle-dispatch'));
    assert.equal(report.triangleDispatchReady, false);
  }
  if (!report.dependencies.every(item => item.ready)) {
    assert.ok(report.triangleDispatchBlockers.includes('three-webgpu'));
    assert.ok(report.triangleDispatchBlockers.includes('mesh-bvh-compute'));
  }
  assert.equal(gateById.get('triangle-kernel')?.ready, true);
  assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join('; ')}`);
  console.log(`WebGPU lab browser QA: ${report.gates.length} gates rendered; ${report.triangleDispatchReady ? 'strict receipt-backed success' : 'fail-closed partial capability path'}.`);
  console.log(`Triangle-dispatch blockers: ${report.triangleDispatchBlockers.join(', ')}`);
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
