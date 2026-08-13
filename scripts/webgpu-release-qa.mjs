import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_IMPORTS = Object.freeze({
  '@specter-lab/three-webgpu': './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  '@specter-lab/three-mesh-bvh': './vendor/webgpu-lab/three-mesh-bvh-0.9.13/src/webgpu/index.js',
  three: './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  'three/webgpu': './vendor/webgpu-lab/three-0.185.1/build/three.webgpu.js',
  'three/tsl': './vendor/webgpu-lab/three-0.185.1/build/three.tsl.js'
});
const PACKAGES = Object.freeze([
  Object.freeze({ root: 'vendor/webgpu-lab/three-0.185.1', name: 'three', version: '0.185.1' }),
  Object.freeze({ root: 'vendor/webgpu-lab/three-mesh-bvh-0.9.13', name: 'three-mesh-bvh', version: '0.9.13' })
]);
let checks = 0;

function check(value, message) {
  checks++;
  assert.ok(value, message);
}

function checkEqual(actual, expected, message) {
  checks++;
  assert.deepEqual(actual, expected, message);
}

function toPosix(path) {
  return path.split(sep).join('/');
}

async function listFiles(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const target = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  await visit(directory);
  return files;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

const [releaseSource, packageDocument, workflow, worker, html, gameMain, softwareNotice] = await Promise.all([
  readFile(resolve(ROOT, 'scripts/release.mjs'), 'utf8'),
  readFile(resolve(ROOT, 'package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(ROOT, '.github/workflows/pages-release.yml'), 'utf8'),
  readFile(resolve(ROOT, 'service-worker.js'), 'utf8'),
  readFile(resolve(ROOT, 'webgpu-lab.html'), 'utf8'),
  readFile(resolve(ROOT, 'src/main.js'), 'utf8'),
  readFile(resolve(ROOT, 'THIRD_PARTY_SOFTWARE.md'), 'utf8')
]);

const deployableBlock = releaseSource.match(/const DEPLOYABLE_PATHS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
check(deployableBlock.includes("'webgpu-lab.html'"), 'The Pages tree must include the WebGPU lab HTML.');
check(deployableBlock.includes("'vendor/webgpu-lab'"), 'The Pages tree must include the exact vendored WebGPU lab closure.');
check(deployableBlock.includes("'src'"), 'The Pages tree must continue to include the lab and experimental source modules under src/.');
check(deployableBlock.includes("'THIRD_PARTY_SOFTWARE.md'"), 'The Pages tree must include vendored software notices.');
check(releaseSource.includes('async function validateWebgpuLabReleaseClosure(errors)'), 'Release validation must define the WebGPU lab closure gate.');
check(/await validateWebgpuLabReleaseClosure\(errors\)/.test(releaseSource), 'Release validation must execute the WebGPU lab closure gate.');
for (const expectedZipEntry of [
  'THIRD_PARTY_SOFTWARE.md',
  'webgpu-lab.html',
  'src/experimental/webgpu-advanced-contract.js',
  'src/experimental/fsr2-2.2.1/ffx-fsr2-luminance-first-mip.wgsl',
  'src/experimental/fsr2-2.2.1/LICENSE-AMD-FSR2.txt',
  'src/experimental/fsr2-2.2.1/luminance-first-mip-reference.js',
  'src/experimental/fsr2-2.2.1/PROVENANCE.json',
  'src/webgpu-lab/main.js',
  'src/webgpu-lab/known-triangle-dispatch.js',
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
  'vendor/webgpu-lab/three-0.185.1/SHA256_MANIFEST.json',
  'vendor/webgpu-lab/three-mesh-bvh-0.9.13/SHA256_MANIFEST.json'
]) {
  check(releaseSource.includes(`'${expectedZipEntry}'`), `ZIP verification must require ${expectedZipEntry}.`);
}

check(packageDocument.scripts['qa:webgpu-advanced'] === 'node scripts/webgpu-advanced-qa.mjs', 'The advanced renderer contract QA command must be pinned.');
check(packageDocument.scripts['qa:webgpu-lab'] === 'node scripts/webgpu-lab-qa.mjs', 'The lab contract QA command must be pinned.');
check(packageDocument.scripts['qa:webgpu-temporal'] === 'node scripts/webgpu-temporal-qa.mjs', 'The temporal-input QA command must be pinned.');
check(packageDocument.scripts['qa:webgpu-bvh'] === 'node scripts/scene-bvh-proof-qa.mjs', 'The scene BVH proof QA command must be pinned.');
check(packageDocument.scripts['qa:fsr2-luminance'] === 'node scripts/fsr2-luminance-first-mip-qa.mjs', 'The staged FSR 2 first-mip QA command must be pinned.');
check(packageDocument.scripts['qa:webgpu-release'] === 'node scripts/webgpu-release-qa.mjs', 'The release-closure QA command must be pinned.');
check(packageDocument.scripts['qa:webgpu-lab-browser'] === 'node scripts/webgpu-lab-browser-qa.mjs', 'The lab browser QA command must be pinned.');
check(packageDocument.scripts['qa:webgpu'].includes('qa:webgpu-advanced') && packageDocument.scripts['qa:webgpu'].includes('qa:webgpu-lab') && packageDocument.scripts['qa:webgpu'].includes('qa:webgpu-temporal') && packageDocument.scripts['qa:webgpu'].includes('qa:webgpu-bvh') && packageDocument.scripts['qa:webgpu'].includes('qa:fsr2-luminance') && packageDocument.scripts['qa:webgpu'].includes('qa:webgpu-release'), 'The aggregate WebGPU QA command must cover every static contract.');
check(packageDocument.scripts['release:check'].includes('npm run qa:webgpu'), 'The local release check must include WebGPU static QA.');

const staticQaIndex = workflow.search(/run: npm run qa:webgpu\r?\n/);
const labBrowserIndex = workflow.indexOf('run: npm run qa:webgpu-lab-browser');
const gameBrowserIndex = workflow.indexOf('run: npm run qa:browser');
check(staticQaIndex !== -1, 'Pages CI must run the aggregate WebGPU static QA command.');
check(labBrowserIndex > staticQaIndex, 'Pages CI must run lab browser acceptance after static WebGPU QA.');
check(gameBrowserIndex > labBrowserIndex, 'Pages CI must run the full game browser suite after the isolated lab acceptance.');
check(workflow.includes('path: .release/pages'), 'Pages must publish only the release script output tree.');

const importMapMatch = html.match(/<script\b[^>]*\btype\s*=\s*(["'])importmap\1[^>]*>([\s\S]*?)<\/script>/i);
check(Boolean(importMapMatch), 'The lab must contain an inline import map.');
const imports = JSON.parse(importMapMatch[2]).imports;
checkEqual(imports, EXPECTED_IMPORTS, 'The lab import map must contain only the exact same-origin vendored modules.');
check(!/https?:\/\/|(?:src|href)\s*=\s*(["'])\/\//i.test(html), 'The lab HTML must not contain a CDN or other network dependency.');
check(!html.includes('src/main.js'), 'The isolated lab must not boot the game.');
check(!gameMain.includes('webgpu-lab/') && !gameMain.includes('experimental/webgpu-advanced-contract'), 'The game must not import the lab or staged renderer contract.');
check(softwareNotice.includes('three-0.185.1/package.json') && softwareNotice.includes('three-mesh-bvh-0.9.13/package.json'), 'The software notice must retain local evidence paths for both vendored packages.');
check(softwareNotice.includes('MIT') && softwareNotice.includes('service worker does not install-time'), 'The software notice must retain the license and demand-loaded cache boundary.');

for (const arrayName of ['REQUIRED_SHELL_URLS', 'OPTIONAL_PRECACHE_URLS']) {
  const block = worker.match(new RegExp(`const ${arrayName} = \\[([\\s\\S]*?)\\n\\];`))?.[1] ?? '';
  check(Boolean(block), `The service-worker ${arrayName} list must remain auditable.`);
  check(!/webgpu-lab|vendor\/webgpu-lab|src\/experimental\//i.test(block), `${arrayName} must not precache the experimental lab, staged FSR reference, or dependencies.`);
}

for (const expected of PACKAGES) {
  const packageRoot = resolve(ROOT, expected.root);
  const receipt = JSON.parse(await readFile(resolve(packageRoot, 'SHA256_MANIFEST.json'), 'utf8'));
  check(receipt.schema === 'specter-vendored-npm-closure/v1', `${expected.name} must use the reviewed closure receipt schema.`);
  check(receipt.package?.name === expected.name && receipt.package?.version === expected.version && receipt.package?.license === 'MIT', `${expected.name} must retain its exact version and MIT license receipt.`);
  const packageMetadata = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
  check(packageMetadata.name === expected.name && packageMetadata.version === expected.version && packageMetadata.license === 'MIT', `${expected.name} package metadata must match its receipt.`);
  const recorded = new Set(receipt.files.map(record => record.path));
  check(recorded.size === receipt.files.length, `${expected.name} receipt paths must be unique.`);
  const actual = (await listFiles(packageRoot))
    .map(file => toPosix(relative(packageRoot, file)))
    .filter(path => path !== 'SHA256_MANIFEST.json')
    .sort();
  checkEqual(actual, [...recorded].sort(), `${expected.name} must contain no unrecorded or missing files.`);
  for (const record of receipt.files) {
    const file = resolve(packageRoot, record.path);
    check((await stat(file)).size === record.bytes, `${expected.name}/${record.path} byte count must match its receipt.`);
    check((await sha256(file)) === record.sha256, `${expected.name}/${record.path} SHA-256 must match its receipt.`);
  }
}

console.log(`WebGPU release QA: ${checks} checks, 0 failures.`);
