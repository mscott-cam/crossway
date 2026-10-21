import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'astro preview --port 4321 --ignore-lock',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      env: {
        RESEND_API_KEY: 'e2e-fake',
        CONTACT_TO_EMAIL: 'e2e@example.com',
      },
    },
    {
      command: 'node dist-announcement/server/entry.mjs',
      url: 'http://localhost:4322',
      reuseExistingServer: !process.env.CI,
      env: {
        HOST: '127.0.0.1',
        PORT: '4322',
        RESEND_API_KEY: 'e2e-fake',
        CONTACT_TO_EMAIL: 'e2e@example.com',
      },
    },
  ],
});
