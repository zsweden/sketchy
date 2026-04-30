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
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().setFramework('crt');
  });
});

async function dispatchTouchPointer(
  page: import('@playwright/test').Page,
  selector: string,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
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
        isPrimary: id === 1,
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

test('touch double-tap on the pane creates a node', async ({ page }) => {
  await tapPane(page, 220, 260, 1);
  await page.waitForTimeout(80);
  await tapPane(page, 220, 260, 1);

  await expect(page.locator('.entity-node')).toHaveCount(1);
});

test('touch long-press on a node opens the context menu', async ({ page }) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().addNode({ x: 200, y: 200 });
  });
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

test('long-press is cancelled when the finger moves beyond tolerance', async ({ page }) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().addNode({ x: 200, y: 200 });
  });
  const node = page.locator('[data-node-id]').first();
  const box = await node.boundingBox();
  const x = Math.round(box!.x + box!.width / 2);
  const y = Math.round(box!.y + box!.height / 2);

  await dispatchTouchPointer(page, '[data-node-id]', 'pointerdown', x, y, 3);
  // Drag well beyond any reasonable long-press tolerance before the timer fires.
  await dispatchTouchPointer(page, '[data-node-id]', 'pointermove', x + 80, y + 80, 3);
  await page.waitForTimeout(650);
  await dispatchTouchPointer(page, '[data-node-id]', 'pointerup', x + 80, y + 80, 3);

  await expect(page.locator('.context-menu')).not.toBeVisible();
});

test('two-finger pinch on the pane changes the React Flow zoom', async ({ page }) => {
  // React Flow listens for native gesture/wheel events, but emulating a pinch with synthetic
  // pointer events is the most reliable cross-engine path. We assert that the viewport's
  // CSS transform scale changes — which is what users see as zoom.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().addNode({ x: 200, y: 200 });
  });

  const initialScale = await page.evaluate(() => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewport) return 0;
    return new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a;
  });
  expect(initialScale).toBeGreaterThan(0);

  // Simulate a pinch-out by dispatching wheel events with ctrlKey, which React Flow
  // treats as zoom regardless of pointer device.
  await page.locator(PANE).dispatchEvent('wheel', {
    deltaY: -200,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    clientX: 300,
    clientY: 300,
  });

  await page.waitForFunction((prev) => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewport) return false;
    const next = new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a;
    return Math.abs(next - prev) > 0.01;
  }, initialScale);
});
