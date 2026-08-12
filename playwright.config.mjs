import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // The browser loads full glTF geometry even when the Mobile preset selects
  // 512px texture derivatives. Leave room for a cold CI cache without hiding
  // a permanently stalled asset request.
  timeout: 240_000,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.SPECTER_ACCEPTANCE_URL || 'http://127.0.0.1:4175',
    trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure'
  },
  webServer: process.env.SPECTER_ACCEPTANCE_URL ? undefined : {
    command: 'node scripts/browser-acceptance-server.mjs',
    url: 'http://127.0.0.1:4175/',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
