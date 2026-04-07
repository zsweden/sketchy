import { expect } from '@playwright/test';

export const PANE = '[data-testid="diagram-flow"] .react-flow__pane';

export async function createNode(page: import('@playwright/test').Page, x: number, y: number) {
  const countBefore = await page.locator('.entity-node').count();
  await page.evaluate(
    ([nodeX, nodeY]) => {
      // Use store-level creation for deterministic flow-space coordinates.
      // Pane double-click coordinates become viewport-dependent once fitView zooms.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__diagramStore.getState().addNode({ x: nodeX, y: nodeY });
    },
    [x, y],
  );
  await expect(page.locator('.entity-node')).toHaveCount(countBefore + 1);
}

export async function getNodeIds(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator('[data-node-id]').evaluateAll(
    (els) => els.map((el) => el.getAttribute('data-node-id')!),
  );
}

export async function addEdge(page: import('@playwright/test').Page, sourceId: string, targetId: string) {
  await page.evaluate(
    ([src, tgt]) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__sketchy_addEdge(src, tgt),
    [sourceId, targetId],
  );
}

export async function updateNodeText(page: import('@playwright/test').Page, nodeId: string, label: string) {
  await page.evaluate(
    ([id, text]) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().updateNodeText(id, text),
    [nodeId, label],
  );
}

export async function getNodeCenter(page: import('@playwright/test').Page, nodeId: string) {
  const box = await page.locator(`[data-node-id="${nodeId}"]`).boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
}

/**
 * Right-click an edge and wait for a specific context menu item to appear.
 * Retries up to 5 times because React Flow edge SVGs may not have settled
 * when the bounding box is first captured — the click can land on the pane.
 */
export async function rightClickEdge(
  page: import('@playwright/test').Page,
  menuItemText: string,
) {
  const edgePath = page.locator('.react-flow__edge-interaction').first();
  const menuItem = page.locator('.context-menu-item', { hasText: menuItemText });
  const contextMenu = page.locator('.context-menu');

  // Wait for the edge interaction element to have a stable bounding box
  await edgePath.waitFor({ state: 'attached' });

  for (let attempt = 0; attempt < 5; attempt++) {
    const box = await edgePath.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, { button: 'right' });

    // Soft check: the click may miss the edge entirely (no context menu).
    const menuVisible = await contextMenu.isVisible().catch(() => false);
    if (!menuVisible) {
      // Wait briefly for React Flow to settle before retrying
      await page.waitForTimeout(200);
      continue;
    }

    if (await menuItem.isVisible()) return;
    await page.keyboard.press('Escape');
    await expect(contextMenu).not.toBeVisible();
  }
  // Final attempt — let Playwright's expect fail with a clear message
  await expect(menuItem).toBeVisible();
}
