/**
 * Lightweight procedural audio director for SPECTER: Blacksite.
 *
 * The constructor never creates or resumes an AudioContext. Call resume() from
 * a click, pointer, or keyboard handler so browser autoplay policies are
 * respected. All play methods return false until resume() succeeds.
 *
 * @example
 * const audio = createAudioDirector({ seed: 0x5ec7e2, powerOn: false });
 * startButton.addEventListener('click', () => audio.resume());
 * audio.update(dt, {
 *   outdoorBlend: worldOverhaul.outdoorBlend,
 *   combatIntensity: enemiesEngaged ? 1 : 0,
 *   listener: { position: camera.position, forward, up: camera.up }
 * });
 * audio.playWeapon('rifle');
 *
 * @module audio-overhaul
 */

const TAU = Math.PI * 2;
const EPSILON = 0.0001;

const DEFAULTS = Object.freeze({
  seed: 0x5ec7e2,
  masterVolume: 0.82,
  musicVolume: 0.3,
  sfxVolume: 0.9,
  ambienceVolume: 0.52,
  outdoorBlend: 0,
  combatIntensity: 0,
  powerOn: false,
  closeContextOnDispose: true
});

const VOICE_PATTERNS = Object.freeze({
  contact: [176, 142, 196],
  search: [136, 124, 151],
  backup: [144, 168, 132],
  investigate: [132, 158],
  flank: [164, 207, 148],
  suppress: [151, 128, 118],
  retreat: [192, 163, 127],
  hurt: [118, 82],
  down: [104, 76, 59],
  clear: [132, 165],
  radio: [154, 181, 142]
});

function clamp(value, minimum = 0, maximum = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : minimum;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    let value = state += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function vector3(value, fallback = { x: 0, y: 0, z: 0 }) {
  if (Array.isArray(value)) {
    return {
      x: Number(value[0]) || 0,
      y: Number(value[1]) || 0,
      z: Number(value[2]) || 0
    };
  }
  if (value && typeof value === 'object') {
    return {
      x: Number(value.x) || 0,
      y: Number(value.y) || 0,
      z: Number(value.z) || 0
    };
  }
  return { ...fallback };
}

function zoneValue(value) {
  if (typeof value === 'string') return value.toLowerCase() === 'outdoor' ? 1 : 0;
  return clamp(value);
}

function disconnect(node) {
  try { node?.disconnect(); } catch { /* Node may already be disconnected. */ }
}

/** Procedural ambience, music, weapon, interaction, and enemy-call audio. */
export class AudioDirector {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this._context = options.context || null;
    this._ownsContext = !options.context;
    this._contextFactory = options.contextFactory || null;
    this._AudioContextClass = options.AudioContext || null;
    this._random = mulberry32(this.options.seed >>> 0);
    this._initialized = false;
    this._disposed = false;
    this._lastError = null;
    this._persistentSources = new Set();
    this._persistentNodes = new Set();
    this._transientSources = new Set();
    this._buses = null;
    this._zoneNodes = null;
    this._musicNodes = null;
    this._powerGain = null;
    this._noiseBuffer = null;
    this._weaponSamples = Object.create(null);
    this._enemyVoiceSamples = Object.create(null);
    this._footstepSamples = [];
    this._zoneBlend = zoneValue(this.options.outdoorBlend);
    this._combatIntensity = clamp(this.options.combatIntensity);
    this._powerOn = Boolean(this.options.powerOn);
    this._volumes = {
      master: clamp(this.options.masterVolume),
      music: clamp(this.options.musicVolume),
      sfx: clamp(this.options.sfxVolume),
      ambience: clamp(this.options.ambienceVolume)
    };
  }

  get context() { return this._context; }
  get ready() { return this._initialized && !this._disposed; }
  get active() { return this.ready && this._context?.state === 'running'; }
  get lastError() { return this._lastError; }
  get zoneBlend() { return this._zoneBlend; }
  get combatIntensity() { return this._combatIntensity; }
  get powerOn() { return this._powerOn; }
  get volumes() { return { ...this._volumes }; }
  get weaponSamples() { return Object.keys(this._weaponSamples); }
  get enemyVoiceSamples() {
    return Object.freeze(Object.fromEntries(Object.entries(this._enemyVoiceSamples)
      .map(([type, samples]) => [type, samples.length])));
  }
  get footstepSamples() { return this._footstepSamples.length; }

  /**
   * Create and resume the Web Audio graph. Call from a trusted user gesture.
   * @returns {Promise<boolean>} true when the context is running.
   */
  async resume() {
    if (this._disposed) throw new Error('AudioDirector has been disposed.');
    try {
      if (!this._context) {
        if (this._contextFactory) this._context = this._contextFactory();
        else {
          const AudioContextClass = this._AudioContextClass
            || globalThis.AudioContext
            || globalThis.webkitAudioContext;
          if (!AudioContextClass) throw new Error('Web Audio API is not available.');
          this._context = new AudioContextClass({ latencyHint: 'interactive' });
        }
        if (!this._context) throw new Error('Audio context factory returned no context.');
      }
      if (!this._initialized) this._initializeGraph();
      if (this._context.state === 'suspended') await this._context.resume();
      return this._context.state === 'running';
    } catch (error) {
      this._lastError = error;
      throw error;
    }
  }

  /** Alias intended for start-screen handlers. */
  activate() { return this.resume(); }

  /**
   * Decode optional externally recorded weapon reports after the audio context
   * has been activated. The procedural layers remain active as a deterministic
   * fallback and to provide spatial tails, suppression, and casing detail.
   */
  async loadWeaponSamples(payloads = {}) {
    if (!this.ready) return Object.freeze({ loaded: [], failed: ['context-not-ready'] });
    const loaded = [];
    const failed = [];
    for (const [kind, payload] of Object.entries(payloads)) {
      const weapon = kind === 'pistol' ? 'pistol' : kind === 'rifle' ? 'rifle' : null;
      if (!weapon || !(payload instanceof ArrayBuffer)) { failed.push(kind); continue; }
      try {
        // decodeAudioData can detach its argument, so retain the fetched source.
        const buffer = await this._context.decodeAudioData(payload.slice(0));
        this._weaponSamples[weapon] = buffer;
        loaded.push(weapon);
      } catch (error) {
        this._lastError = error;
        failed.push(weapon);
      }
    }
    return Object.freeze({ loaded: Object.freeze(loaded), failed: Object.freeze(failed) });
  }

  /**
   * Decode optional human-performed enemy callouts. Payload keys use
   * `type:variant`, for example `contact:male`; multiple variants avoid the
   * same actor repeating on every squad state transition.
   */
  async loadEnemyVoiceSamples(payloads = {}) {
    if (!this.ready) return Object.freeze({ loaded: [], failed: ['context-not-ready'] });
    const loaded = [];
    const failed = [];
    for (const [id, payload] of Object.entries(payloads)) {
      const [type, variant = 'default'] = id.split(':');
      if (!VOICE_PATTERNS[type] || !(payload instanceof ArrayBuffer)) { failed.push(id); continue; }
      try {
        const buffer = await this._context.decodeAudioData(payload.slice(0));
        const variants = this._enemyVoiceSamples[type] || (this._enemyVoiceSamples[type] = []);
        variants.push({ variant, buffer });
        loaded.push(id);
      } catch (error) {
        this._lastError = error;
        failed.push(id);
      }
    }
    return Object.freeze({ loaded: Object.freeze(loaded), failed: Object.freeze(failed) });
  }

  /**
   * Decode optional CC0 player-footstep recordings. The compact footstep
   * library is intentionally surface-neutral; playFootstep() applies the
   * hard-floor or grass spectral treatment at runtime.
   */
  async loadFootstepSamples(payloads = {}) {
    if (!this.ready) return Object.freeze({ loaded: [], failed: ['context-not-ready'] });
    const loaded = [];
    const failed = [];
    for (const [id, payload] of Object.entries(payloads)) {
      if (!(payload instanceof ArrayBuffer)) { failed.push(id); continue; }
      try {
        const buffer = await this._context.decodeAudioData(payload.slice(0));
        this._footstepSamples.push(buffer);
        loaded.push(id);
      } catch (error) {
        this._lastError = error;
        failed.push(id);
      }
    }
    return Object.freeze({ loaded: Object.freeze(loaded), failed: Object.freeze(failed) });
  }

  async suspend() {
    if (!this._context || this._context.state !== 'running') return false;
    await this._context.suspend();
    return true;
  }

  _initializeGraph() {
    const context = this._context;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.18;

    const master = context.createGain();
    const music = context.createGain();
    const sfx = context.createGain();
    const ambience = context.createGain();
    music.connect(master);
    sfx.connect(master);
    ambience.connect(master);
    master.connect(compressor).connect(context.destination);

    this._buses = { master, music, sfx, ambience, compressor };
    this._noiseBuffer = this._createNoiseBuffer(4);
    this._initialized = true;
    this._applyVolumes(0);
    this._startAmbience();
    this._startTensionBed();
    this._applyZone(this._zoneBlend, 0);
    this._applyCombat(this._combatIntensity, 0);
    this._applyPower(this._powerOn, 0);
  }

  _createNoiseBuffer(seconds) {
    const context = this._context;
    const frameCount = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const white = this._random() * 2 - 1;
      previous = previous * 0.86 + white * 0.14;
      samples[index] = white * 0.72 + previous * 0.28;
    }
    return buffer;
  }

  _rememberPersistent(...nodes) {
    for (const node of nodes) if (node) this._persistentNodes.add(node);
  }

  _startPersistent(source, when = this._context.currentTime) {
    this._persistentSources.add(source);
    source.start(when);
    return source;
  }

  _loopingNoise(destination, settings = {}) {
    const context = this._context;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this._noiseBuffer;
    source.loop = true;
    source.playbackRate.value = settings.rate || 1;
    filter.type = settings.type || 'lowpass';
    filter.frequency.value = settings.frequency || 800;
    filter.Q.value = settings.q || 0.7;
    gain.gain.value = settings.gain ?? 0.05;
    source.connect(filter).connect(gain).connect(destination);
    this._rememberPersistent(source, filter, gain);
    return { source: this._startPersistent(source), filter, gain };
  }

  _persistentOscillator(destination, settings = {}) {
    const context = this._context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = settings.type || 'sine';
    oscillator.frequency.value = settings.frequency || 60;
    gain.gain.value = settings.gain ?? 0.01;
    oscillator.connect(gain).connect(destination);
    this._rememberPersistent(oscillator, gain);
    return { oscillator: this._startPersistent(oscillator), gain };
  }

  _startAmbience() {
    const context = this._context;
    const indoor = context.createGain();
    const outdoor = context.createGain();
    const power = context.createGain();
    indoor.gain.value = 1;
    outdoor.gain.value = 0;
    power.gain.value = this._powerOn ? 1 : 0.16;
    power.connect(indoor);
    indoor.connect(this._buses.ambience);
    outdoor.connect(this._buses.ambience);
    this._zoneNodes = { indoor, outdoor };
    this._powerGain = power;
    this._rememberPersistent(indoor, outdoor, power);

    this._loopingNoise(power, { type: 'lowpass', frequency: 520, q: 0.5, gain: 0.075, rate: 0.68 });
    this._loopingNoise(power, { type: 'bandpass', frequency: 1450, q: 1.1, gain: 0.021, rate: 1.37 });
    this._persistentOscillator(power, { type: 'sine', frequency: 60, gain: 0.007 });
    this._persistentOscillator(power, { type: 'sine', frequency: 120, gain: 0.0035 });

    const wind = this._loopingNoise(outdoor, {
      type: 'bandpass', frequency: 720, q: 0.45, gain: 0.065, rate: 0.43
    });
    this._loopingNoise(outdoor, {
      type: 'highpass', frequency: 2100, q: 0.4, gain: 0.022, rate: 1.91
    });

    const gust = context.createOscillator();
    const gustDepth = context.createGain();
    gust.type = 'sine';
    gust.frequency.value = 0.083;
    gustDepth.gain.value = 0.026;
    gust.connect(gustDepth).connect(wind.gain.gain);
    this._rememberPersistent(gust, gustDepth);
    this._startPersistent(gust);
  }

  _startTensionBed() {
    const context = this._context;
    const exploration = context.createGain();
    const combat = context.createGain();
    const combatPulse = context.createGain();
    const lowpass = context.createBiquadFilter();
    exploration.gain.value = 0.052;
    combat.gain.value = 0;
    combatPulse.gain.value = 0.72;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 430;
    lowpass.Q.value = 0.8;
    exploration.connect(this._buses.music);
    combatPulse.connect(combat).connect(this._buses.music);
    this._musicNodes = { exploration, combat, combatPulse, lowpass };
    this._rememberPersistent(exploration, combat, combatPulse, lowpass);

    this._persistentOscillator(exploration, { type: 'sine', frequency: 54, gain: 0.44 });
    this._persistentOscillator(exploration, { type: 'triangle', frequency: 81, gain: 0.12 });

    const combatOscillator = context.createOscillator();
    const combatOscillatorGain = context.createGain();
    combatOscillator.type = 'sawtooth';
    combatOscillator.frequency.value = 46;
    combatOscillatorGain.gain.value = 0.18;
    combatOscillator.connect(combatOscillatorGain).connect(lowpass).connect(combatPulse);
    this._rememberPersistent(combatOscillator, combatOscillatorGain);
    this._startPersistent(combatOscillator);

    const pulse = context.createOscillator();
    const pulseDepth = context.createGain();
    pulse.type = 'sine';
    pulse.frequency.value = 1.72;
    pulseDepth.gain.value = 0.25;
    pulse.connect(pulseDepth).connect(combatPulse.gain);
    this._rememberPersistent(pulse, pulseDepth);
    this._startPersistent(pulse);

    const combatNoise = this._loopingNoise(combatPulse, {
      type: 'bandpass', frequency: 126, q: 1.4, gain: 0.022, rate: 0.57
    });
    combatNoise.filter.frequency.value = 126;
  }

  _ramp(parameter, value, seconds = 0.08) {
    if (!parameter || !this._context) return;
    const now = this._context.currentTime;
    const duration = Math.max(0, Number(seconds) || 0);
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(Number.isFinite(parameter.value) ? parameter.value : value, now);
    if (duration > 0) parameter.linearRampToValueAtTime(value, now + duration);
    else parameter.setValueAtTime(value, now);
  }

  _applyVolumes(fadeSeconds = 0.08) {
    if (!this._buses) return;
    this._ramp(this._buses.master.gain, this._volumes.master, fadeSeconds);
    this._ramp(this._buses.music.gain, this._volumes.music, fadeSeconds);
    this._ramp(this._buses.sfx.gain, this._volumes.sfx, fadeSeconds);
    this._ramp(this._buses.ambience.gain, this._volumes.ambience, fadeSeconds);
  }

  setMasterVolume(value, fadeSeconds = 0.08) {
    this._volumes.master = clamp(value);
    this._applyVolumes(fadeSeconds);
    return this;
  }

  setMusicVolume(value, fadeSeconds = 0.08) {
    this._volumes.music = clamp(value);
    this._applyVolumes(fadeSeconds);
    return this;
  }

  setSfxVolume(value, fadeSeconds = 0.08) {
    this._volumes.sfx = clamp(value);
    this._applyVolumes(fadeSeconds);
    return this;
  }

  setAmbienceVolume(value, fadeSeconds = 0.08) {
    this._volumes.ambience = clamp(value);
    this._applyVolumes(fadeSeconds);
    return this;
  }

  _applyZone(value, fadeSeconds = 1.2) {
    if (!this._zoneNodes) return;
    const blend = clamp(value);
    const indoor = Math.cos(blend * Math.PI * 0.5);
    const outdoor = Math.sin(blend * Math.PI * 0.5);
    this._ramp(this._zoneNodes.indoor.gain, indoor, fadeSeconds);
    this._ramp(this._zoneNodes.outdoor.gain, outdoor, fadeSeconds);
  }

  /** Set 0/"indoor" through 1/"outdoor" with an equal-power crossfade. */
  setZone(value, fadeSeconds = 1.2) {
    this._zoneBlend = zoneValue(value);
    this._applyZone(this._zoneBlend, fadeSeconds);
    return this;
  }

  _applyCombat(value, fadeSeconds = 0.55) {
    if (!this._musicNodes) return;
    const intensity = clamp(value);
    this._ramp(this._musicNodes.exploration.gain, 0.052 * Math.cos(intensity * Math.PI * 0.5), fadeSeconds);
    this._ramp(this._musicNodes.combat.gain, 0.115 * Math.sin(intensity * Math.PI * 0.5), fadeSeconds);
    this._ramp(this._musicNodes.lowpass.frequency, 360 + intensity * 520, fadeSeconds);
  }

  setCombatIntensity(value, fadeSeconds = 0.55) {
    this._combatIntensity = clamp(value);
    this._applyCombat(this._combatIntensity, fadeSeconds);
    return this;
  }

  _applyPower(on, fadeSeconds = 0.45) {
    if (this._powerGain) this._ramp(this._powerGain.gain, on ? 1 : 0.16, fadeSeconds);
  }

  setPowerState(on, fadeSeconds = 0.45) {
    this._powerOn = Boolean(on);
    this._applyPower(this._powerOn, fadeSeconds);
    return this;
  }

  /**
   * Per-frame convenience hook. All fields are optional.
   * @param {number} deltaSeconds
   * @param {{outdoorBlend?:number,zone?:number|string,combatIntensity?:number,powerOn?:boolean,listener?:Object}} state
   */
  update(deltaSeconds, state = {}) {
    const response = 1 - Math.exp(-Math.max(0, Number(deltaSeconds) || 0) * 5);
    const nextZone = state.outdoorBlend ?? state.zone;
    if (nextZone !== undefined) {
      const target = zoneValue(nextZone);
      const smoothed = this._zoneBlend + (target - this._zoneBlend) * response;
      if (Math.abs(smoothed - this._zoneBlend) > 0.0001) this.setZone(smoothed, 0.08);
    }
    if (state.combatIntensity !== undefined) {
      const target = clamp(state.combatIntensity);
      const smoothed = this._combatIntensity + (target - this._combatIntensity) * response;
      if (Math.abs(smoothed - this._combatIntensity) > 0.0001) this.setCombatIntensity(smoothed, 0.08);
    }
    if (state.powerOn !== undefined && Boolean(state.powerOn) !== this._powerOn) {
      this.setPowerState(state.powerOn);
    }
    if (state.listener) this.setListener(state.listener);
    return this;
  }

  /** Update Web Audio's listener from THREE.Vector3-compatible values. */
  setListener({ position, forward, up } = {}) {
    if (!this.ready) return false;
    const listener = this._context.listener;
    const p = vector3(position);
    const f = vector3(forward, { x: 0, y: 0, z: -1 });
    const u = vector3(up, { x: 0, y: 1, z: 0 });
    const now = this._context.currentTime;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(p.x, now);
      listener.positionY.setValueAtTime(p.y, now);
      listener.positionZ.setValueAtTime(p.z, now);
      listener.forwardX.setValueAtTime(f.x, now);
      listener.forwardY.setValueAtTime(f.y, now);
      listener.forwardZ.setValueAtTime(f.z, now);
      listener.upX.setValueAtTime(u.x, now);
      listener.upY.setValueAtTime(u.y, now);
      listener.upZ.setValueAtTime(u.z, now);
    } else {
      listener.setPosition(p.x, p.y, p.z);
      listener.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
    return true;
  }

  _setPannerPosition(panner, position) {
    const p = vector3(position);
    const now = this._context.currentTime;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(p.x, now);
      panner.positionY.setValueAtTime(p.y, now);
      panner.positionZ.setValueAtTime(p.z, now);
    } else panner.setPosition(p.x, p.y, p.z);
  }

  _createEvent(position, settings = {}) {
    const context = this._context;
    const bus = this._buses[settings.bus || 'sfx'];
    const input = context.createGain();
    input.gain.value = clamp(settings.gain ?? 1, 0, 2);
    const event = { input, nodes: [input], active: 0 };
    if (position) {
      const panner = context.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = settings.refDistance || 1.8;
      panner.maxDistance = settings.maxDistance || 70;
      panner.rolloffFactor = settings.rolloffFactor || 1.15;
      this._setPannerPosition(panner, position);
      input.connect(panner).connect(bus);
      event.nodes.push(panner);
    } else input.connect(bus);
    return event;
  }

  _trackTransient(source, event, layerNodes) {
    event.active += 1;
    this._transientSources.add(source);
    source.onended = () => {
      this._transientSources.delete(source);
      for (const node of layerNodes) disconnect(node);
      event.active -= 1;
      if (event.active <= 0) for (const node of event.nodes) disconnect(node);
    };
  }

  _noiseLayer(event, settings = {}) {
    const context = this._context;
    const start = settings.start ?? context.currentTime;
    const duration = Math.max(0.015, settings.duration || 0.1);
    const end = start + duration;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filters = [];
    source.buffer = this._noiseBuffer;
    source.playbackRate.value = settings.rate || 1;
    const filterSettings = settings.filters || (settings.filter ? [settings.filter] : []);
    for (const definition of filterSettings) {
      const filter = context.createBiquadFilter();
      filter.type = definition.type || 'bandpass';
      filter.frequency.value = definition.frequency || 1000;
      filter.Q.value = definition.q ?? 0.8;
      filters.push(filter);
    }
    let node = source;
    for (const filter of filters) { node.connect(filter); node = filter; }
    node.connect(gain).connect(event.input);
    const attack = Math.min(duration * 0.35, settings.attack ?? 0.002);
    gain.gain.setValueAtTime(EPSILON, start);
    gain.gain.linearRampToValueAtTime(Math.max(EPSILON, settings.gain ?? 0.2), start + attack);
    gain.gain.exponentialRampToValueAtTime(EPSILON, end);
    this._trackTransient(source, event, [source, ...filters, gain]);
    const maximumOffset = Math.max(0, this._noiseBuffer.duration - duration - 0.02);
    source.start(start, this._random() * maximumOffset);
    source.stop(end + 0.015);
    return source;
  }

  _sampleLayer(event, buffer, settings = {}) {
    if (!buffer) return null;
    const context = this._context;
    const start = settings.start ?? context.currentTime;
    const rate = settings.rate || 1;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filters = [];
    source.buffer = buffer;
    source.playbackRate.value = rate;
    let node = source;
    for (const definition of settings.filters || []) {
      const filter = context.createBiquadFilter();
      filter.type = definition.type || 'lowpass';
      filter.frequency.value = definition.frequency || 2500;
      filter.Q.value = definition.q ?? 0.7;
      node.connect(filter);
      node = filter;
      filters.push(filter);
    }
    node.connect(gain).connect(event.input);
    const duration = Math.max(0.02, Math.min(settings.duration || buffer.duration / rate, buffer.duration / rate));
    const end = start + duration;
    gain.gain.setValueAtTime(EPSILON, start);
    gain.gain.linearRampToValueAtTime(Math.max(EPSILON, settings.gain ?? 0.45), start + Math.min(0.004, duration * 0.08));
    gain.gain.setValueAtTime(Math.max(EPSILON, settings.gain ?? 0.45), start + duration * 0.48);
    gain.gain.exponentialRampToValueAtTime(EPSILON, end);
    this._trackTransient(source, event, [source, ...filters, gain]);
    source.start(start);
    source.stop(end + 0.012);
    return source;
  }

  _oscillatorLayer(event, settings = {}) {
    const context = this._context;
    const start = settings.start ?? context.currentTime;
    const duration = Math.max(0.012, settings.duration || 0.08);
    const end = start + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filters = [];
    oscillator.type = settings.type || 'sine';
    const from = Math.max(1, settings.from || settings.frequency || 120);
    const to = Math.max(1, settings.to || from);
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, end);
    const filterSettings = settings.filters || [];
    let node = oscillator;
    for (const definition of filterSettings) {
      const filter = context.createBiquadFilter();
      filter.type = definition.type || 'bandpass';
      filter.frequency.value = definition.frequency || 1000;
      filter.Q.value = definition.q ?? 0.8;
      node.connect(filter);
      node = filter;
      filters.push(filter);
    }
    node.connect(gain).connect(event.input);
    const attack = Math.min(duration * 0.35, settings.attack ?? 0.0015);
    gain.gain.setValueAtTime(EPSILON, start);
    gain.gain.linearRampToValueAtTime(Math.max(EPSILON, settings.gain ?? 0.1), start + attack);
    gain.gain.exponentialRampToValueAtTime(EPSILON, end);
    this._trackTransient(oscillator, event, [oscillator, ...filters, gain]);
    oscillator.start(start);
    oscillator.stop(end + 0.01);
    return oscillator;
  }

  _casingLayers(event, kind, start, strength = 1) {
    const basePitch = kind === 'rifle' ? 3300 : 3900;
    const count = kind === 'rifle' ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      const time = start + index * (0.026 + this._random() * 0.012);
      const pitch = basePitch * (0.84 + this._random() * 0.3);
      this._oscillatorLayer(event, {
        start: time,
        duration: 0.038 + this._random() * 0.025,
        type: 'triangle',
        from: pitch,
        to: pitch * 0.48,
        gain: 0.025 * strength
      });
      this._noiseLayer(event, {
        start: time,
        duration: 0.028,
        gain: 0.018 * strength,
        filter: { type: 'highpass', frequency: 2400, q: 0.55 }
      });
    }
  }

  /**
   * Play a layered rifle or pistol report. options.position makes it spatial.
   * @param {'rifle'|'pistol'} kind
   * @param {{position?:Object|number[],gain?:number,suppressed?:boolean,casing?:boolean,outdoorBlend?:number}} options
   */
  playWeapon(kind = 'rifle', options = {}) {
    if (!this.ready) return false;
    const weapon = kind === 'pistol' ? 'pistol' : 'rifle';
    const context = this._context;
    const now = context.currentTime + 0.004;
    const suppressed = Boolean(options.suppressed);
    const variation = 0.96 + this._random() * 0.08;
    const event = this._createEvent(options.position, {
      gain: options.gain ?? 1,
      refDistance: 2.2,
      maxDistance: weapon === 'rifle' ? 105 : 82,
      rolloffFactor: 1.08
    });
    const sourceSample = this._weaponSamples[weapon];
    if (sourceSample) {
      this._sampleLayer(event, sourceSample, {
        start: now,
        duration: weapon === 'rifle' ? 1.2 : 1.08,
        rate: variation,
        gain: suppressed ? 0.13 : weapon === 'rifle' ? 0.48 : 0.43,
        filters: suppressed
          ? [{ type: 'highpass', frequency: 220, q: 0.55 }, { type: 'lowpass', frequency: 2100, q: 0.72 }]
          : [{ type: 'highpass', frequency: 65, q: 0.4 }]
      });
    }
    const transientGain = suppressed ? 0.22 : sourceSample ? 0.58 : 1;

    if (weapon === 'rifle') {
      this._noiseLayer(event, {
        start: now, duration: suppressed ? 0.055 : 0.095, gain: 0.72 * transientGain,
        rate: variation,
        filters: [
          { type: 'highpass', frequency: suppressed ? 180 : 70, q: 0.45 },
          { type: 'lowpass', frequency: suppressed ? 1900 : 7200, q: 0.72 }
        ]
      });
      this._oscillatorLayer(event, {
        start: now, duration: 0.105, type: 'square', from: 138 * variation, to: 43,
        gain: 0.24 * transientGain
      });
      this._noiseLayer(event, {
        start: now + 0.013, duration: 0.035, gain: 0.16,
        filter: { type: 'bandpass', frequency: 2850 * variation, q: 1.3 }
      });
    } else {
      this._noiseLayer(event, {
        start: now, duration: suppressed ? 0.045 : 0.075, gain: 0.58 * transientGain,
        rate: variation,
        filters: [
          { type: 'highpass', frequency: suppressed ? 260 : 110, q: 0.5 },
          { type: 'lowpass', frequency: suppressed ? 2300 : 8400, q: 0.65 }
        ]
      });
      this._oscillatorLayer(event, {
        start: now, duration: 0.085, type: 'square', from: 172 * variation, to: 58,
        gain: 0.18 * transientGain
      });
      this._oscillatorLayer(event, {
        start: now + 0.014, duration: 0.038, type: 'triangle', from: 2450, to: 880,
        gain: 0.075
      });
    }

    const blend = clamp(options.outdoorBlend ?? this._zoneBlend);
    if (!suppressed) {
      const indoorStrength = Math.cos(blend * Math.PI * 0.5);
      const outdoorStrength = Math.sin(blend * Math.PI * 0.5);
      if (indoorStrength > 0.01) {
        this._noiseLayer(event, {
          start: now + 0.022,
          duration: weapon === 'rifle' ? 0.34 : 0.26,
          attack: 0.018,
          gain: (weapon === 'rifle' ? 0.21 : 0.15) * indoorStrength,
          filter: { type: 'bandpass', frequency: weapon === 'rifle' ? 690 : 880, q: 0.55 }
        });
      }
      if (outdoorStrength > 0.01) {
        this._noiseLayer(event, {
          start: now + 0.028,
          duration: weapon === 'rifle' ? 0.72 : 0.52,
          attack: 0.024,
          gain: (weapon === 'rifle' ? 0.13 : 0.095) * outdoorStrength,
          filter: { type: 'bandpass', frequency: weapon === 'rifle' ? 510 : 690, q: 0.42 }
        });
      }
    }
    if (options.casing !== false) this._casingLayers(event, weapon, now + (weapon === 'rifle' ? 0.064 : 0.052), 1);
    return true;
  }

  /** Play magazine, charging, selector, dry-fire, or complete reload foley. */
  playWeaponMechanism(kind = 'rifle', action = 'reload', options = {}) {
    if (!this.ready) return false;
    const weapon = kind === 'pistol' ? 'pistol' : 'rifle';
    const now = this._context.currentTime + 0.004;
    const event = this._createEvent(options.position, {
      gain: options.gain ?? 0.82,
      refDistance: 1.5,
      maxDistance: 34
    });
    const click = (time, pitch = 1450, gain = 0.12) => {
      this._noiseLayer(event, {
        start: time, duration: 0.032, gain,
        filter: { type: 'bandpass', frequency: pitch, q: 1.1 }
      });
      this._oscillatorLayer(event, {
        start: time, duration: 0.032, type: 'triangle', from: pitch * 1.15, to: pitch * 0.55,
        gain: gain * 0.45
      });
    };
    const magazine = (time, inserting) => {
      this._noiseLayer(event, {
        start: time, duration: inserting ? 0.11 : 0.08, gain: 0.09,
        filter: { type: 'bandpass', frequency: inserting ? 820 : 1080, q: 0.8 }
      });
      click(time + (inserting ? 0.075 : 0.035), inserting ? 1120 : 1380, inserting ? 0.15 : 0.09);
    };
    const charge = (time) => {
      this._noiseLayer(event, {
        start: time, duration: weapon === 'rifle' ? 0.18 : 0.13, gain: 0.075,
        filter: { type: 'bandpass', frequency: weapon === 'rifle' ? 1180 : 1540, q: 0.65 }
      });
      click(time + (weapon === 'rifle' ? 0.15 : 0.105), weapon === 'rifle' ? 1240 : 1860, 0.17);
    };

    switch (action) {
      case 'dryFire': click(now, weapon === 'rifle' ? 1320 : 1780, 0.13); break;
      case 'selector': click(now, 2100, 0.08); break;
      case 'magOut': magazine(now, false); break;
      case 'magIn': magazine(now, true); break;
      case 'charge':
      case 'slide': charge(now); break;
      case 'equip':
        this._noiseLayer(event, {
          start: now, duration: 0.18, gain: 0.07,
          filter: { type: 'bandpass', frequency: 680, q: 0.52 }
        });
        click(now + 0.13, 1180, 0.08);
        break;
      default: {
        magazine(now, false);
        magazine(now + (weapon === 'rifle' ? 0.43 : 0.3), true);
        charge(now + (weapon === 'rifle' ? 0.82 : 0.58));
      }
    }
    return true;
  }

  /**
   * Play a first-person step. Grass is deliberately softer and lower-passed,
   * while the facility uses a brighter hard-floor heel/toe transient.
   */
  playFootstep(surface = 'hard', options = {}) {
    if (!this.ready) return false;
    const grass = surface === 'grass';
    const now = this._context.currentTime + 0.004;
    const sprinting = Boolean(options.sprinting);
    const strength = sprinting ? 1.12 : 0.92;
    const event = this._createEvent(options.position, {
      gain: options.gain ?? 0.62,
      refDistance: 1.25,
      maxDistance: 28,
      rolloffFactor: 1.25
    });
    const sample = this._footstepSamples.length
      ? this._footstepSamples[Math.floor(this._random() * this._footstepSamples.length)]
      : null;
    const rate = (grass ? 0.9 : 0.96) + this._random() * 0.12;

    if (sample) {
      this._sampleLayer(event, sample, {
        start: now,
        rate,
        gain: (grass ? 0.33 : 0.4) * strength,
        filters: grass
          ? [{ type: 'highpass', frequency: 52, q: 0.5 }, { type: 'lowpass', frequency: 1380, q: 0.72 }]
          : [{ type: 'highpass', frequency: 105, q: 0.55 }, { type: 'lowpass', frequency: 4400, q: 0.62 }]
      });
    } else {
      this._noiseLayer(event, {
        start: now,
        duration: grass ? 0.1 : 0.075,
        gain: (grass ? 0.14 : 0.18) * strength,
        rate,
        filters: grass
          ? [{ type: 'highpass', frequency: 55, q: 0.55 }, { type: 'lowpass', frequency: 940, q: 0.75 }]
          : [{ type: 'highpass', frequency: 130, q: 0.6 }, { type: 'bandpass', frequency: 1750, q: 0.68 }]
      });
    }

    if (grass) {
      this._noiseLayer(event, {
        start: now + 0.012, duration: 0.095, gain: 0.052 * strength,
        filter: { type: 'bandpass', frequency: 430 + this._random() * 140, q: 0.46 }
      });
    } else {
      this._oscillatorLayer(event, {
        start: now + 0.014, duration: 0.034, type: 'triangle',
        from: 1550 + this._random() * 280, to: 620, gain: 0.024 * strength
      });
      this._noiseLayer(event, {
        start: now + 0.026, duration: 0.045, gain: 0.034 * strength,
        filter: { type: 'bandpass', frequency: 2650 + this._random() * 340, q: 1.05 }
      });
    }
    return true;
  }

  playCasing(kind = 'rifle', options = {}) {
    if (!this.ready) return false;
    const event = this._createEvent(options.position, {
      gain: options.gain ?? 0.9,
      refDistance: 1.4,
      maxDistance: 26
    });
    this._casingLayers(event, kind === 'pistol' ? 'pistol' : 'rifle', this._context.currentTime + 0.004);
    return true;
  }

  /** Play the mechanical breaker snap and optionally update the power ambience. */
  playBreaker(options = {}) {
    if (options.applyPower !== false) this.setPowerState(options.on ?? true, options.powerFade ?? 0.5);
    if (!this.ready) return false;
    const now = this._context.currentTime + 0.004;
    const event = this._createEvent(options.position, {
      gain: options.gain ?? 1,
      refDistance: 1.5,
      maxDistance: 38
    });
    this._noiseLayer(event, {
      start: now, duration: 0.072, gain: 0.28,
      filters: [
        { type: 'highpass', frequency: 240, q: 0.55 },
        { type: 'lowpass', frequency: 3600, q: 0.6 }
      ]
    });
    this._oscillatorLayer(event, {
      start: now, duration: 0.14, type: 'triangle', from: 176, to: 54, gain: 0.2
    });
    this._oscillatorLayer(event, {
      start: now + 0.012, duration: 0.045, type: 'square', from: 1650, to: 720, gain: 0.075
    });
    if (options.on ?? true) {
      this._noiseLayer(event, {
        start: now + 0.07, duration: 0.18, attack: 0.01, gain: 0.055,
        filter: { type: 'bandpass', frequency: 2480, q: 1.4 }
      });
    }
    return true;
  }

  /** Play a heavy security-door travel and latch sequence. */
  playDoor(options = {}) {
    if (!this.ready) return false;
    const now = this._context.currentTime + 0.004;
    const open = options.open !== false;
    const heavy = options.heavy !== false;
    const travel = heavy ? 0.68 : 0.42;
    const event = this._createEvent(options.position, {
      gain: options.gain ?? 0.9,
      refDistance: 2.3,
      maxDistance: 72,
      rolloffFactor: 1.05
    });
    this._noiseLayer(event, {
      start: now, duration: travel, attack: 0.07, gain: heavy ? 0.16 : 0.1,
      filters: [
        { type: 'highpass', frequency: 95, q: 0.5 },
        { type: 'lowpass', frequency: heavy ? 1250 : 1850, q: 0.75 }
      ]
    });
    this._oscillatorLayer(event, {
      start: now, duration: travel, attack: 0.055, type: 'sawtooth',
      from: open ? 61 : 74, to: open ? 84 : 48, gain: heavy ? 0.075 : 0.04
    });
    const latchTime = now + (open ? travel * 0.84 : travel * 0.96);
    this._noiseLayer(event, {
      start: latchTime, duration: 0.085, gain: heavy ? 0.29 : 0.18,
      filter: { type: 'bandpass', frequency: 620, q: 0.7 }
    });
    this._oscillatorLayer(event, {
      start: latchTime, duration: 0.13, type: 'triangle', from: 218, to: 52,
      gain: heavy ? 0.2 : 0.11
    });
    return true;
  }

  _radioLayers(event, start, strength = 1) {
    this._noiseLayer(event, {
      start, duration: 0.055, gain: 0.08 * strength,
      filter: { type: 'bandpass', frequency: 2300, q: 0.75 }
    });
    this._oscillatorLayer(event, {
      start: start + 0.012, duration: 0.052, type: 'square', from: 1420, to: 1140,
      gain: 0.045 * strength
    });
    this._oscillatorLayer(event, {
      start: start + 0.068, duration: 0.048, type: 'square', from: 1720, to: 1320,
      gain: 0.034 * strength
    });
  }

  /** Play a compact positional radio key/chirp. */
  playRadioChirp(position, options = {}) {
    if (!this.ready) return false;
    const event = this._createEvent(position, {
      gain: options.gain ?? 0.8,
      refDistance: 1.8,
      maxDistance: options.maxDistance || 48
    });
    this._radioLayers(event, this._context.currentTime + 0.004, options.intensity ?? 1);
    return true;
  }

  /**
   * Play a positional enemy call. Licensed recordings are preferred when they
   * decoded successfully; the compact synthesized phrase remains a deterministic
   * fallback for offline/blocked media and unsupported codecs.
   */
  playEnemyCall(position, options = {}) {
    if (!this.ready) return false;
    const type = String(options.type || 'contact');
    const pattern = VOICE_PATTERNS[type] || VOICE_PATTERNS.contact;
    const intensity = clamp(options.intensity ?? 0.85, 0.15, 1.25);
    const event = this._createEvent(position, {
      gain: options.gain ?? 0.78,
      refDistance: 2,
      maxDistance: options.maxDistance || 58,
      rolloffFactor: 1.12
    });
    let cursor = this._context.currentTime + 0.004;
    if (options.radio !== false) {
      this._radioLayers(event, cursor, 0.72);
      cursor += 0.105;
    }
    const voiceShift = 0.94 + this._random() * 0.12;
    const recordings = this._enemyVoiceSamples[type];
    if (recordings?.length) {
      const recording = recordings[Math.floor(this._random() * recordings.length)];
      const voiceDuration = recording.buffer.duration / voiceShift;
      this._sampleLayer(event, recording.buffer, {
        start: cursor,
        rate: voiceShift,
        gain: 0.68 * intensity,
        filters: options.radio === false
          ? [{ type: 'highpass', frequency: 110, q: 0.45 }, { type: 'lowpass', frequency: 5800, q: 0.55 }]
          : [{ type: 'highpass', frequency: 260, q: 0.55 }, { type: 'lowpass', frequency: 2700, q: 0.72 }]
      });
      if (options.radio !== false) {
        this._noiseLayer(event, {
          start: cursor + voiceDuration, duration: 0.045, gain: 0.055,
          filter: { type: 'bandpass', frequency: 2500, q: 0.8 }
        });
      }
      return true;
    }
    for (let index = 0; index < pattern.length; index += 1) {
      const duration = (0.105 + this._random() * 0.045) / intensity;
      const pitch = pattern[index] * voiceShift;
      this._oscillatorLayer(event, {
        start: cursor,
        duration,
        attack: 0.013,
        type: 'sawtooth',
        from: pitch * 1.06,
        to: pitch * 0.83,
        gain: 0.075 * intensity,
        filters: [
          { type: 'highpass', frequency: 105, q: 0.4 },
          { type: 'lowpass', frequency: options.radio === false ? 3300 : 2250, q: 0.75 }
        ]
      });
      this._oscillatorLayer(event, {
        start: cursor,
        duration: duration * 0.9,
        type: 'triangle',
        from: pitch * 2.02,
        to: pitch * 1.72,
        gain: 0.025 * intensity
      });
      this._noiseLayer(event, {
        start: cursor,
        duration: Math.min(0.04, duration * 0.35),
        gain: 0.02 * intensity,
        filter: { type: 'bandpass', frequency: 1800 + this._random() * 900, q: 1.2 }
      });
      cursor += duration + 0.025 + this._random() * 0.028;
    }
    if (options.radio !== false) {
      this._noiseLayer(event, {
        start: cursor, duration: 0.045, gain: 0.055,
        filter: { type: 'bandpass', frequency: 2500, q: 0.8 }
      });
    }
    return true;
  }

  /** Stop all sources, disconnect the graph, and optionally close its context. */
  async dispose({ closeContext = this.options.closeContextOnDispose } = {}) {
    if (this._disposed) return;
    this._disposed = true;
    for (const source of this._transientSources) {
      try { source.stop(); } catch { /* Source may already have ended. */ }
      disconnect(source);
    }
    for (const source of this._persistentSources) {
      try { source.stop(); } catch { /* Source may already have ended. */ }
      disconnect(source);
    }
    this._transientSources.clear();
    this._persistentSources.clear();
    for (const node of this._persistentNodes) disconnect(node);
    this._persistentNodes.clear();
    if (this._buses) for (const node of Object.values(this._buses)) disconnect(node);
    if (closeContext && this._ownsContext && this._context?.state !== 'closed') {
      await this._context.close();
    }
    this._initialized = false;
    this._buses = null;
    this._zoneNodes = null;
    this._musicNodes = null;
    this._powerGain = null;
    this._noiseBuffer = null;
    this._weaponSamples = Object.create(null);
    this._enemyVoiceSamples = Object.create(null);
    this._footstepSamples = [];
  }
}

export function createAudioDirector(options = {}) {
  return new AudioDirector(options);
}

export default createAudioDirector;
