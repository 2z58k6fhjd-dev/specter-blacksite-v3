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
