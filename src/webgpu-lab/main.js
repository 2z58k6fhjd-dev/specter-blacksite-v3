import { probeWebgpuEnvironment } from './browser-probe.js';
import { resolveVendoredWebgpuDependencies } from './dependency-loader.js';
import { WEBGPU_LAB_DEPENDENCIES } from './dependency-manifest.js';
import { createWebgpuLabReport, renderWebgpuLabReport } from './diagnostics.js';
import { probeWebgpuRasterFoundation } from './raster-foundation-probe.js';
import { probeSceneBvhFoundation } from './scene-bvh-probe.js';

const output = document.querySelector('#labOutput');
const retry = document.querySelector('#retryProbe');

async function runLabProbe() {
  retry.disabled = true;
  output.setAttribute('aria-busy', 'true');
  const probing = document.createElement('p');
  probing.className = 'probing';
  probing.textContent = 'Checking only local dependencies and browser capabilities…';
  output.replaceChildren(probing);

  const [baseEnvironment, dependencyResolution] = await Promise.all([
    probeWebgpuEnvironment(),
    resolveVendoredWebgpuDependencies()
  ]);
  let environment = baseEnvironment;
  if (dependencyResolution.ready) {
    const THREE = dependencyResolution.modules?.[WEBGPU_LAB_DEPENDENCIES.three.id];
    const meshBvh = dependencyResolution.modules?.[WEBGPU_LAB_DEPENDENCIES.meshBvh.id];
    const [rasterResult, sceneBvhResult] = await Promise.allSettled([
      baseEnvironment.deviceAcquired
        ? probeWebgpuRasterFoundation({ THREE })
        : Promise.reject(new Error(baseEnvironment.error || 'WebGPU compute device unavailable')),
      probeSceneBvhFoundation({ threeModule: THREE, meshBvhModule: meshBvh })
    ]);
    environment = Object.freeze({
      ...baseEnvironment,
      webgpuRasterReceipt: rasterResult.status === 'fulfilled' ? rasterResult.value : null,
      rasterError: rasterResult.status === 'rejected' ? String(rasterResult.reason?.message || rasterResult.reason) : null,
      sceneBvhPackEvidence: sceneBvhResult.status === 'fulfilled' ? sceneBvhResult.value.packEvidence : null,
      sceneBvhDispatchReceipt: sceneBvhResult.status === 'fulfilled' ? sceneBvhResult.value.dispatchReceipt : null,
      sceneBvhError: sceneBvhResult.status === 'rejected'
        ? String(sceneBvhResult.reason?.message || sceneBvhResult.reason)
        : sceneBvhResult.value.dispatchError
    });
  }
  const report = createWebgpuLabReport({ environment, dependencyResolution });
  renderWebgpuLabReport(report, output);
  output.setAttribute('aria-busy', 'false');
  retry.disabled = false;

  Object.defineProperty(globalThis, '__SPECTER_WEBGPU_LAB__', {
    value: report,
    configurable: true,
    enumerable: false
  });
  globalThis.dispatchEvent(new CustomEvent('specter-webgpu-lab-ready', { detail: report }));
}

retry.addEventListener('click', runLabProbe);
runLabProbe().catch(error => {
  output.setAttribute('aria-busy', 'false');
  const panel = document.createElement('section');
  panel.className = 'panel fatal';
  const heading = document.createElement('h2');
  heading.textContent = 'Lab probe failed closed';
  const detail = document.createElement('p');
  detail.textContent = String(error?.message || error);
  panel.append(heading, detail);
  output.replaceChildren(panel);
  retry.disabled = false;
});
