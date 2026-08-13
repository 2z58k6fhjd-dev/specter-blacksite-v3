import {
  ADVANCED_RENDERER_CONTRACT,
  evaluateAdvancedRendererCapabilities
} from '../experimental/webgpu-advanced-contract.js';
import { WEBGPU_LAB_DEPENDENCIES, WEBGPU_LAB_STAGE } from './dependency-manifest.js';
import { validateKnownTriangleDispatchReceipt } from './dispatch-receipt.js';
import { validateRasterFoundationReceipt } from './raster-foundation-receipt.js';
import { validateSceneBvhDispatchReceipt } from './scene-bvh-receipt.js';
import { validateSceneBvhPackEvidence } from './scene-bvh-probe.js';

function gate(id, label, ready, detail) {
  return Object.freeze({ id, label, ready: ready === true, detail: String(detail || '') });
}

export function createWebgpuLabReport({ environment = {}, dependencyResolution = {} } = {}) {
  const dependencyById = new Map((dependencyResolution.dependencies || []).map(item => [item.id, item]));
  const three = dependencyById.get(WEBGPU_LAB_DEPENDENCIES.three.id);
  const meshBvh = dependencyById.get(WEBGPU_LAB_DEPENDENCIES.meshBvh.id);
  const dispatchEvidence = validateKnownTriangleDispatchReceipt(environment.knownTriangleDispatchReceipt);
  const rasterEvidence = validateRasterFoundationReceipt(environment.webgpuRasterReceipt);
  const sceneBvhPackEvidence = validateSceneBvhPackEvidence(environment.sceneBvhPackEvidence);
  const sceneBvhDispatchEvidence = validateSceneBvhDispatchReceipt(environment.sceneBvhDispatchReceipt);
  const contractEvaluation = evaluateAdvancedRendererCapabilities({
    secureContext: environment.secureContext === true,
    navigatorGpu: environment.navigatorGpu === true,
    adapterFound: environment.adapterFound === true,
    backend: rasterEvidence.valid ? 'webgpu' : 'not-initialized',
    threeRevision: three?.ready ? WEBGPU_LAB_DEPENDENCIES.three.revision : 0,
    tslPostProcessing: rasterEvidence.valid,
    computeShaders: environment.deviceAcquired === true,
    storageBuffers: environment.deviceAcquired === true,
    storageTextures: environment.deviceAcquired === true,
    bvhComputeData: sceneBvhDispatchEvidence.valid,
    limits: environment.limits || {},
    fsr2: {}
  });

  const gates = Object.freeze([
    gate('secure-context', 'Secure browser context', environment.secureContext, environment.secureContext ? 'Available' : 'Required'),
    gate('webgpu-api', 'WebGPU browser API', environment.navigatorGpu, environment.navigatorGpu ? 'Available' : 'navigator.gpu missing'),
    gate('webgpu-adapter', 'WebGPU adapter', environment.adapterFound, environment.adapterFound ? 'Acquired' : 'Not acquired'),
    gate('webgpu-device', 'Minimum compute device', environment.deviceAcquired, environment.deviceAcquired ? 'Probe succeeded; device released' : environment.error || 'Not acquired'),
    gate('three-webgpu', `Vendored Three ${WEBGPU_LAB_DEPENDENCIES.three.version} WebGPU module`, three?.ready, three?.ready ? 'Local package metadata, module availability, and required exports validated at runtime; release validation enforces file hashes' : three?.blockers?.join('; ') || 'Not present'),
    gate('mesh-bvh-compute', `Vendored three-mesh-bvh ${WEBGPU_LAB_DEPENDENCIES.meshBvh.version} BVHComputeData`, meshBvh?.ready, meshBvh?.ready ? 'Local package metadata, module availability, and required exports validated at runtime; release validation enforces file hashes' : meshBvh?.blockers?.join('; ') || 'Not present'),
    gate(
      'renderer-init',
      'WebGPURenderer + temporal MRT frame submitted',
      rasterEvidence.valid,
      rasterEvidence.valid
        ? 'Three r185 WebGPU backend submitted and completed a 64x64 HDR/depth/velocity/mask frame'
        : environment.rasterError || `No valid raster receipt: ${rasterEvidence.missing.join(', ')}`
    ),
    gate(
      'scene-bvh',
      'Pinned BVHComputeData packs validated TLAS/BLAS bytes',
      sceneBvhPackEvidence.valid,
      sceneBvhPackEvidence.valid
        ? `CPU oracle validated ${environment.sceneBvhPackEvidence.facts.nodeCount} nodes / ${environment.sceneBvhPackEvidence.facts.packedTriangleCount} triangles; SHA-256 ${environment.sceneBvhPackEvidence.packSha256}`
        : environment.sceneBvhError || `No valid pack evidence: ${sceneBvhPackEvidence.missing.join(', ')}`
    ),
    gate('triangle-kernel', 'Known-input WGSL ray/triangle intersection kernel', WEBGPU_LAB_STAGE.triangleKernelImplemented, WEBGPU_LAB_STAGE.triangleKernelImplemented ? 'Möller–Trumbore compute proof is present' : 'No ray/triangle shader exists'),
    gate(
      'triangle-dispatch',
      'Known-triangle compute dispatch validated',
      WEBGPU_LAB_STAGE.triangleDispatchValidated && dispatchEvidence.valid,
      dispatchEvidence.valid
        ? 'Receipt is structurally valid; stage promotion is still required'
        : `No valid GPU readback receipt: ${dispatchEvidence.missing.join(', ')}`
    ),
    gate(
      'scene-bvh-dispatch',
      'Mapped WebGPU TLAS/BLAS traversal receipt',
      sceneBvhDispatchEvidence.valid,
      sceneBvhDispatchEvidence.valid
        ? 'Exact object, triangle, distance, barycentric, and visited-node bytes validated'
        : environment.sceneBvhError || `No valid scene dispatch receipt: ${sceneBvhDispatchEvidence.missing.join(', ')}`
    ),
    gate('fsr2-port', 'Validated AMD FSR 2 WGSL port', WEBGPU_LAB_STAGE.fsr2PortImplemented, 'Only a pinned first 2x2 log-luminance mip reference exists; full SPD, exposure, reconstruct/dilate, depth clip, locks, accumulation, and RCAS remain absent')
  ]);
  const triangleGateIds = new Set([
    'secure-context', 'webgpu-api', 'webgpu-adapter', 'webgpu-device',
    'three-webgpu', 'mesh-bvh-compute', 'renderer-init', 'scene-bvh',
    'triangle-kernel', 'triangle-dispatch', 'scene-bvh-dispatch'
  ]);
  const triangleDispatchBlockers = Object.freeze(gates.filter(item => triangleGateIds.has(item.id) && !item.ready).map(item => item.id));

  return Object.freeze({
    lab: 'SPECTER isolated WebGPU advanced-renderer lab',
    stage: WEBGPU_LAB_STAGE.id,
    runtimeIntegrated: false,
    generatedAt: new Date().toISOString(),
    claims: Object.freeze({
      webgpuRasterActive: rasterEvidence.valid,
      geometryRayTracingActive: contractEvaluation.computeBvhGeometryRayTracing,
      hardwareRayTracingActive: false,
      hardwareRayTracingReason: ADVANCED_RENDERER_CONTRACT.hardwareRayTracingReason,
      amdFsr2Active: false
    }),
    environment: Object.freeze({ ...environment }),
    dependencies: Object.freeze([...(dependencyResolution.dependencies || [])]),
    gates,
    dispatchEvidence,
    rasterEvidence,
    sceneBvhPackEvidence,
    sceneBvhDispatchEvidence,
    triangleDispatchReady: triangleDispatchBlockers.length === 0,
    triangleDispatchBlockers,
    contractEvaluation
  });
}

function text(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function renderWebgpuLabReport(report, root) {
  const gateRows = report.gates.map(item => `
    <tr>
      <td><span class="state ${item.ready ? 'pass' : 'blocked'}">${item.ready ? 'READY' : 'BLOCKED'}</span></td>
      <th scope="row">${text(item.label)}</th>
      <td>${text(item.detail)}</td>
    </tr>`).join('');
  const blockers = report.triangleDispatchBlockers.map(id => `<li><code>${text(id)}</code></li>`).join('');
  root.innerHTML = `
    <section class="claims" aria-label="Current claims">
      <article><span>WEBGPU RASTER</span><strong>${report.claims.webgpuRasterActive ? 'ACTIVE IN LAB' : 'NOT ACTIVE'}</strong></article>
      <article><span>GEOMETRY RAYS</span><strong>${report.claims.geometryRayTracingActive ? 'ACTIVE IN PROOF' : 'NOT ACTIVE'}</strong></article>
      <article><span>HARDWARE RT</span><strong>NOT EXPOSED</strong></article>
      <article><span>AMD FSR 2</span><strong>NOT ACTIVE</strong></article>
    </section>
    <section class="panel">
      <div class="panel-heading"><h2>Readiness gates</h2><span>${report.gates.filter(item => item.ready).length}/${report.gates.length} ready</span></div>
      <div class="table-scroll"><table><thead><tr><th>Status</th><th>Gate</th><th>Evidence</th></tr></thead><tbody>${gateRows}</tbody></table></div>
    </section>
    <section class="panel blockers">
      <h2>Exact blockers before triangle dispatch</h2>
      <ol>${blockers || '<li>None. This would require a new implementation stage before any claim changes.</li>'}</ol>
    </section>
    <details class="panel"><summary>Machine-readable diagnostics</summary><pre>${text(JSON.stringify(report, null, 2))}</pre></details>`;
}
