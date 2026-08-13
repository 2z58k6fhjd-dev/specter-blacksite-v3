#!/usr/bin/env node

/**
 * Dependency-free release checks for the static GitHub Pages build.
 *
 * Commands:
 *   node scripts/release.mjs validate
 *   node scripts/release.mjs package [--version <safe-id>]
 *   node scripts/release.mjs verify
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  access,
  cp,
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_ROOT = resolve(ROOT, '.release');
const PAGES_ROOT = resolve(RELEASE_ROOT, 'pages');
const ARTIFACTS_ROOT = resolve(RELEASE_ROOT, 'artifacts');
const DOWNLOAD_ROOT = resolve(PAGES_ROOT, 'download');
const DEPLOYABLE_PATHS = [
  'assets',
  'src',
  'vendor/webgpu-lab',
  'index.html',
  'manifest.webmanifest',
  'player-model.html',
  'README.md',
  'ASSET_CATALOG.md',
  'service-worker.js',
  'styles.css',
  'THIRD_PARTY_ASSETS.md',
  'THIRD_PARTY_SOFTWARE.md',
  'webgpu-lab.html'
];
const MEDIA_EXTENSIONS = new Set([
  '.bin', '.glb', '.gltf', '.jpeg', '.jpg', '.ktx2', '.mp3', '.ogg', '.png', '.wav', '.webp'
]);
const STAGING_BINARY_EXTENSIONS = new Set([
  '.7z', '.bin', '.blend', '.fbx', '.glb', '.gltf', '.gz', '.jpeg', '.jpg', '.ktx2',
  '.mp3', '.ogg', '.png', '.rar', '.tar', '.wav', '.webp', '.zip'
]);
const STAGING_REQUIRED_RECORDS = [
  'SOURCE.md',
  'LICENSE.txt',
  'ORIGINAL.sha256',
  'conversion.md',
  'qa.md'
];
const JAVASCRIPT_EXTENSIONS = new Set(['.cjs', '.js', '.mjs']);
const SKIPPED_DIRECTORIES = new Set(['.git', '.github', '.release', 'node_modules']);
const REQUIRED_LICENSE_RECORDS = [
  'assets/ar15/license.txt',
  'assets/m9/license.txt',
  'assets/soldier/license.txt',
  'assets/audio/cc-by-3.0-tabasco/LICENSE.txt',
  'assets/audio/cc0-kenney-rpg-footsteps/License.txt',
  'assets/audio/cc0-kenney-voiceover/License.txt',
  'assets/audio/cc0-zer0-sol-handgun-reload/LICENSE.txt',
  'assets/environment/polyhaven-concrete-road-barrier-02/LICENSE.txt',
  'assets/environment/polyhaven-fern-02/LICENSE.txt',
  'assets/environment/polyhaven-metal-office-desk/LICENSE.txt',
  'assets/environment/polyhaven-modular-chainlink-fence/LICENSE.txt',
  'assets/environment/polyhaven-plastic-container/LICENSE.txt',
  'assets/environment/polyhaven-power-box-01/LICENSE.txt',
  'assets/environment/polyhaven-steel-frame-shelves-01/LICENSE.txt'
];
const OPTIONAL_LOCAL_PATHS = new Set([
  // Extreme can intentionally probe this pack and retain the verified 2K maps
  // when it is absent. A real 4K pack becomes required as soon as its manifest
  // is added to the repository.
  'assets/environment/pbr-v2-4k',
  'assets/environment/pbr-v2-4k/manifest.json'
]);
const CC0_PISTOL_RELOAD = Object.freeze({
  file: 'assets/audio/cc0-zer0-sol-handgun-reload/reload.wav',
  receipt: 'assets/audio/cc0-zer0-sol-handgun-reload/ORIGINAL.sha256',
  sha256: '091399145b174ac3b2e0df245b4712a13ce85df072e37256b0fc32658718be53',
  runtimeUrl: './assets/audio/cc0-zer0-sol-handgun-reload/reload.wav'
});
const WEBGPU_LAB_PACKAGES = Object.freeze([
  Object.freeze({
    root: 'vendor/webgpu-lab/three-0.185.1',
    name: 'three',
    version: '0.185.1',
    license: 'MIT',
    registry: 'https://registry.npmjs.org/three',
    tarball: 'https://registry.npmjs.org/three/-/three-0.185.1.tgz',
    tarballSha256: 'a2143f5bf978bd3470a51024b2b6bdd581913ba8f36ff1538d433f3a95adf2df',
    npmIntegrity: 'sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg==',
    entrypoints: Object.freeze(['build/three.webgpu.js', 'build/three.tsl.js'])
  }),
  Object.freeze({
    root: 'vendor/webgpu-lab/three-mesh-bvh-0.9.13',
    name: 'three-mesh-bvh',
    version: '0.9.13',
    license: 'MIT',
    registry: 'https://registry.npmjs.org/three-mesh-bvh',
    tarball: 'https://registry.npmjs.org/three-mesh-bvh/-/three-mesh-bvh-0.9.13.tgz',
    tarballSha256: 'e626379202bfa250ce75800c07f5b9083510eb85b1bb4e7c865c647e88c1c8ad',
    npmIntegrity: 'sha512-2zRh4iTFDmiTISanSVFofIw6J92DxFSqWn2qsQTtKp2ko5Ebk/JaI/wpMqNaBJ3F0qx7/NuP9GPK4jGDX99J2Q==',
    entrypoints: Object.freeze(['src/webgpu/index.js'])
  })
]);
const WEBGPU_LAB_IMPORT_MAP = Object.freeze({
  '@specter-lab/three-webgpu': './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  '@specter-lab/three-mesh-bvh': './vendor/webgpu-lab/three-mesh-bvh-0.9.13/src/webgpu/index.js',
  three: './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  'three/webgpu': './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  'three/tsl': './vendor/webgpu-lab/three-0.185.1/build/three.tsl.js'
});
const WEBGPU_LAB_REQUIRED_FILES = Object.freeze([
  'THIRD_PARTY_SOFTWARE.md',
  'webgpu-lab.html',
  'src/experimental/webgpu-advanced-contract.js',
  'src/experimental/fsr2-2.2.1/ffx-fsr2-luminance-first-mip.wgsl',
  'src/experimental/fsr2-2.2.1/LICENSE-AMD-FSR2.txt',
  'src/experimental/fsr2-2.2.1/luminance-first-mip-reference.js',
  'src/experimental/fsr2-2.2.1/PROVENANCE.json',
  'src/webgpu-lab/browser-probe.js',
  'src/webgpu-lab/dependency-loader.js',
  'src/webgpu-lab/dependency-manifest.js',
  'src/webgpu-lab/diagnostics.js',
  'src/webgpu-lab/dispatch-receipt.js',
  'src/webgpu-lab/known-triangle-dispatch.js',
  'src/webgpu-lab/main.js',
  'src/webgpu-lab/raster-foundation-probe.js',
  'src/webgpu-lab/raster-foundation-receipt.js',
  'src/webgpu-lab/scene-bvh-cpu-oracle.js',
  'src/webgpu-lab/scene-bvh-dispatch.js',
  'src/webgpu-lab/scene-bvh-harness.html',
  'src/webgpu-lab/scene-bvh-harness.js',
  'src/webgpu-lab/scene-bvh-pack.js',
  'src/webgpu-lab/scene-bvh-probe.js',
  'src/webgpu-lab/scene-bvh-receipt.js',
  'src/webgpu-lab/temporal-input-foundation.js',
  'src/webgpu-lab/webgpu-lab.css'
]);
const FSR2_LUMINANCE_REFERENCE = Object.freeze({
  root: 'src/experimental/fsr2-2.2.1',
  version: '2.2.1',
  commit: '1680d1edd5c034f88ebbbb793d8b88f8842cf804',
  licenseSha256: '6a12d0fdb5410839473f80b5395cf9493e8c007f76faed9f3fa41ab2f273803e',
  localFiles: Object.freeze({
    'ffx-fsr2-luminance-first-mip.wgsl': Object.freeze({ bytes: 3476, sha256: '70ef24d53478da983e99f55c2ef7464ef7514ce20f40c2f977e93a70b671c9be' }),
    'LICENSE-AMD-FSR2.txt': Object.freeze({ bytes: 1165, sha256: '6a12d0fdb5410839473f80b5395cf9493e8c007f76faed9f3fa41ab2f273803e' }),
    'luminance-first-mip-reference.js': Object.freeze({ bytes: 6903, sha256: 'a9048136ef9b468342265d4d4fbe7a3a75704678a21fc10722b1adf9aa05e615' }),
    'PROVENANCE.json': Object.freeze({ bytes: 3712, sha256: '1ebbb890d1fe76dffdc46a33f82636236ee576e4ce52de0f797d67380a905b98' })
  }),
  sources: Object.freeze({
    'src/ffx-fsr2-api/shaders/ffx_fsr2_compute_luminance_pyramid.h': 'c63f1820e08dce54f9da230e46538bd39c6560a8',
    'src/ffx-fsr2-api/shaders/ffx_fsr2_common.h': '0c72aa84943e50b6806cddd6bf5c56c7d4922fe0',
    'src/ffx-fsr2-api/shaders/ffx_spd.h': '5ce24ec87cc3204b7d5e315774a892ba6fdd13b9',
    'src/ffx-fsr2-api/shaders/ffx_fsr2_compute_luminance_pyramid_pass.hlsl': '2b96636c26bb19e379fd8d6a296e6360d41b99d0'
  })
});

function fail(message) {
  throw new Error(message);
}

function toPosix(path) {
  return path.split(sep).join('/');
}

function relativeToRoot(path) {
  return toPosix(relative(ROOT, path));
}

function isInside(parent, candidate) {
  const result = relative(parent, candidate);
  return result === '' || (!result.startsWith(`..${sep}`) && result !== '..' && !isAbsolute(result));
}

function isIgnoredPath(path) {
  const firstPart = relativeToRoot(path).split('/')[0];
  return SKIPPED_DIRECTORIES.has(firstPart);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory, { skipIgnored = false } = {}) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      if (skipIgnored && isIgnoredPath(fullPath)) continue;
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  await visit(directory);
  return files.sort((a, b) => a.localeCompare(b));
}

function run(command, args, { cwd = ROOT } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => rejectPromise(error));
    child.on('close', code => {
      if (code === 0) {
        resolvePromise(stdout.trim());
      } else {
        rejectPromise(new Error(`${command} ${args.join(' ')} exited with ${code}${stderr ? `\n${stderr.trim()}` : ''}`));
      }
    });
  });
}

async function git(...args) {
  return run('git', args);
}

function stripSearchAndHash(value) {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function looksExternal(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);
}

function normalizeLocalReference(value) {
  return stripSearchAndHash(value.trim()).replace(/\\/g, '/');
}

async function assertReferenceExists(reference, source, baseDirectory, errors) {
  const localReference = normalizeLocalReference(reference);
  if (!localReference || localReference === '.' || localReference === './' || looksExternal(localReference)) return;
  const target = localReference.startsWith('/')
    ? resolve(ROOT, localReference.slice(1))
    : resolve(baseDirectory, localReference);
  if (!isInside(ROOT, target)) {
    errors.push(`${relativeToRoot(source)} escapes the repository with ${reference}`);
    return;
  }
  if (await pathExists(target)) return;
  const rootRelative = relativeToRoot(target);
  if (OPTIONAL_LOCAL_PATHS.has(rootRelative)) return;
  errors.push(`${relativeToRoot(source)} references missing local path ${reference}`);
}

async function hashFile(path, algorithm = 'sha256') {
  return new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(path);
    stream.on('error', rejectPromise);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolvePromise(hash.digest('hex')));
  });
}

async function readImageDimensions(path) {
  const data = await readFile(path);
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return [data.readUInt32BE(16), data.readUInt32BE(20)];
  }
  if (data.length >= 16 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') {
    let offset = 12;
    while (offset + 8 <= data.length) {
      const tag = data.subarray(offset, offset + 4).toString('ascii');
      const length = data.readUInt32LE(offset + 4), start = offset + 8;
      if (tag === 'VP8X' && start + 10 <= data.length) return [1 + data.readUIntLE(start + 4, 3), 1 + data.readUIntLE(start + 7, 3)];
      if (tag === 'VP8L' && start + 5 <= data.length) {
        const bits = data.readUInt32LE(start + 1);
        return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
      }
      if (tag === 'VP8 ' && start + 10 <= data.length) return [data.readUInt16LE(start + 6), data.readUInt16LE(start + 8)];
      offset = start + length + (length % 2);
    }
  }
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 <= data.length) {
      if (data[offset] !== 0xff) { offset++; continue; }
      let marker = data[offset + 1]; offset += 2;
      while (marker === 0xff && offset < data.length) marker = data[offset++];
      if (marker === 0xd8 || marker === 0xd9) continue;
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) return [data.readUInt16BE(offset + 5), data.readUInt16BE(offset + 3)];
      offset += length;
    }
  }
  return null;
}

async function validateJavaScriptSyntax(errors) {
  const sourceFiles = await listFiles(ROOT, { skipIgnored: true });
  const javascriptFiles = sourceFiles.filter(path => JAVASCRIPT_EXTENSIONS.has(extname(path)));
  for (const file of javascriptFiles) {
    try {
      await run(process.execPath, ['--check', file]);
    } catch (error) {
      errors.push(`JavaScript syntax check failed for ${relativeToRoot(file)}: ${error.message}`);
    }
  }
  return javascriptFiles.length;
}

async function validateHtmlAndCssReferences(errors) {
  const sourceFiles = await listFiles(ROOT, { skipIgnored: true });
  for (const file of sourceFiles) {
    const extension = extname(file);
    if (extension !== '.html' && extension !== '.css') continue;
    const content = await readFile(file, 'utf8');
    const references = [];
    if (extension === '.html') {
      for (const match of content.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) references.push(match[2]);
    }
    for (const match of content.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) references.push(match[2]);
    for (const reference of references) {
      await assertReferenceExists(reference, file, dirname(file), errors);
    }
  }
}

async function validateJavaScriptReferences(errors) {
  const sourceFiles = await listFiles(resolve(ROOT, 'src'));
  for (const file of sourceFiles.filter(path => extname(path) === '.js')) {
    const content = await readFile(file, 'utf8');
    const importReferences = [
      ...content.matchAll(/\bfrom\s*(["'])(.*?)\1/g),
      ...content.matchAll(/\bimport\s*(["'])(.*?)\1/g)
    ].map(match => match[2]);
    for (const reference of importReferences) {
      if (reference.startsWith('.')) await assertReferenceExists(reference, file, dirname(file), errors);
    }
    // Runtime asset URLs are normally resolved against the document URL, not the
    // module URL, so validate them from the repository's web root.
    for (const match of content.matchAll(/(["'])(\.?\/?assets\/[A-Za-z0-9_./-]+)\1/g)) {
      await assertReferenceExists(match[2], file, ROOT, errors);
    }
  }
}

async function validateServiceWorkerReferences(errors) {
  const worker = resolve(ROOT, 'service-worker.js');
  const content = await readFile(worker, 'utf8');
  for (const match of content.matchAll(/(["'])(\.\/[^"']+)\1/g)) {
    await assertReferenceExists(match[2], worker, ROOT, errors);
  }
}

function collectUris(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectUris(item, found);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'uri' && typeof item === 'string') found.push(item);
      else collectUris(item, found);
    }
  }
  return found;
}

async function validateGltfClosure(errors) {
  const assetFiles = await listFiles(resolve(ROOT, 'assets'));
  const gltfFiles = assetFiles.filter(path => extname(path).toLowerCase() === '.gltf');
  for (const gltf of gltfFiles) {
    let document;
    try {
      document = JSON.parse(await readFile(gltf, 'utf8'));
    } catch (error) {
      errors.push(`${relativeToRoot(gltf)} is not valid glTF JSON: ${error.message}`);
      continue;
    }
    for (const uri of collectUris(document)) {
      if (looksExternal(uri) || uri.startsWith('data:')) continue;
      await assertReferenceExists(uri, gltf, dirname(gltf), errors);
    }
  }
}

async function validateAssetProvenance(errors) {
  const attribution = resolve(ROOT, 'THIRD_PARTY_ASSETS.md');
  if (!(await pathExists(attribution)) || (await stat(attribution)).size === 0) {
    errors.push('THIRD_PARTY_ASSETS.md is missing or empty');
  }
  for (const record of REQUIRED_LICENSE_RECORDS) {
    const recordPath = resolve(ROOT, record);
    if (!(await pathExists(recordPath)) || (await stat(recordPath)).size === 0) {
      errors.push(`Required license record is missing or empty: ${record}`);
    }
  }

  const assetRoot = resolve(ROOT, 'assets');
  const allAssets = await listFiles(assetRoot);
  const provenanceNames = /^(?:license|credits|readme)(?:\.|$)/i;
  for (const asset of allAssets) {
    if (!MEDIA_EXTENSIONS.has(extname(asset).toLowerCase())) continue;
    let current = dirname(asset);
    let documented = false;
    while (isInside(assetRoot, current)) {
      const entries = await readdir(current, { withFileTypes: true });
      if (entries.some(entry => entry.isFile() && provenanceNames.test(entry.name))) {
        documented = true;
        break;
      }
      if (current === assetRoot) break;
      current = dirname(current);
    }
    if (!documented) errors.push(`Asset lacks a local license or provenance record: ${relativeToRoot(asset)}`);
  }
}

async function validateRecordedAudioProvenance(errors) {
  const sourcePath = resolve(ROOT, CC0_PISTOL_RELOAD.file);
  const receiptPath = resolve(ROOT, CC0_PISTOL_RELOAD.receipt);
  if (!(await pathExists(sourcePath)) || !(await pathExists(receiptPath))) {
    errors.push('CC0 pistol reload source or SHA-256 receipt is missing');
    return;
  }
  const receipt = await readFile(receiptPath, 'utf8');
  const receiptMatch = receipt.match(/^([a-f0-9]{64})\s+reload\.wav\s*$/mi);
  if (!receiptMatch) {
    errors.push('CC0 pistol reload SHA-256 receipt is malformed');
  } else if (receiptMatch[1].toLowerCase() !== CC0_PISTOL_RELOAD.sha256) {
    errors.push('CC0 pistol reload SHA-256 receipt does not retain the approved source hash');
  } else if ((await hashFile(sourcePath)) !== CC0_PISTOL_RELOAD.sha256) {
    errors.push('CC0 pistol reload source does not match its approved SHA-256 receipt');
  }

  const [main, serviceWorker] = await Promise.all([
    readFile(resolve(ROOT, 'src/main.js'), 'utf8'),
    readFile(resolve(ROOT, 'service-worker.js'), 'utf8')
  ]);
  if (!main.includes(`url:'${CC0_PISTOL_RELOAD.runtimeUrl}'`)) {
    errors.push('CC0 pistol reload source is not wired to the runtime mechanism loader');
  }
  if (!serviceWorker.includes(`'${CC0_PISTOL_RELOAD.runtimeUrl}'`)) {
    errors.push('CC0 pistol reload source is missing from the service-worker cache list');
  }
}

async function validateNonRuntimeStaging(errors) {
  const stagingRoot = resolve(ROOT, 'assets/_staging');
  if (!(await pathExists(stagingRoot))) return;
  const entries = await readdir(stagingRoot, { withFileTypes: true });
  const candidates = entries.filter(entry => entry.isDirectory());
  for (const entry of candidates) {
    const candidateRoot = resolve(stagingRoot, entry.name);
    for (const record of STAGING_REQUIRED_RECORDS) {
      const recordPath = resolve(candidateRoot, record);
      if (!(await pathExists(recordPath)) || !(await stat(recordPath)).isFile() || (await stat(recordPath)).size === 0) {
        errors.push(`Staging candidate ${entry.name} is missing a nonempty ${record} record`);
      }
    }
    const hashRecord = resolve(candidateRoot, 'ORIGINAL.sha256');
    if (await pathExists(hashRecord)) {
      const status = await readFile(hashRecord, 'utf8');
      const hasNoBinaryState = status.includes('STATUS: NO ORIGINAL BINARY OR DERIVATIVE IS STORED IN THIS DIRECTORY.');
      const hasSourceHash = /source(?:_archive(?:_or_root)?)?_sha256\s*:\s*[a-f0-9]{64}\b/i.test(status);
      if (!hasNoBinaryState && !hasSourceHash) {
        errors.push(`Staging candidate ${entry.name} must explicitly record its no-binary state or an original source SHA-256`);
      }
    }
    const licenseRecord = resolve(candidateRoot, 'LICENSE.txt');
    if (await pathExists(licenseRecord)) {
      const licenseText = await readFile(licenseRecord, 'utf8');
      const hasApprovedLicense = /(?:\bCC0(?:\s*1\.0)?\b|Creative Commons Zero|\bCC\s*BY(?:\s*[0-9.]+)?\b|Creative Commons Attribution)/i.test(licenseText);
      if (!hasApprovedLicense) {
        errors.push(`Staging candidate ${entry.name} does not explicitly declare an allowed CC0 or CC BY license`);
      }
    }
    const sourceRecord = resolve(candidateRoot, 'SOURCE.md');
    if (await pathExists(sourceRecord)) {
      const sourceText = await readFile(sourceRecord, 'utf8');
      if (!/https?:\/\/\S+/i.test(sourceText)) {
        errors.push(`Staging candidate ${entry.name} must retain at least one source URL`);
      }
    }
    const files = await listFiles(candidateRoot);
    for (const file of files) {
      if (STAGING_BINARY_EXTENSIONS.has(extname(file).toLowerCase())) {
        errors.push(`Non-runtime staging may not contain binary/media/archive files: ${relativeToRoot(file)}`);
      }
    }
  }

  // These are the only files which may be loaded by the live static page.  The
  // source catalogue and release checker may mention staging records; runtime
  // code may not import, fetch, or precache them.
  const runtimeFiles = [
    resolve(ROOT, 'index.html'),
    resolve(ROOT, 'service-worker.js'),
    ...await listFiles(resolve(ROOT, 'src'))
  ];
  for (const file of runtimeFiles) {
    if (!['.html', '.js'].includes(extname(file).toLowerCase())) continue;
    if ((await readFile(file, 'utf8')).includes('assets/_staging/')) {
      errors.push(`Runtime file may not reference non-runtime staging: ${relativeToRoot(file)}`);
    }
  }
}

async function validatePbrManifest(errors) {
  const manifestPath = resolve(ROOT, 'assets/environment/pbr-v2/manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    errors.push(`PBR manifest is invalid: ${error.message}`);
    return;
  }
  const pbrRoot = dirname(manifestPath);
  const records = [];
  for (const material of manifest.materials ?? []) {
    if (material.source && material.source !== 'procedural') records.push({ file: material.source });
    for (const map of material.maps ?? []) records.push(map);
  }
  for (const source of manifest.generatedSources ?? []) records.push(source);
  for (const artifact of manifest.qa?.artifacts ?? []) records.push(artifact);
  if (records.length === 0) {
    errors.push('PBR manifest contains no asset records');
    return;
  }
  for (const record of records) {
    if (!record.file) {
      errors.push('PBR manifest contains an asset record without a file name');
      continue;
    }
    const file = resolve(pbrRoot, record.file);
    if (!isInside(pbrRoot, file) || !(await pathExists(file))) {
      errors.push(`PBR manifest references missing file ${record.file}`);
      continue;
    }
    const metadata = await stat(file);
    if (Number.isInteger(record.bytes) && metadata.size !== record.bytes) {
      errors.push(`PBR manifest byte count mismatch for ${record.file}`);
    }
    if (record.sha256 && (await hashFile(file)) !== record.sha256) {
      errors.push(`PBR manifest SHA-256 mismatch for ${record.file}`);
    }
  }
}

async function validateLowPayloadManifest(errors) {
  const manifestPath = resolve(ROOT, 'assets/low-textures/manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    errors.push(`Low-payload texture manifest is invalid: ${error.message}`);
    return;
  }
  if (manifest.maxDimension !== 512 || !Array.isArray(manifest.records) || manifest.records.length === 0) {
    errors.push('Low-payload texture manifest must declare nonempty 512px-max records');
    return;
  }
  const expectedFiles = new Set();
  let recordedBytes = 0;
  for (const record of manifest.records) {
    if (!record?.source || !record?.file || !Array.isArray(record.dimensions)) {
      errors.push('Low-payload texture manifest contains an incomplete record');
      continue;
    }
    const source = resolve(ROOT, record.source);
    const file = resolve(ROOT, record.file);
    if (!isInside(resolve(ROOT, 'assets'), source) || !(await pathExists(source))) {
      errors.push(`Low-payload texture source is missing: ${record.source}`);
    }
    if (!isInside(resolve(ROOT, 'assets/low-textures'), file) || !(await pathExists(file))) {
      errors.push(`Low-payload texture derivative is missing: ${record.file}`);
      continue;
    }
    expectedFiles.add(file);
    const metadata = await stat(file);
    recordedBytes += metadata.size;
    if (metadata.size !== record.bytes) errors.push(`Low-payload byte count mismatch for ${record.file}`);
    if (record.sha256 && (await hashFile(file)) !== record.sha256) errors.push(`Low-payload SHA-256 mismatch for ${record.file}`);
    if (record.dimensions.some((dimension) => !Number.isInteger(dimension) || dimension < 1 || dimension > 512)) {
      errors.push(`Low-payload dimensions exceed the 512px contract for ${record.file}`);
    }
  }
  if (recordedBytes !== manifest.runtimeBytes) errors.push('Low-payload texture manifest runtime byte total is incorrect');
  const derivatives = (await listFiles(resolve(ROOT, 'assets/low-textures')))
    .filter((file) => MEDIA_EXTENSIONS.has(extname(file).toLowerCase()));
  for (const file of derivatives) if (!expectedFiles.has(file)) errors.push(`Low-payload tree contains an unrecorded derivative: ${relativeToRoot(file)}`);

  const requiredEnvironmentMaps = [
    'concrete-albedo.webp', 'concrete-normal.webp', 'concrete-orm.webp',
    'painted-metal-albedo.webp', 'painted-metal-normal.webp', 'painted-metal-orm.webp',
    'diamond-plate-albedo.webp', 'diamond-plate-normal.webp', 'diamond-plate-orm.webp',
    'asphalt-albedo.webp', 'asphalt-normal.webp', 'asphalt-orm.webp',
    'utility-panel-albedo.webp', 'utility-panel-normal.webp', 'utility-panel-orm.webp',
    'vehicle-paint-albedo.webp', 'vehicle-paint-orm.webp',
    'vehicle-rubber-albedo.webp', 'vehicle-rubber-normal.webp', 'vehicle-rubber-orm.webp',
    'grass-soil-albedo.webp', 'grass-soil-normal.webp', 'grass-soil-orm.webp'
  ];
  const lowPbrRoot = resolve(ROOT, 'assets/low-textures/environment/pbr-v2');
  for (const filename of requiredEnvironmentMaps) {
    if (!(await pathExists(resolve(lowPbrRoot, filename)))) errors.push(`Low-payload PBR map is missing: ${filename}`);
  }
}

async function validateMediumTextureManifest(errors) {
  const manifestPath = resolve(ROOT, 'assets/medium-textures/manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    errors.push(`Medium texture manifest is invalid: ${error.message}`);
    return;
  }
  if (manifest.maxDimension !== 1024 || !Array.isArray(manifest.records) || manifest.records.length === 0) {
    errors.push('Medium texture manifest must declare nonempty 1024px-max records');
    return;
  }
  const expectedFiles = new Set();
  let recordedBytes = 0;
  for (const record of manifest.records) {
    if (!record?.source || !record?.file || !Array.isArray(record.dimensions)) {
      errors.push('Medium texture manifest contains an incomplete record');
      continue;
    }
    const source = resolve(ROOT, record.source);
    const file = resolve(ROOT, record.file);
    if (!isInside(resolve(ROOT, 'assets'), source) || !(await pathExists(source))) errors.push(`Medium texture source is missing: ${record.source}`);
    if (!isInside(resolve(ROOT, 'assets/medium-textures'), file) || !(await pathExists(file))) {
      errors.push(`Medium texture derivative is missing: ${record.file}`);
      continue;
    }
    expectedFiles.add(file);
    recordedBytes += (await stat(file)).size;
    if ((await stat(file)).size !== record.bytes) errors.push(`Medium texture byte count mismatch for ${record.file}`);
    if (record.sha256 && (await hashFile(file)) !== record.sha256) errors.push(`Medium texture SHA-256 mismatch for ${record.file}`);
    if (record.dimensions.some((dimension) => !Number.isInteger(dimension) || dimension < 1 || dimension > 1024)) errors.push(`Medium texture dimensions exceed 1024px for ${record.file}`);
  }
  if (recordedBytes !== manifest.runtimeBytes) errors.push('Medium texture manifest runtime byte total is incorrect');
  for (const file of (await listFiles(resolve(ROOT, 'assets/medium-textures'))).filter((entry) => MEDIA_EXTENSIONS.has(extname(entry).toLowerCase()))) {
    if (!expectedFiles.has(file)) errors.push(`Medium texture tree contains an unrecorded derivative: ${relativeToRoot(file)}`);
  }
}

async function validateOptionalNativePbrManifest(errors) {
  const manifestPath = resolve(ROOT, 'assets/environment/pbr-v2-4k/manifest.json');
  if (!(await pathExists(manifestPath))) return;
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    errors.push(`Native 4K PBR manifest is invalid: ${error.message}`);
    return;
  }
  const dimensions = manifest?.runtimeFormat?.dimensions;
  if (!Array.isArray(dimensions) || dimensions.length < 2 || Math.min(...dimensions.map(Number)) < 4096) {
    errors.push('Native 4K PBR manifest must declare dimensions of at least 4096px');
    return;
  }
  const mapRecords = new Map((manifest.materials ?? []).flatMap((material) => material.maps ?? [])
    .filter((record) => record?.file)
    .map((record) => [record.file, record]));
  for (const filename of [
    'concrete-albedo.webp', 'concrete-normal.webp', 'concrete-orm.webp',
    'painted-metal-albedo.webp', 'painted-metal-normal.webp', 'painted-metal-orm.webp',
    'diamond-plate-albedo.webp', 'diamond-plate-normal.webp', 'diamond-plate-orm.webp',
    'asphalt-albedo.webp', 'asphalt-normal.webp', 'asphalt-orm.webp',
    'utility-panel-albedo.webp', 'utility-panel-normal.webp', 'utility-panel-orm.webp',
    'vehicle-paint-albedo.webp', 'vehicle-paint-orm.webp',
    'vehicle-rubber-albedo.webp', 'vehicle-rubber-normal.webp', 'vehicle-rubber-orm.webp',
    'grass-soil-albedo.webp', 'grass-soil-normal.webp', 'grass-soil-orm.webp'
  ]) {
    const record = mapRecords.get(filename);
    if (!record) {
      errors.push(`Native 4K PBR manifest is missing ${filename}`);
      continue;
    }
    const mapDimensions = record.dimensions;
    if (!Array.isArray(mapDimensions) || mapDimensions.length < 2 || Math.min(...mapDimensions.map(Number)) < 4096) {
      errors.push(`Native 4K PBR map must declare dimensions of at least 4096px: ${filename}`);
    }
    if (!Number.isFinite(Number(record.bytes)) || Number(record.bytes) < 1) errors.push(`Native 4K PBR map has no valid byte count: ${filename}`);
    if (!/^[a-f0-9]{64}$/i.test(String(record.sha256 ?? ''))) errors.push(`Native 4K PBR map has no valid SHA-256: ${filename}`);
    const mapPath = resolve(dirname(manifestPath), filename);
    if (!(await pathExists(mapPath))) {
      errors.push(`Native 4K PBR map is missing from the repository: ${filename}`);
      continue;
    }
    const metadata = await stat(mapPath);
    if (metadata.size !== Number(record.bytes)) errors.push(`Native 4K PBR byte count mismatch: ${filename}`);
    if ((await hashFile(mapPath)) !== String(record.sha256).toLowerCase()) errors.push(`Native 4K PBR SHA-256 mismatch: ${filename}`);
    const actualDimensions = await readImageDimensions(mapPath);
    if (!actualDimensions || Math.min(...actualDimensions) < 4096) errors.push(`Native 4K PBR image is not a decodable 4096px-or-greater map: ${filename}`);
  }
}

async function validateForestFoliagePolicy(errors) {
  const mainPath = resolve(ROOT, 'src/main.js');
  const worldPath = resolve(ROOT, 'src/world-overhaul.js');
  const workerPath = resolve(ROOT, 'service-worker.js');
  const alphaPath = resolve(ROOT, 'assets/environment/polyhaven-fern-02/textures/fern_02_alpha_4k.png');
  const heroRoot = resolve(ROOT, 'assets/environment/polyhaven-fir-sapling-runtime');
  const heroManifestPath = resolve(heroRoot, 'manifest.json');
  const fenceRoot = resolve(ROOT, 'assets/environment/polyhaven-modular-chainlink-fence');
  const fenceManifestPath = resolve(fenceRoot, 'manifest.json');
  const deskRoot = resolve(ROOT, 'assets/environment/polyhaven-metal-office-desk');
  const deskManifestPath = resolve(deskRoot, 'manifest.json');
  const generatedCardFiles = [
    'assets/environment/generated/douglas-fir-card-v2.png',
    'assets/environment/generated/douglas-fir-card-v2-normal.png',
    'assets/environment/generated/douglas-fir-card-v2-roughness.png'
  ];
  const [main, world, worker] = await Promise.all([readFile(mainPath, 'utf8'), readFile(worldPath, 'utf8'), readFile(workerPath, 'utf8')]);

  if (!main.includes('missionAssetsReady') || !main.includes('loadForestFernAsset')) {
    errors.push('Forest foliage must wait until required mission assets are ready.');
  }
  if (!main.includes("['high','4k-preferred'].includes(preset.textureTier)") || !main.includes('fern_02_alpha_4k.png')) {
    errors.push('Raw 4K Forest Fern foliage must retain its High/4K texture-tier guard and official alpha mask.');
  }
  if (!main.includes('loadHighTierTreeCards') || !main.includes('douglas-fir-card-v2-normal.png')) {
    errors.push('High-tier forest cards must retain their albedo, normal, and roughness loading path.');
  }
  for (const file of generatedCardFiles) {
    if (!(await pathExists(resolve(ROOT, file)))) errors.push(`Generated Douglas-fir card asset is missing: ${file}`);
    if (!worker.includes(`./${file}`)) errors.push(`Service worker must track the demand-loaded Douglas-fir card: ${file}`);
  }
  if (worker.includes('polyhaven-fern-02/')) {
    errors.push('Fern 02 must not be precached: it is an optional high-tier stream.');
  }
  if (worker.includes('polyhaven-fir-sapling-runtime/')) {
    errors.push('CC0 Fir Sapling hero assets must not be precached: they are optional High-tier streams.');
  }
  if (worker.includes('polyhaven-modular-chainlink-fence/')) {
    errors.push('CC0 modular chain-link fence assets must not be precached: they are optional High-tier streams.');
  }
  if (worker.includes('polyhaven-metal-office-desk/')) {
    errors.push('CC0 metal office desk assets must not be precached: they are optional High-tier streams.');
  }
  if (!(await pathExists(alphaPath))) {
    errors.push('Official Fern 02 alpha mask is missing.');
  } else if ((await hashFile(alphaPath, 'md5')) !== '520e194db987df18fd73b49d979ada0c') {
    errors.push('Official Fern 02 alpha-mask MD5 does not match Poly Haven metadata.');
  }

  if (!(await pathExists(heroManifestPath))) {
    errors.push('CC0 Fir Sapling runtime manifest is missing.');
    return;
  }
  let heroManifest;
  try {
    heroManifest = JSON.parse(await readFile(heroManifestPath, 'utf8'));
  } catch (error) {
    errors.push(`CC0 Fir Sapling runtime manifest is invalid: ${error.message}`);
    return;
  }
  if (heroManifest?.source?.license !== 'CC0-1.0' || !Array.isArray(heroManifest?.source?.authors) || heroManifest.source.authors.length < 2) {
    errors.push('CC0 Fir Sapling runtime manifest must retain its CC0 license and both Poly Haven creator credits.');
  }
  const inputMd5 = heroManifest?.source?.inputMd5 ?? {};
  for (const [name, expectedMd5] of Object.entries({
    'fir_sapling_1k.gltf': '7b1a5ceae7be69954510b5a5c719b4fb',
    'fir_sapling.bin': 'b329143a90d95201891afc52daeb9698'
  })) {
    if (String(inputMd5[name] ?? '').toLowerCase() !== expectedMd5) errors.push(`CC0 Fir Sapling source MD5 is missing or incorrect: ${name}`);
  }
  const lod0 = Number(heroManifest?.conversion?.lod0?.triangles);
  const lod1 = Number(heroManifest?.conversion?.lod1?.triangles);
  if (!Number.isFinite(lod0) || lod0 < 10000 || lod0 > 160000) errors.push('CC0 Fir Sapling LOD0 must remain a bounded authored high-detail derivative.');
  if (!Number.isFinite(lod1) || lod1 < 1000 || lod1 >= lod0 || lod1 > 45000) errors.push('CC0 Fir Sapling LOD1 must be a materially reduced geometry derivative.');
  if (heroManifest?.conversion?.lod2?.type !== 'shared project PBR crossed-card impostor') errors.push('CC0 Fir Sapling must retain the shared PBR card LOD2 fallback.');
  const outputRecords = heroManifest?.outputs ?? {};
  for (const [relativePath, record] of Object.entries(outputRecords)) {
    const outputPath = resolve(heroRoot, relativePath);
    if (!(await pathExists(outputPath))) {
      errors.push(`CC0 Fir Sapling runtime output is missing: ${relativePath}`);
      continue;
    }
    const metadata = await stat(outputPath);
    if (metadata.size !== Number(record?.bytes)) errors.push(`CC0 Fir Sapling output byte count mismatch: ${relativePath}`);
    if ((await hashFile(outputPath)) !== String(record?.sha256 ?? '').toLowerCase()) errors.push(`CC0 Fir Sapling output SHA-256 mismatch: ${relativePath}`);
  }
  for (const required of ['fir_sapling_lod0.gltf', 'fir_sapling_lod1.gltf', 'README.md', 'LICENSE.txt']) {
    if (!(await pathExists(resolve(heroRoot, required)))) errors.push(`CC0 Fir Sapling runtime record is missing: ${required}`);
  }
  if (!main.includes('loadForestHeroFirAssets') || !main.includes('forestHeroFirsEnabledForPreset')) {
    errors.push('CC0 Fir Sapling hero assets must remain lazy-loaded behind the High vegetation gate.');
  }
  if (!world.includes('installHeroSaplings') || !world.includes('new THREE.LOD()') || !world.includes('cc0-fir-sapling-hero-')) {
    errors.push('Forest world must retain the CC0 Fir Sapling LOD installation path.');
  }

  if (!(await pathExists(fenceManifestPath))) {
    errors.push('CC0 modular chain-link fence manifest is missing.');
    return;
  }
  let fenceManifest;
  try {
    fenceManifest = JSON.parse(await readFile(fenceManifestPath, 'utf8'));
  } catch (error) {
    errors.push(`CC0 modular chain-link fence manifest is invalid: ${error.message}`);
    return;
  }
  if (fenceManifest?.source?.license !== 'CC0-1.0' || !Array.isArray(fenceManifest?.source?.authors) || fenceManifest.source.authors.length < 2) {
    errors.push('CC0 modular chain-link fence manifest must retain its license and both Poly Haven credits.');
  }
  if (Number(fenceManifest?.source?.runtimePanelTriangles) !== 3054 || Number(fenceManifest?.source?.runtimePanelCount) !== 8) {
    errors.push('CC0 modular chain-link fence manifest must retain the bounded 3,054-triangle eight-panel runtime budget.');
  }
  if (fenceManifest?.runtime?.optional !== true || fenceManifest?.runtime?.lazyAfterMissionReady !== true || fenceManifest?.runtime?.precache !== false) {
    errors.push('CC0 modular chain-link fence must remain an optional, post-readiness, non-precached High-tier detail.');
  }
  for (const [relativePath, record] of Object.entries(fenceManifest?.files ?? {})) {
    const fenceFile = resolve(fenceRoot, relativePath);
    if (!(await pathExists(fenceFile))) {
      errors.push(`CC0 modular chain-link fence runtime file is missing: ${relativePath}`);
      continue;
    }
    const metadata = await stat(fenceFile);
    if (metadata.size !== Number(record?.bytes)) errors.push(`CC0 modular chain-link fence byte count mismatch: ${relativePath}`);
    if ((await hashFile(fenceFile, 'md5')) !== String(record?.md5 ?? '').toLowerCase()) errors.push(`CC0 modular chain-link fence MD5 mismatch: ${relativePath}`);
    if ((await hashFile(fenceFile)) !== String(record?.sha256 ?? '').toLowerCase()) errors.push(`CC0 modular chain-link fence SHA-256 mismatch: ${relativePath}`);
  }
  if (!main.includes('loadPerimeterFenceAsset') || !main.includes('perimeterFenceDetailEnabledForPreset') || !main.includes('modular_chainlink_fence_double')) {
    errors.push('CC0 modular chain-link fence must remain lazy-loaded from the bounded authored double-panel mesh.');
  }

  if (!(await pathExists(deskManifestPath))) {
    errors.push('CC0 metal office desk manifest is missing.');
    return;
  }
  let deskManifest;
  try {
    deskManifest = JSON.parse(await readFile(deskManifestPath, 'utf8'));
  } catch (error) {
    errors.push(`CC0 metal office desk manifest is invalid: ${error.message}`);
    return;
  }
  if (deskManifest?.source?.license !== 'CC0-1.0' || !Array.isArray(deskManifest?.source?.authors) || deskManifest.source.authors.length !== 1 || !String(deskManifest.source.authors[0]).includes('Ulan Cabanilla')) {
    errors.push('CC0 metal office desk manifest must retain the Poly Haven CC0 license and Ulan Cabanilla credit.');
  }
  if (Number(deskManifest?.source?.sourceTriangles) !== 6898 || Number(deskManifest?.source?.runtimeDeskCount) !== 3) {
    errors.push('CC0 metal office desk manifest must retain the bounded 6,898-triangle three-desk runtime budget.');
  }
  if (deskManifest?.runtime?.optional !== true || deskManifest?.runtime?.lazyAfterMissionReady !== true || deskManifest?.runtime?.precache !== false) {
    errors.push('CC0 metal office desks must remain optional, post-readiness, non-precached High-tier dressing.');
  }
  for (const [relativePath, record] of Object.entries(deskManifest?.files ?? {})) {
    const deskFile = resolve(deskRoot, relativePath);
    if (!(await pathExists(deskFile))) {
      errors.push(`CC0 metal office desk runtime file is missing: ${relativePath}`);
      continue;
    }
    const metadata = await stat(deskFile);
    if (metadata.size !== Number(record?.bytes)) errors.push(`CC0 metal office desk byte count mismatch: ${relativePath}`);
    if ((await hashFile(deskFile, 'md5')) !== String(record?.md5 ?? '').toLowerCase()) errors.push(`CC0 metal office desk MD5 mismatch: ${relativePath}`);
    if ((await hashFile(deskFile)) !== String(record?.sha256 ?? '').toLowerCase()) errors.push(`CC0 metal office desk SHA-256 mismatch: ${relativePath}`);
  }
  if (!main.includes('loadOfficeDeskAsset') || !main.includes('officeDeskDetailEnabledForPreset') || !main.includes('setProceduralDeskVisibility')) {
    errors.push('CC0 metal office desks must remain lazy-loaded High-tier replacements for the procedural facility desks.');
  }
}

function sameSortedStrings(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.every((value, index) => value === sortedExpected[index]);
}

async function validateVendoredWebgpuPackage(expected, errors) {
  const packageRoot = resolve(ROOT, expected.root);
  const receiptPath = resolve(packageRoot, 'SHA256_MANIFEST.json');
  if (!(await pathExists(receiptPath))) {
    errors.push(`WebGPU lab dependency receipt is missing: ${expected.root}/SHA256_MANIFEST.json`);
    return;
  }

  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  } catch (error) {
    errors.push(`WebGPU lab dependency receipt is invalid JSON (${expected.name}): ${error.message}`);
    return;
  }

  if (receipt.schema !== 'specter-vendored-npm-closure/v1') {
    errors.push(`WebGPU lab ${expected.name} receipt has an unsupported schema`);
  }
  for (const field of ['name', 'version', 'license', 'registry', 'tarball', 'tarballSha256', 'npmIntegrity']) {
    if (receipt.package?.[field] !== expected[field]) {
      errors.push(`WebGPU lab ${expected.name} receipt ${field} does not match the pinned release contract`);
    }
  }
  if (!sameSortedStrings(receipt.entrypoints, expected.entrypoints)) {
    errors.push(`WebGPU lab ${expected.name} receipt entrypoints do not match the pinned module closure`);
  }
  if (!Array.isArray(receipt.files) || receipt.files.length === 0) {
    errors.push(`WebGPU lab ${expected.name} receipt has no file records`);
    return;
  }

  const recordedPaths = new Set();
  for (const record of receipt.files) {
    const relativePath = record?.path;
    if (typeof relativePath !== 'string' || !relativePath || relativePath.includes('\\')) {
      errors.push(`WebGPU lab ${expected.name} receipt contains an unsafe or invalid file path`);
      continue;
    }
    const file = resolve(packageRoot, relativePath);
    if (!isInside(packageRoot, file) || file === packageRoot || toPosix(relative(packageRoot, file)) !== relativePath) {
      errors.push(`WebGPU lab ${expected.name} receipt path escapes or aliases its package root: ${relativePath}`);
      continue;
    }
    if (recordedPaths.has(relativePath)) {
      errors.push(`WebGPU lab ${expected.name} receipt repeats ${relativePath}`);
      continue;
    }
    recordedPaths.add(relativePath);
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 || !/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) {
      errors.push(`WebGPU lab ${expected.name} receipt metadata is invalid for ${relativePath}`);
      continue;
    }
    if (!(await pathExists(file)) || !(await stat(file)).isFile()) {
      errors.push(`WebGPU lab ${expected.name} closure is missing ${relativePath}`);
      continue;
    }
    const metadata = await stat(file);
    if (metadata.size !== record.bytes) {
      errors.push(`WebGPU lab ${expected.name} byte count mismatch for ${relativePath}`);
    }
    if ((await hashFile(file)) !== record.sha256) {
      errors.push(`WebGPU lab ${expected.name} SHA-256 mismatch for ${relativePath}`);
    }
  }

  const actualPaths = (await listFiles(packageRoot))
    .map(file => toPosix(relative(packageRoot, file)))
    .filter(path => path !== 'SHA256_MANIFEST.json');
  if (!sameSortedStrings(actualPaths, [...recordedPaths])) {
    const unrecorded = actualPaths.filter(path => !recordedPaths.has(path));
    const missing = [...recordedPaths].filter(path => !actualPaths.includes(path));
    if (unrecorded.length) errors.push(`WebGPU lab ${expected.name} contains unrecorded file(s): ${unrecorded.join(', ')}`);
    if (missing.length) errors.push(`WebGPU lab ${expected.name} receipt names missing file(s): ${missing.join(', ')}`);
  }
  for (const entrypoint of expected.entrypoints) {
    if (!recordedPaths.has(entrypoint)) errors.push(`WebGPU lab ${expected.name} entrypoint is absent from its receipt: ${entrypoint}`);
  }

  try {
    const packageDocument = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
    if (packageDocument.name !== expected.name || packageDocument.version !== expected.version || packageDocument.license !== expected.license) {
      errors.push(`WebGPU lab ${expected.name} package metadata does not match its exact version and MIT license`);
    }
  } catch (error) {
    errors.push(`WebGPU lab ${expected.name} package metadata is unreadable: ${error.message}`);
  }
  try {
    const license = await readFile(resolve(packageRoot, 'LICENSE'), 'utf8');
    if (!/MIT License/i.test(license) || !/Permission is hereby granted/i.test(license)) {
      errors.push(`WebGPU lab ${expected.name} does not retain its MIT license text`);
    }
  } catch (error) {
    errors.push(`WebGPU lab ${expected.name} license is unreadable: ${error.message}`);
  }
}

async function validateWebgpuLabReleaseClosure(errors) {
  for (const required of WEBGPU_LAB_REQUIRED_FILES) {
    const file = resolve(ROOT, required);
    if (!(await pathExists(file)) || !(await stat(file)).isFile()) {
      errors.push(`WebGPU lab release file is missing: ${required}`);
    }
  }
  for (const dependency of WEBGPU_LAB_PACKAGES) {
    await validateVendoredWebgpuPackage(dependency, errors);
  }

  const softwareNoticePath = resolve(ROOT, 'THIRD_PARTY_SOFTWARE.md');
  if (await pathExists(softwareNoticePath)) {
    const softwareNotice = await readFile(softwareNoticePath, 'utf8');
    for (const dependency of WEBGPU_LAB_PACKAGES) {
      if (!softwareNotice.includes(dependency.version) || !softwareNotice.includes(`${dependency.root}/package.json`)) {
        errors.push(`THIRD_PARTY_SOFTWARE.md must retain the exact ${dependency.name} version and local evidence path`);
      }
    }
    if (!softwareNotice.includes('MIT') || !softwareNotice.includes('service worker does not install-time')) {
      errors.push('THIRD_PARTY_SOFTWARE.md must retain the MIT notice and demand-loaded service-worker boundary');
    }
  }

  const htmlPath = resolve(ROOT, 'webgpu-lab.html');
  if (!(await pathExists(htmlPath))) return;
  const html = await readFile(htmlPath, 'utf8');
  const importMaps = [...html.matchAll(/<script\b[^>]*\btype\s*=\s*(["'])importmap\1[^>]*>([\s\S]*?)<\/script>/gi)];
  if (importMaps.length !== 1) {
    errors.push('WebGPU lab HTML must contain exactly one inline import map');
  } else {
    try {
      const imports = JSON.parse(importMaps[0][2]).imports;
      if (!imports || !sameSortedStrings(Object.keys(imports), Object.keys(WEBGPU_LAB_IMPORT_MAP))) {
        errors.push('WebGPU lab import map specifiers do not match the pinned local dependency graph');
      } else {
        for (const [specifier, expectedPath] of Object.entries(WEBGPU_LAB_IMPORT_MAP)) {
          if (imports[specifier] !== expectedPath || looksExternal(imports[specifier])) {
            errors.push(`WebGPU lab import ${specifier} must resolve to its pinned same-origin module`);
          }
        }
      }
    } catch (error) {
      errors.push(`WebGPU lab import map is invalid JSON: ${error.message}`);
    }
  }
  if (/https?:\/\/|(?:src|href)\s*=\s*(["'])\/\//i.test(html)) {
    errors.push('WebGPU lab HTML contains an external network dependency');
  }
  if (!/<meta\b[^>]*name\s*=\s*(["'])robots\1[^>]*content\s*=\s*(["'])noindex,\s*nofollow\2/i.test(html)) {
    errors.push('WebGPU lab HTML must remain noindex and nofollow while experimental');
  }
  if (html.includes('src/main.js')) {
    errors.push('WebGPU lab HTML must not load the shipped game entry point');
  }

  const labSourceRoot = resolve(ROOT, 'src/webgpu-lab');
  if (await pathExists(labSourceRoot)) {
    for (const file of (await listFiles(labSourceRoot)).filter(path => extname(path) === '.js')) {
      const source = await readFile(file, 'utf8');
      if (/https?:\/\/|\/\/(?:cdn|unpkg|jsdelivr|esm\.sh|skypack|cdnjs)/i.test(source)) {
        errors.push(`WebGPU lab runtime contains an external dependency URL: ${relativeToRoot(file)}`);
      }
      const imports = [
        ...source.matchAll(/\bfrom\s*(["'])(.*?)\1/g),
        ...source.matchAll(/\bimport\s*(["'])(.*?)\1/g)
      ].map(match => match[2]);
      for (const reference of imports) {
        if (!reference.startsWith('.') && !(reference in WEBGPU_LAB_IMPORT_MAP)) {
          errors.push(`${relativeToRoot(file)} imports unpinned WebGPU lab dependency ${reference}`);
        }
      }
    }
  }

  const gameMain = await readFile(resolve(ROOT, 'src/main.js'), 'utf8');
  if (gameMain.includes('webgpu-lab/') || gameMain.includes('experimental/webgpu-advanced-contract')) {
    errors.push('The shipped game must not import the isolated WebGPU lab or its staged renderer contract');
  }
  const worker = await readFile(resolve(ROOT, 'service-worker.js'), 'utf8');
  for (const arrayName of ['REQUIRED_SHELL_URLS', 'OPTIONAL_PRECACHE_URLS']) {
    const list = worker.match(new RegExp(`const ${arrayName} = \\[([\\s\\S]*?)\\n\\];`));
    if (!list) {
      errors.push(`Service worker ${arrayName} could not be audited for WebGPU lab precaching`);
      continue;
    }
    if (/webgpu-lab|vendor\/webgpu-lab|src\/experimental\//i.test(list[1])) {
      errors.push(`Service worker ${arrayName} must not precache the experimental WebGPU lab or its vendored modules`);
    }
  }

  const fsrRoot = resolve(ROOT, FSR2_LUMINANCE_REFERENCE.root);
  for (const [relativePath, expected] of Object.entries(FSR2_LUMINANCE_REFERENCE.localFiles)) {
    const file = resolve(fsrRoot, relativePath);
    try {
      const metadata = await stat(file);
      if (metadata.size !== expected.bytes || (await hashFile(file)) !== expected.sha256) {
        errors.push(`The staged FSR 2 local receipt drifted: ${relativePath}`);
      }
    } catch (error) {
      errors.push(`The staged FSR 2 local file is unreadable (${relativePath}): ${error.message}`);
    }
  }
  try {
    const provenance = JSON.parse(await readFile(resolve(fsrRoot, 'PROVENANCE.json'), 'utf8'));
    if (provenance.upstream?.version !== FSR2_LUMINANCE_REFERENCE.version
      || provenance.upstream?.commit !== FSR2_LUMINANCE_REFERENCE.commit
      || provenance.upstream?.license !== 'MIT'
      || provenance.runtimeIntegrated !== false
      || provenance.representsCompleteLuminancePyramid !== false
      || provenance.representsCompleteFsr2 !== false) {
      errors.push('The staged FSR 2 luminance provenance must stay pinned, MIT, isolated, and explicitly incomplete');
    }
    const foundSources = new Map((provenance.upstream?.sources || []).map(source => [source.path, source.gitBlobSha1]));
    for (const [path, gitBlobSha1] of Object.entries(FSR2_LUMINANCE_REFERENCE.sources)) {
      if (foundSources.get(path) !== gitBlobSha1) errors.push(`The staged FSR 2 source receipt drifted: ${path}`);
    }
  } catch (error) {
    errors.push(`The staged FSR 2 provenance is unreadable: ${error.message}`);
  }
  try {
    const license = resolve(fsrRoot, 'LICENSE-AMD-FSR2.txt');
    if ((await hashFile(license)) !== FSR2_LUMINANCE_REFERENCE.licenseSha256) {
      errors.push('The staged AMD FSR 2 MIT notice does not match the pinned upstream license');
    }
  } catch (error) {
    errors.push(`The staged AMD FSR 2 MIT notice is unreadable: ${error.message}`);
  }
  try {
    const shader = await readFile(resolve(fsrRoot, 'ffx-fsr2-luminance-first-mip.wgsl'), 'utf8');
    if ((shader.match(/@compute\b/g) || []).length !== 1
      || !shader.includes('FSR2_EPSILON: f32 = 1.0e-3')
      || !shader.includes('vec3<f32>(0.2126, 0.7152, 0.0722)')) {
      errors.push('The staged FSR 2 first-mip WGSL arithmetic or bounded entry point drifted');
    }
  } catch (error) {
    errors.push(`The staged FSR 2 first-mip WGSL is unreadable: ${error.message}`);
  }
}

async function validateRelease() {
  const errors = [];
  const javascriptCount = await validateJavaScriptSyntax(errors);
  await validateHtmlAndCssReferences(errors);
  await validateJavaScriptReferences(errors);
  await validateServiceWorkerReferences(errors);
  await validateGltfClosure(errors);
  await validateAssetProvenance(errors);
  await validateRecordedAudioProvenance(errors);
  await validateNonRuntimeStaging(errors);
  await validateForestFoliagePolicy(errors);
  await validatePbrManifest(errors);
  await validateLowPayloadManifest(errors);
  await validateMediumTextureManifest(errors);
  await validateOptionalNativePbrManifest(errors);
  await validateWebgpuLabReleaseClosure(errors);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    fail(`Release validation failed with ${errors.length} issue(s).`);
  }
  console.log(`Release validation passed: ${javascriptCount} JavaScript file(s), local references, glTF closure, licenses, non-runtime staging policy, forest foliage policy, PBR manifests, and the isolated WebGPU lab dependency closure verified.`);
}

function valueForArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value`);
  return value;
}

function safeReleaseVersion() {
  const supplied = valueForArgument('--version') ?? process.env.RELEASE_VERSION ?? process.env.GITHUB_SHA;
  if (!supplied) return 'local';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(supplied)) {
    fail(`Release version must be a safe filename segment; received ${supplied}`);
  }
  return supplied;
}

async function copyDeployableTree() {
  await rm(PAGES_ROOT, { recursive: true, force: true });
  await mkdir(DOWNLOAD_ROOT, { recursive: true });
  for (const path of DEPLOYABLE_PATHS) {
    const source = resolve(ROOT, path);
    if (!(await pathExists(source))) fail(`Cannot package missing deployable path ${path}`);
    await cp(source, resolve(PAGES_ROOT, path), { recursive: true });
  }
}

async function gitMetadata() {
  const commit = await git('rev-parse', 'HEAD');
  const committedAt = await git('log', '-1', '--format=%cI');
  return { commit, committedAt };
}

async function requireCommittedReleaseTree() {
  // The ZIP is deliberately built with git archive so it has a stable,
  // reproducible repository-root layout. That only represents the tested
  // source tree when there are no tracked or untracked release changes left in
  // the worktree. Refuse instead of attaching an old HEAD archive to a newer
  // Pages copy or release label.
  const status = await git('status', '--porcelain=v1', '--untracked-files=all');
  if (!status) return;
  const entries = status.split(/\r?\n/).filter(Boolean);
  const preview = entries.slice(0, 8).join(', ');
  fail(`Refusing to package a dirty worktree: commit the verified release tree first (${preview}${entries.length > 8 ? ', …' : ''}).`);
}

async function githubRepositoryUrl() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    const server = process.env.GITHUB_SERVER_URL?.replace(/\/$/, '') || 'https://github.com';
    return `${server}/${repository}`;
  }
  try {
    const origin = await git('remote', 'get-url', 'origin');
    const match = origin.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/i);
    if (match) return `https://github.com/${match[1]}`;
  } catch {
    // Local package checks can still describe the verified archive without a remote.
  }
  return null;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function packageRelease() {
  const version = safeReleaseVersion();
  await requireCommittedReleaseTree();
  const { commit, committedAt } = await gitMetadata();
  const archiveName = `specter-blacksite-${version}.zip`;
  const notesName = `specter-blacksite-${version}-release-notes.md`;
  const archivePath = resolve(ARTIFACTS_ROOT, archiveName);
  const notesPath = resolve(ARTIFACTS_ROOT, notesName);

  await rm(ARTIFACTS_ROOT, { recursive: true, force: true });
  await mkdir(ARTIFACTS_ROOT, { recursive: true });
  await copyDeployableTree();
  await git('archive', '--format=zip', `--output=${archivePath}`, 'HEAD');
  const archiveSha256 = await hashFile(archivePath);
  const repositoryUrl = await githubRepositoryUrl();
  const releaseTag = `build-${commit}`;
  const releasePage = repositoryUrl ? `${repositoryUrl}/releases/tag/${releaseTag}` : null;
  const latestRelease = repositoryUrl ? `${repositoryUrl}/releases/latest` : null;
  const releaseAsset = repositoryUrl ? `${repositoryUrl}/releases/download/${releaseTag}/${archiveName}` : null;
  const sourceArchive = repositoryUrl ? `${repositoryUrl}/archive/${commit}.zip` : null;
  const notes = [
    '# SPECTER: Blacksite release',
    '',
    `- Version: \`${version}\``,
    `- Commit: \`${commit}\``,
    `- Commit timestamp: ${committedAt}`,
    `- Archive: ${archiveName}`,
    `- SHA-256: \`${archiveSha256}\``,
    '',
    'This release passed JavaScript syntax, local asset-reference, glTF dependency, local license/provenance, PBR manifest integrity, and isolated WebGPU lab dependency-closure checks before packaging.'
  ].join('\n');
  await writeFile(notesPath, `${notes}\n`);
  const index = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SPECTER release ${escapeHtml(version)}</title>
<main>
  <h1>SPECTER: Blacksite release</h1>
  <p>Version <code>${escapeHtml(version)}</code></p>
  <ul>
    ${releaseAsset ? `<li><a href="${escapeHtml(releaseAsset)}">Download the verified replacement ZIP</a></li>` : ''}
    ${latestRelease ? `<li><a href="${escapeHtml(latestRelease)}">View the latest GitHub release</a></li>` : ''}
    ${sourceArchive ? `<li><a href="${escapeHtml(sourceArchive)}">Download the matching source snapshot</a></li>` : ''}
  </ul>
</main>
</html>
`;
  await writeFile(resolve(DOWNLOAD_ROOT, 'index.html'), index);
  const manifest = {
    schemaVersion: 1,
    version,
    commit,
    committedAt,
    releaseTag,
    archive: `artifacts/${archiveName}`,
    archiveSha256,
    releaseNotes: `artifacts/${notesName}`,
    releasePage,
    latestRelease,
    releaseAsset,
    sourceArchive,
    archiveContents: 'Repository files are stored at the ZIP root; no enclosing project directory is added.'
  };
  await writeFile(resolve(DOWNLOAD_ROOT, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Packaged verified release artifact: ${relativeToRoot(archivePath)}`);
}

async function readZipEntries(path) {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    const tailLength = Math.min(info.size, 0xffff + 22);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, info.size - tailLength);
    let eocd = -1;
    for (let index = tail.length - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === 0x06054b50) {
        eocd = index;
        break;
      }
    }
    if (eocd === -1) fail('ZIP end-of-central-directory record is missing');
    const entryCount = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    const directory = Buffer.alloc(directorySize);
    await handle.read(directory, 0, directorySize, directoryOffset);
    const entries = [];
    let cursor = 0;
    while (cursor < directory.length) {
      if (directory.readUInt32LE(cursor) !== 0x02014b50) fail('ZIP central-directory entry is malformed');
      const nameLength = directory.readUInt16LE(cursor + 28);
      const extraLength = directory.readUInt16LE(cursor + 30);
      const commentLength = directory.readUInt16LE(cursor + 32);
      entries.push(directory.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'));
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    if (entries.length !== entryCount) fail(`ZIP central-directory count mismatch (${entries.length} entries, expected ${entryCount})`);
    return entries;
  } finally {
    await handle.close();
  }
}

async function compareDeployableCopies(errors) {
  for (const item of DEPLOYABLE_PATHS) {
    const source = resolve(ROOT, item);
    const destination = resolve(PAGES_ROOT, item);
    const sourceFiles = (await stat(source)).isDirectory() ? await listFiles(source) : [source];
    for (const sourceFile of sourceFiles) {
      const outputFile = resolve(destination, relative(source, sourceFile));
      if (!(await pathExists(outputFile))) {
        errors.push(`Pages package is missing ${relativeToRoot(sourceFile)}`);
        continue;
      }
      const [sourceInfo, outputInfo] = await Promise.all([stat(sourceFile), stat(outputFile)]);
      if (sourceInfo.size !== outputInfo.size) {
        errors.push(`Pages package size mismatch for ${relativeToRoot(sourceFile)}`);
        continue;
      }
      if ((await hashFile(sourceFile)) !== (await hashFile(outputFile))) {
        errors.push(`Pages package content mismatch for ${relativeToRoot(sourceFile)}`);
      }
    }
  }
}

async function verifyRelease() {
  const errors = [];
  const manifestPath = resolve(DOWNLOAD_ROOT, 'release-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    fail(`Cannot read release manifest: ${error.message}`);
  }
  for (const value of ['archive', 'archiveSha256', 'releaseNotes', 'version', 'commit']) {
    if (!manifest[value]) errors.push(`Release manifest is missing ${value}`);
  }
  const archive = manifest.archive ? resolve(RELEASE_ROOT, manifest.archive) : null;
  const notes = manifest.releaseNotes ? resolve(RELEASE_ROOT, manifest.releaseNotes) : null;
  const archiveIsFile = archive && isInside(ARTIFACTS_ROOT, archive) && (await pathExists(archive)) && (await stat(archive)).isFile();
  const notesIsFile = notes && isInside(ARTIFACTS_ROOT, notes) && (await pathExists(notes)) && (await stat(notes)).isFile();
  if (!archiveIsFile) errors.push('Verified release ZIP is missing from the release artifacts');
  if (!notesIsFile) errors.push('Release notes are missing from the release artifacts');
  if (archiveIsFile) {
    if ((await hashFile(archive)) !== manifest.archiveSha256) errors.push('Release ZIP SHA-256 does not match its manifest');
    try {
      const entries = await readZipEntries(archive);
      for (const expected of [
        'index.html',
        'src/main.js',
        'service-worker.js',
        'THIRD_PARTY_ASSETS.md',
        'THIRD_PARTY_SOFTWARE.md',
        'webgpu-lab.html',
        'src/experimental/webgpu-advanced-contract.js',
        'src/experimental/fsr2-2.2.1/ffx-fsr2-luminance-first-mip.wgsl',
        'src/experimental/fsr2-2.2.1/LICENSE-AMD-FSR2.txt',
        'src/experimental/fsr2-2.2.1/PROVENANCE.json',
        'src/webgpu-lab/main.js',
        'src/webgpu-lab/known-triangle-dispatch.js',
        'src/webgpu-lab/raster-foundation-probe.js',
        'src/webgpu-lab/raster-foundation-receipt.js',
        'src/webgpu-lab/scene-bvh-dispatch.js',
        'src/webgpu-lab/scene-bvh-pack.js',
        'src/webgpu-lab/scene-bvh-probe.js',
        'src/webgpu-lab/scene-bvh-receipt.js',
        'src/webgpu-lab/temporal-input-foundation.js',
        'vendor/webgpu-lab/three-0.185.1/LICENSE',
        'vendor/webgpu-lab/three-0.185.1/SHA256_MANIFEST.json',
        'vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
        'vendor/webgpu-lab/three-mesh-bvh-0.9.13/LICENSE',
        'vendor/webgpu-lab/three-mesh-bvh-0.9.13/SHA256_MANIFEST.json',
        'vendor/webgpu-lab/three-mesh-bvh-0.9.13/src/webgpu/index.js'
      ]) {
        if (!entries.includes(expected)) errors.push(`Release ZIP does not contain root-level ${expected}`);
      }
      if (!entries.includes('index.html')) errors.push('Release ZIP has an enclosing top-level directory instead of repository-root contents');
    } catch (error) {
      errors.push(`Release ZIP is not structurally valid: ${error.message}`);
    }
  }
  if (!(await pathExists(resolve(PAGES_ROOT, 'index.html')))) errors.push('Pages package is missing index.html');
  if (!(await pathExists(resolve(DOWNLOAD_ROOT, 'index.html')))) errors.push('Pages package is missing the release download index');
  await compareDeployableCopies(errors);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    fail(`Release package verification failed with ${errors.length} issue(s).`);
  }
  console.log(`Release package verified: ${relativeToRoot(archive)} has repository-root contents, the Pages tree matches validated source files, and the ZIP is ready for GitHub Releases.`);
}

const command = process.argv[2];
if (command === 'validate') {
  await validateRelease();
} else if (command === 'package') {
  await packageRelease();
} else if (command === 'verify') {
  await verifyRelease();
} else {
  fail('Usage: node scripts/release.mjs <validate|package|verify> [--version <safe-id>]');
}
