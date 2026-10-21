import { test, expect } from '@playwright/test';

test('home page responds with the church title', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(await page.title()).toContain('Crossway Bible Church');
});
