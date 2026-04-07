import { expect, test } from '@playwright/test';
import { createNode, updateNodeText, getNodeIds } from './helpers';

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

test('search bar accepts input and filters nodes', async ({ page }) => {
  // Create nodes with distinct labels
  await createNode(page, 100, 100);
  await createNode(page, 100, 300);
  const nodeIds = await getNodeIds(page);
  await updateNodeText(page, nodeIds[0], 'Revenue Growth');
  await updateNodeText(page, nodeIds[1], 'Cost Reduction');

  const searchInput = page.locator('[data-testid="search-bar"] input');
  await searchInput.fill('Revenue');

  // The matching node should be highlighted, non-matching dimmed
  await expect(page.locator('.entity-node.highlighted')).toHaveCount(1);
  await expect(page.locator('.entity-node.dimmed')).toHaveCount(1);
});

test('clearing search resets all nodes to normal', async ({ page }) => {
  await createNode(page, 100, 100);
  const nodeIds = await getNodeIds(page);
  await updateNodeText(page, nodeIds[0], 'Test Node');

  const searchInput = page.locator('[data-testid="search-bar"] input');
  await searchInput.fill('Test');
  await expect(page.locator('.entity-node.highlighted')).toHaveCount(1);

  // Clear via the X button
  const clearBtn = page.locator('[data-testid="search-bar"] button[aria-label="Clear search"]');
  await clearBtn.click();

  await expect(searchInput).toHaveValue('');
  await expect(page.locator('.entity-node.highlighted')).toHaveCount(0);
  await expect(page.locator('.entity-node.dimmed')).toHaveCount(0);
});

test('Escape key clears search', async ({ page }) => {
  await createNode(page, 100, 100);
  const nodeIds = await getNodeIds(page);
  await updateNodeText(page, nodeIds[0], 'Demand');

  const searchInput = page.locator('[data-testid="search-bar"] input');
  await searchInput.fill('Demand');
  await expect(page.locator('.entity-node.highlighted')).toHaveCount(1);

  await searchInput.press('Escape');
  await expect(searchInput).toHaveValue('');
  await expect(page.locator('.entity-node.highlighted')).toHaveCount(0);
});

test('search is case-insensitive', async ({ page }) => {
  await createNode(page, 100, 100);
  const nodeIds = await getNodeIds(page);
  await updateNodeText(page, nodeIds[0], 'Revenue Growth');

  const searchInput = page.locator('[data-testid="search-bar"] input');
  await searchInput.fill('revenue');
  await expect(page.locator('.entity-node.highlighted')).toHaveCount(1);
});

test('search with no matches dims all nodes', async ({ page }) => {
  await createNode(page, 100, 100);
  await createNode(page, 100, 300);

  const searchInput = page.locator('[data-testid="search-bar"] input');
  await searchInput.fill('zzz-nonexistent');
  await expect(page.locator('.entity-node.dimmed')).toHaveCount(2);
  await expect(page.locator('.entity-node.highlighted')).toHaveCount(0);
});
