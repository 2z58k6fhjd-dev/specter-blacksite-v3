#!/usr/bin/env node

/**
 * Focused, dependency-free release checks for SPECTER's gameplay contracts.
 *
 * Browser playthroughs still verify feel and rendering. This suite protects
 * the mission-critical source connections that must survive before a Pages
 * package is published: the breaker, physical weapon effects, enemy voice,
 * grounded equipment drops, and the extraction handoff.
 *
 * Run with: node scripts/gameplay-qa.mjs
 */
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_PATH = resolve(ROOT, 'src/main.js');
const WORLD_PATH = resolve(ROOT, 'src/world-overhaul.js');
const TACTICAL_PATH = resolve(ROOT, 'src/tactical-animation.js');
const AUDIO_PATH = resolve(ROOT, 'src/audio-overhaul.js');
const INDEX_PATH = resolve(ROOT, 'index.html');

let checks = 0;
const failures = [];

function check(condition, message) {
  checks += 1;
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

function functionBody(source, name) {
  const matcher = new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?(?:function\\s+)?${name}\\s*\\(`, 'm');
  const match = matcher.exec(source);
  check(Boolean(match), `Function ${name} is missing.`);
  const parameters = source.indexOf('(', match.index);
  check(parameters >= 0, `Function ${name} has no parameter list.`);
  let parameterDepth = 0;
  let parameterEnd = -1;
  let parameterQuote = '';
  let parameterEscaped = false;
  for (let index = parameters; index < source.length; index += 1) {
    const character = source[index];
    if (parameterQuote) {
      if (parameterEscaped) parameterEscaped = false;
      else if (character === '\\') parameterEscaped = true;
      else if (character === parameterQuote) parameterQuote = '';
      continue;
    }
    if (character === '\'' || character === '"' || character === '`') {
      parameterQuote = character;
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
  check(opening >= 0, `Function ${name} has no opening body.`);
  let depth = 0;
  let quote = '';
  let escaped = false;
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
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }
  throw new Error(`Function ${name} has no closing body.`);
}

function objectKeys(source, marker) {
  const start = source.indexOf(marker);
  check(start >= 0, `${marker} is missing.`);
  const end = source.indexOf('});', start);
  check(end > start, `${marker} has no stable closing boundary.`);
  return [...source.slice(start, end).matchAll(/^\s*([a-z][a-z0-9_-]*)\s*:/gmi)].map(match => match[1]);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const [main, world, tactical, audio, index] = await Promise.all([
  readFile(MAIN_PATH, 'utf8'),
  readFile(WORLD_PATH, 'utf8'),
  readFile(TACTICAL_PATH, 'utf8'),
  readFile(AUDIO_PATH, 'utf8'),
  readFile(INDEX_PATH, 'utf8')
]);

await test('breaker is a dedicated, reachable, collision-backed mission control', () => {
  const breaker = functionBody(world, 'createBreakerBox');
  check(breaker.includes("group.name='breaker-box'"), 'Breaker must keep a dedicated world group.');
  check(/group\.position\.set\(-8\.83,1\.55,5\.4\);group\.rotation\.y=Math\.PI\/2/.test(breaker), 'Breaker must retain its wall-aligned placement.');
  check(breaker.includes("'breaker-wall-recess'"), 'Breaker must include a recessed wall backing.');
  check(breaker.includes("leverPivot.name='breaker-lever-pivot'"), 'Breaker must keep a named animated control pivot.');
  check(breaker.includes("'breaker-main-handle'"), 'Breaker must keep a visible main handle.');
  check(breaker.includes("'breaker-lever-interaction-target'"), 'Breaker must keep a dedicated interaction target.');
  check(breaker.includes("interactionTarget.userData.interaction='main-breaker'"), 'Breaker interaction target must identify the main breaker.');
  check(/leverPivot\.add\(interactionTarget\)/.test(breaker), 'Breaker interaction target must remain aligned with the animated lever.');
  check(breaker.includes("'breaker-cabinet-collider'"), 'Breaker must retain a cabinet collision footprint.');
  check(/collision\.push\(collider\)/.test(breaker), 'Breaker cabinet collider must be registered for movement collision.');
  check(/return \{[^}]*interactionTarget[^}]*collider/.test(breaker), 'Breaker factory must expose its control and collider to the mission.');

  check(/const switchGroup=worldOverhaul\.breaker\.interactionTarget/.test(main), 'Mission interaction must use the breaker’s dedicated target.');
  const interact = functionBody(main, 'interact');
  check(/raycaster\.setFromCamera\(new THREE\.Vector2\(\),camera\)/.test(interact), 'Breaker interaction must raycast from the player view.');
  check(/raycaster\.intersectObject\(switchGroup,true\)/.test(interact), 'Breaker interaction may only raycast the dedicated target.');
  check(/h&&h\.distance<2\.7/.test(interact), 'Breaker interaction must enforce close-range use.');
  check(/restorePower\(\)/.test(interact), 'Breaker interaction must drive mission progression.');
  const restore = functionBody(main, 'restorePower');
  check(/worldOverhaul\.setPowered\(true\)/.test(restore) && /audio\.playBreaker/.test(restore), 'Breaker use must power the world and provide feedback.');
  check(/audio\.playDoor/.test(restore) && /EXIT UNLOCKING/.test(restore), 'Breaker use must unlock and communicate the next objective.');
});

await test('reload timeline drives a captured physical rifle magazine', () => {
  const timing = tactical.slice(tactical.indexOf('const ACTION_TIMING_DATA'), tactical.indexOf('const WEAPON_ACTION_TIMINGS'));
  check(/\[TacticalWeaponAction\.RELOAD\]:\s*\{[\s\S]*magOut:[^}]*freshMag:[^}]*magIn:[^}]*ready:/.test(timing), 'Rifle reload timing must include magazine-out, fresh-mag, insert, and ready markers.');
  check(/\[TacticalWeaponAction\.RELOAD_EMPTY\]:\s*\{[\s\S]*magOut:[^}]*freshMag:[^}]*boltRelease:[^}]*ready:/.test(timing), 'Empty rifle reload timing must include a bolt release.');
  check(/\[TacticalWeaponAction\.TACTICAL_RELOAD\]:\s*\{[\s\S]*magOut:[^}]*freshMag:[^}]*magIn:[^}]*ready:/.test(timing), 'Tactical rifle reload timing must retain magazine markers.');

  const capture = functionBody(main, 'captureRifleReloadParts');
  check(/model\.getObjectByName\('mag'\)/.test(capture), 'Rifle reload must capture the authored inserted magazine mesh.');
  check(/basePosition:magazine\.position\.clone\(\)/.test(capture) && /outOffset:parentOut\.sub\(parentOrigin\)/.test(capture), 'Captured rifle magazine must retain a base and physical removal offset.');
  const mechanics = functionBody(main, 'updateRifleReloadMechanics');
  check(/if\(p<\.32\)/.test(mechanics) && /else if\(p<\.46\)/.test(mechanics) && /else if\(p<\.69\)/.test(mechanics), 'Rifle reload must include distinct out, transfer, and insertion phases.');
  check(/magazine\.visible=false/.test(mechanics) && /magazine\.position\.copy\(basePosition\)\.addScaledVector/.test(mechanics), 'Rifle reload must visibly move and temporarily remove the physical magazine.');
  const installRifle = functionBody(main, 'installRifle');
  const installVariants = functionBody(main, 'installRifleVariants');
  check(/captureRifleReloadParts\(model,rifleHolder,weaponRig\.rifle\)/.test(installRifle), 'Primary rifle must wire its captured magazine to the reload system.');
  check(/captureRifleReloadParts\(model,holder,rig\)/.test(installVariants), 'Rifle variants must wire their captured magazines to the reload system.');

  const capturePistol = functionBody(main, 'capturePistolReloadParts');
  check(/model\.getObjectByName\('Clip_lp\.001'\)/.test(capturePistol), 'M9 reload must capture the authored inserted magazine hierarchy rather than create a stand-in.');
  check(/outOffset:parentOut\.sub\(parentOrigin\)/.test(capturePistol), 'M9 reload must retain a physical magazine removal offset.');
  const pistolMechanics = functionBody(main, 'updatePistolReloadMechanics');
  check(/markers\.magRelease/.test(pistolMechanics) && /markers\.magOut/.test(pistolMechanics) && /markers\.freshMag/.test(pistolMechanics) && /markers\.seated/.test(pistolMechanics), 'M9 magazine motion must follow the authored reload marker sequence.');
  check(/magazine\.visible=false/.test(pistolMechanics) && /magazine\.position\.copy\(basePosition\)\.addScaledVector/.test(pistolMechanics), 'M9 reload must animate the authored magazine through out, transfer, and reseat phases.');

  const reload = functionBody(main, 'reload');
  check(/TacticalWeaponAction\.RELOAD_EMPTY/.test(reload) && /TacticalWeaponAction\.TACTICAL_RELOAD/.test(reload), 'Reload entry point must select empty and tactical timeline variants.');
  check(/viewmodelActionTimeline\.start\(action/.test(reload) && /viewmodelActionKind='reload'/.test(reload), 'Reload entry point must start the authored viewmodel timeline.');
  check(/profile\.reloadSeconds\?\.\[empty\?'empty':'tactical'\]/.test(reload), 'Weapon profiles must retain distinct tactical and empty reload durations.');
  const updateAction = functionBody(main, 'updateViewmodelAction');
  check(/updateRifleReloadMechanics\(currentWeapon,viewmodelActionTimeline\.normalizedTime/.test(updateAction), 'Reload mechanics must sample the same timeline used for player animation.');
  check(/marker\.name==='magOut'/.test(updateAction) && /marker\.name==='freshMag'/.test(updateAction), 'Reload markers must drive magazine removal and insertion feedback.');
  check(/finishPendingReload\(\)/.test(updateAction), 'Ammo transfer must remain tied to reload timeline completion.');
  check(/updatePistolReloadMechanics\(currentWeapon/.test(updateAction), 'Pistol reload must update its captured authored magazine from the same action timeline.');

  check(/output\.magazineOut = 0/.test(tactical), 'Each action sample must reset magazine motion before choosing its curve.');
  check(/if \(actionType === TacticalWeaponAction\.CHAMBER\)[\s\S]*?output\.chamber = chamber/.test(tactical), 'Chamber checks must use a dedicated mechanism curve rather than reload motion.');
  check(/output\.bolt = output\.emptyReload \?/.test(tactical), 'Tactical reloads must not perform the empty-reload release phase.');
});

await test('M9 slide, casing, muzzle, and under-barrel light use weapon anchors', () => {
  const pistol = functionBody(main, 'installPistol');
  check(/pistolSlide=model\.getObjectByName\('Shutter_lp\.001'\)/.test(pistol), 'M9 must capture the authored slide mesh.');
  check(/pistolSlideBase\.copy\(pistolSlide\.position\)/.test(pistol) && /pistolSlideTravel\.copy\(back\.sub\(start\)\)/.test(pistol), 'M9 slide must keep a physical base position and travel vector.');
  check(/weaponRig\.pistol\.muzzle=addAnchor\([^;]*'pistol-muzzle'\)/.test(pistol), 'M9 muzzle flash must have an end-of-barrel anchor.');
  check(/weaponRig\.pistol\.lightMount=addAnchor\([^;]*'pistol-underbarrel-light'\)/.test(pistol), 'M9 flashlight must have an under-barrel anchor.');
  check(/weaponRig\.pistol\.eject=addAnchor\([^;]*'pistol-ejection-port'\)/.test(pistol), 'M9 shell ejection must have an ejection-port anchor.');

  const updateSlide = functionBody(main, 'updatePistolSlide');
  check(/pistolSlideLocked/.test(updateSlide) && /pistolSlideTime/.test(updateSlide), 'M9 slide must support both shot cycling and empty lockback.');
  check(/pistolSlide\.position\.copy\(pistolSlideBase\)\.addScaledVector\(pistolSlideTravel,amount\)/.test(updateSlide), 'M9 slide update must move the captured physical slide.');
  check(/viewmodelActionKind==='chamber'/.test(updateSlide) && /actionSample\?\.chamber/.test(updateSlide), 'M9 chamber checks must drive the captured physical slide from the dedicated timeline curve.');
  const trigger = functionBody(main, 'triggerFireAnimation');
  check(/if\(kind==='pistol'\)\{[\s\S]*pistolSlideTime=0;[\s\S]*pistolSlideLocked=ammo\.pistol===0/.test(trigger), 'M9 firing must reset slide motion and lock after an empty shot.');

  const attachLight = functionBody(main, 'attachFlashlightToWeapon');
  check(/weaponRig\[kind\]\?\.lightMount/.test(attachLight) && /mount\.add\(flashlight,flashlight\.target\)/.test(attachLight), 'Flashlight must attach to the active weapon’s light mount.');
  const muzzleBurst = functionBody(main, 'spawnMuzzleBurst');
  check(/anchor\.getWorldPosition/.test(muzzleBurst) && /transformDirection\(anchor\.matrixWorld\)/.test(muzzleBurst), 'Muzzle burst must originate and project from its weapon anchor.');
  const casing = functionBody(main, 'ejectCasing');
  check(/anchorOverride\|\|weaponRig\[kind\]\.eject/.test(casing), 'Casing system must use the weapon ejection anchor.');
  check(/right\.multiplyScalar/.test(casing) && /casings\.push/.test(casing), 'Casing system must launch and track physical casings.');
  const shoot = functionBody(main, 'shoot');
  check(/triggerFireAnimation\(currentWeapon\);gunshot\(currentWeapon\);muzzleFlash\(\);ejectCasing\(currentWeapon\)/.test(shoot), 'Weapon firing must trigger animation, sound, flash, and casing ejection together.');
});

await test('enemy voice clips, types, volume control, and subtitles remain wired', async () => {
  const voicePatterns = objectKeys(audio, 'const VOICE_PATTERNS = Object.freeze({');
  const requiredTypes = ['contact', 'investigate', 'backup', 'flank', 'suppress', 'retreat', 'down', 'clear', 'radio'];
  check(voicePatterns.length >= 10, 'Audio director must retain a varied enemy-voice type library.');
  for (const type of requiredTypes) check(voicePatterns.includes(type), `Audio director is missing ${type} enemy voice behavior.`);

  const loadAudio = functionBody(main, 'loadAudioAssets');
  const clips = [...loadAudio.matchAll(/\{kind:'voice',id:'([^']+)',url:'([^']+)'\}/g)];
  check(clips.length >= 12, 'At least twelve licensed enemy voice clips must be staged.');
  const clipsByType = new Map();
  for (const [, id, url] of clips) {
    const [type] = id.split(':');
    clipsByType.set(type, (clipsByType.get(type) || 0) + 1);
    const asset = resolve(ROOT, url.replace(/^\.\//, ''));
    check(await exists(asset), `Staged enemy voice clip is missing: ${url}.`);
  }
  for (const type of ['contact', 'investigate', 'backup', 'flank', 'retreat', 'suppress', 'down']) {
    check((clipsByType.get(type) || 0) >= 2, `${type} must retain at least two staged voice variants.`);
  }
  check(/audio\.loadEnemyVoiceSamples\(enemyVoiceSamplePayloads\)/.test(main), 'Fetched enemy voice clips must be decoded into the audio director.');
  const loadVoice = functionBody(audio, 'loadEnemyVoiceSamples');
  check(/const \[type, variant = 'default'\] = id\.split\('\:'\)/.test(loadVoice), 'Voice loader must retain per-type variants.');
  check(/VOICE_PATTERNS\[type\]/.test(loadVoice) && /variants\.push\(\{ variant, buffer \}\)/.test(loadVoice), 'Voice loader must validate types and retain decoded variants.');
  const playVoice = functionBody(audio, 'playEnemyCall');
  check(/bus: 'voice'/.test(playVoice) && /this\._enemyVoiceSamples\[type\]/.test(playVoice), 'Enemy calls must use the dedicated voice bus and loaded clips when available.');

  const voiceRequest = functionBody(main, 'requestEnemyVoice');
  check(/voiceNextAt/.test(voiceRequest) && /enemyVoiceSquadNextAt/.test(voiceRequest) && /enemyVoiceGlobalNextAt/.test(voiceRequest), 'Enemy calls must be throttled per actor, squad, and globally.');
  check(/audio\?\.playEnemyCall/.test(voiceRequest), 'Enemy state changes must request positional voice playback.');
  const subtitle = functionBody(main, 'showEnemySubtitle');
  check(/enemySubtitle\.textContent/.test(subtitle) && /enemySubtitle\.classList\.add\('active'\)/.test(subtitle), 'Enemy calls must surface subtitles.');
  check(/setTimeout\(\(\)=>enemySubtitle\.classList\.remove\('active'\)/.test(subtitle), 'Enemy subtitles must clear after their display duration.');
  check(/id="enemySubtitle" aria-live="polite"/.test(index), 'Enemy subtitle region must remain accessible.');

  check(/voiceVolumeControl=document\.getElementById\('voiceVolume'\)/.test(main), 'Graphics/audio panel must expose enemy voice volume control.');
  const setVolume = functionBody(main, 'setVoiceVolume');
  check(/audio\.setVoiceVolume\(normalized\)/.test(setVolume) && /enemyVoiceVolume:normalized/.test(setVolume), 'Voice volume must update the dedicated bus and persist safely.');
  check(/setVoiceVolume\(value, fadeSeconds = 0\.08\)/.test(audio), 'Audio director must expose a smooth dedicated voice-volume setter.');
});

await test('enemy weapons and complete gear drop only after grounded death settling', () => {
  check(/const DROP_ACTIVE_LIMIT=\d+,DROP_POOL_LIMIT=\d+,DROP_POOL_PER_KEY_LIMIT=\d+,DROP_LIFETIME=\d+,ENEMY_DEATH_SETTLE_HOLD=/.test(main), 'Drop system must retain bounded active, pooled, and lifetime budgets.');
  const acquire = functionBody(main, 'acquireDroppedCombatProp');
  const snapshot = functionBody(main, 'cloneDroppedCombatSource');
  check(/savedUserData/.test(snapshot) && /source\.clone\(true\)/.test(snapshot) && /node\.userData=userData/.test(snapshot), 'Drop snapshots must remove circular live metadata before cloning and restore the source afterward.');
  check(/const pooledObject=bucket\?\.pop\(\)/.test(acquire) && /pooledObject\|\|cloneDroppedCombatSource\(source\)/.test(acquire), 'Dropped props must reuse pooled objects before creating a safe visual snapshot.');
  const release = functionBody(main, 'releaseDroppedCombatProp');
  check(/bucket\.length<DROP_POOL_PER_KEY_LIMIT&&droppedCombatPropPoolSize<DROP_POOL_LIMIT/.test(release), 'Dropped prop pool must remain bounded.');
  const beginDrop = functionBody(main, 'beginEnemyEquipmentDrop');
  check(/data\.dropStarted=true/.test(beginDrop) && /beginDroppedCombatProp\(data\.weapon/.test(beginDrop), 'Enemy death must drop the equipped weapon once.');
  check(/for\(const \[index,gear\] of \(data\.droppableGear\|\|\[\]\)\.entries\(\)\)/.test(beginDrop), 'Enemy death must process all configured gear drops.');
  check(/beginDroppedCombatProp\(gear/.test(beginDrop), 'Configured gear must enter the pooled drop system.');
  const updateDrops = functionBody(main, 'updateDroppedCombatProps');
  check(/prop\.object\.position\.y<=dropGroundHeight\(\)/.test(updateDrops) && /prop\.settled=true/.test(updateDrops), 'Dropped props must settle on the ground.');
  check(/prop\.age>DROP_LIFETIME/.test(updateDrops) && /releaseDroppedCombatProp\(prop\)/.test(updateDrops), 'Expired dropped props must return to the pool.');
  const death = functionBody(main, 'beginEnemyDeath');
  check(/data\.dropQueued=true/.test(death) && /triggerDeath/.test(death), 'Death must queue drops alongside the grounded death animation.');
  check(/const grounded=data\.deathElapsed>=data\.deathSettleDuration\+ENEMY_DEATH_SETTLE_HOLD/.test(main), 'Enemy kit drops must wait for the grounded death settle window.');
  check(/if\(data\.dropQueued&&!data\.dropStarted&&grounded\)beginEnemyEquipmentDrop/.test(main), 'Enemy kit drops must only begin after a settled death.');
  check(/plate-carrier/.test(main) && /carrier-collar/.test(main) && /battle-belt/.test(main), 'Drop selection must include carrier and belt gear.');
  check(/pouch/.test(main) && /shoulder-\(\?:pad\|cover\)/.test(main) && /knee-pad/.test(main), 'Drop selection must include pouches and protective pads.');
});

await test('extraction locks player input, preserves the run, and reaches victory', () => {
  const damage = functionBody(main, 'damagePlayer');
  check(/if\(extractionSequence\)return/.test(damage), 'Extraction must make pursuit fire non-lethal during the cinematic run.');
  const move = functionBody(main, 'move');
  check(/if\(extractionSequence\)return/.test(move), 'Normal player movement must stop while the extraction sequence owns movement.');
  const start = functionBody(main, 'startExtractionSequence');
  check(/fireHeld=false;setAim\(false\);moveVelocity\.set\(0,0,0\)/.test(start), 'Extraction must clear active firing, ADS, and movement velocity.');
  check(/for\(const code of Object\.keys\(keys\)\)keys\[code\]=false/.test(start), 'Extraction must clear held movement keys.');
  check(/controls\.unlock\?\.\(\)/.test(start) && /worldOverhaul\.setExtractionGateOpen\(true\)/.test(start), 'Extraction must hand off controls and open the forest gate.');
  const update = functionBody(main, 'updateExtractionSequence');
  check(/moving=true;sprinting=true;aiming=false/.test(update), 'Extraction run must force a non-aiming sprint pose.');
  check(/camera\.position\.z=THREE\.MathUtils\.lerp\(sequence\.startZ,extractionRunTarget\.z,runBlend\)/.test(update), 'Extraction must carry the player through the opened gate into the forest.');
  check(/playExtractionPursuitCue\(sequence,t\)/.test(update), 'Extraction must preserve pursuit gunfire and enemy calls.');
  check(/extractionFade\?\.classList\.add\('active'\)/.test(update) && /completeMission\(\)/.test(update), 'Extraction must fade into a mission completion handoff.');
  const complete = functionBody(main, 'completeMission');
  check(/missionWon=true;started=false;fireHeld=false/.test(complete), 'Mission completion must prevent further gameplay input.');
  check(/document\.getElementById\('victoryPanel'\)\.classList\.add\('active'\)/.test(complete), 'Mission completion must activate the victory screen.');
  check(/if\(extractionSequence\)\{e\.preventDefault\(\);return\}/.test(main), 'Keyboard input must be consumed during extraction.');
  check(/if\(!started\|\|extractionSequence\)return;ensureAudio\(\)/.test(main), 'Mouse fire and ADS must be rejected during extraction.');
  check(/if\(!extractionSequence&&powerOn&&kills>=enemies\.length&&camera\.position\.distanceTo\(extractionPoint\)<6\.6\)startExtractionSequence\(\)/.test(main), 'Extraction must require restored power, secured hostiles, and arrival at the zone.');
});

console.log(`\nGameplay QA: ${checks} checks, ${failures.length} failure${failures.length === 1 ? '' : 's'}.`);
if (failures.length) {
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
}
