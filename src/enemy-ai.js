/**
 * SPECTER enemy decision layer.
 *
 * The module deliberately has no Three.js import. A THREE.Vector3 is structurally
 * compatible with the {x, y, z} points accepted here, while returned points are
 * plain objects that can be copied into a Vector3. The controller never moves a
 * scene object itself; update() returns an intent for the renderer, navigator,
 * weapon system, and animation system to execute.
 *
 * Determinism: controllers use a seeded PRNG and logical time advanced only by
 * update(deltaSeconds). Replaying the same seed, delta values, method calls, and
 * update inputs produces the same decisions. Environment hooks must also be
 * deterministic if deterministic replays are required.
 *
 * @module enemy-ai
 */

/** @typedef {{x:number, y?:number, z:number}} Point3 */

/**
 * @typedef {Object} NoiseEvent
 * @property {Point3} position World-space noise origin.
 * @property {number} [loudness=1] Relative loudness. One is a rifle shot.
 * @property {number} [radius] Explicit hearing radius in world units.
 * @property {string} [type='generic'] gunshot, explosion, footsteps, voice, impact, door, or generic.
 * @property {string} [sourceId]
 * @property {string} [sourceFaction]
 * @property {number} [time] Logical event time. EnemyAISystem supplies this automatically.
 * @property {number} [priority=0] Added to the perceived strength for scripted events.
 */

/**
 * @typedef {Object} EnemyAIUpdateInput
 * @property {{position:Point3, forward?:Point3, health?:number, maxHealth?:number, alive?:boolean}} self
 * Current authoritative enemy transform and health.
 * @property {{position:Point3, velocity?:Point3, visible?:boolean, inFov?:boolean, visibility?:number, alive?:boolean, aimingAtAgent?:boolean}} [player]
 * Set visible after the game's ray/portal/occlusion test. If omitted, canSee hook is used.
 * @property {Object} [navigation]
 * @property {(from:Point3,to:Point3,agent:EnemyAIController)=>boolean} [navigation.canReach]
 * @property {(point:Point3,agent:EnemyAIController)=>Point3|null} [navigation.projectPoint]
 * @property {Array<Object>|((request:Object)=>Array<Object>|Object|null)} [coverCandidates]
 * @property {boolean} [combatEnabled=true]
 * @property {number} [visibility=1] Global visibility scalar, useful for darkness and smoke.
 * @property {Object} [metadata] Passed through to hooks.
 */

/**
 * @typedef {Object} EnemyAIIntent
 * @property {string} id
 * @property {string} state
 * @property {string} stateLabel
 * @property {string} debugLabel
 * @property {string} reason
 * @property {{target:Point3,speed:number,mode:string,stoppingDistance:number}|null} move
 * @property {Point3|null} lookAt
 * @property {Point3|null} aimAt
 * @property {{weapon:string,burstRemaining:number,accuracy:number,spread:number,suppressed:boolean}|null} fire
 * @property {'stand'|'crouch'} stance
 * @property {'idle'|'walk'|'run'|'strafe'|'retreat'} locomotion
 * @property {number} suspicion
 * @property {number} alertness
 * @property {number} suppression
 * @property {boolean} targetVisible
 * @property {Point3|null} lastKnownTarget
 * @property {Point3|null} coverTarget
 * @property {Point3|null} flankTarget
 * @property {Array<Object>} events State changes and squad alerts emitted this frame.
 */

/** Stable state names for animation and debug UI bindings. */
export const EnemyAIState = Object.freeze({
  IDLE: 'idle',
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  INVESTIGATE: 'investigate',
  SEARCH: 'search',
  CHASE: 'chase',
  ENGAGE: 'engage',
  RETREAT: 'retreat',
  SUPPRESSED: 'suppressed',
  DEAD: 'dead'
});

/** Human-readable state labels suitable for an overhead debug label. */
export const EnemyAIStateLabel = Object.freeze({
  [EnemyAIState.IDLE]: 'IDLE',
  [EnemyAIState.PATROL]: 'PATROL',
  [EnemyAIState.SUSPICIOUS]: 'SUSPICIOUS',
  [EnemyAIState.INVESTIGATE]: 'INVESTIGATING',
  [EnemyAIState.SEARCH]: 'SEARCHING',
  [EnemyAIState.CHASE]: 'CHASING',
  [EnemyAIState.ENGAGE]: 'ENGAGING',
  [EnemyAIState.RETREAT]: 'RETREATING',
  [EnemyAIState.SUPPRESSED]: 'SUPPRESSED',
  [EnemyAIState.DEAD]: 'DEAD'
});

const BASE_CONFIG = {
  perception: {
    visionDistance: 31,
    peripheralDistance: 6,
    fieldOfViewDegrees: 105,
    suspicionGainPerSecond: 1.05,
    suspicionDecayPerSecond: 0.075,
    suspiciousThreshold: 0.24,
    combatThreshold: 0.82,
    lostSightGrace: 1.15,
    targetMemory: 16
  },
  hearing: {
    baseRadius: 22,
    distanceScale: 1,
    minimumAudibility: 0.07,
    investigateThreshold: 0.16,
    immediateInvestigateThreshold: 0.48,
    memory: 12,
    ignoreFriendlyFootsteps: true,
    typeMultipliers: {
      generic: 1,
      gunshot: 1.45,
      explosion: 2.1,
      footsteps: 0.58,
      voice: 0.82,
      impact: 0.9,
      door: 0.74
    }
  },
  movement: {
    idleSpeed: 0,
    patrolSpeed: 0.85,
    investigateSpeed: 1.15,
    chaseSpeed: 2.2,
    retreatSpeed: 2.05,
    suppressedSpeed: 1.35,
    arrivalRadius: 0.65,
    patrolPauseMin: 0.7,
    patrolPauseMax: 2.4,
    patrolMode: 'loop'
  },
  investigation: {
    suspiciousPause: 0.7,
    inspectDuration: 1.3,
    searchDuration: 11,
    searchRadiusMin: 2.2,
    searchRadiusMax: 7.5,
    searchPointCount: 6,
    searchPauseMin: 0.45,
    searchPauseMax: 1.25
  },
  combat: {
    engageDistance: 18,
    preferredDistance: 11,
    minimumDistance: 3.5,
    reactionTime: 0.32,
    aimSettleTime: 0.24,
    accuracy: 0.62,
    movingAccuracyMultiplier: 0.72,
    suppressedAccuracyMultiplier: 0.48,
    shotInterval: 0.105,
    burstMin: 2,
    burstMax: 5,
    burstCooldownMin: 0.52,
    burstCooldownMax: 1.12,
    flankChance: 0.34,
    flankDistanceMin: 4.5,
    flankDistanceMax: 8,
    flankCooldown: 7,
    aimLeadSeconds: 0.12,
    weapon: 'rifle'
  },
  cover: {
    refreshInterval: 1.4,
    maxSearchDistance: 14,
    desiredDistance: 6.5,
    arrivalRadius: 0.75,
    holdTime: 1.2
  },
  morale: {
    retreatHealthRatio: 0.25,
    retreatChance: 0.72,
    suppressionThreshold: 0.56,
    suppressionExitThreshold: 0.2,
    suppressionDecayPerSecond: 0.18,
    suppressionMinimumTime: 1.2,
    damageSuppressionScale: 0.012,
    squadMateDownSuppression: 0.24
  },
  squad: {
    alertRadius: 34,
    radioRange: 70,
    radioEnabled: true,
    alertCooldown: 2.2,
    alertMemory: 14
  },
  debug: { enabled: false }
};

/**
 * Difficulty profiles are patches over the default configuration. Custom patches
 * may be supplied to resolveEnemyAIDifficulty() or the controller constructor.
 */
export const EnemyAIDifficultyPreset = deepFreeze({
  recruit: {
    perception: { visionDistance: 24, suspicionGainPerSecond: 0.68, lostSightGrace: 0.72 },
    hearing: { distanceScale: 0.78 },
    combat: { reactionTime: 0.7, aimSettleTime: 0.48, accuracy: 0.38, burstMin: 1, burstMax: 3, flankChance: 0.1 },
    movement: { chaseSpeed: 1.75 },
    morale: { retreatChance: 0.9, suppressionThreshold: 0.4 }
  },
  regular: {},
  hardened: {
    perception: { visionDistance: 35, suspicionGainPerSecond: 1.3, lostSightGrace: 1.55 },
    hearing: { distanceScale: 1.14 },
    combat: { reactionTime: 0.22, aimSettleTime: 0.16, accuracy: 0.72, burstMin: 3, burstMax: 6, flankChance: 0.48 },
    movement: { chaseSpeed: 2.45 },
    morale: { retreatChance: 0.55, suppressionThreshold: 0.68 }
  },
  elite: {
    perception: { visionDistance: 42, suspicionGainPerSecond: 1.75, lostSightGrace: 2 },
    hearing: { distanceScale: 1.32 },
    combat: { reactionTime: 0.12, aimSettleTime: 0.1, accuracy: 0.82, burstMin: 3, burstMax: 7, flankChance: 0.64, aimLeadSeconds: 0.2 },
    movement: { chaseSpeed: 2.75, investigateSpeed: 1.45 },
    morale: { retreatChance: 0.38, suppressionThreshold: 0.8 }
  }
});

/** Read-only base values, exported for editor UI and configuration tooling. */
export const DEFAULT_ENEMY_AI_CONFIG = deepFreeze(deepMerge({}, BASE_CONFIG));

const VALID_STATES = new Set(Object.values(EnemyAIState));
const PASSIVE_STATES = new Set([
  EnemyAIState.IDLE,
  EnemyAIState.PATROL,
  EnemyAIState.SUSPICIOUS,
  EnemyAIState.INVESTIGATE,
  EnemyAIState.SEARCH
]);
const COMBAT_STATES = new Set([
  EnemyAIState.CHASE,
  EnemyAIState.ENGAGE,
  EnemyAIState.RETREAT,
  EnemyAIState.SUPPRESSED
]);
const EPSILON = 1e-6;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, ...sources) {
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (isPlainObject(value)) {
        target[key] = deepMerge(isPlainObject(target[key]) ? target[key] : {}, value);
      } else if (Array.isArray(value)) {
        target[key] = value.map(item => isPlainObject(item) ? deepMerge({}, item) : item);
      } else {
        target[key] = value;
      }
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

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function point(value, fallback = null) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.z)) return fallback;
  return { x: value.x, y: finite(value.y), z: value.z };
}

function clonePoint(value) {
  return value ? { x: value.x, y: finite(value.y), z: value.z } : null;
}

function add(a, b) {
  return { x: a.x + b.x, y: finite(a.y) + finite(b.y), z: a.z + b.z };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: finite(a.y) - finite(b.y), z: a.z - b.z };
}

function multiply(a, scalar) {
  return { x: a.x * scalar, y: finite(a.y) * scalar, z: a.z * scalar };
}

function length2D(vector) {
  return Math.hypot(vector.x, vector.z);
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function normalize2D(vector, fallback = { x: 0, y: 0, z: -1 }) {
  const length = Math.hypot(vector.x, vector.z);
  return length > EPSILON
    ? { x: vector.x / length, y: 0, z: vector.z / length }
    : clonePoint(fallback);
}

function dot2D(a, b) {
  return a.x * b.x + a.z * b.z;
}

function lerpPoint(a, b, amount) {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: finite(a.y) + (finite(b.y) - finite(a.y)) * amount,
    z: a.z + (b.z - a.z) * amount
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function compareAgentIds(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

class SeededRandom {
  constructor(seed) {
    this.state = (Number(seed) >>> 0) || 0x9e3779b9;
  }

  next() {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 4294967296;
  }

  between(min, max) {
    return min + (max - min) * this.next();
  }

  integer(min, maxInclusive) {
    return Math.floor(this.between(min, maxInclusive + 1));
  }

  chance(probability) {
    return this.next() < clamp(probability);
  }
}

/**
 * Resolve a named difficulty and optional per-archetype overrides.
 *
 * @param {'recruit'|'regular'|'hardened'|'elite'|Object} [difficulty='regular']
 * @param {Object} [overrides]
 * @returns {Object} A mutable, independent configuration object.
 */
export function resolveEnemyAIDifficulty(difficulty = 'regular', overrides = {}) {
  const preset = typeof difficulty === 'string'
    ? EnemyAIDifficultyPreset[difficulty] || EnemyAIDifficultyPreset.regular
    : difficulty;
  return deepMerge({}, BASE_CONFIG, preset || {}, overrides || {});
}

/**
 * Decision controller for one enemy.
 *
 * @example
 * const ai = new EnemyAIController({
 *   id: 'guard-01',
 *   squadId: 'alpha',
 *   seed: 41,
 *   patrolPoints: [{x: 2, z: -4}, {x: 8, z: -12}],
 *   difficulty: 'hardened'
 * });
 * const intent = ai.update(dt, {
 *   self: {position: enemy.position, forward: enemyForward, health: hp, maxHealth: 100},
 *   player: {position: camera.position, visible: raycastHasLineOfSight}
 * });
 * if (intent.move) navigation.moveToward(enemy, intent.move.target, intent.move.speed, dt);
 * if (intent.fire) fireEnemyWeapon(enemy, intent.fire);
 */
export class EnemyAIController {
  /**
   * @param {Object} options
   * @param {string} options.id Stable unique id.
   * @param {string} [options.squadId='default']
   * @param {string} [options.faction='hostile']
   * @param {number|string} [options.seed] Stable replay seed. Defaults to an id hash.
   * @param {'recruit'|'regular'|'hardened'|'elite'|Object} [options.difficulty='regular']
   * @param {Object} [options.config] Per-agent configuration patch.
   * @param {Point3[]} [options.patrolPoints=[]]
   * @param {string} [options.initialState] EnemyAIState value.
   * @param {number} [options.health=100]
   * @param {number} [options.maxHealth=100]
   * @param {Object} [options.hooks]
   * @param {(request:Object)=>boolean} [options.hooks.canSee] LOS hook used when input.player.visible is absent.
   * @param {(request:Object)=>Array<Object>|Object|null} [options.hooks.findCover]
   * @param {(candidate:Object,request:Object)=>number} [options.hooks.scoreCover]
   * @param {(request:Object)=>Point3|null} [options.hooks.chooseFlank]
   * @param {(event:Object,agent:EnemyAIController)=>void} [options.hooks.onStateChange]
   * @param {(event:Object,agent:EnemyAIController)=>void} [options.hooks.onSquadAlert]
   */
  constructor(options = {}) {
    if (!options.id) throw new Error('EnemyAIController requires a stable id.');
    this.id = String(options.id);
    this.squadId = String(options.squadId || 'default');
    this.faction = String(options.faction || 'hostile');
    this.config = resolveEnemyAIDifficulty(options.difficulty, options.config);
    this.hooks = options.hooks || {};
    const seed = typeof options.seed === 'string'
      ? hashString(options.seed)
      : finite(options.seed, hashString(this.id));
    this.random = new SeededRandom(seed);

    this.time = 0;
    this.position = { x: 0, y: 0, z: 0 };
    this.forward = { x: 0, y: 0, z: -1 };
    this.maxHealth = Math.max(1, finite(options.maxHealth, 100));
    this.health = clamp(finite(options.health, this.maxHealth), 0, this.maxHealth);
    this.suspicion = 0;
    this.alertness = 0;
    this.suppression = 0;
    this.suppressionOrigin = null;
    this.lastSuppressedTime = -Infinity;
    this.lastKnownTarget = null;
    this.lastTargetVelocity = { x: 0, y: 0, z: 0 };
    this.lastSeenTime = -Infinity;
    this.lastStimulus = null;
    this.targetVisible = false;
    this.targetDistance = Infinity;
    this.targetInFov = false;
    this.patrolPoints = (options.patrolPoints || []).map(value => point(value)).filter(Boolean);
    this.patrolIndex = 0;
    this.patrolDirection = 1;
    this.investigatePoint = null;
    this.searchOrigin = null;
    this.searchPoints = [];
    this.searchIndex = 0;
    this.searchEndTime = -Infinity;
    this.coverTarget = null;
    this.coverRecord = null;
    this.nextCoverRefresh = 0;
    this.flankTarget = null;
    this.nextFlankTime = 0;
    this.combatReadyTime = Infinity;
    this.nextShotTime = 0;
    this.burstRemaining = 0;
    this.nextBurstTime = 0;
    this.pauseUntil = 0;
    this.nextPatrolDecision = 0;
    this.lastAlertTime = -Infinity;
    this.lowHealthHandled = false;
    this._heardNoises = [];
    this._frameEvents = [];
    this._lastInput = null;

    const requestedState = VALID_STATES.has(options.initialState) ? options.initialState : null;
    this.state = requestedState || (this.patrolPoints.length ? EnemyAIState.PATROL : EnemyAIState.IDLE);
    this.stateReason = 'spawned';
    this.stateEnteredTime = 0;
  }

  /** Replace this agent's patrol route without resetting its alert state. */
  setPatrolRoute(points, startIndex = 0) {
    this.patrolPoints = (points || []).map(value => point(value)).filter(Boolean);
    this.patrolIndex = this.patrolPoints.length
      ? Math.max(0, Math.min(this.patrolPoints.length - 1, Math.floor(startIndex)))
      : 0;
    this.patrolDirection = 1;
    if (!this.patrolPoints.length && this.state === EnemyAIState.PATROL) {
      this._transition(EnemyAIState.IDLE, 'patrol route cleared');
    }
    return this;
  }

  /** Change difficulty at runtime while keeping behavioral memory. */
  setDifficulty(difficulty, overrides = {}) {
    this.config = resolveEnemyAIDifficulty(difficulty, overrides);
    return this;
  }

  /** Set authoritative health, useful when damage is owned by the game combat system. */
  setHealth(health, maxHealth = this.maxHealth) {
    this.maxHealth = Math.max(1, finite(maxHealth, this.maxHealth));
    this.health = clamp(finite(health, this.health), 0, this.maxHealth);
    if (this.health <= 0) this._transition(EnemyAIState.DEAD, 'health depleted');
    return this;
  }

  /**
   * Notify the controller of damage. This updates morale and target memory but does
   * not apply scene effects. Supply attackerPosition when known.
   */
  applyDamage(amount, details = {}) {
    const damage = Math.max(0, finite(amount));
    if (details.health == null) this.health = Math.max(0, this.health - damage);
    else this.health = clamp(details.health, 0, details.maxHealth || this.maxHealth);
    if (details.maxHealth != null) this.maxHealth = Math.max(1, finite(details.maxHealth, this.maxHealth));
    const attackerPosition = point(details.attackerPosition || details.position);
    if (attackerPosition) {
      this.lastKnownTarget = attackerPosition;
      this.investigatePoint = clonePoint(attackerPosition);
      this.lastSeenTime = this.time;
    }
    this.suspicion = 1;
    this.alertness = 1;
    this.applySuppression(damage * this.config.morale.damageSuppressionScale, {
      origin: attackerPosition,
      type: 'damage'
    });
    this._queueSquadAlert('contact', attackerPosition || this.position, 1, true);
    if (this.health <= 0) this._transition(EnemyAIState.DEAD, 'fatal damage');
    else if (!COMBAT_STATES.has(this.state)) this._transition(EnemyAIState.CHASE, 'took damage');
    return this.health;
  }

  /** Add normalized suppression (0..1 is the useful range). */
  applySuppression(amount, details = {}) {
    if (this.state === EnemyAIState.DEAD) return this.suppression;
    this.suppression = clamp(this.suppression + Math.max(0, finite(amount)));
    this.suppressionOrigin = point(details.origin || details.position, this.suppressionOrigin);
    this.lastSuppressedTime = this.time;
    this._frameEvents.push({
      type: 'suppression',
      amount: Math.max(0, finite(amount)),
      origin: clonePoint(this.suppressionOrigin),
      sourceId: details.sourceId || null
    });
    return this.suppression;
  }

  /**
   * Test and store a sound for later processing by update().
   *
   * @param {NoiseEvent} noise
   * @param {Point3} [listenerPosition=this.position]
   * @returns {boolean} True when the sound was audible.
   */
  hear(noise, listenerPosition = this.position) {
    const origin = point(noise?.position);
    const listener = point(listenerPosition, this.position);
    if (!origin || !listener || this.state === EnemyAIState.DEAD) return false;
    const type = String(noise.type || 'generic');
    if (
      this.config.hearing.ignoreFriendlyFootsteps &&
      type === 'footsteps' &&
      noise.sourceFaction &&
      noise.sourceFaction === this.faction
    ) return false;

    const multiplier = finite(this.config.hearing.typeMultipliers[type], 1);
    const loudness = Math.max(0, finite(noise.loudness, 1));
    const radius = Math.max(
      EPSILON,
      finite(noise.radius, this.config.hearing.baseRadius * loudness * multiplier)
        * this.config.hearing.distanceScale
    );
    const distance = distance2D(origin, listener);
    if (distance > radius) return false;
    const falloff = 1 - distance / radius;
    const intensity = clamp(loudness * multiplier * falloff + finite(noise.priority));
    if (intensity < this.config.hearing.minimumAudibility) return false;

    this._heardNoises.push({
      type,
      position: origin,
      sourceId: noise.sourceId || null,
      sourceFaction: noise.sourceFaction || null,
      time: finite(noise.time, this.time),
      intensity,
      distance
    });
    this._heardNoises.sort((a, b) => b.intensity - a.intensity || a.distance - b.distance || a.time - b.time);
    if (this._heardNoises.length > 8) this._heardNoises.length = 8;
    return true;
  }

  /** Receive a squad contact report from EnemyAISystem or custom networking code. */
  receiveSquadAlert(alert = {}) {
    if (this.state === EnemyAIState.DEAD || alert.sourceId === this.id) return false;
    const reportedPosition = point(alert.position);
    if (!reportedPosition) return false;
    const certainty = clamp(finite(alert.certainty, 0.75));
    this.lastKnownTarget = reportedPosition;
    // A radio report starts the same finite target-memory window as direct contact.
    // It is not line of sight (targetVisible remains false), but it is actionable.
    this.lastSeenTime = this.time;
    this.investigatePoint = clonePoint(reportedPosition);
    this.lastStimulus = {
      type: 'squad-alert',
      position: clonePoint(reportedPosition),
      intensity: certainty,
      time: this.time,
      sourceId: alert.sourceId || null
    };
    this.suspicion = Math.max(this.suspicion, certainty * 0.9);
    this.alertness = Math.max(this.alertness, certainty);
    if (PASSIVE_STATES.has(this.state)) {
      this._transition(
        certainty >= this.config.perception.combatThreshold ? EnemyAIState.CHASE : EnemyAIState.INVESTIGATE,
        'squad contact report'
      );
    }
    if (typeof this.hooks.onSquadAlert === 'function') this.hooks.onSquadAlert(alert, this);
    return true;
  }

  /** Mark a squadmate down, reducing morale and raising alertness. */
  reportSquadMateDown(position, sourceId = null) {
    this.applySuppression(this.config.morale.squadMateDownSuppression, { origin: position, sourceId });
    return this.receiveSquadAlert({
      type: 'squadmate-down',
      position,
      sourceId,
      certainty: 1
    });
  }

  /**
   * Advance decisions by one deterministic simulation step.
   *
   * @param {number} deltaSeconds Fixed or variable simulation delta, clamped to 0.25.
   * @param {EnemyAIUpdateInput} input
   * @returns {EnemyAIIntent}
   */
  update(deltaSeconds, input = {}) {
    const dt = clamp(finite(deltaSeconds), 0, 0.25);
    this.time += dt;
    this._lastInput = input;
    this.syncSelf(input);

    if (input.self?.alive === false || this.health <= 0) {
      this._transition(EnemyAIState.DEAD, input.self?.alive === false ? 'authoritative death' : 'health depleted');
      return this._makeIntent(input);
    }

    this._decayMemory(dt);
    const heard = this._consumeStrongestNoise();
    this._updatePerception(dt, input);
    if (heard) this._reactToNoise(heard);

    if (this._shouldRetreat()) {
      this.lowHealthHandled = true;
      this._transition(EnemyAIState.RETREAT, 'low health');
    } else if (this.suppression >= this.config.morale.suppressionThreshold && this.state !== EnemyAIState.RETREAT) {
      this._transition(EnemyAIState.SUPPRESSED, 'incoming fire');
    }

    this._updateState(input);
    return this._makeIntent(input);
  }

  /**
   * Synchronize transform/health without advancing decisions. EnemyAISystem uses
   * this before distributing same-tick sounds.
   */
  syncSelf(input = {}) {
    const self = input.self || input;
    const nextPosition = point(self.position);
    const nextForward = point(self.forward);
    if (nextPosition) this.position = nextPosition;
    if (nextForward && length2D(nextForward) > EPSILON) this.forward = normalize2D(nextForward);
    if (self.maxHealth != null) this.maxHealth = Math.max(1, finite(self.maxHealth, this.maxHealth));
    if (self.health != null) this.health = clamp(self.health, 0, this.maxHealth);
    return this;
  }

  /** Serializable behavioral snapshot for save games, telemetry, and tests. */
  getSnapshot() {
    return {
      id: this.id,
      squadId: this.squadId,
      faction: this.faction,
      time: this.time,
      state: this.state,
      stateReason: this.stateReason,
      stateTime: this.time - this.stateEnteredTime,
      position: clonePoint(this.position),
      health: this.health,
      maxHealth: this.maxHealth,
      suspicion: this.suspicion,
      alertness: this.alertness,
      suppression: this.suppression,
      targetVisible: this.targetVisible,
      targetDistance: this.targetDistance,
      lastKnownTarget: clonePoint(this.lastKnownTarget),
      investigatePoint: clonePoint(this.investigatePoint),
      coverTarget: clonePoint(this.coverTarget),
      flankTarget: clonePoint(this.flankTarget),
      patrolIndex: this.patrolIndex,
      randomState: this.random.state
    };
  }

  /** Compact label for a sprite, dat.GUI, or inspector. */
  getDebugLabel() {
    const tags = [EnemyAIStateLabel[this.state] || this.state.toUpperCase()];
    if (this.targetVisible) tags.push('LOS');
    if (this.flankTarget) tags.push('FLANK');
    else if (this.coverTarget) tags.push('COVER');
    if (this.suspicion > 0.01) tags.push(`S${Math.round(this.suspicion * 100)}`);
    if (this.suppression > 0.01) tags.push(`U${Math.round(this.suppression * 100)}`);
    return tags.join(' • ');
  }

  _decayMemory(dt) {
    const perception = this.config.perception;
    const activelyAlert = COMBAT_STATES.has(this.state) || this.state === EnemyAIState.SEARCH;
    const suspicionDecay = perception.suspicionDecayPerSecond * (activelyAlert ? 0.35 : 1);
    if (!this.targetVisible) this.suspicion = clamp(this.suspicion - suspicionDecay * dt);
    this.suppression = clamp(this.suppression - this.config.morale.suppressionDecayPerSecond * dt);
    this.alertness = clamp(Math.max(this.suspicion, this.alertness - suspicionDecay * 0.42 * dt));
    if (this.health / this.maxHealth > this.config.morale.retreatHealthRatio + 0.18) this.lowHealthHandled = false;
    this._heardNoises = this._heardNoises.filter(noise => this.time - noise.time <= this.config.hearing.memory);
    if (this.time - this.lastSeenTime > perception.targetMemory && PASSIVE_STATES.has(this.state)) {
      this.lastKnownTarget = null;
    }
  }

  _consumeStrongestNoise() {
    if (!this._heardNoises.length) return null;
    let bestIndex = 0;
    for (let index = 1; index < this._heardNoises.length; index++) {
      const current = this._heardNoises[index];
      const best = this._heardNoises[bestIndex];
      const currentScore = current.intensity - (this.time - current.time) * 0.035;
      const bestScore = best.intensity - (this.time - best.time) * 0.035;
      if (currentScore > bestScore) bestIndex = index;
    }
    return this._heardNoises.splice(bestIndex, 1)[0];
  }

  _updatePerception(dt, input) {
    const player = input.player;
    this.targetVisible = false;
    this.targetDistance = Infinity;
    this.targetInFov = false;
    if (!player || player.alive === false || !point(player.position)) return;

    const playerPosition = point(player.position);
    const toPlayer = subtract(playerPosition, this.position);
    const distance = length2D(toPlayer);
    const direction = normalize2D(toPlayer);
    const fovCos = Math.cos(this.config.perception.fieldOfViewDegrees * Math.PI / 360);
    const computedInFov = dot2D(this.forward, direction) >= fovCos || distance <= this.config.perception.peripheralDistance;
    const inFov = typeof player.inFov === 'boolean' ? player.inFov : computedInFov;
    let visible = false;
    if (typeof player.visible === 'boolean') visible = player.visible;
    else if (typeof this.hooks.canSee === 'function') {
      visible = Boolean(this.hooks.canSee({ agent: this, from: this.position, to: playerPosition, input }));
    }
    const alertedAwareness = COMBAT_STATES.has(this.state) && this.time - this.lastSeenTime <= this.config.perception.lostSightGrace;
    visible = visible && distance <= this.config.perception.visionDistance && (inFov || alertedAwareness);
    this.targetVisible = visible;
    this.targetDistance = distance;
    this.targetInFov = inFov;
    this.lastTargetVelocity = point(player.velocity, { x: 0, y: 0, z: 0 });

    if (!visible) return;
    const distanceFactor = clamp(1 - distance / this.config.perception.visionDistance, 0.15, 1);
    const visibility = clamp(finite(player.visibility, finite(input.visibility, 1)));
    const detection = this.config.perception.suspicionGainPerSecond * distanceFactor * visibility * dt;
    const wasCombatReady = this.suspicion >= this.config.perception.combatThreshold || COMBAT_STATES.has(this.state);
    this.suspicion = clamp(this.suspicion + detection);
    this.alertness = Math.max(this.alertness, this.suspicion);
    this.lastKnownTarget = playerPosition;
    this.lastSeenTime = this.time;
    this.investigatePoint = clonePoint(playerPosition);

    if (!wasCombatReady && this.suspicion >= this.config.perception.combatThreshold) {
      this.combatReadyTime = this.time + this.config.combat.reactionTime;
      this._queueSquadAlert('contact', playerPosition, this.suspicion);
    }

    if (
      this.suspicion >= this.config.perception.combatThreshold &&
      this.state !== EnemyAIState.RETREAT &&
      this.state !== EnemyAIState.SUPPRESSED
    ) {
      const next = distance <= this.config.combat.engageDistance ? EnemyAIState.ENGAGE : EnemyAIState.CHASE;
      this._transition(next, 'visual contact');
    } else if (
      this.suspicion >= this.config.perception.suspiciousThreshold &&
      (this.state === EnemyAIState.IDLE || this.state === EnemyAIState.PATROL)
    ) {
      this._transition(EnemyAIState.SUSPICIOUS, 'possible visual contact');
    }
  }

  _reactToNoise(noise) {
    if (!noise || noise.intensity < this.config.hearing.investigateThreshold) return;
    this.lastStimulus = noise;
    this.investigatePoint = clonePoint(noise.position);
    this.suspicion = Math.max(this.suspicion, clamp(noise.intensity * 0.82));
    this.alertness = Math.max(this.alertness, noise.intensity);

    if (COMBAT_STATES.has(this.state)) {
      if (!this.targetVisible && noise.intensity > 0.65) this.lastKnownTarget = clonePoint(noise.position);
      return;
    }
    const immediate = noise.intensity >= this.config.hearing.immediateInvestigateThreshold;
    this._transition(immediate ? EnemyAIState.INVESTIGATE : EnemyAIState.SUSPICIOUS, `heard ${noise.type}`);
    if (noise.type === 'gunshot' || noise.type === 'explosion') {
      this._queueSquadAlert('noise', noise.position, noise.intensity);
    }
  }

  _shouldRetreat() {
    if (this.state === EnemyAIState.DEAD || this.state === EnemyAIState.RETREAT || this.lowHealthHandled) return false;
    if (this.health / this.maxHealth > this.config.morale.retreatHealthRatio) return false;
    const chance = this.config.morale.retreatChance;
    this.lowHealthHandled = true;
    return this.random.chance(chance);
  }

  _updateState(input) {
    switch (this.state) {
      case EnemyAIState.IDLE: this._updateIdle(); break;
      case EnemyAIState.PATROL: this._updatePatrol(); break;
      case EnemyAIState.SUSPICIOUS: this._updateSuspicious(); break;
      case EnemyAIState.INVESTIGATE: this._updateInvestigate(); break;
      case EnemyAIState.SEARCH: this._updateSearch(input); break;
      case EnemyAIState.CHASE: this._updateChase(input); break;
      case EnemyAIState.ENGAGE: this._updateEngage(input); break;
      case EnemyAIState.RETREAT: this._updateRetreat(input); break;
      case EnemyAIState.SUPPRESSED: this._updateSuppressed(input); break;
      default: break;
    }
  }

  _updateIdle() {
    if (this.patrolPoints.length && this.time >= this.pauseUntil) this._transition(EnemyAIState.PATROL, 'begin patrol');
  }

  _updatePatrol() {
    if (!this.patrolPoints.length) {
      this._transition(EnemyAIState.IDLE, 'no patrol route');
      return;
    }
    const target = this.patrolPoints[this.patrolIndex];
    if (distance2D(this.position, target) <= this.config.movement.arrivalRadius) {
      if (this.time < this.pauseUntil) return;
      this.pauseUntil = this.time + this.random.between(
        this.config.movement.patrolPauseMin,
        this.config.movement.patrolPauseMax
      );
      this._advancePatrolIndex();
    }
  }

  _updateSuspicious() {
    if (this.suspicion >= this.config.perception.combatThreshold && this.lastKnownTarget) {
      this._transition(EnemyAIState.CHASE, 'suspicion confirmed');
      return;
    }
    if (this.time - this.stateEnteredTime >= this.config.investigation.suspiciousPause) {
      if (this.investigatePoint) this._transition(EnemyAIState.INVESTIGATE, 'checking stimulus');
      else this._returnToRoute('stimulus faded');
    }
  }

  _updateInvestigate() {
    if (!this.investigatePoint) {
      this._transition(EnemyAIState.SEARCH, 'no precise stimulus');
      return;
    }
    if (distance2D(this.position, this.investigatePoint) <= this.config.movement.arrivalRadius) {
      if (this.time - this.stateEnteredTime >= this.config.investigation.inspectDuration) {
        this.searchOrigin = clonePoint(this.investigatePoint);
        this._transition(EnemyAIState.SEARCH, 'reached stimulus');
      }
    }
  }

  _updateSearch(input) {
    if (!this.searchPoints.length) this._buildSearchPoints(input);
    if (this.time >= this.searchEndTime) {
      this._returnToRoute('search exhausted');
      return;
    }
    const target = this.searchPoints[this.searchIndex];
    if (!target) return;
    if (distance2D(this.position, target) <= this.config.movement.arrivalRadius && this.time >= this.pauseUntil) {
      this.pauseUntil = this.time + this.random.between(
        this.config.investigation.searchPauseMin,
        this.config.investigation.searchPauseMax
      );
      this.searchIndex = (this.searchIndex + 1) % this.searchPoints.length;
    }
  }

  _updateChase(input) {
    if (this.targetVisible && this.targetDistance <= this.config.combat.engageDistance) {
      this._transition(EnemyAIState.ENGAGE, 'target in weapon range');
      return;
    }
    const target = this.lastKnownTarget;
    if (!target || this.time - this.lastSeenTime > this.config.perception.targetMemory) {
      this._transition(EnemyAIState.SEARCH, 'target trail cold');
      return;
    }
    if (!this.targetVisible && distance2D(this.position, target) <= this.config.movement.arrivalRadius) {
      this.searchOrigin = clonePoint(target);
      this._transition(EnemyAIState.SEARCH, 'last known position reached');
      return;
    }
    if (this.time >= this.nextFlankTime && this.targetVisible && this.random.chance(this.config.combat.flankChance)) {
      this.flankTarget = this._chooseFlank(input, target);
      this.nextFlankTime = this.time + this.config.combat.flankCooldown;
    }
  }

  _updateEngage(input) {
    if (!this.targetVisible && this.time - this.lastSeenTime > this.config.perception.lostSightGrace) {
      this._transition(EnemyAIState.CHASE, 'lost line of sight');
      return;
    }
    if (this.targetVisible && this.targetDistance > this.config.combat.engageDistance * 1.12) {
      this._transition(EnemyAIState.CHASE, 'target beyond engagement range');
      return;
    }
    if (this.targetVisible && this.targetDistance < this.config.combat.minimumDistance) {
      this.coverTarget = this._requestCover(input, 'disengage', this.lastKnownTarget);
      if (this.coverTarget) this._transition(EnemyAIState.RETREAT, 'target too close');
      return;
    }
    if (this.time >= this.nextFlankTime && this.random.chance(this.config.combat.flankChance * 0.45)) {
      this.flankTarget = this._chooseFlank(input, this.lastKnownTarget);
      this.nextFlankTime = this.time + this.config.combat.flankCooldown;
      if (this.flankTarget) this._transition(EnemyAIState.CHASE, 'flanking');
    }
  }

  _updateRetreat(input) {
    if (!this.coverTarget || this.time >= this.nextCoverRefresh) {
      this.coverTarget = this._requestCover(input, 'retreat', this.lastKnownTarget || this.suppressionOrigin);
      this.nextCoverRefresh = this.time + this.config.cover.refreshInterval;
    }
    if (!this.coverTarget) {
      if (this.suppression >= this.config.morale.suppressionThreshold) this._transition(EnemyAIState.SUPPRESSED, 'no retreat cover');
      else if (this.targetVisible) this._transition(EnemyAIState.ENGAGE, 'retreat blocked');
      return;
    }
    if (distance2D(this.position, this.coverTarget) <= this.config.cover.arrivalRadius) {
      if (this.suppression > this.config.morale.suppressionExitThreshold) {
        this._transition(EnemyAIState.SUPPRESSED, 'cover reached');
      } else if (this.targetVisible) {
        this._transition(EnemyAIState.ENGAGE, 'firing from cover');
      } else {
        this.searchOrigin = clonePoint(this.lastKnownTarget || this.coverTarget);
        this._transition(EnemyAIState.SEARCH, 'safe position reached');
      }
    }
  }

  _updateSuppressed(input) {
    if (!this.coverTarget || this.time >= this.nextCoverRefresh) {
      this.coverTarget = this._requestCover(input, 'suppression', this.lastKnownTarget || this.suppressionOrigin);
      this.nextCoverRefresh = this.time + this.config.cover.refreshInterval;
    }
    const minimumElapsed = this.time - this.stateEnteredTime >= this.config.morale.suppressionMinimumTime;
    if (minimumElapsed && this.suppression <= this.config.morale.suppressionExitThreshold) {
      if (this.targetVisible) this._transition(EnemyAIState.ENGAGE, 'suppression cleared');
      else if (this.lastKnownTarget) this._transition(EnemyAIState.CHASE, 'suppression cleared');
      else this._transition(EnemyAIState.SEARCH, 'suppression cleared');
    }
  }

  _makeIntent(input) {
    const events = this._frameEvents.slice();
    this._frameEvents = [];
    const intent = {
      id: this.id,
      state: this.state,
      stateLabel: EnemyAIStateLabel[this.state] || this.state,
      debugLabel: this.getDebugLabel(),
      reason: this.stateReason,
      move: null,
      lookAt: null,
      aimAt: null,
      fire: null,
      stance: 'stand',
      locomotion: 'idle',
      suspicion: this.suspicion,
      alertness: this.alertness,
      suppression: this.suppression,
      targetVisible: this.targetVisible,
      lastKnownTarget: clonePoint(this.lastKnownTarget),
      coverTarget: clonePoint(this.coverTarget),
      flankTarget: clonePoint(this.flankTarget),
      events
    };

    const move = (target, speed, mode, stoppingDistance = this.config.movement.arrivalRadius) => {
      if (!target) return;
      intent.move = { target: clonePoint(target), speed, mode, stoppingDistance };
      intent.lookAt = clonePoint(target);
      intent.locomotion = mode;
    };

    switch (this.state) {
      case EnemyAIState.PATROL:
        if (this.time >= this.pauseUntil) move(this.patrolPoints[this.patrolIndex], this.config.movement.patrolSpeed, 'walk');
        break;
      case EnemyAIState.SUSPICIOUS:
        intent.lookAt = clonePoint(this.investigatePoint || this.lastKnownTarget);
        break;
      case EnemyAIState.INVESTIGATE:
        move(this.investigatePoint, this.config.movement.investigateSpeed, 'walk');
        break;
      case EnemyAIState.SEARCH:
        if (this.time >= this.pauseUntil) move(this.searchPoints[this.searchIndex], this.config.movement.investigateSpeed, 'walk');
        intent.lookAt ||= clonePoint(this.searchOrigin);
        break;
      case EnemyAIState.CHASE:
        move(this.flankTarget || this.lastKnownTarget, this.config.movement.chaseSpeed, 'run');
        if (this.targetVisible) intent.aimAt = this._predictedAimPoint();
        break;
      case EnemyAIState.ENGAGE:
        intent.lookAt = clonePoint(this.lastKnownTarget);
        intent.aimAt = this._predictedAimPoint();
        if (this.targetVisible && this.targetDistance > this.config.combat.preferredDistance * 1.2) {
          move(this.lastKnownTarget, this.config.movement.chaseSpeed * 0.7, 'strafe', this.config.combat.preferredDistance);
        }
        intent.fire = this._requestFire(input, false);
        break;
      case EnemyAIState.RETREAT:
        move(this.coverTarget || this._fallbackRetreatPoint(), this.config.movement.retreatSpeed, 'retreat');
        intent.lookAt = clonePoint(this.lastKnownTarget || this.suppressionOrigin);
        intent.stance = 'crouch';
        break;
      case EnemyAIState.SUPPRESSED:
        intent.stance = 'crouch';
        if (this.coverTarget && distance2D(this.position, this.coverTarget) > this.config.cover.arrivalRadius) {
          move(this.coverTarget, this.config.movement.suppressedSpeed, 'run');
        }
        intent.lookAt = clonePoint(this.lastKnownTarget || this.suppressionOrigin);
        intent.aimAt = this.targetVisible ? this._predictedAimPoint() : null;
        if (this.targetVisible && this.random.chance(0.16)) intent.fire = this._requestFire(input, true);
        break;
      default: break;
    }
    return intent;
  }

  _requestFire(input, suppressed) {
    if (input.combatEnabled === false || !this.targetVisible || !this.lastKnownTarget) return null;
    if (this.time < this.combatReadyTime + this.config.combat.aimSettleTime) return null;
    if (this.time < this.nextShotTime || this.time < this.nextBurstTime) return null;

    if (this.burstRemaining <= 0) {
      this.burstRemaining = this.random.integer(this.config.combat.burstMin, this.config.combat.burstMax);
    }
    this.burstRemaining--;
    this.nextShotTime = this.time + this.config.combat.shotInterval;
    if (this.burstRemaining <= 0) {
      this.nextBurstTime = this.time + this.random.between(
        this.config.combat.burstCooldownMin,
        this.config.combat.burstCooldownMax
      );
    }

    const moving = this.state === EnemyAIState.CHASE || Boolean(this.flankTarget);
    let accuracy = this.config.combat.accuracy;
    if (moving) accuracy *= this.config.combat.movingAccuracyMultiplier;
    if (suppressed || this.suppression > 0.2) accuracy *= this.config.combat.suppressedAccuracyMultiplier;
    accuracy *= clamp(1 - this.targetDistance / (this.config.perception.visionDistance * 1.35), 0.4, 1);
    accuracy = clamp(accuracy, 0.05, 0.98);
    return {
      weapon: this.config.combat.weapon,
      burstRemaining: this.burstRemaining,
      accuracy,
      spread: 1 - accuracy,
      suppressed: Boolean(suppressed)
    };
  }

  _predictedAimPoint() {
    if (!this.lastKnownTarget) return null;
    const lead = this.config.combat.aimLeadSeconds;
    return add(this.lastKnownTarget, multiply(this.lastTargetVelocity, lead));
  }

  _requestCover(input, purpose, threatPosition) {
    const threat = point(threatPosition, this.lastKnownTarget || this.position);
    const request = {
      agent: this,
      purpose,
      from: clonePoint(this.position),
      threat: clonePoint(threat),
      maxDistance: this.config.cover.maxSearchDistance,
      input
    };
    let candidates = null;
    const provider = input.coverCandidates;
    if (typeof provider === 'function') candidates = provider(request);
    else if (Array.isArray(provider)) candidates = provider;
    else if (typeof this.hooks.findCover === 'function') candidates = this.hooks.findCover(request);
    if (!candidates) return null;
    if (!Array.isArray(candidates)) candidates = [candidates];

    let best = null;
    let bestScore = -Infinity;
    for (const rawCandidate of candidates) {
      if (!rawCandidate) continue;
      const candidatePosition = point(rawCandidate.position || rawCandidate);
      if (!candidatePosition) continue;
      const distance = distance2D(this.position, candidatePosition);
      if (distance > this.config.cover.maxSearchDistance) continue;
      if (input.navigation?.canReach && !input.navigation.canReach(this.position, candidatePosition, this)) continue;
      const candidate = isPlainObject(rawCandidate) ? rawCandidate : { position: candidatePosition };
      const defaultScore = this._scoreCover(candidate, candidatePosition, threat, purpose);
      const score = typeof this.hooks.scoreCover === 'function'
        ? finite(this.hooks.scoreCover(candidate, { ...request, defaultScore }), defaultScore)
        : defaultScore;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    this.coverRecord = best;
    return best ? point(best.position || best) : null;
  }

  _scoreCover(candidate, candidatePosition, threat, purpose) {
    const distance = distance2D(this.position, candidatePosition);
    const desiredPenalty = Math.abs(distance - this.config.cover.desiredDistance) * 0.08;
    const coverage = clamp(finite(candidate.coverage, 0.5));
    const exposure = clamp(finite(candidate.exposure, 1 - coverage));
    const fromThreat = normalize2D(subtract(this.position, threat));
    const toCover = normalize2D(subtract(candidatePosition, this.position));
    const retreatAlignment = dot2D(fromThreat, toCover);
    const purposeWeight = purpose === 'retreat' || purpose === 'disengage' ? 0.8 : 0.35;
    return coverage * 1.8 - exposure * 1.4 - desiredPenalty + retreatAlignment * purposeWeight + finite(candidate.priority) * 0.5;
  }

  _chooseFlank(input, target) {
    const request = {
      agent: this,
      from: clonePoint(this.position),
      target: clonePoint(target),
      side: this.random.chance(0.5) ? 'left' : 'right',
      minDistance: this.config.combat.flankDistanceMin,
      maxDistance: this.config.combat.flankDistanceMax,
      input
    };
    if (typeof this.hooks.chooseFlank === 'function') {
      const hooked = point(this.hooks.chooseFlank(request));
      if (hooked) return hooked;
    }
    const toTarget = normalize2D(subtract(target, this.position));
    const side = request.side === 'left' ? -1 : 1;
    const perpendicular = { x: -toTarget.z * side, y: 0, z: toTarget.x * side };
    const distance = this.random.between(request.minDistance, request.maxDistance);
    let candidate = add(lerpPoint(this.position, target, 0.58), multiply(perpendicular, distance));
    if (typeof input.navigation?.projectPoint === 'function') {
      candidate = point(input.navigation.projectPoint(candidate, this));
    }
    if (!candidate) return null;
    if (input.navigation?.canReach && !input.navigation.canReach(this.position, candidate, this)) return null;
    return candidate;
  }

  _fallbackRetreatPoint() {
    const threat = this.lastKnownTarget || this.suppressionOrigin;
    if (!threat) return null;
    const away = normalize2D(subtract(this.position, threat));
    return add(this.position, multiply(away, this.config.cover.desiredDistance));
  }

  _buildSearchPoints(input) {
    const origin = clonePoint(this.searchOrigin || this.lastKnownTarget || this.investigatePoint || this.position);
    this.searchOrigin = origin;
    this.searchPoints = [];
    const count = Math.max(1, Math.floor(this.config.investigation.searchPointCount));
    const offset = this.random.between(0, Math.PI * 2);
    for (let index = 0; index < count; index++) {
      const angle = offset + index / count * Math.PI * 2 + this.random.between(-0.28, 0.28);
      const radius = this.random.between(
        this.config.investigation.searchRadiusMin,
        this.config.investigation.searchRadiusMax
      );
      let candidate = {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y,
        z: origin.z + Math.sin(angle) * radius
      };
      if (typeof input.navigation?.projectPoint === 'function') {
        candidate = point(input.navigation.projectPoint(candidate, this));
      }
      if (!candidate) continue;
      if (input.navigation?.canReach && !input.navigation.canReach(this.position, candidate, this)) continue;
      this.searchPoints.push(candidate);
    }
    if (!this.searchPoints.length) this.searchPoints.push(origin);
    this.searchIndex = 0;
    this.searchEndTime = this.time + this.config.investigation.searchDuration;
  }

  _advancePatrolIndex() {
    const count = this.patrolPoints.length;
    if (count <= 1) return;
    switch (this.config.movement.patrolMode) {
      case 'pingpong':
        if (this.patrolIndex >= count - 1) this.patrolDirection = -1;
        else if (this.patrolIndex <= 0) this.patrolDirection = 1;
        this.patrolIndex += this.patrolDirection;
        break;
      case 'random': {
        let next = this.random.integer(0, count - 1);
        if (next === this.patrolIndex) next = (next + 1) % count;
        this.patrolIndex = next;
        break;
      }
      default:
        this.patrolIndex = (this.patrolIndex + 1) % count;
    }
  }

  _returnToRoute(reason) {
    this.searchPoints = [];
    this.searchOrigin = null;
    this.investigatePoint = null;
    this.flankTarget = null;
    this.coverTarget = null;
    this._transition(this.patrolPoints.length ? EnemyAIState.PATROL : EnemyAIState.IDLE, reason);
  }

  _transition(nextState, reason) {
    if (!VALID_STATES.has(nextState) || nextState === this.state) return false;
    const previous = this.state;
    this.state = nextState;
    this.stateReason = reason || 'state transition';
    this.stateEnteredTime = this.time;
    if (nextState === EnemyAIState.ENGAGE && !Number.isFinite(this.combatReadyTime)) {
      this.combatReadyTime = this.time + this.config.combat.reactionTime;
    }
    if (nextState === EnemyAIState.SEARCH) {
      this.searchPoints = [];
      this.searchEndTime = this.time + this.config.investigation.searchDuration;
    }
    if (nextState === EnemyAIState.SUPPRESSED || nextState === EnemyAIState.RETREAT) {
      this.nextCoverRefresh = this.time;
    }
    if (nextState === EnemyAIState.DEAD) {
      this.targetVisible = false;
      this.burstRemaining = 0;
      this.coverTarget = null;
      this.flankTarget = null;
    }
    const event = {
      type: 'state-change',
      id: this.id,
      from: previous,
      to: nextState,
      reason: this.stateReason,
      time: this.time
    };
    this._frameEvents.push(event);
    if (typeof this.hooks.onStateChange === 'function') this.hooks.onStateChange(event, this);
    return true;
  }

  _queueSquadAlert(type, position, certainty, force = false) {
    if (!position || (!force && this.time - this.lastAlertTime < this.config.squad.alertCooldown)) return;
    this.lastAlertTime = this.time;
    this._frameEvents.push({
      type: 'squad-alert',
      alertType: type,
      sourceId: this.id,
      squadId: this.squadId,
      faction: this.faction,
      position: clonePoint(position),
      certainty: clamp(certainty),
      time: this.time
    });
  }
}

/**
 * Deterministic multi-agent coordinator for spatial noises and squad alerts.
 * It is optional: EnemyAIController can be used directly when a game already has
 * event and squad managers.
 */
export class EnemyAISystem {
  /**
   * @param {Object} [options]
   * @param {number|string} [options.seed=1]
   * @param {'recruit'|'regular'|'hardened'|'elite'|Object} [options.difficulty='regular']
   * @param {Object} [options.config]
   * @param {Object} [options.hooks] Default hooks inherited by new controllers.
   * @param {number} [options.noiseRetention=2]
   */
  constructor(options = {}) {
    this.time = 0;
    this.seed = typeof options.seed === 'string' ? hashString(options.seed) : finite(options.seed, 1);
    this.difficulty = options.difficulty || 'regular';
    this.config = options.config || {};
    this.hooks = options.hooks || {};
    this.noiseRetention = Math.max(0.1, finite(options.noiseRetention, 2));
    this.agents = new Map();
    this.pendingNoises = [];
    this.pendingAlerts = [];
  }

  /** Create and register an agent, or register an existing controller. */
  addAgent(options) {
    const agent = options instanceof EnemyAIController
      ? options
      : new EnemyAIController({
          ...options,
          difficulty: options.difficulty ?? this.difficulty,
          config: deepMerge({}, this.config, options.config || {}),
          hooks: { ...this.hooks, ...(options.hooks || {}) },
          seed: options.seed ?? ((this.seed ^ hashString(String(options.id))) >>> 0)
        });
    if (this.agents.has(agent.id)) throw new Error(`Enemy AI id already registered: ${agent.id}`);
    this.agents.set(agent.id, agent);
    return agent;
  }

  /** Remove an agent by controller or id. */
  removeAgent(agentOrId) {
    const id = agentOrId instanceof EnemyAIController ? agentOrId.id : String(agentOrId);
    return this.agents.delete(id);
  }

  /** Queue a world noise for distribution at the next update. */
  emitNoise(noise) {
    const position = point(noise?.position);
    if (!position) throw new Error('emitNoise requires noise.position.');
    const event = {
      ...noise,
      position,
      loudness: Math.max(0, finite(noise.loudness, 1)),
      type: String(noise.type || 'generic'),
      time: finite(noise.time, this.time),
      sequence: this.pendingNoises.length
    };
    this.pendingNoises.push(event);
    return event;
  }

  /** Queue an explicit squad report for next-update delivery. */
  broadcastSquadAlert(alert) {
    const position = point(alert?.position);
    if (!position) throw new Error('broadcastSquadAlert requires alert.position.');
    const event = {
      type: 'squad-alert',
      alertType: alert.alertType || alert.type || 'contact',
      sourceId: alert.sourceId || null,
      squadId: alert.squadId || 'default',
      faction: alert.faction || 'hostile',
      position,
      certainty: clamp(finite(alert.certainty, 0.75)),
      time: finite(alert.time, this.time)
    };
    this.pendingAlerts.push(event);
    return event;
  }

  /**
   * Update all agents in stable id order.
   *
   * @param {number} deltaSeconds
   * @param {Map<string,EnemyAIUpdateInput>|Object|((id:string,agent:EnemyAIController)=>EnemyAIUpdateInput)} inputs
   * @returns {Map<string,EnemyAIIntent>}
   */
  update(deltaSeconds, inputs = {}) {
    const dt = clamp(finite(deltaSeconds), 0, 0.25);
    this.time += dt;
    const orderedAgents = [...this.agents.values()].sort(compareAgentIds);
    const getInput = agent => {
      if (typeof inputs === 'function') return inputs(agent.id, agent) || {};
      if (inputs instanceof Map) return inputs.get(agent.id) || {};
      return inputs[agent.id] || {};
    };
    // Resolve each input once. Callback-based providers can safely build an input
    // object without being invoked twice or introducing order-dependent data.
    const resolvedInputs = new Map(orderedAgents.map(agent => [agent.id, getInput(agent)]));

    // Sync positions first so same-tick hearing is independent of update order.
    for (const agent of orderedAgents) agent.syncSelf(resolvedInputs.get(agent.id));

    const futureNoises = [];
    const noises = this.pendingNoises
      .filter(noise => {
        if (noise.time > this.time) {
          futureNoises.push(noise);
          return false;
        }
        return this.time - noise.time <= this.noiseRetention;
      })
      .sort((a, b) => a.time - b.time || a.sequence - b.sequence);
    for (const noise of noises) {
      for (const agent of orderedAgents) agent.hear(noise, agent.position);
    }
    this.pendingNoises = futureNoises;

    this._deliverAlerts(orderedAgents, this.pendingAlerts);
    this.pendingAlerts = [];

    const intents = new Map();
    const generatedAlerts = [];
    for (const agent of orderedAgents) {
      const intent = agent.update(dt, resolvedInputs.get(agent.id));
      intents.set(agent.id, intent);
      for (const event of intent.events) {
        if (event.type === 'squad-alert') generatedAlerts.push(event);
      }
    }

    // Deliver on the next simulation step to avoid agent-id ordering advantages.
    this.pendingAlerts.push(...generatedAlerts);
    return intents;
  }

  /** Snapshot all agents in stable order. */
  getDebugSnapshot() {
    return [...this.agents.values()]
      .sort(compareAgentIds)
      .map(agent => ({ ...agent.getSnapshot(), debugLabel: agent.getDebugLabel() }));
  }

  _deliverAlerts(agents, alerts) {
    for (const alert of alerts) {
      const source = alert.sourceId ? this.agents.get(alert.sourceId) : null;
      const sourceConfig = source?.config || resolveEnemyAIDifficulty(this.difficulty, this.config);
      for (const recipient of agents) {
        if (recipient.id === alert.sourceId) continue;
        if (recipient.squadId !== alert.squadId || recipient.faction !== alert.faction) continue;
        const distance = distance2D(recipient.position, alert.position);
        const radioReach = sourceConfig.squad.radioEnabled && distance <= sourceConfig.squad.radioRange;
        const vocalReach = distance <= sourceConfig.squad.alertRadius;
        if (radioReach || vocalReach) recipient.receiveSquadAlert(alert);
      }
    }
  }
}

/** Convenience factory for dependency-injection and editor tooling. */
export function createEnemyAI(options) {
  return new EnemyAIController(options);
}

/** Convenience factory for the optional multi-agent coordinator. */
export function createEnemyAISystem(options) {
  return new EnemyAISystem(options);
}

export default EnemyAIController;
