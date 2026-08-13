import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_ROOT = resolve(ROOT, 'node_modules/three');

const mobileDevice = {
  viewport: { width: 412, height: 915 }, deviceScaleFactor: 1,
  isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A166B) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
};

async function waitForMission(page) {
  await expect(page.locator('#startButton')).toHaveText('ENTER BLACKSITE', { timeout: 180_000 });
}

async function enterMission(page) {
  await page.locator('#startButton').click();
  await expect(page.locator('#startPanel')).toBeHidden({ timeout: 10_000 });
}

async function localRuntimeDiagnostics(page, options = {}) {
  return page.evaluate(options => globalThis.__specterLocalRuntimeDiagnostics?.(options) || null, options);
}

// The shipped game intentionally imports Three.js from a pinned CDN URL.
// Browser acceptance mirrors that same pinned package locally, making CI and
// developer runs deterministic even when a browser sandbox blocks CDN traffic.
async function mirrorPinnedThree(page) {
  await page.route('https://cdn.jsdelivr.net/npm/three@0.166.1/**', async route => {
    const requestUrl = new URL(route.request().url());
    const suffix = requestUrl.pathname.replace('/npm/three@0.166.1/', '');
    const target = resolve(THREE_ROOT, suffix);
    if (relative(THREE_ROOT, target).startsWith('..')) { await route.abort('blockedbyclient'); return; }
    try {
      const body = await readFile(target);
      await route.fulfill({ body, contentType: 'text/javascript; charset=utf-8' });
    } catch { await route.abort('blockedbyclient'); }
  });
}

test.describe.configure({ mode: 'serial' });

test('mobile profile loads true low payload and keeps touch controls usable', async ({ browser }) => {
  const context = await browser.newContext(mobileDevice);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mirrorPinnedThree(page);
  await page.goto('/?quality=mobile&qa=breaker', { waitUntil: 'domcontentloaded' });
  await waitForMission(page);
  await expect(page.locator('#graphicsButton')).toContainText('MOBILE ULTRA LOW');
  await enterMission(page);
  await expect(page.locator('#touchControls')).toHaveClass(/active/);
  await expect(page.locator('#hud')).toContainText('POWER');
  await page.locator('[data-touch-action="use"]').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 71, isPrimary: true });
  await expect(page.locator('#powerState')).toHaveText('ONLINE');
  await expect(page.locator('#objective')).toContainText('EXIT THE FACILITY');
  await expect(page.locator('#graphicsButton')).toContainText('LOW-PAYLOAD 512 PBR');
  expect(errors).toEqual([]);
  await context.close();
});

test('a weapon action and an actual enemy radio call reach the rendered HUD', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mirrorPinnedThree(page);
  await page.goto('/?quality=mobile&qa=voice', { waitUntil: 'domcontentloaded' });
  await waitForMission(page);
  await enterMission(page);
  await expect(page.locator('#enemySubtitle')).toBeVisible({ timeout: 12_000 });
  await page.keyboard.press('KeyC');
  await expect(page.locator('#message')).toContainText('BOLT CHECK');
  expect(errors).toEqual([]);
});

test('high vegetation streams and presents the real CC0 fir LOD chain', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mirrorPinnedThree(page);
  await page.goto('/?quality=high&qa=forest', { waitUntil: 'domcontentloaded' });
  await waitForMission(page);
  await enterMission(page);
  // The optional close/mid forest asset is intentionally post-readiness. Wait
  // for the actual glTF-derived LODs, not merely the procedural cone fallback.
  await expect.poll(() => localRuntimeDiagnostics(page), { timeout: 180_000 }).toMatchObject({
    quality: 'high', textureTier: 'high', missionAssetsReady: true,
    forest: {
      fir: {
        source: 'Poly Haven Fir Sapling (CC0)', heroLodInstances: 6,
        instancedLod1Active: 6, enabled: true
      }
    },
    perimeterFence: { highTierPanels: 8, enabled: true },
    officeDesks: { highTierDesks: 3, enabled: true },
    scope: { size: 768, frameRate: 30 }
  });
  const diagnostics = await localRuntimeDiagnostics(page, { includeMemory: true });
  expect(diagnostics.camera.z).toBeLessThan(-60);
  expect(diagnostics.forest.trees.hero).toBe(6);
  expect(diagnostics.forest.trees.detail).toBe(6);
  expect(diagnostics.perimeterFence.highTierPanels).toBe(8);
  expect(diagnostics.officeDesks.highTierDesks).toBe(3);
  expect(diagnostics.graphics.memory.totalMB).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('AUTO resolves a renderer-starved mobile session to a safe profile', async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext(mobileDevice);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mirrorPinnedThree(page);
  await page.goto('/?quality=auto&qa=exterior', { waitUntil: 'domcontentloaded' });
  await waitForMission(page);
  await enterMission(page);
  await expect.poll(async () => {
    const diagnostics = await localRuntimeDiagnostics(page);
    return { preference: diagnostics?.graphics?.preference, ...diagnostics?.graphics?.auto };
  }, { timeout: 75_000 }).toMatchObject({ preference: 'auto', active: false, pending: false });
  const diagnostics = await localRuntimeDiagnostics(page);
  expect(diagnostics.graphics.auto.samples).toBeGreaterThanOrEqual(diagnostics.graphics.auto.hitches >= 4 ? 4 : 120);
  expect(['mobile', 'intel']).toContain(diagnostics.quality);
  expect(errors).toEqual([]);
  // Stop the full render loop before closing its manually-created context.
  // Closing the context first can spend the remaining timeout draining a
  // renderer-starved SwiftShader page; leaving it open can starve the next test.
  await page.close({ runBeforeUnload: false });
  await context.close();
});

test('graphics controls apply a fixed internal output and persist in-browser', async ({ page }) => {
  test.setTimeout(360_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mirrorPinnedThree(page);
  // Start from the true mobile payload, then use the player-facing title-menu
  // controls. The title and in-mission buttons open the same graphics panel;
  // staying at the title keeps this settings test independent of AI/combat
  // simulation while still exercising the live renderer and persistence path.
  await page.goto('/?quality=mobile&qa=graphics', { waitUntil: 'domcontentloaded' });
  await waitForMission(page);
  await page.locator('#graphicsButton').click();
  await expect(page.locator('#graphicsPanel')).toHaveClass(/active/);
  const scopeBudgets = { mobile: { size: 256, frameRate: 15 } };
  await expect(page.locator('[data-quality]')).toHaveCount(8);
  // Exercise the honest WebGL compatibility path without asking software
  // Chromium to compile SSR, SSAO, and bloom together. Capture all resulting
  // state in the same browser transaction so renderer work cannot starve a
  // sequence of later automation calls.
  const snapshot = await page.evaluate(() => {
    const value = (id, next) => { document.getElementById(id).value = next; };
    value('graphicsRenderScale', '1');
    value('graphicsResolution', '720');
    value('graphicsTextureTier', 'high');
    value('graphicsShadowQuality', '0');
    value('graphicsVegetationDensity', 'off');
    for (const id of ['graphicsSSAO', 'graphicsSSR', 'graphicsRTR', 'graphicsRTGI', 'graphicsBloom', 'graphicsGrass']) document.getElementById(id).checked = false;
    document.getElementById('graphicsRTShadows').checked = true;
    document.getElementById('graphicsFSR2').checked = true;
    document.getElementById('graphicsAntialias').checked = true;
    document.getElementById('graphicsFog').checked = true;
    document.getElementById('graphicsFog').dispatchEvent(new Event('change', { bubbles: true }));
    return {
      persisted: JSON.parse(localStorage.getItem('specter-custom-graphics') || '{}'),
      measured: globalThis.__specterLocalRuntimeDiagnostics?.({ includeMemory: true }) || null,
      rayStatus: document.getElementById('graphicsRayStatus').textContent
    };
  });
  expect(snapshot.persisted).toMatchObject({
    outputResolution: 720, textureTier: 'high', shadowMapSize: 2048,
    postProcessing: false, forestDensity: 'off', rayTracedReflections: false,
    rayTracedShadows: true, rayTracedGlobalIllumination: false, fsr2: true,
    antialiasing: 'on'
  });
  const measured = snapshot.measured;
  expect(measured).toMatchObject({
    quality: 'mobile', textureTier: 'high', textureStatus: 'HIGH TEXTURES ON RELOAD', scope: scopeBudgets.mobile,
    graphics: {
      preference: 'mobile', mode: 'renderer', postProcessing: false,
      output: { mode: 'fixed-height', requestedHeight: 720, height: 720 },
      ray: { native: false, reflections: false, shadows: true, indirect: false },
      upscaler: { native: false, requested: true, active: false, bypassed: true },
      custom: { pixelRatioCap: 1, outputResolution: 720, textureTier: 'high', shadows: true, shadowMapSize: 2048, postProcessing: false, forestDensity: 'off', ambientOcclusion: false, screenSpaceReflections: false, bloom: false, rayTracedReflections: false, rayTracedShadows: true, rayTracedGlobalIllumination: false, fsr2: true }
    }
  });
  expect(measured.graphics.memory.outputHeight).toBe(720);
  expect(measured.graphics.memory.totalMB).toBeGreaterThan(0);
  expect(snapshot.rayStatus).toContain('NATIVE RT: UNAVAILABLE IN WEBGL');
  expect(snapshot.rayStatus).toContain('SHADOWS: PCF/STANDARD SHADOW MAPS');
  expect(snapshot.rayStatus).toContain('UPSCALE: FIXED RESOLUTION (NOT FSR2)');
  expect(errors).toEqual([]);
});

test('settled deaths and the extraction sequence reach the victory handoff', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mirrorPinnedThree(page);
  await page.goto('/?quality=performance&qa=victory', { waitUntil: 'domcontentloaded' });
  await waitForMission(page);
  await enterMission(page);
  // Game simulation clamps oversized render deltas to retain stable motion.
  // A heavily software-rendered CI browser can therefore need over a minute to
  // advance the four-second cinematic through enough rendered frames.
  await expect(page.locator('#victoryPanel')).toHaveClass(/active/, { timeout: 120_000 });
  await expect(page.locator('#victoryStats')).toContainText('HOSTILES NEUTRALIZED');
  expect(errors).toEqual([]);
});
