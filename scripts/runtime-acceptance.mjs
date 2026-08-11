#!/usr/bin/env node

/**
 * Deterministic acceptance gate for the browser-facing SPECTER runtime.
 *
 * This is deliberately dependency-free so it can run in Pages CI.  It proves
 * the connections that turn the local browser QA routes and visible controls
 * into real mission actions.  It does not pretend to replace a rendered
 * browser playthrough; docs/QA/runtime-acceptance-harness.md records those
 * small, real-runtime checks and the boundary between the two layers.
 *
 * Optional local-server probe:
 *   node scripts/runtime-acceptance.mjs --url http://127.0.0.1:4175/
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = Object.freeze({
  main: resolve(ROOT, 'src/main.js'),
  world: resolve(ROOT, 'src/world-overhaul.js'),
  audio: resolve(ROOT, 'src/audio-overhaul.js'),
  tactical: resolve(ROOT, 'src/tactical-animation.js'),
  index: resolve(ROOT, 'index.html')
});

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}

async function test(name, callback) {
  try {
    await callback();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`FAIL  ${name}`);
  }
}

/** Return a balanced named function body without importing the browser module. */
function functionBody(source, name) {
  const found = new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?function\\s+${name}\\s*\\(`, 'm').exec(source);
  check(Boolean(found), `Function ${name} is missing.`);
  const parameterStart = source.indexOf('(', found.index);
  let parameterDepth = 0;
  let parameterEnd = -1;
  let quote = '';
  let escaped = false;
  for (let index = parameterStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '(') parameterDepth += 1;
    if (character === ')') {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }
  check(parameterEnd >= 0, `Function ${name} has an unclosed parameter list.`);
  const opening = source.indexOf('{', parameterEnd + 1);
  check(opening >= 0, `Function ${name} has no opening brace.`);
  let depth = 0;
  quote = '';
  escaped = false;
  for (let index = opening; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(found.index, index + 1);
    }
  }
  throw new Error(`Function ${name} has no closing brace.`);
}

const [main, world, audio, tactical, index] = await Promise.all(
  Object.values(paths).map(path => readFile(path, 'utf8'))
);

await test('graphics panel exposes every persistent user-facing control', () => {
  for (const id of [
    'graphicsButton', 'graphicsQuickButton', 'graphicsPanel', 'graphicsRenderScale',
    'graphicsTextureTier', 'graphicsShadowQuality', 'graphicsVegetationDensity',
    'graphicsSSAO', 'graphicsSSR', 'graphicsBloom', 'graphicsAntialias',
    'graphicsGrass', 'graphicsFog', 'graphicsVramEstimate', 'voiceVolume'
  ]) check(index.includes(`id="${id}"`), `Missing visible graphics/audio control #${id}.`);
  for (const quality of ['auto', 'intel', 'performance', 'balanced', 'high', 'ultra', 'extreme']) {
    check(index.includes(`data-quality="${quality}"`), `Missing ${quality} graphics preset button.`);
  }

  check(/const startupGraphicsPreference=isGraphicsQualityChoice\(startupQualityQuery\)\?startupQualityQuery:\(isGraphicsQualityChoice\(startupRememberedQuality\)\?startupRememberedQuality:AUTO_GRAPHICS_QUALITY\)/.test(main), 'An explicit quality query must deterministically override remembered settings.');
  check(/bootGraphicsCustomSettings=hasExplicitGraphicsQualityQuery\?\{\}:JSON\.parse\(localStorage\.getItem\(graphicsCustomStorageKey\)/.test(main), 'Explicit quality routes must not inherit stale custom graphics settings.');
  const setQuality = functionBody(main, 'setGraphicsQuality');
  check(/graphics\.setQuality\(runtimeSelected\)/.test(setQuality), 'Preset selection must update the active renderer immediately.');
  check(/localStorage\.setItem\(qualityStorageKey,quality\)/.test(setQuality), 'Preset selection must persist the chosen quality.');
  check(/localStorage\.removeItem\(graphicsCustomStorageKey\)/.test(setQuality), 'Preset selection must clear an incompatible custom override.');
  const applyCustom = functionBody(main, 'applyCustomGraphicsSettings');
  check(/graphics\.setCustomSettings\(customSettings\)/.test(applyCustom), 'Custom settings must update the active renderer immediately.');
  check(/localStorage\.setItem\(graphicsCustomStorageKey,JSON\.stringify\(bootGraphicsCustomSettings\)\)/.test(applyCustom), 'Custom settings must persist their full draft.');
  check(/renderGraphicsMemoryEstimate\(graphicsCustomDraft\(\)\)/.test(main), 'The GPU estimate must update while the render-scale slider is adjusted.');
});

await test('AUTO evaluates real capability inputs and keeps a conservative fallback', () => {
  const recommendSource = functionBody(main, 'recommendedGraphicsQuality');
  const recommend = Function(`"use strict";${recommendSource};return recommendedGraphicsQuality;`)();
  const capable = {
    renderer: 'ANGLE (Generic GPU)', webgl2: true, maxTextureSize: 16384,
    maxRenderbufferSize: 16384, maxSamples: 4, maxAnisotropy: 16,
    deviceMemoryGB: 8, cpuCores: 8, displayPixels: 1920 * 1080
  };
  check(recommend({ ...capable, renderer: 'Intel(R) HD Graphics 4600' }) === 'intel', 'Named Intel HD 4600 must use Competitive Low.');
  check(recommend({ ...capable, maxTextureSize: 4096 }) === 'intel', 'A 4096px texture limit must use Competitive Low.');
  check(recommend({ ...capable, deviceMemoryGB: 2 }) === 'intel', 'A 2 GB device-memory report must use Competitive Low.');
  check(recommend(capable, 40) === 'intel', 'A sustained 40 ms P90 must use Competitive Low.');
  check(recommend(capable, 16) !== 'intel', 'A capable device with a healthy sample must not be forced to Intel.');
  check(/const autoBenchmark=\{active:false,pending:false,samples:\[\],warmupFrames:45,warmup:0,minimumFrames:120,hitches:0\}/.test(main), 'AUTO must retain a bounded warm-up and sample window.');
  check(/if\(!extractionSequence\)sampleAutoGraphicsBenchmark\(rawDt\)/.test(main), 'AUTO must sample gameplay time only outside the extraction cinematic.');
  check(/toast\(`AUTO GRAPHICS/.test(main), 'AUTO must disclose the measured selection to the player.');
});

await test('localhost-only QA routes drive the real breaker, exterior, forest, and victory entries', () => {
  check(/const localQAMode=\(location\.hostname==='127\.0\.0\.1'\|\|location\.hostname==='localhost'\)\?new URLSearchParams\(location\.search\)\.get\('qa'\):null/.test(main), 'QA routes must remain unavailable on the published game.');
  const applyQA = functionBody(main, 'applyLocalQA');
  for (const mode of ['exterior', 'forest', 'breaker', 'storage', 'utility', 'victory']) {
    check(applyQA.includes(`localQAMode==='${mode}'`), `Local QA route ${mode} is missing.`);
  }
  check(/startButton\.onclick=.*?ensureAudio\(\);applyLocalQA\(\);/s.test(main), 'QA setup must run only after the actual mission start path and audio activation.');
  const interact = functionBody(main, 'interact');
  check(/raycaster\.setFromCamera\(new THREE\.Vector2\(\),camera\)/.test(interact), 'Breaker use must raycast from the first-person center view.');
  check(/h&&h\.distance<2\.7/.test(interact), 'Breaker use must retain a close-range constraint.');
  const restore = functionBody(main, 'restorePower');
  check(/worldOverhaul\.setPowered\(true\)/.test(restore), 'Breaker use must power the environment.');
  check(/EXIT UNLOCKING/.test(restore), 'Breaker use must advance the mission objective.');
  const breakerFactory = functionBody(world, 'createBreakerBox');
  check(/breaker-wall-recess/.test(breakerFactory) && /breaker-lever-interaction-target/.test(breakerFactory), 'The breaker must retain its visible recessed cabinet and dedicated lever target.');
});

await test('player weapon controls remain connected to authored action, visual, and sound paths', () => {
  const keyboard = /addEventListener\('keydown',e=>\{([\s\S]*?)\}\);/.exec(main)?.[1] || '';
  for (const [code, action] of [['KeyR', 'reload'], ['KeyC', 'chamberCheck'], ['KeyI', 'inspectWeapon'], ['KeyB', 'toggleMode'], ['Digit2', "switchWeapon('pistol')"]]) {
    check(keyboard.includes(code) && keyboard.includes(action), `${code} no longer reaches ${action}.`);
  }
  const shoot = functionBody(main, 'shoot');
  check(/triggerFireAnimation\(currentWeapon\);gunshot\(currentWeapon\);muzzleFlash\(\);ejectCasing\(currentWeapon\)/.test(shoot), 'A shot must jointly trigger animation, audio, muzzle flash, and casing ejection.');
  const reload = functionBody(main, 'reload');
  check(/TacticalWeaponAction\.RELOAD_EMPTY/.test(reload) && /TacticalWeaponAction\.TACTICAL_RELOAD/.test(reload), 'Reload must select the appropriate authored action timeline.');
  const actionUpdate = functionBody(main, 'updateViewmodelAction');
  check(/updateRifleReloadMechanics/.test(actionUpdate) && /updatePistolReloadMechanics/.test(actionUpdate), 'Weapon actions must drive captured physical rifle and M9 magazine mechanics.');
  check(/marker\.name==='magOut'/.test(actionUpdate) && /marker\.name==='ready'/.test(actionUpdate), 'Reload marker events must remain connected to the action timeline.');
  check(/TacticalWeaponAction\.INSPECT/.test(tactical) && /TacticalWeaponAction\.CHAMBER/.test(tactical), 'Tactical action definitions must retain inspect and chamber support.');
});

await test('enemy voice is triggerable, positional, throttled, subtitled, and independently configurable', () => {
  const requestVoice = functionBody(main, 'requestEnemyVoice');
  check(/voiceNextAt/.test(requestVoice) && /enemyVoiceSquadNextAt/.test(requestVoice) && /enemyVoiceGlobalNextAt/.test(requestVoice), 'Enemy voice must keep actor, squad, and global cooldowns.');
  check(/audio\?\.playEnemyCall/.test(requestVoice), 'Enemy calls must reach the positional audio director.');
  const subtitle = functionBody(main, 'showEnemySubtitle');
  check(/enemySubtitle\.textContent/.test(subtitle) && /enemySubtitle\.classList\.add\('active'\)/.test(subtitle), 'Enemy calls must display an accessible subtitle.');
  check(/id="enemySubtitle" aria-live="polite"/.test(index), 'Enemy subtitle region must remain live and accessible.');
  const volume = functionBody(main, 'setVoiceVolume');
  check(/audio\.setVoiceVolume\(normalized\)/.test(volume), 'Voice volume UI must target the dedicated voice bus.');
  check(/localStorage\.setItem\(voiceSettingsStorageKey/.test(volume), 'Voice volume changes must persist.');
  check(/playEnemyCall/.test(audio) && /bus: 'voice'/.test(audio), 'The audio director must preserve a dedicated voice bus.');
});

await test('grounded enemy deaths deterministically hand off to pooled weapon and gear drops', () => {
  const death = functionBody(main, 'beginEnemyDeath');
  check(/data\.dropQueued=true/.test(death) && /triggerDeath/.test(death), 'A death must queue visual equipment drops with its grounded pose.');
  check(/const grounded=data\.deathElapsed>=data\.deathSettleDuration\+ENEMY_DEATH_SETTLE_HOLD/.test(main), 'Drops must wait until the death pose has settled.');
  check(/if\(data\.dropQueued&&!data\.dropStarted&&grounded\)beginEnemyEquipmentDrop/.test(main), 'Settled deaths must enter the drop path exactly once.');
  const beginDrop = functionBody(main, 'beginEnemyEquipmentDrop');
  check(/beginDroppedCombatProp\(data\.weapon/.test(beginDrop), 'The carried weapon must enter the drop system.');
  check(/for\(const \[index,gear\] of \(data\.droppableGear\|\|\[\]\)\.entries\(\)\)/.test(beginDrop), 'Configured tactical gear must enter the drop system.');
  const updateDrops = functionBody(main, 'updateDroppedCombatProps');
  check(/prop\.settled=true/.test(updateDrops) && /releaseDroppedCombatProp\(prop\)/.test(updateDrops), 'Dropped props must settle and eventually return to a bounded pool.');
  check(/localQAMode==='victory'/.test(functionBody(main, 'applyLocalQA')) && /beginEnemyDeath\(enemy/.test(functionBody(main, 'applyLocalQA')), 'Victory QA route must exercise the real death entry point before extraction.');
});

await test('extraction is a gated mission handoff into the victory screen', () => {
  const startExtraction = functionBody(main, 'startExtractionSequence');
  check(/worldOverhaul\.setExtractionGateOpen\(true\)/.test(startExtraction), 'Extraction must open the perimeter gate.');
  check(/fireHeld=false;setAim\(false\);moveVelocity\.set\(0,0,0\)/.test(startExtraction), 'Extraction must neutralize player combat input before the cinematic run.');
  const updateExtraction = functionBody(main, 'updateExtractionSequence');
  check(/playExtractionPursuitCue\(sequence,t\)/.test(updateExtraction), 'Extraction must retain the pursuit voice and gunfire cue.');
  check(/completeMission\(\)/.test(updateExtraction), 'Extraction must complete after the gate-run sequence.');
  const completeMission = functionBody(main, 'completeMission');
  check(/missionWon=true;started=false/.test(completeMission), 'Mission completion must stop normal gameplay.');
  check(/victoryPanel'\)\.classList\.add\('active'\)/.test(completeMission), 'Mission completion must show the victory screen.');
  check(/powerOn&&kills>=enemies\.length&&camera\.position\.distanceTo\(extractionPoint\)<6\.6/.test(main), 'Normal extraction must remain gated by restored power, secured enemies, and arrival.');
});

const urlIndex = process.argv.indexOf('--url');
if (urlIndex >= 0) {
  const url = process.argv[urlIndex + 1];
  await test('optional local server probe exposes the browser mission shell', async () => {
    check(typeof url === 'string' && /^https?:\/\//.test(url), '--url must be followed by an http(s) address.');
    const response = await fetch(url, { redirect: 'error' });
    check(response.ok, `Local mission endpoint returned ${response.status}.`);
    const html = await response.text();
    check(html.includes('SPECTER: BLACKSITE') && html.includes('id="startButton"'), 'Local mission shell is missing expected start UI.');
  });
}

console.log(`\nRuntime acceptance QA: ${checks} checks, ${failures.length} failure${failures.length === 1 ? '' : 's'}.`);
if (failures.length) {
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
}
