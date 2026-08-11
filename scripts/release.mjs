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
const RELEASES_ROOT = resolve(PAGES_ROOT, 'releases');
const DEPLOYABLE_PATHS = [
  'assets',
  'src',
  'index.html',
  'manifest.webmanifest',
  'player-model.html',
  'README.md',
  'service-worker.js',
  'styles.css',
  'THIRD_PARTY_ASSETS.md'
];
const MEDIA_EXTENSIONS = new Set([
  '.bin', '.glb', '.gltf', '.jpeg', '.jpg', '.ktx2', '.mp3', '.ogg', '.png', '.wav', '.webp'
]);
const JAVASCRIPT_EXTENSIONS = new Set(['.cjs', '.js', '.mjs']);
const SKIPPED_DIRECTORIES = new Set(['.git', '.github', '.release', 'node_modules']);
const REQUIRED_LICENSE_RECORDS = [
  'assets/ar15/license.txt',
  'assets/m9/license.txt',
  'assets/soldier/license.txt',
  'assets/audio/cc-by-3.0-tabasco/LICENSE.txt',
  'assets/audio/cc0-kenney-rpg-footsteps/License.txt',
  'assets/audio/cc0-kenney-voiceover/License.txt',
  'assets/environment/polyhaven-concrete-road-barrier-02/LICENSE.txt',
  'assets/environment/polyhaven-fern-02/LICENSE.txt',
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

async function validateForestFoliagePolicy(errors) {
  const mainPath = resolve(ROOT, 'src/main.js');
  const workerPath = resolve(ROOT, 'service-worker.js');
  const alphaPath = resolve(ROOT, 'assets/environment/polyhaven-fern-02/textures/fern_02_alpha_4k.png');
  const [main, worker] = await Promise.all([readFile(mainPath, 'utf8'), readFile(workerPath, 'utf8')]);

  if (!main.includes('missionAssetsReady') || !main.includes('loadForestFernAsset')) {
    errors.push('Forest foliage must wait until required mission assets are ready.');
  }
  if (!main.includes("preset.textureTier!=='low'") || !main.includes('fern_02_alpha_4k.png')) {
    errors.push('Forest foliage must retain the Low texture-tier guard and official Fern alpha mask.');
  }
  if (worker.includes('polyhaven-fern-02/')) {
    errors.push('Fern 02 must not be precached: it is an optional high-tier stream.');
  }
  if (!(await pathExists(alphaPath))) {
    errors.push('Official Fern 02 alpha mask is missing.');
  } else if ((await hashFile(alphaPath, 'md5')) !== '520e194db987df18fd73b49d979ada0c') {
    errors.push('Official Fern 02 alpha-mask MD5 does not match Poly Haven metadata.');
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
  await validateForestFoliagePolicy(errors);
  await validatePbrManifest(errors);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    fail(`Release validation failed with ${errors.length} issue(s).`);
  }
  console.log(`Release validation passed: ${javascriptCount} JavaScript file(s), local references, glTF closure, licenses, forest foliage policy, and PBR manifest verified.`);
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
  await mkdir(RELEASES_ROOT, { recursive: true });
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

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function packageRelease() {
  const version = safeReleaseVersion();
  const { commit, committedAt } = await gitMetadata();
  const stem = `specter-blacksite-${version}`;
  const archiveName = `${stem}.zip`;
  const notesName = `${stem}-release-notes.md`;
  const archivePath = resolve(RELEASES_ROOT, archiveName);
  const notesPath = resolve(RELEASES_ROOT, notesName);

  await copyDeployableTree();
  await git('archive', '--format=zip', `--output=${archivePath}`, 'HEAD');
  const archiveSha256 = await hashFile(archivePath);
  const notes = [
    '# SPECTER: Blacksite release',
    '',
    `- Version: \`${version}\``,
    `- Commit: \`${commit}\``,
    `- Commit timestamp: ${committedAt}`,
    `- Archive: [${archiveName}](./${archiveName})`,
    `- SHA-256: \`${archiveSha256}\``,
    '',
    'This release passed JavaScript syntax, local asset-reference, glTF dependency, local license/provenance, and PBR manifest integrity checks before packaging.'
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
    <li><a href="./${archiveName}">Download release ZIP</a></li>
    <li><a href="./${notesName}">Read release notes</a></li>
  </ul>
</main>
</html>
`;
  await writeFile(resolve(RELEASES_ROOT, 'index.html'), index);
  const manifest = {
    schemaVersion: 1,
    version,
    commit,
    committedAt,
    archive: `releases/${archiveName}`,
    archiveSha256,
    releaseNotes: `releases/${notesName}`,
    archiveContents: 'Repository files are stored at the ZIP root; no enclosing project directory is added.'
  };
  await writeFile(resolve(RELEASES_ROOT, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Packaged Pages release: ${relativeToRoot(archivePath)}`);
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
  const manifestPath = resolve(RELEASES_ROOT, 'release-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    fail(`Cannot read release manifest: ${error.message}`);
  }
  for (const value of ['archive', 'archiveSha256', 'releaseNotes', 'version', 'commit']) {
    if (!manifest[value]) errors.push(`Release manifest is missing ${value}`);
  }
  const archive = manifest.archive ? resolve(PAGES_ROOT, manifest.archive) : null;
  const notes = manifest.releaseNotes ? resolve(PAGES_ROOT, manifest.releaseNotes) : null;
  const archiveIsFile = archive && isInside(PAGES_ROOT, archive) && (await pathExists(archive)) && (await stat(archive)).isFile();
  const notesIsFile = notes && isInside(PAGES_ROOT, notes) && (await pathExists(notes)) && (await stat(notes)).isFile();
  if (!archiveIsFile) errors.push('Versioned release ZIP is missing from the Pages package');
  if (!notesIsFile) errors.push('Release notes are missing from the Pages package');
  if (archiveIsFile) {
    if ((await hashFile(archive)) !== manifest.archiveSha256) errors.push('Release ZIP SHA-256 does not match its manifest');
    try {
      const entries = await readZipEntries(archive);
      for (const expected of ['index.html', 'src/main.js', 'service-worker.js', 'THIRD_PARTY_ASSETS.md']) {
        if (!entries.includes(expected)) errors.push(`Release ZIP does not contain root-level ${expected}`);
      }
      if (!entries.includes('index.html')) errors.push('Release ZIP has an enclosing top-level directory instead of repository-root contents');
    } catch (error) {
      errors.push(`Release ZIP is not structurally valid: ${error.message}`);
    }
  }
  if (!(await pathExists(resolve(PAGES_ROOT, 'index.html')))) errors.push('Pages package is missing index.html');
  if (!(await pathExists(resolve(RELEASES_ROOT, 'index.html')))) errors.push('Pages package is missing the release download index');
  await compareDeployableCopies(errors);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    fail(`Release package verification failed with ${errors.length} issue(s).`);
  }
  console.log(`Release package verified: ${relativeToRoot(archive)} has repository-root contents and the Pages tree matches validated source files.`);
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
