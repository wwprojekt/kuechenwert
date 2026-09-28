import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-Tests für KüchenWert (tests/e2e).
 *
 * Gegen eine laufende Umgebung (Preview-Build, Staging, Production):
 *   PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test
 * Ohne PLAYWRIGHT_BASE_URL startet Playwright den Vite-Dev-Server (`npm run dev`, Port 8080).
 */
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const devServerURL = 'http://localhost:8080';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalBaseURL ?? devServerURL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run dev',
        url: devServerURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
});
