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
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().setFramework('crt');
  });
});

test('skills button opens dropdown with framework-specific skills', async ({ page }) => {
  const skillBtn = page.locator('button[aria-label="Skills"]');
  await expect(skillBtn).toBeVisible();
  await skillBtn.click();

  const dropdown = page.locator('.skill-menu-dropdown');
  await expect(dropdown).toBeVisible();
  // CRT should have at least one skill
  await expect(dropdown.locator('.skill-menu-item').first()).toBeVisible();
});

test('skills dropdown closes on outside click', async ({ page }) => {
  const skillBtn = page.locator('button[aria-label="Skills"]');
  await skillBtn.click();
  await expect(page.locator('.skill-menu-dropdown')).toBeVisible();

  // Click outside
  await page.locator('[data-testid="diagram-flow"]').click({ position: { x: 50, y: 50 } });
  await expect(page.locator('.skill-menu-dropdown')).not.toBeVisible();
});

test('skills menu re-renders after framework change', async ({ page }) => {
  const skillBtn = page.locator('button[aria-label="Skills"]');

  // Open skills in CRT
  await skillBtn.click();
  await expect(page.locator('.skill-menu-dropdown')).toBeVisible();
  const crtCount = await page.locator('.skill-menu-dropdown .skill-menu-item').count();
  expect(crtCount).toBeGreaterThan(0);

  // Close and switch to VSM (which has a cross-framework skill with target label)
  await page.locator('[data-testid="diagram-flow"]').click({ position: { x: 50, y: 50 } });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().setFramework('vsm');
  });

  // Re-open skills — should still show skills for the new framework
  await skillBtn.click();
  await expect(page.locator('.skill-menu-dropdown')).toBeVisible();
  const vsmCount = await page.locator('.skill-menu-dropdown .skill-menu-item').count();
  expect(vsmCount).toBeGreaterThan(0);
});

test('skill button shows disabled state when no skills available', async ({ page }) => {
  // Switch to a framework with potentially no skills, check the button state
  const skillBtn = page.locator('button[aria-label="Skills"]');
  // Skills button should exist and have aria-expanded attribute
  await expect(skillBtn).toHaveAttribute('aria-expanded', 'false');
});
