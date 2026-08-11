import * as THREE from 'three';

/**
 * Low-allocation procedural animation for SPECTER's 127-joint soldier rig.
 *
 * Poses are additive to captured local rest transforms, so the module can animate
 * the existing soldier, the SPECTER operator clone, or a compatible replacement
 * without overwriting its bind pose. The animator owns only mapped bone local
 * transforms; world movement, navigation, weapon meshes, IK and physics remain in
 * the game layer.
 *
 * @module tactical-animation
 */

/** Supported high-level locomotion labels. */
export const TacticalLocomotion = Object.freeze({
  IDLE: 'idle',
  WALK: 'walk',
  RUN: 'run',
  STRAFE: 'strafe',
  RETREAT: 'retreat'
});

/** Grounded procedural death choices. */
export const DeathFallVariant = Object.freeze({
  BACKWARD: 'backward',
  FORWARD: 'forward',
  LEFT: 'left',
  RIGHT: 'right',
  KNEEL_FORWARD: 'kneel-forward',
  COLLAPSE: 'collapse'
});

/** Weapon action labels understood by the timing and pose helpers. */
export const TacticalWeaponAction = Object.freeze({
  RELOAD: 'reload',
  RELOAD_EMPTY: 'reload-empty',
  TACTICAL_RELOAD: 'tactical-reload',
  EQUIP: 'equip',
  HOLSTER: 'holster',
  CHAMBER: 'chamber',
  INSPECT: 'inspect'
});

const BONE_DEFINITIONS = Object.freeze({
  skeletonRoot: {
    aliases: ['root ground_00', 'root ground', 'armature', 'root'],
    patterns: ['rootground', 'armature']
  },
  hips: {
    aliases: ['unused root_03', 'hips', 'pelvis', 'mixamorigHips', 'ValveBiped.Bip01_Pelvis'],
    patterns: ['pelvis', 'hips', 'root03']
  },
  spineLower: {
    aliases: ['spine 1_02', 'spine 1', 'spine', 'mixamorigSpine', 'ValveBiped.Bip01_Spine'],
    patterns: ['spine102', 'spine1', 'spine']
  },
  spineMid: {
    aliases: ['spine 2_04', 'spine 2', 'spine1', 'mixamorigSpine1', 'ValveBiped.Bip01_Spine1'],
    patterns: ['spine204', 'spine2', 'spine1']
  },
  spineUpper: {
    aliases: ['spine 3_05', 'spine 3', 'spine2', 'mixamorigSpine2', 'ValveBiped.Bip01_Spine2'],
    patterns: ['spine305', 'spine3', 'spine2']
  },
  chest: {
    aliases: ['spine 4_01', 'spine 4', 'upper chest', 'chest', 'mixamorigSpine3', 'ValveBiped.Bip01_Spine4'],
    patterns: ['spine401', 'spine4', 'upperchest', 'chest']
  },
  neckLower: {
    aliases: ['head neck lower_06', 'head neck lower', 'neck', 'mixamorigNeck', 'ValveBiped.Bip01_Neck1'],
    patterns: ['headnecklower', 'necklower', 'neck']
  },
  neckUpper: {
    aliases: ['head neck upper_0119', 'head neck upper', 'neck1', 'upper neck'],
    patterns: ['headneckupper', 'neckupper', 'neck1']
  },
  head: {
    aliases: ['head part_0120', 'head part', 'head', 'mixamorigHead', 'ValveBiped.Bip01_Head1'],
    patterns: ['headpart', 'head1', 'head']
  },
  rightClavicle: {
    aliases: ['arm right shoulder 1_010', 'arm right shoulder 1', 'right shoulder', 'mixamorigRightShoulder', 'ValveBiped.Bip01_R_Clavicle'],
    patterns: ['armrightshoulder1', 'rightclavicle', 'rightshoulder']
  },
  rightUpperArm: {
    aliases: ['arm right shoulder 2_011', 'arm right shoulder 2', 'right arm', 'right upper arm', 'mixamorigRightArm', 'ValveBiped.Bip01_R_UpperArm'],
    patterns: ['armrightshoulder2', 'rightupperarm', 'rightarm']
  },
  rightForearm: {
    aliases: ['arm rght elbow_012', 'arm right elbow_012', 'arm right elbow', 'right forearm', 'mixamorigRightForeArm', 'ValveBiped.Bip01_R_Forearm'],
    patterns: ['armrightelbow', 'rightforearm', 'rightelbow']
  },
  rightHand: {
    aliases: ['arm right wrist_013', 'arm right wrist', 'right hand', 'right wrist', 'mixamorigRightHand', 'ValveBiped.Bip01_R_Hand'],
    patterns: ['armrightwrist', 'righthand', 'rightwrist']
  },
  leftClavicle: {
    aliases: ['arm left shoulder 1_034', 'arm left shoulder 1', 'left shoulder', 'mixamorigLeftShoulder', 'ValveBiped.Bip01_L_Clavicle'],
    patterns: ['armleftshoulder1', 'leftclavicle', 'leftshoulder']
  },
  leftUpperArm: {
    aliases: ['arm left shoulder 2_035', 'arm left shoulder 2', 'left arm', 'left upper arm', 'mixamorigLeftArm', 'ValveBiped.Bip01_L_UpperArm'],
    patterns: ['armleftshoulder2', 'leftupperarm', 'leftarm']
  },
  leftForearm: {
    aliases: ['arm left elbow_036', 'arm left elbow', 'left forearm', 'mixamorigLeftForeArm', 'ValveBiped.Bip01_L_Forearm'],
    patterns: ['armleftelbow', 'leftforearm', 'leftelbow']
  },
  leftHand: {
    aliases: ['arm left wrist_037', 'arm left wrist', 'left hand', 'left wrist', 'mixamorigLeftHand', 'ValveBiped.Bip01_L_Hand'],
    patterns: ['armleftwrist', 'lefthand', 'leftwrist']
  },
  rightUpperLeg: {
    aliases: ['leg right thigh_057', 'leg right thigh', 'right up leg', 'right thigh', 'mixamorigRightUpLeg', 'ValveBiped.Bip01_R_Thigh'],
    patterns: ['legrightthigh', 'rightupleg', 'rightthigh']
  },
  rightLowerLeg: {
    aliases: ['leg right knee_058', 'leg right knee', 'right leg', 'right calf', 'mixamorigRightLeg', 'ValveBiped.Bip01_R_Calf'],
    patterns: ['legrightknee', 'rightlowerleg', 'rightcalf']
  },
  rightFoot: {
    aliases: ['leg right ankle_059', 'leg right ankle', 'right foot', 'mixamorigRightFoot', 'ValveBiped.Bip01_R_Foot'],
    patterns: ['legrightankle', 'rightankle', 'rightfoot']
  },
  rightToe: {
    aliases: ['leg right toe_060', 'leg right toe', 'right toe base', 'right toe', 'mixamorigRightToeBase'],
    patterns: ['legrighttoe', 'righttoebase', 'righttoe']
  },
  leftUpperLeg: {
    aliases: ['leg left thigh_061', 'leg left thigh', 'left up leg', 'left thigh', 'mixamorigLeftUpLeg', 'ValveBiped.Bip01_L_Thigh'],
    patterns: ['legleftthigh', 'leftupleg', 'leftthigh']
  },
  leftLowerLeg: {
    aliases: ['leg left knee_062', 'leg left knee', 'left leg', 'left calf', 'mixamorigLeftLeg', 'ValveBiped.Bip01_L_Calf'],
    patterns: ['legleftknee', 'leftlowerleg', 'leftcalf']
  },
  leftFoot: {
    aliases: ['leg left ankle_063', 'leg left ankle', 'left foot', 'mixamorigLeftFoot', 'ValveBiped.Bip01_L_Foot'],
    patterns: ['legleftankle', 'leftankle', 'leftfoot']
  },
  leftToe: {
    aliases: ['leg left toe_031', 'leg left toe', 'left toe base', 'left toe', 'mixamorigLeftToeBase'],
    patterns: ['leglefttoe', 'lefttoebase', 'lefttoe']
  }
});

const POSE_BONES = Object.freeze([
  'hips', 'spineLower', 'spineMid', 'spineUpper', 'chest', 'neckLower', 'neckUpper', 'head',
  'rightClavicle', 'rightUpperArm', 'rightForearm', 'rightHand',
  'leftClavicle', 'leftUpperArm', 'leftForearm', 'leftHand',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToe',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToe'
]);

const POSE_INDEX = Object.freeze(Object.fromEntries(POSE_BONES.map((name, index) => [name, index * 3])));
const REQUIRED_CORE_BONES = Object.freeze(['hips', 'spineLower', 'spineUpper', 'head', 'rightUpperArm', 'leftUpperArm', 'rightUpperLeg', 'leftUpperLeg']);

const CONFIG = {
  blend: {
    locomotion: 11,
    stance: 13,
    aim: 16,
    bone: 18,
    deathBone: 25
  },
  locomotion: {
    walkFrequency: 7.1,
    runFrequency: 10.1,
    walkStride: 0.34,
    runStride: 0.52,
    walkKnee: 0.43,
    runKnee: 0.68,
    walkBob: 0.012,
    runBob: 0.022,
    tacticalRunLean: 0.1
  },
  idle: {
    breathFrequency: 1.65,
    breathSpine: 0.009,
    alertBreathMultiplier: 1.18
  },
  crouch: {
    pelvisDrop: 0.205,
    hipPitch: -0.08,
    spinePitch: 0.13,
    thighPitch: -0.46,
    kneePitch: 0.92,
    anklePitch: -0.39
  },
  recoil: {
    decay: 19,
    max: 1.25,
    bodyPitch: 0.035,
    shoulderPitch: 0.11,
    handPitch: 0.06
  },
  hit: {
    duration: 0.42,
    maxStrength: 1.25
  },
  suppression: {
    duration: 0.3,
    maxStrength: 1
  },
  death: {
    duration: 1.35
  }
};

/** Default animation tuning. Use a nested partial object to override values. */
export const DEFAULT_TACTICAL_ANIMATION_CONFIG = deepFreeze(cloneAndMerge({}, CONFIG));

const ACTION_TIMING_DATA = {
  rifle: {
    [TacticalWeaponAction.RELOAD]: {
      duration: 2.05,
      markers: { magRelease: 0.13, magOut: 0.29, freshMag: 0.48, magIn: 0.68, seated: 0.74, ready: 0.96 }
    },
    [TacticalWeaponAction.RELOAD_EMPTY]: {
      duration: 2.35,
      markers: { magRelease: 0.11, magOut: 0.27, freshMag: 0.46, magIn: 0.65, seated: 0.71, boltRelease: 0.82, ready: 0.97 }
    },
    [TacticalWeaponAction.TACTICAL_RELOAD]: {
      duration: 1.78,
      markers: { magRelease: 0.16, magOut: 0.32, freshMag: 0.46, magIn: 0.67, seated: 0.73, ready: 0.95 }
    },
    [TacticalWeaponAction.EQUIP]: { duration: 0.58, markers: { shoulder: 0.48, ready: 0.92 } },
    [TacticalWeaponAction.HOLSTER]: { duration: 0.5, markers: { lowered: 0.62, hidden: 0.94 } },
    [TacticalWeaponAction.CHAMBER]: { duration: 0.72, markers: { handleBack: 0.34, chambered: 0.62, ready: 0.92 } },
    [TacticalWeaponAction.INSPECT]: { duration: 1.18, markers: { raise: 0.18, inspect: 0.42, return: 0.76, ready: 0.96 } }
  },
  pistol: {
    [TacticalWeaponAction.RELOAD]: {
      duration: 1.48,
      markers: { magRelease: 0.12, magOut: 0.25, freshMag: 0.44, magIn: 0.66, seated: 0.72, ready: 0.95 }
    },
    [TacticalWeaponAction.RELOAD_EMPTY]: {
      duration: 1.72,
      markers: { magRelease: 0.1, magOut: 0.23, freshMag: 0.41, magIn: 0.62, seated: 0.68, slideRelease: 0.79, ready: 0.95 }
    },
    [TacticalWeaponAction.TACTICAL_RELOAD]: {
      duration: 1.32,
      markers: { magRelease: 0.14, magOut: 0.28, freshMag: 0.43, magIn: 0.65, seated: 0.71, ready: 0.94 }
    },
    [TacticalWeaponAction.EQUIP]: { duration: 0.42, markers: { raised: 0.54, ready: 0.91 } },
    [TacticalWeaponAction.HOLSTER]: { duration: 0.44, markers: { lowered: 0.58, hidden: 0.93 } },
    [TacticalWeaponAction.CHAMBER]: { duration: 0.52, markers: { slideBack: 0.3, chambered: 0.61, ready: 0.91 } },
    [TacticalWeaponAction.INSPECT]: { duration: 0.98, markers: { raise: 0.16, inspect: 0.38, return: 0.7, ready: 0.94 } }
  }
};

/** Exact, normalized weapon-action marker timings for synchronizing magazines, bolts, slides, audio and ammo. */
export const WEAPON_ACTION_TIMINGS = deepFreeze(cloneAndMerge({}, ACTION_TIMING_DATA));

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneAndMerge(target, ...sources) {
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (isPlainObject(value)) target[key] = cloneAndMerge(isPlainObject(target[key]) ? target[key] : {}, value);
      else if (Array.isArray(value)) target[key] = value.slice();
      else target[key] = value;
    }
  }
  return target;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function saturate(value) {
  return clamp(value, 0, 1);
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function smoothstep(edge0, edge1, value) {
  const t = saturate((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function smootherstep(edge0, edge1, value) {
  const t = saturate((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function windowCurve(value, riseStart, riseEnd, fallStart, fallEnd) {
  return smoothstep(riseStart, riseEnd, value) * (1 - smoothstep(fallStart, fallEnd, value));
}

function canonicalName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/rght/g, 'right')
    .replace(/lft/g, 'left')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeWeapon(weapon) {
  const value = String(weapon || 'rifle').toLowerCase();
  return value.includes('pistol') || value.includes('m9') || value.includes('sidearm') ? 'pistol' : 'rifle';
}

function validObject3D(value) {
  return value && typeof value.traverse === 'function';
}

function selectBestCandidate(candidates, used, definition) {
  const aliases = definition.aliases.map(canonicalName);
  for (const alias of aliases) {
    let best = null;
    for (const candidate of candidates) {
      if (used.has(candidate.object) || candidate.canonical !== alias) continue;
      if (!best || candidate.quality > best.quality) best = candidate;
    }
    if (best) return best.object;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    if (used.has(candidate.object)) continue;
    let score = -Infinity;
    for (const pattern of definition.patterns) {
      const canonicalPattern = canonicalName(pattern);
      if (candidate.canonical.includes(canonicalPattern)) {
        score = Math.max(score, canonicalPattern.length * 2 - Math.abs(candidate.canonical.length - canonicalPattern.length) * 0.08);
      }
    }
    if (!Number.isFinite(score)) continue;
    if (candidate.canonical.includes('unused')) score -= 6;
    score += candidate.quality;
    if (score > bestScore) {
      bestScore = score;
      best = candidate.object;
    }
  }
  return best;
}

function captureFingerChains(candidates) {
  const result = {
    right: { thumb: [], index: [], middle: [], ring: [], pinky: [] },
    left: { thumb: [], index: [], middle: [], ring: [], pinky: [] }
  };
  const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const sourceNumber = { 1: 'thumb', 2: 'index', 3: 'middle', 4: 'ring', 5: 'pinky' };
  for (const candidate of candidates) {
    const match = candidate.canonical.match(/arm(right|left)finger([1-5])([abc])/);
    if (!match) continue;
    const side = match[1];
    const finger = sourceNumber[Number(match[2])];
    const segment = { a: 0, b: 1, c: 2 }[match[3]];
    result[side][finger][segment] = candidate.object;
  }
  for (const side of ['right', 'left']) {
    for (const finger of fingerNames) result[side][finger] = result[side][finger].filter(Boolean);
  }
  return result;
}

/**
 * Capture the tactical skeleton by normalized aliases and store its rest pose.
 *
 * @param {THREE.Object3D|Object} source A model root or SPECTER operator object containing root/model.
 * @param {{strict?:boolean}} [options]
 * @returns {{root:THREE.Object3D,bones:Object,base:Object,fingers:Object,found:string[],missing:string[],boneCount:number}}
 */
export function captureTacticalRig(source, { strict = false } = {}) {
  const root = validObject3D(source) ? source : source?.model || source?.root;
  if (!validObject3D(root)) throw new Error('captureTacticalRig requires a THREE.Object3D model root.');
  const candidates = [];
  root.traverse(object => {
    if (!object?.name) return;
    candidates.push({
      object,
      canonical: canonicalName(object.name),
      quality: object.isBone ? 4 : object.type === 'Bone' ? 3 : 0
    });
  });

  const used = new Set();
  const bones = Object.create(null);
  for (const [key, definition] of Object.entries(BONE_DEFINITIONS)) {
    const bone = selectBestCandidate(candidates, used, definition);
    if (bone) {
      bones[key] = bone;
      used.add(bone);
    }
  }
  const missing = Object.keys(BONE_DEFINITIONS).filter(key => !bones[key]);
  const missingCore = REQUIRED_CORE_BONES.filter(key => !bones[key]);
  if (strict && missingCore.length) throw new Error(`Tactical rig missing core bones: ${missingCore.join(', ')}`);

  const base = Object.create(null);
  for (const [key, bone] of Object.entries(bones)) {
    base[key] = {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone()
    };
  }
  return {
    root,
    bones,
    base,
    fingers: captureFingerChains(candidates),
    found: Object.keys(bones),
    missing,
    missingCore,
    boneCount: candidates.filter(candidate => candidate.object.isBone || candidate.object.type === 'Bone').length
  };
}

/** Return an immutable timing profile. Unknown weapon aliases fall back to rifle. */
export function getWeaponActionTiming(weapon = 'rifle', action = TacticalWeaponAction.RELOAD) {
  const weaponType = normalizeWeapon(weapon);
  return WEAPON_ACTION_TIMINGS[weaponType]?.[action] || WEAPON_ACTION_TIMINGS[weaponType][TacticalWeaponAction.RELOAD];
}

/**
 * Sample reusable action curves. Pass an output object to avoid allocation.
 * Values are normalized pose/event weights rather than model-space transforms.
 */
export function sampleWeaponAction(profile, normalizedTime, output = {}, action = null) {
  const t = saturate(normalizedTime);
  const actionType = action || profile?.action || null;
  output.normalizedTime = t;
  output.action = actionType;
  output.weight = smoothstep(0, 0.07, t) * (1 - smoothstep(0.9, 1, t));
  output.inspect = 0;
  output.holster = 0;
  output.equip = 0;

  // Draw and stow are intentionally handled as their own curves rather than
  // borrowing reload motion. The viewmodel can remain visible until the
  // `hidden` marker, then the next weapon rises from the same low-ready pose.
  if (actionType === TacticalWeaponAction.EQUIP || actionType === TacticalWeaponAction.HOLSTER) {
    const stow = actionType === TacticalWeaponAction.EQUIP
      ? 1 - smootherstep(0.02, 0.86, t)
      : smootherstep(0.08, 0.9, t);
    output.prepare = stow;
    output.magazineOut = 0;
    output.magazineIn = 0;
    output.bolt = 0;
    output.settle = actionType === TacticalWeaponAction.EQUIP ? smoothstep(0.72, 0.98, t) : stow;
    output.supportHand = stow * 0.34;
    output.weaponDip = stow;
    output[actionType] = stow;
    output.duration = profile?.duration || 1;
    return output;
  }

  // Inspection rolls the weapon toward the operator while preserving a small
  // low-ready dip. It is distinct from a chamber check and carries no ammo
  // state changes, so it is safe to interrupt only after it returns to ready.
  if (actionType === TacticalWeaponAction.INSPECT) {
    const inspect = windowCurve(t, 0.12, 0.36, 0.56, 0.84);
    output.prepare = windowCurve(t, 0.06, 0.22, 0.7, 0.9);
    output.magazineOut = 0;
    output.magazineIn = 0;
    output.bolt = 0;
    output.settle = smoothstep(0.78, 0.99, t);
    output.inspect = inspect;
    output.supportHand = inspect * 0.58;
    output.weaponDip = output.prepare * 0.32;
    output.duration = profile?.duration || 1;
    return output;
  }

  output.prepare = windowCurve(t, 0, 0.12, 0.2, 0.34);
  output.magazineOut = windowCurve(t, 0.1, 0.27, 0.42, 0.61);
  output.magazineIn = windowCurve(t, 0.38, 0.57, 0.7, 0.83);
  output.bolt = windowCurve(t, 0.7, 0.79, 0.86, 0.94);
  output.settle = smoothstep(0.79, 0.98, t);
  output.supportHand = Math.max(output.magazineOut, output.magazineIn, output.bolt);
  output.weaponDip = Math.max(output.prepare * 0.6, output.magazineOut * 0.85, output.magazineIn * 0.65);
  output.duration = profile?.duration || 1;
  return output;
}

/**
 * Deterministic one-shot action timeline for magazines, bolts, slide releases,
 * reload audio, equip/holster visibility and procedural upper-body poses.
 */
export class WeaponActionTimeline {
  constructor({ weapon = 'rifle' } = {}) {
    this.weapon = normalizeWeapon(weapon);
    this.action = null;
    this.profile = null;
    this.time = 0;
    this.duration = 0;
    this.playbackRate = 1;
    this.active = false;
    this.completed = false;
    this.normalizedTime = 0;
    this.previousNormalizedTime = 0;
    this.sampleState = sampleWeaponAction(null, 0, {});
    this._markers = [];
    this._markerCursor = 0;
    this._firedMarkers = [];
  }

  /** Start or replace a weapon action. */
  start(action, { weapon = this.weapon, duration, playbackRate = 1 } = {}) {
    this.weapon = normalizeWeapon(weapon);
    this.action = action;
    this.profile = getWeaponActionTiming(this.weapon, action);
    this.duration = Math.max(0.01, Number.isFinite(duration) ? duration : this.profile.duration);
    this.playbackRate = Math.max(0.01, Number.isFinite(playbackRate) ? playbackRate : 1);
    this.time = 0;
    this.normalizedTime = 0;
    this.previousNormalizedTime = 0;
    this.active = true;
    this.completed = false;
    this._markerCursor = 0;
    this._firedMarkers.length = 0;
    this._markers = Object.entries(this.profile.markers || {}).sort((a, b) => a[1] - b[1]);
    sampleWeaponAction(this.profile, 0, this.sampleState, this.action);
    return this;
  }

  update(deltaSeconds) {
    if (!this.active) return this.sampleState;
    const dt = clamp(deltaSeconds, 0, 0.25);
    this.previousNormalizedTime = this.normalizedTime;
    this.time = Math.min(this.duration, this.time + dt * this.playbackRate);
    this.normalizedTime = saturate(this.time / this.duration);
    while (this._markerCursor < this._markers.length && this._markers[this._markerCursor][1] <= this.normalizedTime) {
      const [name, at] = this._markers[this._markerCursor++];
      if (at > this.previousNormalizedTime || this.previousNormalizedTime === 0) {
        this._firedMarkers.push({ name, at, action: this.action, weapon: this.weapon });
      }
    }
    sampleWeaponAction(this.profile, this.normalizedTime, this.sampleState, this.action);
    if (this.normalizedTime >= 1) {
      this.active = false;
      this.completed = true;
    }
    return this.sampleState;
  }

  /** Copy newly crossed markers into target and clear the internal event list. */
  consumeMarkers(target = []) {
    for (const marker of this._firedMarkers) target.push(marker);
    this._firedMarkers.length = 0;
    return target;
  }

  cancel() {
    this.active = false;
    this.completed = false;
    this.action = null;
    this.profile = null;
    this.time = 0;
    this.normalizedTime = 0;
    this._markers.length = 0;
    this._markerCursor = 0;
    this._firedMarkers.length = 0;
    sampleWeaponAction(null, 0, this.sampleState);
    return this;
  }

  getState(output = {}) {
    output.action = this.action;
    output.weapon = this.weapon;
    output.active = this.active;
    output.completed = this.completed;
    output.time = this.time;
    output.duration = this.duration;
    output.normalizedTime = this.normalizedTime;
    output.sample = this.sampleState;
    return output;
  }
}

function directionComponents(direction) {
  if (typeof direction === 'string') {
    switch (direction) {
      case 'back': return { x: 0, z: 1 };
      case 'left': return { x: -1, z: 0 };
      case 'right': return { x: 1, z: 0 };
      default: return { x: 0, z: -1 };
    }
  }
  const x = Number.isFinite(direction?.x) ? direction.x : 0;
  const z = Number.isFinite(direction?.z) ? direction.z : -1;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function resolveDeathVariant(variant, direction, sequence) {
  if (Object.values(DeathFallVariant).includes(variant)) return variant;
  if (sequence % 5 === 4) return DeathFallVariant.COLLAPSE;
  if (sequence % 4 === 3) return DeathFallVariant.KNEEL_FORWARD;
  if (Math.abs(direction.x) > 0.62) return direction.x > 0 ? DeathFallVariant.LEFT : DeathFallVariant.RIGHT;
  return direction.z < 0 ? DeathFallVariant.BACKWARD : DeathFallVariant.FORWARD;
}

/**
 * Procedural full-body animator for enemies and third-person player operators.
 */
export class TacticalAnimator {
  /**
   * @param {THREE.Object3D|Object} source Model root, captured rig, or SPECTER operator.
   * @param {{config?:Object,strict?:boolean,phase?:number,weapon?:string}} [options]
   */
  constructor(source, options = {}) {
    this.rig = source?.bones && source?.base ? source : captureTacticalRig(source, { strict: options.strict });
    this.config = cloneAndMerge({}, CONFIG, options.config || {});
    this.weapon = normalizeWeapon(options.weapon);
    this.time = 0;
    this.locomotionPhase = Number.isFinite(options.phase) ? options.phase : 0;
    this.breathPhase = Number.isFinite(options.phase) ? options.phase * 0.37 : 0;
    this.moveBlend = 0;
    this.runBlend = 0;
    this.strafeBlend = 0;
    this.strafeDirection = 0;
    this.crouchBlend = 0;
    this.aimBlend = 0;
    this.weaponReadyBlend = 0;
    this.alertness = 0;
    this.recoil = 0;
    this.recoilSide = 0;
    this.shotSequence = 0;
    this.action = new WeaponActionTimeline({ weapon: this.weapon });
    this.hit = { active: false, time: 0, duration: this.config.hit.duration, strength: 0, x: 0, z: -1, height: 'torso' };
    this.suppression = { active: false, time: 0, duration: this.config.suppression.duration, strength: 0, x: 0, z: -1 };
    this.death = { active: false, time: 0, duration: this.config.death.duration, progress: 0, variant: null, x: 0, z: -1 };
    this.deathSequence = 0;
    this._pose = new Float32Array(POSE_BONES.length * 3);
    this._hipsOffset = new THREE.Vector3();
    this._targetPosition = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'XYZ');
    this._deltaQuaternion = new THREE.Quaternion();
    this._targetQuaternion = new THREE.Quaternion();
    this.output = {
      moving: false,
      aiming: false,
      crouching: false,
      locomotion: TacticalLocomotion.IDLE,
      action: this.action.sampleState,
      recoil: 0,
      deathProgress: 0,
      deathVariant: null
    };
  }

  /**
   * Update the rig. EnemyAIIntent may be supplied as state.intent, or its fields
   * can be passed directly.
   *
   * @param {number} deltaSeconds
   * @param {Object} [state]
   * @param {string} [state.locomotion]
   * @param {number} [state.speed=1] Normalized movement effort.
   * @param {number} [state.moveX=0] Local lateral movement, -1 left to +1 right.
   * @param {boolean|number} [state.crouching]
   * @param {boolean|number} [state.aiming]
   * @param {number} [state.aimPitch=0] Local aim pitch in radians.
   * @param {number} [state.aimYaw=0] Local aim yaw in radians.
   * @param {boolean|number} [state.weaponReady=true]
   * @param {string} [state.weapon]
   * @param {number} [state.alertness=0]
   * @returns {Object} Stable, reused output object.
   */
  update(deltaSeconds, state = {}) {
    const dt = clamp(deltaSeconds, 0, 0.25);
    this.time += dt;
    const intent = state.intent || state;
    const locomotion = intent.locomotion || (intent.move ? intent.move.mode : TacticalLocomotion.IDLE) || TacticalLocomotion.IDLE;
    const movingTarget = locomotion !== TacticalLocomotion.IDLE && locomotion !== 'none';
    const runTarget = locomotion === TacticalLocomotion.RUN || locomotion === TacticalLocomotion.RETREAT || locomotion === 'tactical-run';
    const strafeValue = Number.isFinite(state.moveX)
      ? clamp(state.moveX, -1, 1)
      : locomotion === TacticalLocomotion.STRAFE ? (Number.isFinite(state.strafeDirection) ? clamp(state.strafeDirection, -1, 1) : 1) : 0;
    const crouchTarget = typeof state.crouching === 'number'
      ? saturate(state.crouching)
      : state.crouching || intent.stance === 'crouch' ? 1 : 0;
    const aimTarget = typeof state.aiming === 'number'
      ? saturate(state.aiming)
      : state.aiming || Boolean(intent.aimAt) ? 1 : 0;
    const readyTarget = typeof state.weaponReady === 'number'
      ? saturate(state.weaponReady)
      : state.weaponReady === false ? 0 : 1;
    const speed = saturate(Number.isFinite(state.speed) ? state.speed : movingTarget ? 1 : 0);
    if (state.weapon) this.weapon = normalizeWeapon(state.weapon);

    this.moveBlend = damp(this.moveBlend, movingTarget ? speed : 0, this.config.blend.locomotion, dt);
    this.runBlend = damp(this.runBlend, runTarget ? speed : 0, this.config.blend.locomotion, dt);
    this.strafeBlend = damp(this.strafeBlend, Math.abs(strafeValue), this.config.blend.locomotion, dt);
    this.strafeDirection = damp(this.strafeDirection, strafeValue, this.config.blend.locomotion, dt);
    this.crouchBlend = damp(this.crouchBlend, crouchTarget, this.config.blend.stance, dt);
    this.aimBlend = damp(this.aimBlend, aimTarget, this.config.blend.aim, dt);
    this.weaponReadyBlend = damp(this.weaponReadyBlend, readyTarget, this.config.blend.aim, dt);
    this.alertness = damp(this.alertness, saturate(state.alertness ?? intent.alertness ?? 0), 4, dt);

    const pace = this.config.locomotion.walkFrequency + (this.config.locomotion.runFrequency - this.config.locomotion.walkFrequency) * this.runBlend;
    this.locomotionPhase += dt * pace * Math.max(0.2, speed);
    this.breathPhase += dt * this.config.idle.breathFrequency * (1 + this.alertness * 0.2);
    this.recoil = damp(this.recoil, 0, this.config.recoil.decay, dt);
    this.recoilSide = damp(this.recoilSide, 0, this.config.recoil.decay * 0.8, dt);
    const actionSample = this.action.update(dt);
    this._advanceReaction(this.hit, dt);
    this._advanceReaction(this.suppression, dt);

    this._pose.fill(0);
    this._hipsOffset.set(0, 0, 0);
    if (this.death.active) {
      this.death.time = Math.min(this.death.duration, this.death.time + dt);
      this.death.progress = saturate(this.death.time / this.death.duration);
      this._applyDeathPose();
    } else {
      this._applyIdlePose();
      this._applyLocomotionPose();
      this._applyCrouchPose();
      this._applyUpperBodyPose(state, actionSample);
      this._applyRecoilPose();
      this._applyWeaponActionPose(actionSample);
      this._applyHitPose();
      this._applySuppressionPose();
    }
    this._commitPose(dt);

    this.output.moving = this.moveBlend > 0.05;
    this.output.aiming = this.aimBlend > 0.5;
    this.output.crouching = this.crouchBlend > 0.5;
    this.output.locomotion = locomotion;
    this.output.action = actionSample;
    this.output.recoil = this.recoil;
    this.output.deathProgress = this.death.progress;
    this.output.deathVariant = this.death.variant;
    return this.output;
  }

  /** Convenience bridge for the intent returned by enemy-ai.js. */
  updateFromIntent(deltaSeconds, intent, extras = {}) {
    extras.intent = intent;
    return this.update(deltaSeconds, extras);
  }

  /** Add a restrained weapon/body recoil impulse. */
  triggerRecoil({ strength = 1, side } = {}) {
    const amount = clamp(strength, 0, this.config.recoil.max);
    this.recoil = clamp(this.recoil + amount, 0, this.config.recoil.max);
    this.shotSequence++;
    const fallbackSide = this.shotSequence % 2 ? 1 : -1;
    this.recoilSide = clamp(this.recoilSide + amount * (Number.isFinite(side) ? clamp(side, -1, 1) : fallbackSide) * 0.18, -0.4, 0.4);
    return this;
  }

  /** Trigger reload/equip/holster/chamber and return the shared action timeline. */
  triggerWeaponAction(action, options = {}) {
    this.weapon = normalizeWeapon(options.weapon || this.weapon);
    this.action.start(action, { ...options, weapon: this.weapon });
    return this.action;
  }

  triggerReload(options = {}) {
    const action = options.empty
      ? TacticalWeaponAction.RELOAD_EMPTY
      : options.tactical ? TacticalWeaponAction.TACTICAL_RELOAD : TacticalWeaponAction.RELOAD;
    return this.triggerWeaponAction(action, options);
  }

  consumeWeaponMarkers(target = []) {
    return this.action.consumeMarkers(target);
  }

  /** Trigger a local-space hit reaction from front/back/left/right or an {x,z} direction. */
  triggerHit({ direction = 'front', strength = 1, height = 'torso', duration } = {}) {
    if (this.death.active) return this;
    const vector = directionComponents(direction);
    this.hit.active = true;
    this.hit.time = 0;
    this.hit.duration = Math.max(0.12, Number.isFinite(duration) ? duration : this.config.hit.duration);
    this.hit.strength = clamp(strength, 0, this.config.hit.maxStrength);
    this.hit.x = vector.x;
    this.hit.z = vector.z;
    this.hit.height = height;
    return this;
  }

  /** Trigger a smaller defensive duck/flinch for a near miss or suppression event. */
  triggerSuppression({ direction = 'front', strength = 0.7, duration } = {}) {
    if (this.death.active) return this;
    const vector = directionComponents(direction);
    this.suppression.active = true;
    this.suppression.time = 0;
    this.suppression.duration = Math.max(0.1, Number.isFinite(duration) ? duration : this.config.suppression.duration);
    this.suppression.strength = clamp(strength, 0, this.config.suppression.maxStrength);
    this.suppression.x = vector.x;
    this.suppression.z = vector.z;
    return this;
  }

  /** Enter a permanent grounded fall pose until reset() is called. */
  triggerDeath({ variant = 'auto', direction = 'front', duration } = {}) {
    if (this.death.active) return this.death.variant;
    const vector = directionComponents(direction);
    this.deathSequence++;
    this.death.active = true;
    this.death.time = 0;
    this.death.duration = Math.max(0.65, Number.isFinite(duration) ? duration : this.config.death.duration);
    this.death.progress = 0;
    this.death.x = vector.x;
    this.death.z = vector.z;
    this.death.variant = resolveDeathVariant(variant, vector, this.deathSequence);
    this.action.cancel();
    this.hit.active = false;
    this.suppression.active = false;
    return this.death.variant;
  }

  /** Restore the captured local pose and clear all procedural state. */
  reset({ immediate = true } = {}) {
    this.death.active = false;
    this.death.time = 0;
    this.death.progress = 0;
    this.death.variant = null;
    this.hit.active = false;
    this.suppression.active = false;
    this.recoil = 0;
    this.recoilSide = 0;
    this.action.cancel();
    this._pose.fill(0);
    this._hipsOffset.set(0, 0, 0);
    if (immediate) this.restoreBasePose();
    return this;
  }

  restoreBasePose() {
    for (const [key, bone] of Object.entries(this.rig.bones)) {
      const base = this.rig.base[key];
      if (!base) continue;
      bone.position.copy(base.position);
      bone.quaternion.copy(base.quaternion);
      bone.scale.copy(base.scale);
    }
    return this;
  }

  getDebugState(output = {}) {
    output.moving = this.moveBlend;
    output.running = this.runBlend;
    output.strafing = this.strafeBlend * Math.sign(this.strafeDirection || 1);
    output.crouching = this.crouchBlend;
    output.aiming = this.aimBlend;
    output.recoil = this.recoil;
    output.action = this.action.action;
    output.actionProgress = this.action.normalizedTime;
    output.hit = this.hit.active;
    output.suppressed = this.suppression.active;
    output.dead = this.death.active;
    output.deathVariant = this.death.variant;
    output.deathProgress = this.death.progress;
    output.missingBones = this.rig.missing;
    return output;
  }

  _add(name, x = 0, y = 0, z = 0, weight = 1) {
    const index = POSE_INDEX[name];
    if (index == null || !this.rig.bones[name] || weight === 0) return;
    this._pose[index] += x * weight;
    this._pose[index + 1] += y * weight;
    this._pose[index + 2] += z * weight;
  }

  _advanceReaction(reaction, dt) {
    if (!reaction.active) return;
    reaction.time += dt;
    if (reaction.time >= reaction.duration) reaction.active = false;
  }

  _applyIdlePose() {
    const breath = Math.sin(this.breathPhase) * this.config.idle.breathSpine * (1 + this.alertness * (this.config.idle.alertBreathMultiplier - 1));
    this._add('spineLower', breath * 0.32, 0, breath * 0.18);
    this._add('spineMid', breath * 0.52, 0, -breath * 0.12);
    this._add('spineUpper', breath * 0.7, 0, breath * 0.14);
    this._add('chest', -breath * 0.42, 0, -breath * 0.1);
    this._add('rightClavicle', 0, 0, breath * 0.34);
    this._add('leftClavicle', 0, 0, -breath * 0.34);
    this._hipsOffset.y += Math.sin(this.breathPhase * 0.5) * 0.0025;
  }

  _applyLocomotionPose() {
    const move = this.moveBlend;
    if (move < 0.001) return;
    const run = this.runBlend;
    const strideAmplitude = this.config.locomotion.walkStride + (this.config.locomotion.runStride - this.config.locomotion.walkStride) * run;
    const kneeAmplitude = this.config.locomotion.walkKnee + (this.config.locomotion.runKnee - this.config.locomotion.walkKnee) * run;
    const bobAmplitude = this.config.locomotion.walkBob + (this.config.locomotion.runBob - this.config.locomotion.walkBob) * run;
    const stride = Math.sin(this.locomotionPhase);
    const alternate = Math.sin(this.locomotionPhase + Math.PI);
    const vertical = Math.abs(Math.cos(this.locomotionPhase));
    const rightKnee = Math.max(0, -stride) * kneeAmplitude;
    const leftKnee = Math.max(0, -alternate) * kneeAmplitude;

    this._hipsOffset.y -= vertical * bobAmplitude * move * (1 - this.crouchBlend * 0.55);
    this._add('hips', -run * this.config.locomotion.tacticalRunLean, stride * 0.026, stride * 0.032, move);
    this._add('spineLower', run * 0.045, -stride * 0.025, -stride * 0.018, move);
    this._add('spineUpper', run * 0.055, -stride * 0.018, stride * 0.015, move);
    this._add('rightUpperLeg', stride * strideAmplitude, 0, -stride * 0.018, move);
    this._add('leftUpperLeg', alternate * strideAmplitude, 0, -alternate * 0.018, move);
    this._add('rightLowerLeg', rightKnee, 0, 0, move);
    this._add('leftLowerLeg', leftKnee, 0, 0, move);
    this._add('rightFoot', -stride * strideAmplitude * 0.2 - rightKnee * 0.28, 0, 0, move);
    this._add('leftFoot', -alternate * strideAmplitude * 0.2 - leftKnee * 0.28, 0, 0, move);
    this._add('rightToe', Math.max(0, stride) * 0.12, 0, 0, move);
    this._add('leftToe', Math.max(0, alternate) * 0.12, 0, 0, move);

    const naturalArm = move * (1 - this.weaponReadyBlend * 0.9) * (1 - this.aimBlend);
    this._add('rightUpperArm', -stride * (0.22 + run * 0.08), 0, 0, naturalArm);
    this._add('leftUpperArm', stride * (0.22 + run * 0.08), 0, 0, naturalArm);
    this._add('rightForearm', Math.max(0, stride) * 0.18, 0, 0, naturalArm);
    this._add('leftForearm', Math.max(0, -stride) * 0.18, 0, 0, naturalArm);

    const strafe = this.strafeBlend * this.strafeDirection;
    this._hipsOffset.x += strafe * 0.012 * Math.cos(this.locomotionPhase);
    this._add('hips', 0, strafe * 0.055, -strafe * 0.045, move);
    this._add('spineLower', 0, -strafe * 0.04, strafe * 0.035, move);
    this._add('rightUpperLeg', 0, -strafe * 0.08, strafe * 0.1, move);
    this._add('leftUpperLeg', 0, -strafe * 0.08, strafe * 0.1, move);
  }

  _applyCrouchPose() {
    const crouch = this.crouchBlend;
    if (crouch < 0.001) return;
    this._hipsOffset.y -= this.config.crouch.pelvisDrop * crouch;
    this._hipsOffset.z += 0.045 * crouch;
    this._add('hips', this.config.crouch.hipPitch, 0, 0, crouch);
    this._add('spineLower', this.config.crouch.spinePitch, 0, 0, crouch);
    this._add('spineMid', -this.config.crouch.spinePitch * 0.32, 0, 0, crouch);
    this._add('rightUpperLeg', this.config.crouch.thighPitch, 0, -0.04, crouch);
    this._add('leftUpperLeg', this.config.crouch.thighPitch, 0, 0.04, crouch);
    this._add('rightLowerLeg', this.config.crouch.kneePitch, 0, 0, crouch);
    this._add('leftLowerLeg', this.config.crouch.kneePitch, 0, 0, crouch);
    this._add('rightFoot', this.config.crouch.anklePitch, 0, 0, crouch);
    this._add('leftFoot', this.config.crouch.anklePitch, 0, 0, crouch);
  }

  _applyUpperBodyPose(state, actionSample) {
    const actionMask = 1 - actionSample.weight * 0.62;
    const aim = this.aimBlend * actionMask;
    const ready = this.weaponReadyBlend * (1 - aim) * actionMask;
    const run = this.runBlend;
    const stride = Math.sin(this.locomotionPhase);
    const aimPitch = clamp(state.aimPitch || 0, -0.65, 0.65);
    const aimYaw = clamp(state.aimYaw || 0, -0.85, 0.85);
    const pistol = this.weapon === 'pistol';

    // Low-ready keeps the weapon controlled during movement without locking the torso.
    this._add('rightUpperArm', -0.3 - run * 0.1, 0, 0.19 + run * 0.04, ready);
    this._add('rightForearm', -0.22, 0, 0.58, ready);
    this._add('leftUpperArm', -0.3 - run * 0.08, 0, -0.19 - run * 0.04, ready);
    this._add('leftForearm', -0.24, 0, -0.62, ready);
    this._add('rightHand', -0.04, 0.03, 0.03, ready);
    this._add('leftHand', -0.04, -0.03, -0.03, ready);
    this._add('rightUpperArm', stride * 0.025, 0, 0, ready * this.moveBlend);
    this._add('leftUpperArm', -stride * 0.025, 0, 0, ready * this.moveBlend);

    const shoulderPitch = pistol ? -0.76 : -0.89;
    const shoulderRoll = pistol ? 0.39 : 0.49;
    const elbowPitch = pistol ? -0.86 : -0.78;
    const elbowRoll = pistol ? 1.06 : 1.28;
    this._add('rightClavicle', -0.035, aimYaw * 0.08, 0.025, aim);
    this._add('leftClavicle', -0.035, aimYaw * 0.08, -0.025, aim);
    this._add('rightUpperArm', shoulderPitch, aimYaw * 0.08, shoulderRoll, aim);
    this._add('rightForearm', elbowPitch, 0, elbowRoll, aim);
    this._add('leftUpperArm', shoulderPitch, aimYaw * 0.08, -shoulderRoll, aim);
    this._add('leftForearm', elbowPitch, 0, -elbowRoll, aim);
    this._add('rightHand', -0.045 - aimPitch * 0.08, 0.025, 0.035, aim);
    this._add('leftHand', -0.045 - aimPitch * 0.08, -0.025, -0.035, aim);
    this._add('spineLower', -aimPitch * 0.12, aimYaw * 0.16, 0, aim);
    this._add('spineMid', -aimPitch * 0.18, aimYaw * 0.24, 0, aim);
    this._add('spineUpper', -0.035 - aimPitch * 0.25, aimYaw * 0.34, 0, aim);
    this._add('chest', -0.025 - aimPitch * 0.18, aimYaw * 0.18, 0, aim);
    this._add('neckLower', aimPitch * 0.2, aimYaw * 0.04, 0, aim);
    this._add('head', aimPitch * 0.2, aimYaw * 0.04, 0, aim);
  }

  _applyRecoilPose() {
    if (this.recoil < 0.001) return;
    const value = this.recoil;
    this._add('spineUpper', this.config.recoil.bodyPitch, this.recoilSide * 0.035, this.recoilSide * 0.025, value);
    this._add('chest', this.config.recoil.bodyPitch * 0.55, 0, 0, value);
    this._add('rightUpperArm', this.config.recoil.shoulderPitch, 0, this.recoilSide * 0.035, value);
    this._add('leftUpperArm', this.config.recoil.shoulderPitch * 0.8, 0, this.recoilSide * 0.02, value);
    this._add('rightHand', this.config.recoil.handPitch, 0, 0, value);
    this._add('leftHand', this.config.recoil.handPitch * 0.75, 0, 0, value);
  }

  _applyWeaponActionPose(sample) {
    if (!this.action.action || sample.weight < 0.001) return;
    const pistol = this.action.weapon === 'pistol';
    const action = this.action.action;
    if (action === TacticalWeaponAction.EQUIP || action === TacticalWeaponAction.HOLSTER) {
      const direction = action === TacticalWeaponAction.EQUIP ? 1 - sample.normalizedTime : sample.normalizedTime;
      const weight = Math.sin(Math.PI * saturate(direction));
      this._add('spineUpper', 0.045, 0, 0.025, weight);
      this._add('rightUpperArm', 0.28, 0, 0.12, weight);
      this._add('leftUpperArm', 0.22, 0, -0.1, weight);
      return;
    }
    if (action === TacticalWeaponAction.INSPECT) {
      const inspect = sample.inspect || 0;
      this._add('spineUpper', 0.055, -0.12, 0.04, inspect);
      this._add('rightUpperArm', -0.34, 0.12, 0.32, inspect);
      this._add('rightForearm', -0.46, 0, 0.62, inspect);
      this._add('leftUpperArm', -0.28, -0.1, -0.22, inspect);
      this._add('leftForearm', -0.34, 0, -0.5, inspect);
      this._add('head', -0.035, 0.045, 0, inspect);
      return;
    }
    if (action === TacticalWeaponAction.CHAMBER) {
      const bolt = Math.max(sample.prepare, sample.bolt);
      this._add('leftUpperArm', -0.56, 0.12, -0.36, bolt);
      this._add('leftForearm', -0.72, 0, -0.78, bolt);
      this._add('leftHand', -0.12, 0.16, -0.12, bolt);
      this._add('rightUpperArm', -0.72, 0, 0.4, sample.weight);
      this._add('rightForearm', -0.66, 0, 1.04, sample.weight);
      return;
    }

    const out = sample.magazineOut;
    const insert = sample.magazineIn;
    const bolt = sample.bolt;
    this._add('spineUpper', 0.025 + sample.weaponDip * 0.045, -0.03, 0.018, sample.weight);
    this._add('head', -0.035, -0.06, 0.018, sample.weight);
    if (pistol) {
      this._add('rightUpperArm', -0.68, 0, 0.34, sample.weight);
      this._add('rightForearm', -0.72, 0, 1.02, sample.weight);
      this._add('leftUpperArm', -0.32 - out * 0.26 - insert * 0.38, -out * 0.18, -0.2 - insert * 0.24, sample.weight);
      this._add('leftForearm', -0.38 - out * 0.55 - insert * 0.35, 0, -0.58 - insert * 0.4, sample.weight);
      this._add('leftHand', -out * 0.18 - insert * 0.1, 0, -out * 0.18, sample.weight);
      this._add('leftUpperArm', -0.18, 0.1, -0.1, bolt);
      this._add('leftForearm', -0.25, 0, -0.28, bolt);
    } else {
      this._add('rightUpperArm', -0.7, 0, 0.41, sample.weight);
      this._add('rightForearm', -0.7, 0, 1.08, sample.weight);
      this._add('leftUpperArm', -0.38 - out * 0.25 - insert * 0.4, -out * 0.15, -0.23 - out * 0.18, sample.weight);
      this._add('leftForearm', -0.48 - out * 0.55 - insert * 0.3, 0, -0.7 - out * 0.28, sample.weight);
      this._add('leftHand', -out * 0.2, 0.08 * insert, -out * 0.14, sample.weight);
      this._add('leftUpperArm', -0.58, 0.15, -0.32, bolt);
      this._add('leftForearm', -0.7, 0, -0.7, bolt);
      this._add('leftHand', -0.1, 0.16, -0.1, bolt);
    }
  }

  _applyHitPose() {
    if (!this.hit.active) return;
    const t = saturate(this.hit.time / this.hit.duration);
    const weight = Math.sin(Math.PI * t) * Math.exp(-t * 0.6) * this.hit.strength;
    const pitch = -this.hit.z * 0.15;
    const roll = -this.hit.x * 0.18;
    this._add('hips', pitch * 0.2, 0, roll * 0.22, weight);
    this._add('spineLower', pitch * 0.45, 0, roll * 0.5, weight);
    this._add('spineUpper', pitch, this.hit.x * 0.045, roll, weight);
    this._add('chest', pitch * 0.65, 0, roll * 0.72, weight);
    this._add('neckLower', -pitch * 0.45, 0, -roll * 0.5, weight);
    this._add('head', -pitch * 0.38, 0, -roll * 0.42, weight);
    if (this.hit.height === 'head') {
      this._add('head', pitch * 0.9, this.hit.x * 0.1, roll * 0.9, weight);
    } else if (this.hit.height === 'leg') {
      const right = this.hit.x >= 0;
      this._add(right ? 'rightUpperLeg' : 'leftUpperLeg', 0.2, 0, right ? -0.12 : 0.12, weight);
      this._add(right ? 'rightLowerLeg' : 'leftLowerLeg', 0.28, 0, 0, weight);
    } else {
      this._add(this.hit.x >= 0 ? 'rightUpperArm' : 'leftUpperArm', pitch * 0.45, 0, roll * 0.65, weight);
    }
  }

  _applySuppressionPose() {
    if (!this.suppression.active) return;
    const t = saturate(this.suppression.time / this.suppression.duration);
    const weight = Math.sin(Math.PI * t) * this.suppression.strength;
    this._hipsOffset.y -= 0.025 * weight;
    this._add('spineLower', 0.055, 0, -this.suppression.x * 0.045, weight);
    this._add('spineUpper', 0.08, 0, -this.suppression.x * 0.065, weight);
    this._add('neckLower', -0.1, 0, this.suppression.x * 0.045, weight);
    this._add('head', -0.08, -this.suppression.x * 0.035, this.suppression.x * 0.04, weight);
    this._add('rightClavicle', -0.055, 0, 0.04, weight);
    this._add('leftClavicle', -0.055, 0, -0.04, weight);
  }

  _applyDeathPose() {
    const p = this.death.progress;
    const variant = this.death.variant;
    const brace = smoothstep(0, 0.24, p) * (1 - smoothstep(0.32, 0.58, p));
    const fall = smootherstep(0.12, 0.88, p);
    const settle = smoothstep(0.72, 1, p);
    const armDrop = smoothstep(0.22, 0.82, p);
    const legFold = smoothstep(0.06, 0.62, p);

    if (variant === DeathFallVariant.BACKWARD) {
      this._hipsOffset.set(0, -0.71 * fall, 0.2 * fall);
      this._add('hips', -1.34 * fall, 0.08 * fall, 0.06 * fall);
      this._add('spineLower', -0.22 * fall, 0, 0.08 * fall);
      this._add('spineUpper', 0.12 * brace - 0.18 * fall, 0, -0.08 * fall);
      this._add('head', -0.16 * brace + 0.2 * fall, 0.08 * fall, 0.08 * fall);
      this._add('rightUpperLeg', -0.34 * legFold, 0, -0.15 * fall);
      this._add('leftUpperLeg', -0.18 * legFold, 0, 0.12 * fall);
      this._add('rightLowerLeg', 0.58 * legFold, 0, 0);
      this._add('leftLowerLeg', 0.42 * legFold, 0, 0);
    } else if (variant === DeathFallVariant.FORWARD) {
      this._hipsOffset.set(0.04 * fall, -0.73 * fall, -0.18 * fall);
      this._add('hips', 1.3 * fall, -0.06 * fall, -0.04 * fall);
      this._add('spineLower', 0.28 * fall, 0, -0.06 * fall);
      this._add('spineUpper', -0.1 * brace + 0.16 * fall, 0, 0.08 * fall);
      this._add('head', 0.15 * brace - 0.18 * fall, -0.08 * fall, -0.06 * fall);
      this._add('rightUpperLeg', -0.42 * legFold, 0, 0.08 * fall);
      this._add('leftUpperLeg', -0.3 * legFold, 0, -0.08 * fall);
      this._add('rightLowerLeg', 0.7 * legFold, 0, 0);
      this._add('leftLowerLeg', 0.58 * legFold, 0, 0);
    } else if (variant === DeathFallVariant.LEFT || variant === DeathFallVariant.RIGHT) {
      const side = variant === DeathFallVariant.LEFT ? 1 : -1;
      this._hipsOffset.set(side * 0.13 * fall, -0.7 * fall, 0.03 * fall);
      this._add('hips', 0.08 * fall, 0.06 * side * fall, 1.34 * side * fall);
      this._add('spineLower', 0.08 * fall, 0, 0.18 * side * fall);
      this._add('spineUpper', -0.06 * fall, 0, 0.22 * side * fall);
      this._add('head', 0, 0.08 * side * fall, -0.2 * side * fall);
      this._add(side > 0 ? 'leftUpperLeg' : 'rightUpperLeg', -0.38 * legFold, 0, -0.24 * side * fall);
      this._add(side > 0 ? 'rightUpperLeg' : 'leftUpperLeg', -0.16 * legFold, 0, 0.14 * side * fall);
      this._add('rightLowerLeg', 0.48 * legFold, 0, 0);
      this._add('leftLowerLeg', 0.6 * legFold, 0, 0);
    } else if (variant === DeathFallVariant.KNEEL_FORWARD) {
      const kneel = smootherstep(0.02, 0.43, p);
      const forward = smootherstep(0.36, 0.94, p);
      this._hipsOffset.set(0.05 * forward, -0.61 * kneel - 0.12 * forward, -0.12 * forward);
      this._add('hips', 0.18 * kneel + 0.86 * forward, 0.08 * forward, 0.06 * forward);
      this._add('spineLower', 0.16 * kneel + 0.28 * forward, 0, -0.05 * forward);
      this._add('spineUpper', -0.08 * kneel + 0.18 * forward, 0, 0.06 * forward);
      this._add('head', -0.1 * kneel - 0.12 * forward, 0.08 * forward, -0.04 * forward);
      this._add('rightUpperLeg', -0.72 * kneel, 0, -0.08 * kneel);
      this._add('leftUpperLeg', -0.64 * kneel, 0, 0.08 * kneel);
      this._add('rightLowerLeg', 1.22 * kneel, 0, 0);
      this._add('leftLowerLeg', 1.12 * kneel, 0, 0);
    } else {
      const coil = smootherstep(0.05, 0.72, p);
      this._hipsOffset.set(0.08 * coil, -0.75 * coil, 0.05 * coil);
      this._add('hips', 0.55 * coil, -0.25 * coil, 0.58 * coil);
      this._add('spineLower', 0.35 * coil, 0.12 * coil, 0.24 * coil);
      this._add('spineUpper', 0.18 * coil, -0.16 * coil, -0.18 * coil);
      this._add('head', -0.28 * coil, 0.18 * coil, -0.2 * coil);
      this._add('rightUpperLeg', -0.68 * coil, 0, -0.22 * coil);
      this._add('leftUpperLeg', -0.44 * coil, 0, 0.28 * coil);
      this._add('rightLowerLeg', 1.05 * coil, 0, 0);
      this._add('leftLowerLeg', 0.82 * coil, 0, 0);
    }

    // Arms lose weapon-ready tension at slightly different rates, avoiding mirrored mannequin falls.
    this._add('rightUpperArm', -0.18 * brace + 0.3 * armDrop, -0.12 * armDrop, 0.62 * armDrop);
    this._add('rightForearm', 0.35 * armDrop, 0, 0.34 * armDrop);
    this._add('leftUpperArm', -0.12 * brace + 0.22 * armDrop, 0.1 * armDrop, -0.78 * armDrop);
    this._add('leftForearm', 0.5 * armDrop, 0, -0.28 * armDrop);
    this._add('rightHand', 0.16 * settle, 0.08 * settle, 0.12 * settle);
    this._add('leftHand', 0.12 * settle, -0.1 * settle, -0.1 * settle);
  }

  _commitPose(dt) {
    const blendRate = this.death.active ? this.config.blend.deathBone : this.config.blend.bone;
    const alpha = 1 - Math.exp(-blendRate * dt);
    for (const name of POSE_BONES) {
      const bone = this.rig.bones[name];
      const base = this.rig.base[name];
      if (!bone || !base) continue;
      const index = POSE_INDEX[name];
      this._euler.set(this._pose[index], this._pose[index + 1], this._pose[index + 2], 'XYZ');
      this._deltaQuaternion.setFromEuler(this._euler);
      this._targetQuaternion.copy(base.quaternion).multiply(this._deltaQuaternion);
      bone.quaternion.slerp(this._targetQuaternion, alpha);
      this._targetPosition.copy(base.position);
      if (name === 'hips') this._targetPosition.add(this._hipsOffset);
      bone.position.lerp(this._targetPosition, alpha);
    }
  }
}

const VIEWMODEL_CONFIG = {
  shoulderSide: 1,
  hipOffset: { x: 0, y: 0, z: 0 },
  adsOffset: { x: 0, y: -0.012, z: -0.055 },
  sprintOffset: { x: 0.105, y: -0.105, z: 0.105 },
  crouchOffset: { x: 0, y: -0.018, z: 0.012 },
  bob: { x: 0.009, y: 0.012, roll: 0.012, walkFrequency: 7.2, runFrequency: 10.2 },
  sway: { look: 0.0022, maxYaw: 0.045, maxPitch: 0.04, damping: 13 },
  recoil: { position: 0.045, pitch: 0.055, decay: 20 },
  blend: 17
};

/** Default right-shoulder viewmodel anchoring offsets. */
export const DEFAULT_VIEWMODEL_SHOULDER_CONFIG = deepFreeze(cloneAndMerge({}, VIEWMODEL_CONFIG));

/**
 * Smooth camera-local shoulder anchor for first-person weapon roots. It preserves
 * the anchor's initial transform and applies restrained ADS, sprint, crouch, bob,
 * look inertia, recoil and reload dip offsets without allocating per frame.
 */
export class ViewmodelShoulderAnchor {
  constructor(anchor, options = {}) {
    if (!anchor?.position || !anchor?.quaternion) throw new Error('ViewmodelShoulderAnchor requires a THREE.Object3D-like anchor.');
    this.anchor = anchor;
    this.config = cloneAndMerge({}, VIEWMODEL_CONFIG, options);
    this.basePosition = anchor.position.clone();
    this.baseQuaternion = anchor.quaternion.clone();
    this.position = anchor.position.clone();
    this.quaternion = anchor.quaternion.clone();
    this._desiredPosition = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._deltaQuaternion = new THREE.Quaternion();
    this._desiredQuaternion = new THREE.Quaternion();
    this.phase = 0;
    this.aim = 0;
    this.sprint = 0;
    this.crouch = 0;
    this.speed = 0;
    this.swayYaw = 0;
    this.swayPitch = 0;
    this.recoil = 0;
    this.recoilSide = 0;
    this.action = new WeaponActionTimeline({ weapon: options.weapon });
    this.output = { aim: 0, sprint: 0, crouch: 0, recoil: 0, action: this.action.sampleState };
  }

  update(deltaSeconds, state = {}) {
    const dt = clamp(deltaSeconds, 0, 0.25);
    const aimTarget = typeof state.aiming === 'number' ? saturate(state.aiming) : state.aiming ? 1 : 0;
    const sprintTarget = typeof state.sprinting === 'number' ? saturate(state.sprinting) : state.sprinting ? 1 : 0;
    const crouchTarget = typeof state.crouching === 'number' ? saturate(state.crouching) : state.crouching ? 1 : 0;
    const speedTarget = saturate(Number.isFinite(state.speed) ? state.speed : state.moving ? 1 : 0);
    this.aim = damp(this.aim, aimTarget, this.config.blend, dt);
    this.sprint = damp(this.sprint, sprintTarget, this.config.blend, dt);
    this.crouch = damp(this.crouch, crouchTarget, this.config.blend, dt);
    this.speed = damp(this.speed, speedTarget, 11, dt);
    const lookX = clamp(state.lookDeltaX || state.lookDelta?.x || 0, -20, 20);
    const lookY = clamp(state.lookDeltaY || state.lookDelta?.y || 0, -20, 20);
    const targetYaw = clamp(-lookX * this.config.sway.look, -this.config.sway.maxYaw, this.config.sway.maxYaw);
    const targetPitch = clamp(-lookY * this.config.sway.look, -this.config.sway.maxPitch, this.config.sway.maxPitch);
    this.swayYaw = damp(this.swayYaw, targetYaw, this.config.sway.damping, dt);
    this.swayPitch = damp(this.swayPitch, targetPitch, this.config.sway.damping, dt);
    this.recoil = damp(this.recoil, 0, this.config.recoil.decay, dt);
    this.recoilSide = damp(this.recoilSide, 0, this.config.recoil.decay * 0.8, dt);
    const action = this.action.update(dt);

    const frequency = this.config.bob.walkFrequency + (this.config.bob.runFrequency - this.config.bob.walkFrequency) * this.sprint;
    this.phase += dt * frequency * Math.max(0.2, this.speed);
    const bobX = Math.sin(this.phase) * this.config.bob.x * this.speed * (1 - this.aim * 0.72);
    const bobY = Math.abs(Math.cos(this.phase)) * this.config.bob.y * this.speed * (1 - this.aim * 0.78);
    const shoulderSide = Math.sign(this.config.shoulderSide || 1);

    this._desiredPosition.copy(this.basePosition);
    this._offset.set(
      this.config.hipOffset.x + bobX,
      this.config.hipOffset.y - bobY,
      this.config.hipOffset.z
    );
    this._offset.x += this.config.adsOffset.x * this.aim + this.config.sprintOffset.x * this.sprint * shoulderSide + this.config.crouchOffset.x * this.crouch;
    this._offset.y += this.config.adsOffset.y * this.aim + this.config.sprintOffset.y * this.sprint + this.config.crouchOffset.y * this.crouch;
    this._offset.z += this.config.adsOffset.z * this.aim + this.config.sprintOffset.z * this.sprint + this.config.crouchOffset.z * this.crouch;
    this._offset.z += this.recoil * this.config.recoil.position + action.weaponDip * 0.035;
    this._offset.y -= action.weaponDip * 0.035;
    this._desiredPosition.add(this._offset);

    const roll = -bobX * this.config.bob.roll / Math.max(0.001, this.config.bob.x) + this.sprint * shoulderSide * 0.18 + this.recoilSide * 0.025;
    this._euler.set(this.swayPitch - this.recoil * this.config.recoil.pitch + action.weaponDip * 0.08, this.swayYaw, roll, 'YXZ');
    this._deltaQuaternion.setFromEuler(this._euler);
    this._desiredQuaternion.copy(this.baseQuaternion).multiply(this._deltaQuaternion);
    const alpha = 1 - Math.exp(-this.config.blend * dt);
    this.position.lerp(this._desiredPosition, alpha);
    this.quaternion.slerp(this._desiredQuaternion, alpha);
    this.anchor.position.copy(this.position);
    this.anchor.quaternion.copy(this.quaternion);

    this.output.aim = this.aim;
    this.output.sprint = this.sprint;
    this.output.crouch = this.crouch;
    this.output.recoil = this.recoil;
    this.output.action = action;
    return this.output;
  }

  triggerRecoil({ strength = 1, side = 0 } = {}) {
    this.recoil = clamp(this.recoil + clamp(strength, 0, 1.4), 0, 1.4);
    this.recoilSide = clamp(this.recoilSide + clamp(side, -1, 1) * 0.25, -0.5, 0.5);
    return this;
  }

  triggerWeaponAction(action, options = {}) {
    return this.action.start(action, options);
  }

  triggerReload(options = {}) {
    const action = options.empty
      ? TacticalWeaponAction.RELOAD_EMPTY
      : options.tactical ? TacticalWeaponAction.TACTICAL_RELOAD : TacticalWeaponAction.RELOAD;
    return this.triggerWeaponAction(action, options);
  }

  setBaseTransform(position = this.anchor.position, quaternion = this.anchor.quaternion) {
    this.basePosition.copy(position);
    this.baseQuaternion.copy(quaternion);
    this.position.copy(position);
    this.quaternion.copy(quaternion);
    return this;
  }

  restore() {
    this.anchor.position.copy(this.basePosition);
    this.anchor.quaternion.copy(this.baseQuaternion);
    this.position.copy(this.basePosition);
    this.quaternion.copy(this.baseQuaternion);
    this.action.cancel();
    this.recoil = 0;
    this.recoilSide = 0;
    return this;
  }
}

/** Create a full-body tactical animator. */
export function createTacticalAnimator(source, options) {
  return new TacticalAnimator(source, options);
}

/** Create a first-person shoulder anchor animator. */
export function createViewmodelShoulderAnchor(anchor, options) {
  return new ViewmodelShoulderAnchor(anchor, options);
}

export default TacticalAnimator;
