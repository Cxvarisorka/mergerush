import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a production-mode build that includes the test hook
 * (`vite build --mode e2e`). Every project runs in Chromium: this environment ships only
 * Chromium, so the iPhone and iPad projects emulate the device (viewport, pixel ratio,
 * touch, user agent) but not the WebKit engine.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
  },
  webServer: {
    command: 'npm run build && npm run build:e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'android-phone', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
    { name: 'small-phone', use: { ...devices['iPhone SE'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
    { name: 'tablet', use: { ...devices['Galaxy Tab S4'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
