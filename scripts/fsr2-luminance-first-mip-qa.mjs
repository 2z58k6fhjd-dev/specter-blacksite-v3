import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FSR2_2_2_1_LUMINANCE_CONSTANTS,
  LUMINANCE_FIRST_MIP_CONTRACT,
  clampFsr2Uv,
  computeFirstLogLuminanceMip,
  firstMipDimensions,
  logLuminanceAfterPreExposure,
  rgbToLuminance,
  sampleLinearClampRgb,
  sourceLogLuminance,
  spdReduce4
} from '../src/experimental/fsr2-2.2.1/luminance-first-mip-reference.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPERIMENT = resolve(ROOT, 'src/experimental/fsr2-2.2.1');
let checks = 0;

async function test(name, operation) {
  try {
    await operation();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

function check(value, message) {
  checks++;
  assert.ok(value, message);
}

function close(actual, expected, tolerance = 1e-12, label = 'value') {
  checks++;
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
}

function makeTexture(rows) {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  assert.ok(width > 0 && rows.every((row) => row.length === width));
  return Object.freeze({
    width,
    height,
    readRgb(x, y) {
      const value = rows[y][x];
      return Array.isArray(value) ? value : [value, value, value];
    }
  });
}

await test('contract is pinned, isolated, and cannot represent complete FSR2', () => {
  check(LUMINANCE_FIRST_MIP_CONTRACT.upstreamVersion === '2.2.1', 'Version must remain pinned.');
  check(LUMINANCE_FIRST_MIP_CONTRACT.upstreamTag === 'v2.2.1', 'Tag must remain pinned.');
  check(
    LUMINANCE_FIRST_MIP_CONTRACT.upstreamCommit === '1680d1edd5c034f88ebbbb793d8b88f8842cf804',
    'Commit must remain pinned.'
  );
  check(LUMINANCE_FIRST_MIP_CONTRACT.runtimeIntegrated === false, 'Reference must stay out of runtime.');
  check(LUMINANCE_FIRST_MIP_CONTRACT.completeLuminancePyramid === false, 'First mip is not a pyramid.');
  check(LUMINANCE_FIRST_MIP_CONTRACT.completeFsr2 === false, 'First mip is not FSR2.');
});

await test('official 2.2.1 luminance constants and formulas are exact', () => {
  close(FSR2_2_2_1_LUMINANCE_CONSTANTS.epsilon, 0.001, 0, 'FSR2_EPSILON');
  close(FSR2_2_2_1_LUMINANCE_CONSTANTS.rgbToLuma[0], 0.2126, 0, 'red coefficient');
  close(FSR2_2_2_1_LUMINANCE_CONSTANTS.rgbToLuma[1], 0.7152, 0, 'green coefficient');
  close(FSR2_2_2_1_LUMINANCE_CONSTANTS.rgbToLuma[2], 0.0722, 0, 'blue coefficient');
  close(FSR2_2_2_1_LUMINANCE_CONSTANTS.spdReduceWeight, 0.25, 0, 'reduce weight');
  close(rgbToLuminance([1, 0, 0]), 0.2126, 0, 'red luminance');
  close(rgbToLuminance([0, 1, 0]), 0.7152, 0, 'green luminance');
  close(rgbToLuminance([0, 0, 1]), 0.0722, 0, 'blue luminance');
  close(logLuminanceAfterPreExposure([0, 0, 0]), Math.log(0.001), 0, 'epsilon floor');
  close(logLuminanceAfterPreExposure([1, 1, 1]), 0, 1e-15, 'unit white');
  close(logLuminanceAfterPreExposure([1, 1, 1], 2), Math.log(0.5), 1e-15, 'pre-exposure');
  close(spdReduce4(1, 2, 3, 4), 2.5, 0, 'SpdReduce4');
});

await test('ClampUv matches AMD render-rectangle and backing-resource math', () => {
  const clamped = clampFsr2Uv([-1, 2], [3, 2], [4, 4]);
  close(clamped[0], 0.125, 0, 'clamped u');
  close(clamped[1], 0.375, 0, 'clamped v');
  const centered = clampFsr2Uv([0.5 / 3, 0.5 / 2], [3, 2], [4, 4]);
  close(centered[0], 0.125, 0, 'centered u');
  close(centered[1], 0.125, 0, 'centered v');
});

await test('linear-clamp oracle samples pixel centers and bilinear midpoints', () => {
  const texture = makeTexture([[0, 1], [2, 3]]);
  const center = sampleLinearClampRgb(texture.readRgb, [2, 2], [0.25, 0.25]);
  center.forEach((component) => close(component, 0, 0, 'pixel center'));
  const midpoint = sampleLinearClampRgb(texture.readRgb, [2, 2], [0.5, 0.5]);
  midpoint.forEach((component) => close(component, 1.5, 0, 'bilinear midpoint'));
});

await test('source load applies jitter, pre-exposure, log floor, and offscreen zero', () => {
  const texture = makeTexture([[0, 1]]);
  const shifted = sourceLogLuminance({
    sourceTexel: [0, 0],
    readRgb: texture.readRgb,
    renderSize: [2, 1],
    inputColorResourceDimensions: [2, 1],
    jitter: [0.5, 0],
    preExposure: 2
  });
  close(shifted, Math.log(0.25), 1e-15, 'jittered and pre-exposed sample');
  close(sourceLogLuminance({
    sourceTexel: [2, 0],
    readRgb: texture.readRgb,
    renderSize: [2, 1],
    inputColorResourceDimensions: [2, 1]
  }), 0, 0, 'offscreen contribution');
});

await test('first mip performs the official four-log-luminance mean', () => {
  const texture = makeTexture([
    [[1, 1, 1], [0, 0, 0]],
    [[1, 0, 0], [0, 1, 0]]
  ]);
  const result = computeFirstLogLuminanceMip({
    readRgb: texture.readRgb,
    renderSize: [2, 2],
    inputColorResourceDimensions: [2, 2]
  });
  check(result.width === 1 && result.height === 1, '2x2 input must produce a 1x1 first mip.');
  const expected = (
    0 + Math.log(0.001) + Math.log(0.2126) + Math.log(0.7152)
  ) * 0.25;
  close(result.values[0], expected, 1e-12, 'first mip result');
});

await test('odd render extents preserve AMD zero contribution at the boundary', () => {
  const texture = makeTexture([
    [0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5]
  ]);
  const result = computeFirstLogLuminanceMip({
    readRgb: texture.readRgb,
    renderSize: [3, 3],
    inputColorResourceDimensions: [3, 3]
  });
  check(result.width === 2 && result.height === 2, '3x3 input must produce a 2x2 first mip.');
  const logHalf = Math.log(0.5);
  close(result.values[0], logHalf, 1e-15, 'four valid samples');
  close(result.values[1], logHalf * 0.5, 1e-15, 'two horizontal valid samples');
  close(result.values[2], logHalf * 0.5, 1e-15, 'two vertical valid samples');
  close(result.values[3], logHalf * 0.25, 1e-15, 'one valid corner sample');
  assert.deepEqual(firstMipDimensions([1919, 1079]), [960, 540]);
  checks++;
});

await test('invalid reference inputs fail deterministically', () => {
  assert.throws(() => logLuminanceAfterPreExposure([1, 1, 1], 0), /greater than zero/);
  checks++;
  assert.throws(() => firstMipDimensions([0, 1080]), /greater than zero/);
  checks++;
  assert.throws(() => sampleLinearClampRgb(null, [1, 1], [0.5, 0.5]), /must be a function/);
  checks++;
});

await test('WGSL contains the pinned arithmetic and only one bounded compute entry point', async () => {
  const shader = await readFile(resolve(EXPERIMENT, 'ffx-fsr2-luminance-first-mip.wgsl'), 'utf8');
  check(shader.includes('const FSR2_EPSILON: f32 = 1.0e-3;'), 'Shader epsilon drifted.');
  check(
    shader.includes('vec3<f32>(0.2126, 0.7152, 0.0722)'),
    'Shader RGB-to-luma coefficients drifted.'
  );
  check(shader.includes('const SPD_REDUCE_WEIGHT: f32 = 0.25;'), 'Shader reduction weight drifted.');
  check(shader.includes('textureSampleLevel('), 'Shader must preserve linear level-zero sampling.');
  check(shader.includes('rgb = rgb / pass_constants.pre_exposure;'), 'Shader must undo pre-exposure.');
  check(shader.includes('log(max(FSR2_EPSILON, dot(rgb, FSR2_RGB_TO_LUMA)))'), 'Log-luma formula drifted.');
  check(shader.includes('return select(0.0, log_luminance, is_on_screen);'), 'Offscreen zero behavior drifted.');
  check(shader.includes('texture_storage_2d<r32float, write>'), 'Reference staging format drifted.');
  check((shader.match(/@compute\b/g) ?? []).length === 1, 'This slice must expose exactly one compute entry point.');
  check((shader.match(/{/g) ?? []).length === (shader.match(/}/g) ?? []).length, 'Shader braces are unbalanced.');
});

await test('machine-readable provenance retains exact upstream objects and limitations', async () => {
  const provenance = JSON.parse(await readFile(resolve(EXPERIMENT, 'PROVENANCE.json'), 'utf8'));
  check(provenance.upstream.version === '2.2.1', 'Provenance version drifted.');
  check(provenance.upstream.commit === '1680d1edd5c034f88ebbbb793d8b88f8842cf804', 'Provenance commit drifted.');
  check(provenance.upstream.license === 'MIT', 'Upstream license must be MIT.');
  check(provenance.representsCompleteLuminancePyramid === false, 'Must not claim a complete pyramid.');
  check(provenance.representsCompleteFsr2 === false, 'Must not claim complete FSR2.');
  check(provenance.runtimeIntegrated === false, 'Must not imply runtime integration.');
  const expectedBlobs = new Map([
    ['src/ffx-fsr2-api/shaders/ffx_fsr2_compute_luminance_pyramid.h', 'c63f1820e08dce54f9da230e46538bd39c6560a8'],
    ['src/ffx-fsr2-api/shaders/ffx_fsr2_common.h', '0c72aa84943e50b6806cddd6bf5c56c7d4922fe0'],
    ['src/ffx-fsr2-api/shaders/ffx_spd.h', '5ce24ec87cc3204b7d5e315774a892ba6fdd13b9'],
    ['src/ffx-fsr2-api/shaders/ffx_fsr2_compute_luminance_pyramid_pass.hlsl', '2b96636c26bb19e379fd8d6a296e6360d41b99d0']
  ]);
  for (const source of provenance.upstream.sources) {
    check(expectedBlobs.get(source.path) === source.gitBlobSha1, `Unexpected blob hash for ${source.path}.`);
    check(source.url.includes(provenance.upstream.commit), `${source.path} URL must pin the commit.`);
    expectedBlobs.delete(source.path);
  }
  check(expectedBlobs.size === 0, 'A required upstream source is absent.');
  check(
    provenance.researchedButNotImplemented.singlePassDownsampler.includes('global atomic'),
    'SPD omissions must remain explicit.'
  );
  check(
    provenance.researchedButNotImplemented.remainingFsr2Passes.includes('reproject and accumulate'),
    'Remaining temporal pass omissions must remain explicit.'
  );
});

await test('AMD MIT notice is retained and the live game does not import the experiment', async () => {
  const license = await readFile(resolve(EXPERIMENT, 'LICENSE-AMD-FSR2.txt'), 'utf8');
  check(license.startsWith('FidelityFX Super Resolution 2.2'), 'AMD license title is missing.');
  check(
    license.includes('Copyright (c) 2022-2023 Advanced Micro Devices, Inc. All rights reserved.'),
    'AMD copyright notice is missing.'
  );
  check(license.includes('Permission is hereby granted, free of charge'), 'MIT grant is missing.');
  check(license.includes('THE SOFTWARE IS PROVIDED "AS IS"'), 'MIT warranty disclaimer is missing.');
  const main = await readFile(resolve(ROOT, 'src/main.js'), 'utf8');
  check(!main.includes('fsr2-2.2.1'), 'The shipped runtime must not import the staged FSR2 experiment.');
});

console.log(`\nFSR2 luminance first-mip QA complete: ${checks} checks, 0 failures.`);
