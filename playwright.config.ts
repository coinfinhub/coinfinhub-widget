import { defineConfig, devices } from '@playwright/test';

// Two origins on purpose: the pages come from localhost, the mock API from 127.0.0.1,
// so every request the widgets make is cross-origin, as it is on other people's sites.
// CFH_PAGES_PORT and CFH_API_PORT move both servers, so a demo already running on 4173/4174 can stay.
const pages = process.env.CFH_PAGES_PORT ?? '4173';

export default defineConfig({
  testDir: 'test/browser',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${pages}` },
  webServer: {
    command: 'node test/browser/servers.mjs',
    url: `http://localhost:${pages}/blank.html`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
