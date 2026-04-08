import { expect, test } from '@playwright/test';
import { createNode, getNodeIds, updateNodeText, getNodeCenter } from './helpers';

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

test('auto-layout repositions nodes', async ({ page }) => {
  await createNode(page, 100, 200);
  await createNode(page, 400, 200);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const getPositions = () =>
    page.locator('.react-flow__node').evaluateAll(
      (nodes) => nodes.map((n) => (n as HTMLElement).style.transform),
    );

  const initialPositions = await getPositions();
  await page.getByRole('button', { name: 'Auto-layout' }).click();

  await expect(async () => {
    const newPositions = await getPositions();
    const changed = initialPositions.some((pos, i) => pos !== newPositions[i]);
    expect(changed).toBe(true);
  }).toPass({ timeout: 5000 });
});

test('multi-select nodes and delete all', async ({ page }) => {
  await createNode(page, 100, 100);
  await createNode(page, 400, 100);
  await createNode(page, 250, 350);
  await expect(page.locator('.entity-node')).toHaveCount(3);

  await page.locator('.entity-node').nth(0).click();
  await page.locator('.entity-node').nth(1).click({ modifiers: ['Shift'] });
  await page.locator('.entity-node').nth(2).click({ modifiers: ['Shift'] });

  await expect(page.getByText('3 nodes selected')).toBeVisible();
  await page.getByRole('button', { name: 'Delete All' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(0);
});

test('align buttons are disabled until two nodes are selected', async ({ page }) => {
  const toolbar = page.locator('header');
  const alignH = toolbar.getByLabel('Align horizontally');
  const alignV = toolbar.getByLabel('Align vertically');

  await expect(alignH).toBeDisabled();
  await expect(alignV).toBeDisabled();

  await createNode(page, 150, 200);
  await createNode(page, 350, 200);

  const ids = await getNodeIds(page);
  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nodeIds) => (window as any).__uiStore.getState().setSelectedNodes(nodeIds),
    ids,
  );

  await expect(alignH).toBeEnabled();
  await expect(alignV).toBeEnabled();
});

test('aligns selected nodes horizontally by rendered center', async ({ page }) => {
  await createNode(page, 150, 140);
  await createNode(page, 420, 320);

  const ids = await getNodeIds(page);
  await updateNodeText(page, ids[0], 'Short');
  await updateNodeText(
    page,
    ids[1],
    'This is a much longer node label that wraps across multiple lines and increases the node height.',
  );
  await expect(page.locator(`[data-node-id="${ids[1]}"]`)).toContainText('This is a much longer');

  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nodeIds) => (window as any).__uiStore.getState().setSelectedNodes(nodeIds),
    ids,
  );
  await page.locator('header').getByLabel('Align horizontally').click();

  await expect(async () => {
    const firstCenter = await getNodeCenter(page, ids[0]);
    const secondCenter = await getNodeCenter(page, ids[1]);
    expect(Math.abs(firstCenter.y - secondCenter.y)).toBeLessThan(1);
  }).toPass({ timeout: 5000 });
});

test('aligns selected nodes vertically by rendered center', async ({ page }) => {
  await createNode(page, 120, 140);
  await createNode(page, 360, 180);

  const ids = await getNodeIds(page);
  await updateNodeText(page, ids[0], 'Short');
  await updateNodeText(
    page,
    ids[1],
    'This is another long label that wraps so the node size differs before alignment.',
  );
  await expect(page.locator(`[data-node-id="${ids[1]}"]`)).toContainText('This is another long');

  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nodeIds) => (window as any).__uiStore.getState().setSelectedNodes(nodeIds),
    ids,
  );
  await page.locator('header').getByLabel('Align vertically').click();

  await expect(async () => {
    const firstCenter = await getNodeCenter(page, ids[0]);
    const secondCenter = await getNodeCenter(page, ids[1]);
    expect(Math.abs(firstCenter.x - secondCenter.x)).toBeLessThan(1);
  }).toPass({ timeout: 5000 });
});

test('distribute buttons require three selected nodes and reposition them', async ({ page }) => {
  await createNode(page, 100, 100);
  await createNode(page, 250, 300);
  await createNode(page, 400, 150);

  const toolbar = page.locator('header');
  const distH = toolbar.getByLabel('Distribute horizontally');
  const distV = toolbar.getByLabel('Distribute vertically');

  await expect(distH).toBeDisabled();
  await expect(distV).toBeDisabled();

  const ids = await getNodeIds(page);
  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nodeIds) => (window as any).__uiStore.getState().setSelectedNodes(nodeIds),
    ids,
  );

  await expect(distH).toBeEnabled();
  await expect(distV).toBeEnabled();

  const getPositions = () =>
    page.locator('.react-flow__node').evaluateAll(
      (nodes) => nodes.map((n) => (n as HTMLElement).style.transform),
    );

  const before = await getPositions();
  await distV.click();

  await expect(async () => {
    const after = await getPositions();
    const changed = before.some((pos, i) => pos !== after[i]);
    expect(changed).toBe(true);
  }).toPass({ timeout: 5000 });
});
