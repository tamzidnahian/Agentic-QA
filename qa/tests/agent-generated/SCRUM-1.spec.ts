import { test, expect } from '@playwright/test';

test('Test the visibility of elements on the Conduit homepage as a visitor', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');

    const conduitBrand = page.getByRole('navigation').getByRole('link', { name: 'conduit' });
    const signInLink = page.locator('a[href="#/login"]');
    const globalFeedTab = page.getByRole('button', { name: 'Global Feed' });

    await expect(conduitBrand).toBeVisible();
    await expect(signInLink).toBeVisible();
    await expect(globalFeedTab).toBeVisible();
});
