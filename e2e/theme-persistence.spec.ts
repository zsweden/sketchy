import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="diagram-flow"]');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');
});

test('theme survives a page reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-popover')).toBeVisible();

  await page.getByLabel('Theme').selectOption('nord');

  // Confirm it took effect before reload.
  const beforeReload = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--accent'),
  );
  expect(beforeReload).toBe('#88C0D0');

  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  const afterReload = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--accent'),
  );
  expect(afterReload).toBe('#88C0D0');

  // Confirm the picker shows the persisted value too.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-popover')).toBeVisible();
  await expect(page.getByLabel('Theme')).toHaveValue('nord');
});

test('switching themes twice keeps the most recent choice across reloads', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Theme').selectOption('rose');
  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Theme')).toHaveValue('rose');
  await page.getByLabel('Theme').selectOption('figma-dark');

  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Theme')).toHaveValue('figma-dark');
});
