import { expect, test } from '@playwright/test';

const PANE = '[data-testid="diagram-flow"] .react-flow__pane';

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

async function dispatchTouchPointer(
  page: import('@playwright/test').Page,
  selector: string,
  type: 'pointerdown' | 'pointerup',
  x: number,
  y: number,
  pointerId: number,
) {
  await page.evaluate(
    ({ selector: targetSelector, type: eventType, x: clientX, y: clientY, pointerId: id }) => {
      const element = document.querySelector(targetSelector);
      if (!element) throw new Error(`Missing element for selector: ${targetSelector}`);

      element.dispatchEvent(new PointerEvent(eventType, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerType: 'touch',
        isPrimary: true,
        pointerId: id,
        clientX,
        clientY,
      }));
    },
    { selector, type, x, y, pointerId },
  );
}

async function tapPane(page: import('@playwright/test').Page, x: number, y: number, pointerId: number) {
  await dispatchTouchPointer(page, PANE, 'pointerdown', x, y, pointerId);
  await dispatchTouchPointer(page, PANE, 'pointerup', x, y, pointerId);
}

test('touch double-tap creates a node and long-press opens the node context menu', async ({ page }) => {
  await tapPane(page, 220, 260, 1);
  await page.waitForTimeout(80);
  await tapPane(page, 220, 260, 1);

  await expect(page.locator('.entity-node')).toHaveCount(1);

  const node = page.locator('[data-node-id]').first();
  const box = await node.boundingBox();
  const x = Math.round(box!.x + box!.width / 2);
  const y = Math.round(box!.y + box!.height / 2);

  await dispatchTouchPointer(page, '[data-node-id]', 'pointerdown', x, y, 2);
  await page.waitForTimeout(650);

  await expect(page.locator('.context-menu')).toBeVisible();

  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();

  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();
});
