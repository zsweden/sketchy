import { expect, test } from '@playwright/test';

test('app boots without uncaught console errors and renders the toolbar', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: Error[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error);
  });

  await page.goto('/');

  await expect(page.locator('[data-testid="diagram-flow"]')).toBeVisible();
  await expect(page.locator('.app-header')).toBeVisible();
  await expect(page.locator('.app-title')).toContainText('Sketchy');

  // Filter out known-benign messages that aren't bundle/runtime regressions:
  // ResizeObserver noise and Vite's HMR favicon warnings during dev.
  const fatalConsoleErrors = consoleErrors.filter(
    (text) => !text.includes('ResizeObserver') && !text.includes('favicon'),
  );

  expect(pageErrors, `pageerror: ${pageErrors.map((e) => e.message).join('\n')}`).toEqual([]);
  expect(fatalConsoleErrors, `console errors: ${fatalConsoleErrors.join('\n')}`).toEqual([]);
});
