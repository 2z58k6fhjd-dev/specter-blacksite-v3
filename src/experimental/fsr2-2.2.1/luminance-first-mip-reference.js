// SPDX-License-Identifier: MIT
//
// CPU reference for the isolated WGSL first-mip port beside this file.
// Algorithm provenance and fidelity limits are recorded in PROVENANCE.json.

export const FSR2_2_2_1_LUMINANCE_CONSTANTS = Object.freeze({
  epsilon: 1e-3,
  rgbToLuma: Object.freeze([0.2126, 0.7152, 0.0722]),
  spdReduceWeight: 0.25
});

export const LUMINANCE_FIRST_MIP_CONTRACT = Object.freeze({
  upstreamVersion: '2.2.1',
  upstreamTag: 'v2.2.1',
  upstreamCommit: '1680d1edd5c034f88ebbbb793d8b88f8842cf804',
  stage: 'isolated-first-spd-reduction-reference',
  runtimeIntegrated: false,
  completeLuminancePyramid: false,
  completeFsr2: false,
  outputFormat: 'r32float-reference-staging'
});

function requireFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  return value;
}

function requireVec2(value, label, { integer = false, positive = false } = {}) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`${label} must be a two-element array.`);
  }
  const result = value.map((component, index) => {
    const checked = requireFiniteNumber(component, `${label}[${index}]`);
    if (integer && !Number.isInteger(checked)) {
      throw new TypeError(`${label}[${index}] must be an integer.`);
    }
    if (positive && checked <= 0) {
      throw new RangeError(`${label}[${index}] must be greater than zero.`);
    }
    return checked;
  });
  return result;
}

function requireRgb(value, label = 'rgb') {
  if (!Array.isArray(value) || value.length < 3) {
    throw new TypeError(`${label} must contain at least three components.`);
  }
  return value.slice(0, 3).map((component, index) =>
    requireFiniteNumber(component, `${label}[${index}]`)
  );
}

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(value, upper));
}

export function rgbToLuminance(rgb) {
  const color = requireRgb(rgb);
  const weights = FSR2_2_2_1_LUMINANCE_CONSTANTS.rgbToLuma;
  return color[0] * weights[0] + color[1] * weights[1] + color[2] * weights[2];
}

export function logLuminanceAfterPreExposure(rgb, preExposure = 1) {
  const exposure = requireFiniteNumber(preExposure, 'preExposure');
  if (exposure <= 0) {
    throw new RangeError('preExposure must be greater than zero.');
  }
  const color = requireRgb(rgb).map((component) => component / exposure);
  return Math.log(Math.max(
    FSR2_2_2_1_LUMINANCE_CONSTANTS.epsilon,
    rgbToLuminance(color)
  ));
}

export function clampFsr2Uv(uv, renderSize, inputColorResourceDimensions) {
  const sourceUv = requireVec2(uv, 'uv');
  const render = requireVec2(renderSize, 'renderSize', { integer: true, positive: true });
  const resource = requireVec2(
    inputColorResourceDimensions,
    'inputColorResourceDimensions',
    { integer: true, positive: true }
  );
  const sampleLocation = [sourceUv[0] * render[0], sourceUv[1] * render[1]];
  const clampedLocation = [
    clamp(sampleLocation[0], 0.5, render[0] - 0.5),
    clamp(sampleLocation[1], 0.5, render[1] - 0.5)
  ];
  return [clampedLocation[0] / resource[0], clampedLocation[1] / resource[1]];
}

export function sampleLinearClampRgb(readRgb, resourceDimensions, uv) {
  if (typeof readRgb !== 'function') {
    throw new TypeError('readRgb must be a function.');
  }
  const resource = requireVec2(resourceDimensions, 'resourceDimensions', {
    integer: true,
    positive: true
  });
  const sourceUv = requireVec2(uv, 'uv');

  const sampleX = sourceUv[0] * resource[0] - 0.5;
  const sampleY = sourceUv[1] * resource[1] - 0.5;
  const floorX = Math.floor(sampleX);
  const floorY = Math.floor(sampleY);
  const fractionX = sampleX - floorX;
  const fractionY = sampleY - floorY;
  const x0 = clamp(floorX, 0, resource[0] - 1);
  const x1 = clamp(floorX + 1, 0, resource[0] - 1);
  const y0 = clamp(floorY, 0, resource[1] - 1);
  const y1 = clamp(floorY + 1, 0, resource[1] - 1);

  const c00 = requireRgb(readRgb(x0, y0), `readRgb(${x0}, ${y0})`);
  const c10 = requireRgb(readRgb(x1, y0), `readRgb(${x1}, ${y0})`);
  const c01 = requireRgb(readRgb(x0, y1), `readRgb(${x0}, ${y1})`);
  const c11 = requireRgb(readRgb(x1, y1), `readRgb(${x1}, ${y1})`);

  return [0, 1, 2].map((channel) => {
    const upper = c00[channel] + (c10[channel] - c00[channel]) * fractionX;
    const lower = c01[channel] + (c11[channel] - c01[channel]) * fractionX;
    return upper + (lower - upper) * fractionY;
  });
}

export function sourceLogLuminance({
  sourceTexel,
  readRgb,
  renderSize,
  inputColorResourceDimensions = renderSize,
  jitter = [0, 0],
  preExposure = 1
}) {
  const texel = requireVec2(sourceTexel, 'sourceTexel', { integer: true });
  const render = requireVec2(renderSize, 'renderSize', { integer: true, positive: true });
  const resource = requireVec2(
    inputColorResourceDimensions,
    'inputColorResourceDimensions',
    { integer: true, positive: true }
  );
  const offset = requireVec2(jitter, 'jitter');
  const uv = [
    (texel[0] + 0.5 + offset[0]) / render[0],
    (texel[1] + 0.5 + offset[1]) / render[1]
  ];
  const clampedUv = clampFsr2Uv(uv, render, resource);
  const sampledRgb = sampleLinearClampRgb(readRgb, resource, clampedUv);
  const logLuminance = logLuminanceAfterPreExposure(sampledRgb, preExposure);
  const isOnScreen = texel[0] >= 0 && texel[1] >= 0
    && texel[0] < render[0] && texel[1] < render[1];
  return isOnScreen ? logLuminance : 0;
}

export function spdReduce4(v0, v1, v2, v3) {
  const values = [v0, v1, v2, v3].map((value, index) =>
    requireFiniteNumber(value, `value[${index}]`)
  );
  return (values[0] + values[1] + values[2] + values[3])
    * FSR2_2_2_1_LUMINANCE_CONSTANTS.spdReduceWeight;
}

export function firstMipDimensions(renderSize) {
  const render = requireVec2(renderSize, 'renderSize', { integer: true, positive: true });
  return [Math.ceil(render[0] / 2), Math.ceil(render[1] / 2)];
}

export function computeFirstLogLuminanceMip(options) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('options must be an object.');
  }
  const render = requireVec2(options.renderSize, 'renderSize', {
    integer: true,
    positive: true
  });
  const [width, height] = firstMipDimensions(render);
  const values = new Float64Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = [x * 2, y * 2];
      const shared = { ...options, renderSize: render };
      values[y * width + x] = spdReduce4(
        sourceLogLuminance({ ...shared, sourceTexel: [base[0], base[1]] }),
        sourceLogLuminance({ ...shared, sourceTexel: [base[0], base[1] + 1] }),
        sourceLogLuminance({ ...shared, sourceTexel: [base[0] + 1, base[1]] }),
        sourceLogLuminance({ ...shared, sourceTexel: [base[0] + 1, base[1] + 1] })
      );
    }
  }

  return Object.freeze({ width, height, values });
}
