#!/usr/bin/env node

/**
 * Focused, dependency-free release checks for SPECTER's graphics contracts.
 *
 * This intentionally uses static source and manifest checks instead of
 * creating a WebGL context in Node. Browser rendering is covered by manual
 * smoke testing; this script catches regressions in the policies that should
 * be true before that test starts.
 *
 * Run with: node scripts/graphics-qa.mjs
 */
import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_PATH = resolve(ROOT, 'src/main.js');
const PIPELINE_PATH = resolve(ROOT, 'src/graphics-pipeline.js');
const RELEASE_PATH = resolve(ROOT, 'scripts/release.mjs');
const LOW_MANIFEST_PATH = resolve(ROOT, 'assets/low-textures/manifest.json');
const NATIVE_4K_MANIFEST_PATH = resolve(ROOT, 'assets/environment/pbr-v2-4k/manifest.json');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const PRESET_NAMES = ['mobile', 'intel', 'performance', 'balanced', 'high', 'ultra', 'extreme'];
const LOW_SOURCE_TEXTURE_DIRECTORIES = [
  'assets/ar15/textures',
  'assets/m9/textures',
  'assets/soldier/textures',
  'assets/environment/polyhaven-concrete-road-barrier-02/textures',
  'assets/environment/polyhaven-plastic-container/textures',
  'assets/environment/polyhaven-power-box-01/textures',
  'assets/environment/polyhaven-steel-frame-shelves-01/textures'
];

let checks = 0;
const failures = [];

function posix(path) {
  return path.split(sep).join('/');
}

function display(path) {
  return posix(relative(ROOT, path));
}

function check(condition, message) {
  checks++;
  if (!condition) throw new Error(message);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`FAIL  ${name}`);
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path) {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

async function listImageFiles(directory, recursive = true) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = resolve(directory, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...await listImageFiles(child, true));
    } else if (entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(child);
    }
  }
  return files;
}

function sourceFileNameList(main) {
  const start = main.indexOf('const environmentPbrEntries=Object.freeze([');
  const end = main.indexOf(']);', start);
  check(start >= 0 && end > start, 'environmentPbrEntries is missing or malformed.');
  const entries = main.slice(start, end);
  const files = [...entries.matchAll(/\['[^']+','([^']+)'\]/g)].map(match => match[1]);
  check(files.length >= 20, 'environmentPbrEntries must enumerate the full PBR runtime set.');
  return files;
}

function presetBlock(source, name) {
  const marker = `${name}: Object.freeze({`;
  const start = source.indexOf(marker);
  check(start >= 0, `Preset ${name} is missing.`);
  const nextName = PRESET_NAMES[PRESET_NAMES.indexOf(name) + 1];
  const end = nextName ? source.indexOf(`${nextName}: Object.freeze({`, start + marker.length) : source.indexOf('\n  })\n});', start);
  check(end > start, `Preset ${name} has no stable closing boundary.`);
  return source.slice(start, end);
}

function field(block, name, expression) {
  return new RegExp(`\\b${name}\\s*:\\s*${expression}`).test(block);
}

function manifestMapFiles(manifest) {
  const materials = Array.isArray(manifest?.materials) ? manifest.materials : [];
  return new Set(materials.flatMap(material => Array.isArray(material?.maps) ? material.maps : [])
    .map(map => map?.file)
    .filter(file => typeof file === 'string' && file.length));
}

const [main, pipeline, release] = await Promise.all([
  readFile(MAIN_PATH, 'utf8'),
  readFile(PIPELINE_PATH, 'utf8'),
  readFile(RELEASE_PATH, 'utf8')
]);
const environmentPbrFiles = sourceFileNameList(main);

await test('graphics presets retain Intel-safe and Extreme contracts', () => {
  for (const name of PRESET_NAMES) presetBlock(pipeline, name);
  const mobile = presetBlock(pipeline, 'mobile');
  check(field(mobile, 'recommendedVRAMMB', '384\\b'), 'Mobile Ultra Low must retain a 384 MB active-resource recommendation.');
  check(field(mobile, 'outputResolution', '480\\b') && field(mobile, 'pixelRatioCap', '0\\.5\\b'), 'Mobile Ultra Low must target a 480p internal buffer with a 0.5x cap.');
  check(field(mobile, 'postProcessing', 'false\\b') && field(mobile, 'shadows', 'false\\b'), 'Mobile Ultra Low must keep a direct, shadow-free renderer path.');
  check(field(mobile, 'textureTier', "'low'") && field(mobile, 'textureAnisotropy', '1\\b'), 'Mobile Ultra Low must select the real 512px texture payload.');
  check(field(mobile, 'grassEnabled', 'false\\b') && field(mobile, 'forestDensity', "'low'"), 'Mobile Ultra Low must keep vegetation lightweight.');
  const intel = presetBlock(pipeline, 'intel');
  check(field(intel, 'recommendedVRAMMB', '512\\b'), 'Intel tier must retain a 512 MB recommendation.');
  check(field(intel, 'pixelRatioCap', '0\\.65\\b'), 'Intel tier must cap render scale at 0.65.');
  check(field(intel, 'postProcessing', 'false\\b'), 'Intel tier must remain on the direct renderer path.');
  check(field(intel, 'shadows', 'false\\b') && field(intel, 'shadowMapSize', '0\\b'), 'Intel tier must disable shadows.');
  check(field(intel, 'textureTier', "'low'"), 'Intel tier must select the low texture tier.');
  check(field(intel, 'ambientOcclusion', 'false\\b') && field(intel, 'screenSpaceReflections', 'false\\b'), 'Intel tier must disable AO and SSR.');
  check(field(intel, 'grassEnabled', 'false\\b') && field(intel, 'forestDensity', "'low'"), 'Intel tier must keep vegetation lightweight.');

  const extreme = presetBlock(pipeline, 'extreme');
  check(field(extreme, 'recommendedVRAMMB', '10240\\b'), 'Extreme tier must remain a 10 GB budget.');
  check(field(extreme, 'pixelRatioCap', '2\\b'), 'Extreme tier must permit a 2x render scale.');
  check(field(extreme, 'shadows', 'true\\b') && field(extreme, 'shadowMapSize', '4096\\b'), 'Extreme tier must retain 4K shadows.');
  check(field(extreme, 'textureTier', "'4k-preferred'"), 'Extreme tier must prefer native 4K environment textures.');
  check(field(extreme, 'ambientOcclusion', 'true\\b') && field(extreme, 'screenSpaceReflections', 'true\\b'), 'Extreme tier must retain AO and SSR.');
});

await test('custom graphics controls remain clamped to supported settings', () => {
  const requiredBooleans = ['postProcessing', 'shadows', 'ambientOcclusion', 'screenSpaceReflections', 'bloom', 'grassEnabled', 'fogEnabled'];
  const requiredRanges = {
    pixelRatioCap: '[0.45, 2]',
    shadowMapSize: '[0, 4096]',
    textureAnisotropy: '[1, 16]',
    aoKernelRadius: '[0, 16]',
    ssrMaxDistance: '[0, 140]',
    ssrOpacity: '[0, 0.35]'
  };
  for (const fieldName of requiredBooleans) {
    check(pipeline.includes(`'${fieldName}'`), `Custom boolean control ${fieldName} is missing.`);
  }
  for (const [fieldName, range] of Object.entries(requiredRanges)) {
    check(pipeline.includes(`${fieldName}: ${range}`), `Custom range ${fieldName}: ${range} is missing.`);
  }
  for (const tier of ['low', 'medium', 'standard', 'high', '4k-preferred']) {
    check(pipeline.includes(`'${tier}'`), `Custom texture tier ${tier} is missing.`);
  }
  for (const density of ['off', 'low', 'medium', 'high', 'ultra', 'extreme']) {
    check(pipeline.includes(`'${density}'`), `Custom vegetation density ${density} is missing.`);
  }
  check(/THREE\.MathUtils\.clamp\(numeric,\s*range\[0\],\s*range\[1\]\)/.test(pipeline), 'Custom numeric settings must be clamped before use.');
  check(/graphicsCustomDraft\(\)/.test(main) && /applyCustomGraphicsSettings\(\)/.test(main), 'The UI must draft and apply custom settings.');
  for (const field of ['rayTracedReflections', 'rayTracedShadows', 'rayTracedGlobalIllumination', 'fsr2']) {
    check(pipeline.includes(`'${field}'`) && main.includes(field), `Experimental graphics control ${field} must be persisted and wired.`);
  }
  check(/nativeRayTracing: false/.test(pipeline) && /reflectionFallback: 'screen-space reflections'/.test(pipeline), 'WebGL must report honest ray-tracing fallback capability.');
  check(/rayTracedReflections: true/.test(presetBlock(pipeline, 'extreme')) && /rayTracedShadows: true/.test(presetBlock(pipeline, 'extreme')) && /rayTracedGlobalIllumination: true/.test(presetBlock(pipeline, 'extreme')), 'Extreme must request every available maximum-quality WebGL lighting fallback.');
  check(/NATIVE RT: UNAVAILABLE IN WEBGL/.test(main), 'The graphics panel must not misrepresent WebGL effects as native hardware ray tracing.');
  check(/nativeFSR2: false/.test(pipeline) && /fsr2Fallback: 'spatial output scaling at 77% of selected render scale \(not FSR2\)'/.test(pipeline), 'FSR2 must not be falsely reported as native on WebGL.');
  check(/export const SPATIAL_UPSCALE_FALLBACK_SCALE = 0\.77/.test(pipeline), 'The browser-compatible spatial upscale factor must remain explicit.');
  check(/export const OUTPUT_RESOLUTION_HEIGHTS = Object\.freeze\(\[0, 240, 360, 480, 720, 900, 1080, 1440, 2160\]\)/.test(pipeline), 'The render-resolution ladder must cover Auto through 240p-4K.');
  check(/CUSTOM_OUTPUT_RESOLUTIONS\.has\(outputResolution\)/.test(pipeline), 'Custom render resolution must be sanitized against the supported ladder.');
  check(/export function resolveOutputResolution/.test(pipeline) && /spatialFallbackBypassed/.test(pipeline), 'Fixed resolution must resolve independently and not silently change under the FSR2 fallback.');
  check(/effectivePixelRatio = outputResolutionState\(preset\)\.pixelRatio/.test(pipeline), 'Resolution selection must alter actual renderer/composer resolution.');
  check(/renderer\.getDrawingBufferSize/.test(pipeline) && /effectiveOutputWidth/.test(pipeline), 'Diagnostics must report the renderer’s real internal drawing buffer.');
  check(/function activeReflectionSettings\(preset = activePreset\(\)\)/.test(pipeline) && /maxDistance: Math\.max\(1, Number\(preset\.ssrMaxDistance\) \|\| SSR_FALLBACK_PROFILE\.maxDistance\)/.test(pipeline), 'Enabled reflection requests must receive a nonzero SSR fallback profile.');
  check(/ssrPass\.maxDistance = reflectionSettings\.maxDistance/.test(pipeline) && /ssrPass\.opacity = reflectionSettings\.opacity/.test(pipeline), 'SSR must consume the active fallback settings rather than zero-valued preset defaults.');
  check(/graphicsResolution=document\.getElementById\('graphicsResolution'\)/.test(main) && /outputResolution:Number\(graphicsResolution\.value\)\|\|0/.test(main), 'The render-resolution selector must be bound and persisted with custom settings.');
  check(/graphicsMemoryEstimate\(preset,diagnostics=graphics\?\.getDiagnostics\?\.\(\)\)/.test(main) && /diagnostics\?\.effectiveOutputWidth/.test(main), 'The GPU estimate must use the graphics pipeline’s actual internal buffer.');
  check(/rayTracedGlobalIllumination/.test(main) && /rayTracedReflections/.test(main), 'The GPU estimate must account for indirect-light and reflection fallback render targets.');
});

await test('fixed internal resolution preserves player intent within browser limits', () => {
  const resolverStart = pipeline.indexOf('export function resolveOutputResolution({');
  const resolverEnd = pipeline.indexOf('\n\nfunction sanitizeCustomSettings', resolverStart);
  check(resolverStart >= 0 && resolverEnd > resolverStart, 'resolveOutputResolution must have a stable source boundary.');
  const resolverSource = pipeline.slice(resolverStart, resolverEnd).replace('export function', 'function');
  const resolveOutput = Function(`
    const DEFAULT_WIDTH=1280,DEFAULT_HEIGHT=720;
    const SPATIAL_UPSCALE_FALLBACK_SCALE=.77;
    const OUTPUT_RESOLUTION_HEIGHTS=Object.freeze([0,240,360,480,720,900,1080,1440,2160]);
    const CUSTOM_OUTPUT_RESOLUTIONS=new Set(OUTPUT_RESOLUTION_HEIGHTS);
    function positiveDimension(value,fallback){const numeric=Number(value);return Number.isFinite(numeric)&&numeric>0?Math.max(1,Math.floor(numeric)):fallback}
    function positiveRatio(value,fallback=1){const numeric=Number(value);return Number.isFinite(numeric)&&numeric>0?numeric:fallback}
    ${resolverSource};return resolveOutputResolution;
  `)();
  const fixed240 = resolveOutput({width:1920,height:1080,requestedPixelRatio:2,preset:{pixelRatioCap:.65,outputResolution:240,fsr2:true},maxSurfaceDimension:4096});
  check(fixed240.selected && fixed240.height === 240 && fixed240.width === 427, 'A requested fixed 240p buffer must preserve aspect and not be silently altered by the FSR fallback.');
  check(fixed240.spatialFallbackBypassed && fixed240.spatialScale === 1, 'Fixed resolution must disclose that the non-native FSR fallback is bypassed.');
  const autoSpatial = resolveOutput({width:1920,height:1080,requestedPixelRatio:2,preset:{pixelRatioCap:1.25,outputResolution:0,fsr2:true},maxSurfaceDimension:4096});
  check(autoSpatial.spatialScale === .77 && autoSpatial.height === 1040, 'Auto resolution with the compatibility request must actually reduce the internal buffer.');
  const clamped4K = resolveOutput({width:1920,height:1080,requestedPixelRatio:2,preset:{pixelRatioCap:.65,outputResolution:2160},maxSurfaceDimension:2048});
  check(clamped4K.limitedByHardware && clamped4K.width === 2048 && clamped4K.height === 1152, 'A fixed 4K request must clamp to the browser’s real render-target limit while preserving aspect.');
});

await test('AUTO benchmark samples raw gameplay timing only', () => {
  check(/const autoBenchmark=\{active:false,pending:false,samples:\[\],warmupFrames:(\d+),warmup:0,minimumFrames:(\d+),hitches:0\}/.test(main), 'AUTO benchmark must define a pending gameplay benchmark state.');
  const benchmark = main.slice(main.indexOf('const autoBenchmark='), main.indexOf('function setGraphicsQuality', main.indexOf('const autoBenchmark=')));
  const minimumFrames = Number(benchmark.match(/minimumFrames:(\d+)/)?.[1] || 0);
  const warmupFrames = Number(benchmark.match(/warmupFrames:(\d+)/)?.[1] || 0);
  check(minimumFrames >= 90, 'AUTO benchmark must sample at least 90 gameplay frames.');
  check(warmupFrames >= 30, 'AUTO benchmark must include a gameplay warm-up period.');
  check(/if\(!missionHasStarted\)\{\s*autoBenchmark\.pending=true/.test(benchmark), 'AUTO benchmark must wait for mission start.');
  check(/autoBenchmark\.pending=false;autoBenchmark\.active=true/.test(benchmark), 'AUTO benchmark must activate only after the mission is active.');
  check(/deltaSeconds<=0\)return/.test(benchmark) && /if\(deltaSeconds>\.35\)\{autoBenchmark\.hitches\+\+;return\}/.test(benchmark), 'AUTO benchmark must retain tab-resume hitches as a conservative penalty.');
  check(/autoBenchmark\.samples\.push\(deltaSeconds\*1000\)/.test(benchmark), 'AUTO benchmark must retain raw delta samples in milliseconds.');
  check(/const scoredP90=autoBenchmark\.hitches>=2\?Math\.max\(p90,24\):p90/.test(benchmark), 'AUTO benchmark must use repeated hitches to reduce unsafe headroom.');
  check(/benchmarkMs<9\)rank=Math\.min\(4,rank\+1\)/.test(main), 'AUTO benchmark must cap fast-sample promotion to one tier.');

  const animate = main.slice(main.indexOf('function animate(){'));
  const rawTiming = animate.indexOf('const rawDt=clock.getDelta(),dt=Math.min(rawDt,.05)');
  const started = animate.indexOf('if(started){');
  const sample = animate.indexOf('sampleAutoGraphicsBenchmark(rawDt)');
  check(rawTiming >= 0, 'Render loop must preserve an unclamped raw frame delta.');
  check(started >= 0 && sample > started, 'AUTO sampling must occur inside active gameplay.');
  check(!animate.includes('sampleAutoGraphicsBenchmark(dt)'), 'AUTO benchmark must not use the simulation-clamped delta.');
  check(/startButton\.onclick=.*missionHasStarted=true[\s\S]*beginAutoGraphicsBenchmark\(\)/.test(main), 'Mission start must release a pending AUTO benchmark.');
});

await test('AUTO selects Mobile Ultra Low for entry-class phones and Intel for generic constrained hardware', () => {
  const functionStart = main.indexOf('function recommendedGraphicsQuality(capabilities,benchmarkMs=null){');
  const functionEnd = main.indexOf('\nconst startupGraphicsCapabilities=', functionStart);
  check(functionStart >= 0 && functionEnd > functionStart, 'recommendedGraphicsQuality is missing or has no stable boundary.');
  const recommend = Function(`"use strict";${main.slice(functionStart, functionEnd)};return recommendedGraphicsQuality;`)();
  const capableGeneric = {
    renderer: 'ANGLE (Generic GPU)', webgl2: true, maxTextureSize: 16384,
    maxRenderbufferSize: 16384, maxSamples: 4, maxAnisotropy: 16,
    deviceMemoryGB: 8, cpuCores: 8, displayPixels: 1920 * 1080
  };
  const weakGenericLegacy = {
    ...capableGeneric, renderer: 'ANGLE (Unknown Vendor)', webgl2: false,
    maxTextureSize: 8192, maxRenderbufferSize: 4096, maxAnisotropy: 4,
    deviceMemoryGB: 0, cpuCores: 4
  };
  const weakGenericDualCore = {
    ...capableGeneric, renderer: 'WebGL Renderer Unavailable', maxTextureSize: 8192,
    maxRenderbufferSize: 8192, maxAnisotropy: 4, deviceMemoryGB: 4, cpuCores: 2
  };
  const galaxyA16Class = {
    ...capableGeneric, renderer: 'Mali-G57', mobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A166B)', deviceMemoryGB: 6,
    cpuCores: 8, maxTextureSize: 16384, maxRenderbufferSize: 16384, maxAnisotropy: 16
  };

  check(recommend(galaxyA16Class) === 'mobile', 'A Galaxy A16-class mobile capability set must select Mobile Ultra Low.');
  check(recommend({ ...capableGeneric, maxTextureSize: 4096 }) === 'intel', 'A 4096px texture limit must retain the Intel fallback.');
  check(recommend({ ...capableGeneric, deviceMemoryGB: 2 }) === 'intel', 'A 2 GB reported-memory device must retain the Intel fallback.');
  check(recommend(weakGenericLegacy) === 'intel', 'A generic legacy constrained renderer must select Intel without an Intel name.');
  check(recommend(weakGenericDualCore) === 'intel', 'A generic two-core constrained device must select Intel without an Intel name.');
  check(recommend(capableGeneric, 40) === 'intel', 'A generic device with a sustained 40 ms P90 must select Intel.');
  check(recommend(capableGeneric, 16) !== 'intel', 'A capable generic device must not be demoted by a healthy benchmark.');
});

await test('low and medium texture manifests and URL-selection contracts are complete', async () => {
  check(await pathExists(LOW_MANIFEST_PATH), 'assets/low-textures/manifest.json is missing. Run scripts/build-low-textures.py.');
  const manifest = JSON.parse(await readFile(LOW_MANIFEST_PATH, 'utf8'));
  check(manifest?.schemaVersion === 1, 'Low-payload manifest schemaVersion must be 1.');
  check(manifest?.maxDimension === 512, 'Low-payload manifest must declare a 512px maximum.');
  check(Array.isArray(manifest?.records) && manifest.records.length > 0, 'Low-payload manifest must contain texture records.');
  check(Number(manifest.runtimeBytes) > 0, 'Low-payload manifest must declare a positive runtime byte budget.');

  const mediumManifestPath = resolve(ROOT, 'assets/medium-textures/manifest.json');
  check(await pathExists(mediumManifestPath), 'assets/medium-textures/manifest.json is missing. Run scripts/build-medium-textures.py.');
  const mediumManifest = JSON.parse(await readFile(mediumManifestPath, 'utf8'));
  check(mediumManifest?.schemaVersion === 1 && mediumManifest?.maxDimension === 1024, 'Medium manifest must declare a 1024px schema.');
  check(Array.isArray(mediumManifest?.records) && mediumManifest.records.length === manifest.records.length, 'Medium manifest must cover the same source texture set as Low.');
  check(Number(mediumManifest.runtimeBytes) > manifest.runtimeBytes, 'Medium derivatives should retain more detail than Low derivatives.');
  for (const record of mediumManifest.records ?? []) {
    check(record.file === `assets/medium-textures/${record.source.slice('assets/'.length)}`, `Medium target does not mirror ${record.source}.`);
    check(Array.isArray(record.dimensions) && Math.max(...record.dimensions) <= 1024, `Medium image exceeds 1024px: ${record.file}.`);
    check(await pathExists(resolve(ROOT, record.file)), `Medium output is missing: ${record.file}.`);
    check((await sha256(resolve(ROOT, record.file))) === record.sha256, `Medium output hash mismatch: ${record.file}.`);
  }

  const sourceRecords = new Map();
  const targetRecords = new Set();
  let declaredDerivativeBytes = 0;
  let declaredSourceBytes = 0;
  for (const record of manifest.records) {
    check(typeof record?.source === 'string' && record.source.startsWith('assets/'), 'Every low-payload record needs an assets/ source path.');
    check(record.file === `assets/low-textures/${record.source.slice('assets/'.length)}`, `Low-payload target does not mirror ${record.source}.`);
    check(!sourceRecords.has(record.source), `Duplicate low-payload source record: ${record.source}.`);
    check(!targetRecords.has(record.file), `Duplicate low-payload target record: ${record.file}.`);
    sourceRecords.set(record.source, record);
    targetRecords.add(record.file);
    check(Array.isArray(record.dimensions) && Math.max(...record.dimensions) <= manifest.maxDimension, `Low-payload image exceeds 512px: ${record.file}.`);
    const target = resolve(ROOT, record.file);
    const source = resolve(ROOT, record.source);
    check(await pathExists(source), `Low-payload source no longer exists: ${record.source}.`);
    check(await pathExists(target), `Low-payload output is missing: ${record.file}.`);
    check((await sha256(target)) === record.sha256, `Low-payload output hash mismatch: ${record.file}.`);
    declaredDerivativeBytes += Number(record.bytes) || 0;
    declaredSourceBytes += Number(record.sourceBytes) || 0;
  }
  check(declaredDerivativeBytes === manifest.runtimeBytes, 'Low-payload runtimeBytes must equal the sum of record bytes.');
  check(declaredDerivativeBytes < declaredSourceBytes, 'Low-payload derivatives must be smaller than their source texture set.');

  const expectedSources = [];
  for (const directory of LOW_SOURCE_TEXTURE_DIRECTORIES) {
    expectedSources.push(...await listImageFiles(resolve(ROOT, directory)));
  }
  const pbrDirectory = resolve(ROOT, 'assets/environment/pbr-v2');
  // Match the source selection rule in build-low-textures.py: generated PBR
  // contact sheets and tiling previews are QA artifacts, not runtime maps.
  expectedSources.push(...(await listImageFiles(pbrDirectory, false)).filter(source => !basename(source).startsWith('pbr-v2-')));
  for (const source of expectedSources) {
    const sourceName = display(source);
    check(sourceRecords.has(sourceName), `Low-payload manifest is missing ${sourceName}.`);
  }

  check(/const startupLowPayloadMode=startupGraphicsQuality==='mobile'\|\|startupGraphicsQuality==='intel'\|\|startupTextureTier==='low'/.test(main), 'Mobile, Intel, and saved Low custom paths must select low payloads before decode.');
  check(/loader\.manager\.setURLModifier\(reducedPayloadModelTextureUrl\)/.test(main), 'GLTFLoader must install the reduced-payload URL modifier.');
  check(/const root=startupLowPayloadMode\?'low-textures':'medium-textures'/.test(main), 'Model texture URL modifier must select the real Low or Medium derivative tree.');
  check(/let pbrRoot=startupLowPayloadMode\?'\.\/assets\/low-textures\/environment\/pbr-v2':startupMediumPayloadMode\?'\.\/assets\/medium-textures\/environment\/pbr-v2':'\.\/assets\/environment\/pbr-v2'/.test(main), 'Environment PBR loading must choose Low, Medium, or full maps before fetch/decode.');
  check(/if\(!startupReducedTextureMode\)await loadHighTierTreeCards\(textureLoader\)/.test(main), 'Reduced texture modes must skip optional high-tier foliage fetches.');
  check(/const mediumTexturesReloadPending=requestedPreset\.textureTier==='medium'&&startupTextureTier!=='medium'/.test(main), 'A Medium texture request must truthfully require a reload when the boot tier differs.');
});

await test('touch controls preserve desktop input while providing a mobile action path', async () => {
  check(/id="touchControls"/.test(await readFile(resolve(ROOT, 'index.html'), 'utf8')), 'The HTML shell must include mobile touch controls.');
  check(/const touchCapable=Boolean\(navigator\.maxTouchPoints>0\|\|globalThis\.matchMedia/.test(main), 'Touch controls must be enabled only on touch-capable devices.');
  check(/id="touchMoveZone"/.test(await readFile(resolve(ROOT, 'index.html'), 'utf8')) && /id="touchLookZone"/.test(await readFile(resolve(ROOT, 'index.html'), 'utf8')), 'Touch controls must provide separate move and look zones.');
  check(/data-touch-action="fire"/.test(await readFile(resolve(ROOT, 'index.html'), 'utf8')) && /data-touch-action="aim"/.test(await readFile(resolve(ROOT, 'index.html'), 'utf8')) && /data-touch-action="use"/.test(await readFile(resolve(ROOT, 'index.html'), 'utf8')), 'Touch controls must expose fire, ADS, and interaction actions.');
  check(/const f=\(keys\.KeyW\?1:0\)-\(keys\.KeyS\?1:0\)\+touchInput\.forward/.test(main) && /touchInput\.strafe/.test(main), 'Touch stick input must feed the same movement controller as keyboard input.');
  check(/function applyLookInput\(dx,dy,locked=false\)/.test(main) && /applyLookInput\(dx\*1\.35,dy\*1\.35,false\)/.test(main), 'Touch look must use the shared first-person camera controller.');
  check(/startButton\.onclick=.*setTouchControlsActive\(true\)/.test(main) && /startExtractionSequence\(\)[\s\S]*setTouchControlsActive\(false\)/.test(main), 'Touch controls must activate for missions and lock out during extraction.');
  check(/e\.target\.closest\?\.\('#graphicsPanel,#graphicsQuickButton,#touchControls'\)/.test(main), 'Desktop mouse fire must ignore touch-control UI interactions.');
});

await test('native 4K pack is verified or safely falls back', async () => {
  check(/function nativeEnvironmentManifestIsComplete\(manifest\)/.test(main), 'Runtime must validate a native 4K manifest.');
  check(/Math\.min\(Number\(dimensions\[0\]\)\|\|0,Number\(dimensions\[1\]\)\|\|0\)<4096/.test(main), 'Runtime must reject sub-4K native manifest dimensions.');
  check(/const records=new Map\(\(manifest\.materials\|\|\[\]\)\.flatMap/.test(main) && /const record=records\.get\(file\),mapDimensions=record\?\.dimensions/.test(main), 'Runtime must require verified records for every environment PBR map in a native manifest.');
  check(/if\(!response\.ok\)return null/.test(main) && /catch\{return null\}/.test(main), 'Missing native 4K manifests must be non-fatal.');
  check(/textureTier==='4k-preferred'\?\(environmentIs4K\?'NATIVE 4K PBR':'2K PBR FALLBACK'\)/.test(main), 'UI must report a verified fallback rather than claim 4K without it.');
  check(/if\(!await getNativeEnvironment4KManifest\(\)\)return false/.test(main), 'Dynamic native 4K loading must retain the current pack when no valid manifest exists.');
  check(/if\(Math\.min\(width,height\)<4096\)throw new Error/.test(main), 'Native 4K maps must be decoded and dimension-checked before replacement.');

  if (!await pathExists(NATIVE_4K_MANIFEST_PATH)) {
    console.log('INFO  Native 4K pack absent; verified 2K fallback policy.');
    return;
  }
  const manifest = JSON.parse(await readFile(NATIVE_4K_MANIFEST_PATH, 'utf8'));
  const dimensions = manifest?.runtimeFormat?.dimensions;
  check(Array.isArray(dimensions) && dimensions.length >= 2 && Math.min(Number(dimensions[0]) || 0, Number(dimensions[1]) || 0) >= 4096, 'Bundled native 4K manifest must declare at least 4096×4096 runtime dimensions.');
  const files = manifestMapFiles(manifest);
  for (const file of environmentPbrFiles) {
    check(files.has(file), `Native 4K manifest omits ${file}.`);
    check(await pathExists(resolve(dirname(NATIVE_4K_MANIFEST_PATH), file)), `Native 4K texture is missing: ${file}.`);
  }
});

await test('embedded preview protects itself from unsupported Extreme SSR', () => {
  check(/function runtimeGraphicsQuality\(quality\)\{return embeddedDesktopRuntime&&quality==='extreme'\?'high':quality\}/.test(main), 'Embedded runtime must map Extreme to the safe High compositor preset.');
  check(/const startupRuntimeGraphicsQuality=runtimeGraphicsQuality\(startupGraphicsQuality\)/.test(main) && /const requestedGraphicsQuality=startupRuntimeGraphicsQuality/.test(main), 'Initial graphics quality must use the embedded-safe selector.');
  check(/runtimeSelected=runtimeGraphicsQuality\(selected\)/.test(main), 'Manual and AUTO quality selection must use the embedded-safe selector.');
  check(/SAFE FALLBACK/.test(main), 'The UI must disclose an embedded graphics fallback.');
  check(/function consumeComposerGlError\(\)/.test(pipeline) && /WebGL post-processing validation failed/.test(pipeline), 'Composer rendering must fall back after a WebGL validation failure.');
});

await test('GPU-memory estimate refreshes after resize', () => {
  check(/function graphicsMemoryEstimate\(preset,diagnostics=graphics\?\.getDiagnostics\?\.\(\)\)/.test(main), 'Graphics memory estimator is missing.');
  check(/diagnostics\?\.effectiveOutputWidth/.test(main) && /pixels=outputWidth\*outputHeight/.test(main), 'Graphics memory estimate must use the live renderer drawing-buffer dimensions.');
  check(/function graphicsRenderTargetEstimate\(\)/.test(main) && /object\.isInstancedMesh/.test(main) && /object\.isSkinnedMesh/.test(main), 'Graphics memory estimate must include compositor targets, instancing, and skeleton buffers.');
  check(/addEventListener\('resize',\(\)=>\{graphics\.resize\(innerWidth,innerHeight,devicePixelRatio\);renderGraphicsMemoryEstimate\(graphics\.getDiagnostics\(\)\.preset\)\}\)/.test(main), 'Resize must refresh both graphics dimensions and the visible GPU-memory estimate.');
});

await test('release packaging cannot archive a stale committed snapshot', () => {
  check(/async function requireCommittedReleaseTree\(\)/.test(release), 'Release packaging must define a committed-tree guard.');
  check(/git\('status', '--porcelain=v1', '--untracked-files=all'\)/.test(release), 'Release packaging must inspect tracked and untracked worktree changes.');
  const packageStart = release.indexOf('async function packageRelease()');
  const packageEnd = release.indexOf('\n\nasync function readZipEntries', packageStart);
  const packageBody = release.slice(packageStart, packageEnd);
  check(packageBody.indexOf('await requireCommittedReleaseTree()') >= 0 && packageBody.indexOf('await requireCommittedReleaseTree()') < packageBody.indexOf("await git('archive'"), 'Release packaging must reject a dirty tree before git archive creates the ZIP.');
});

console.log(`\nGraphics QA: ${checks} checks, ${failures.length} failure${failures.length === 1 ? '' : 's'}.`);
if (failures.length) {
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
}
