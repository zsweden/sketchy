import { expect, test } from '@playwright/test';
import { createNode, getNodeIds } from './helpers';

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

test('bulk-edits background color of two nodes via the multi-select context menu', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 360, 200);

  const ids = await getNodeIds(page);
  expect(ids.length).toBe(2);

  // Select both nodes via the store (deterministic vs viewport-dependent shift-click).
  await page.evaluate(([a, b]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__uiStore.getState().setSelectedNodes([a, b]);
  }, ids);

  // Side panel should display the multi-select header.
  await expect(page.getByText('2 nodes selected')).toBeVisible();

  // Right-click the first node to open the multi-node context menu.
  const firstNode = page.locator(`[data-node-id="${ids[0]}"]`);
  const box = await firstNode.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, {
    button: 'right',
  });

  // The multi context menu shows the selection count.
  await expect(page.locator('.context-menu').getByText('2 nodes selected')).toBeVisible();

  // Click the Blue background swatch (first occurrence is in the Background section).
  await page.locator('.context-menu [title="Blue"]').first().click();

  // Click outside to commit and close the menu.
  await page.mouse.click(10, 10);
  await expect(page.locator('.context-menu')).not.toBeVisible();

  // Both nodes should now have the Blue color in the store.
  const colors = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__diagramStore.getState().diagram.nodes.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n: any) => n.data.color,
    );
  });
  expect(colors).toEqual(['#3B82F6', '#3B82F6']);
});

test('bulk-adds a tag via the side panel multi-select editor', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 360, 200);

  const ids = await getNodeIds(page);
  await page.evaluate(([a, b]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__uiStore.getState().setSelectedNodes([a, b]);
  }, ids);

  await expect(page.getByText('2 nodes selected')).toBeVisible();

  await page.getByRole('button', { name: 'Add Undesirable Effect to all selected' }).click();

  const tags = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__diagramStore.getState().diagram.nodes.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n: any) => n.data.tags,
    );
  });
  expect(tags).toEqual([['ude'], ['ude']]);
});
