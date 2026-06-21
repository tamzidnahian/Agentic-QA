import { test, expect } from '@playwright/test';

test('visitor can open the Conduit homepage', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'conduit', exact: true }),
  ).toBeVisible();

  await expect(page.locator('a[href="#/login"]')).toBeVisible();

  await expect(
    page.getByText('Global Feed', { exact: true }),
  ).toBeVisible();
});