import { WEBGPU_LAB_DEPENDENCIES } from './dependency-manifest.js';

function normalizedLicense(value) {
  if (typeof value === 'string') return value.trim().toUpperCase();
  if (Array.isArray(value)) return value.map(normalizedLicense).join(' OR ');
  return '';
}

async function fetchPackageManifest(dependency, fetchImpl, baseUrl) {
  const url = new URL(dependency.packageManifestUrl, baseUrl).href;
  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) {
      return { ok: false, blocker: `${dependency.id}.package-manifest-http-${response.status}`, url };
    }
    const packageManifest = await response.json();
    if (packageManifest.name !== dependency.packageName) {
      return { ok: false, blocker: `${dependency.id}.package-name-mismatch`, url, packageManifest };
    }
    if (packageManifest.version !== dependency.version) {
      return { ok: false, blocker: `${dependency.id}.version-mismatch`, url, packageManifest };
    }
    if (!normalizedLicense(packageManifest.license).includes(dependency.license)) {
      return { ok: false, blocker: `${dependency.id}.license-mismatch`, url, packageManifest };
    }
    return { ok: true, url, packageManifest };
  } catch (error) {
    return { ok: false, blocker: `${dependency.id}.package-manifest-unavailable`, url, detail: String(error?.message || error) };
  }
}

async function probeModuleFile(dependency, fetchImpl, baseUrl) {
  const url = new URL(dependency.moduleUrl, baseUrl).href;
  try {
    let response = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' });
    if (response.status === 405 || response.status === 501) {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        cache: 'no-store'
      });
    }
    if (!response.ok) return { ok: false, blocker: `${dependency.id}.module-http-${response.status}`, url };
    return { ok: true, url };
  } catch (error) {
    return { ok: false, blocker: `${dependency.id}.module-unavailable`, url, detail: String(error?.message || error) };
  }
}

function publicDependencyResult(dependency, manifestResult, moduleResult, exportResult = null) {
  const blockers = [manifestResult.blocker, moduleResult.blocker, exportResult?.blocker].filter(Boolean);
  return Object.freeze({
    id: dependency.id,
    packageName: dependency.packageName,
    expectedVersion: dependency.version,
    installedVersion: manifestResult.packageManifest?.version || null,
    expectedLicense: dependency.license,
    installedLicense: manifestResult.packageManifest?.license || null,
    manifestUrl: manifestResult.url,
    moduleUrl: moduleResult.url,
    metadataVerified: manifestResult.ok === true,
    moduleFound: moduleResult.ok === true,
    exportsVerified: exportResult?.ok === true,
    ready: blockers.length === 0 && exportResult?.ok === true,
    blockers: Object.freeze(blockers)
  });
}

/**
 * Resolve the pinned local modules. The importer is never invoked until every
 * dependency's module path is available and its package name, exact version,
 * and license metadata have passed runtime checks. Release validation separately
 * enforces the vendored file hashes.
 */
export async function resolveVendoredWebgpuDependencies({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  importer = specifier => import(specifier),
  baseUrl = import.meta.url,
  dependencies = WEBGPU_LAB_DEPENDENCIES
} = {}) {
  if (typeof fetchImpl !== 'function') {
    const blocker = 'dependency-loader.fetch-unavailable';
    return Object.freeze({ ready: false, imported: false, dependencies: Object.freeze([]), blockers: Object.freeze([blocker]), modules: null });
  }

  const entries = Object.values(dependencies);
  const probes = await Promise.all(entries.map(async dependency => ({
    dependency,
    manifest: await fetchPackageManifest(dependency, fetchImpl, baseUrl),
    module: await probeModuleFile(dependency, fetchImpl, baseUrl)
  })));
  const preflightBlockers = probes.flatMap(({ manifest, module }) => [manifest.blocker, module.blocker].filter(Boolean));
  if (preflightBlockers.length > 0) {
    return Object.freeze({
      ready: false,
      imported: false,
      dependencies: Object.freeze(probes.map(({ dependency, manifest, module }) => publicDependencyResult(dependency, manifest, module))),
      blockers: Object.freeze(preflightBlockers),
      modules: null
    });
  }

  const loadedModules = {};
  const exportResults = new Map();
  for (const { dependency } of probes) {
    try {
      const module = await importer(dependency.specifier);
      const missingExports = dependency.requiredExports.filter(name => !(name in module));
      if (missingExports.length > 0) {
        exportResults.set(dependency.id, {
          ok: false,
          blocker: `${dependency.id}.missing-exports:${missingExports.join(',')}`
        });
      } else {
        loadedModules[dependency.id] = module;
        exportResults.set(dependency.id, { ok: true });
      }
    } catch (error) {
      exportResults.set(dependency.id, {
        ok: false,
        blocker: `${dependency.id}.module-evaluation-failed`,
        detail: String(error?.message || error)
      });
    }
  }

  const results = probes.map(({ dependency, manifest, module }) => (
    publicDependencyResult(dependency, manifest, module, exportResults.get(dependency.id))
  ));
  const blockers = results.flatMap(result => result.blockers);
  return Object.freeze({
    ready: blockers.length === 0,
    imported: blockers.length === 0,
    dependencies: Object.freeze(results),
    blockers: Object.freeze(blockers),
    modules: blockers.length === 0 ? Object.freeze(loadedModules) : null
  });
}
