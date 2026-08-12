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
  const diagnostics = await localRuntimeDiagnostics(page);
  expect(diagnostics.camera.z).toBeLessThan(-60);
  expect(diagnostics.forest.trees.hero).toBe(6);
  expect(diagnostics.forest.trees.detail).toBe(6);
  expect(diagnostics.perimeterFence.highTierPanels).toBe(8);
  expect(diagnostics.officeDesks.highTierDesks).toBe(3);
  expect(errors).toEqual([]);
});

test('AUTO resolves a renderer-starved mobile session to a safe profile', async ({ browser }) => {
  test.setTimeout(180_000);
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
  await context.close();
});

test('graphics controls apply a fixed internal output and persist in-browser', async ({ page }) => {
  test.setTimeout(360_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mirrorPinnedThree(page);
  // Start from the true mobile payload, then change the exact same live menu
  // controls a player uses. This keeps the test operable on software Chromium
  // while proving a high-detail custom draft requests a clean reload.
  await page.goto('/?quality=mobile&qa=exterior', { waitUntil: 'domcontentloaded' });
  await waitForMission(page);
  await enterMission(page);
  await page.locator('#graphicsQuickButton').click();
  await expect(page.locator('#graphicsPanel')).toHaveClass(/active/);
  const scopeBudgets = { mobile: { size: 256, frameRate: 15 }, extreme: { size: 1024, frameRate: 45 } };
  await expect(page.locator('[data-quality]')).toHaveCount(8);
  // Build the complete player-facing draft before sending one real change
  // event. Applying a partial draft after each dropdown would repeatedly
  // rebuild post-processing on software/mobile browsers, which is not how a
  // player uses the settings panel and makes acceptance needlessly fragile.
  await page.evaluate(() => {
    const value = (id, next) => { document.getElementById(id).value = next; };
    value('graphicsRenderScale', '1');
    value('graphicsResolution', '720');
    value('graphicsTextureTier', 'high');
    value('graphicsShadowQuality', '2048');
    value('graphicsVegetationDensity', 'high');
    for (const id of ['graphicsSSAO', 'graphicsSSR', 'graphicsRTR', 'graphicsRTShadows', 'graphicsRTGI', 'graphicsFSR2', 'graphicsBloom', 'graphicsAntialias', 'graphicsGrass', 'graphicsFog']) document.getElementById(id).checked = true;
    document.getElementById('graphicsFog').dispatchEvent(new Event('change', { bubbles: true }));
  });
  const measured = await localRuntimeDiagnostics(page, { includeMemory: true });
  expect(measured).toMatchObject({
    quality: 'mobile', textureTier: 'high', textureStatus: 'HIGH TEXTURES ON RELOAD', scope: scopeBudgets.mobile,
    graphics: {
      preference: 'mobile', output: { mode: 'fixed-height', requestedHeight: 720, height: 720 },
      ray: { native: false, reflections: true, shadows: true, indirect: true },
      upscaler: { native: false, requested: true, bypassed: true },
      custom: { pixelRatioCap: 1, outputResolution: 720, textureTier: 'high', shadowMapSize: 2048, forestDensity: 'high', ambientOcclusion: true, screenSpaceReflections: true, bloom: true, rayTracedReflections: true, rayTracedShadows: true, rayTracedGlobalIllumination: true, fsr2: true }
    }
  });
  expect(measured.graphics.memory.outputHeight).toBe(720);
  expect(measured.graphics.memory.totalMB).toBeGreaterThan(0);
  await expect(page.locator('#graphicsRayStatus')).toContainText('NATIVE RT: UNAVAILABLE IN WEBGL');
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('specter-custom-graphics') || '{}'));
  expect(persisted).toMatchObject({ outputResolution: 720, textureTier: 'high', fsr2: true, rayTracedReflections: true });
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
