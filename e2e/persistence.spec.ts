import { expect, test } from '@playwright/test';
import { PANE, createNode, getNodeIds, addEdge, updateNodeText } from './helpers';

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

test('undo restores a deleted node and redo removes it again', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const firstNode = page.locator('.entity-node').first();
  await firstNode.click();
  await page.getByLabel('Node text').fill('Keep me');
  await page.getByLabel('Node text').blur();

  await page.locator('.entity-node').nth(1).click();
  await page.keyboard.press('Backspace');
  await expect(page.locator('.entity-node')).toHaveCount(1);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(2);

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(1);
  await expect(page.locator('.entity-node').first()).toContainText('Keep me');
});

test('saves diagram to sessionStorage, clears, and restores via file load', async ({ page }) => {
  await createNode(page, 200, 250);
  const node = page.locator('.entity-node').first();
  await node.click();
  await page.getByLabel('Node text').fill('Saved node');
  await page.getByLabel('Node text').blur();
  await expect(node).toContainText('Saved node');

  const diagramJson = await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.nodes?.[0]?.data?.label === 'Saved node') return raw;
    return null;
  });
  const json = await diagramJson.jsonValue();
  expect(json).toBeTruthy();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(0);

  const fileInput = page.locator('input[type="file"][accept=".json"]');
  const buffer = Buffer.from(json as string, 'utf-8');
  await fileInput.setInputFiles({
    name: 'test-diagram.json',
    mimeType: 'application/json',
    buffer,
  });

  await expect(page.locator('.entity-node').first()).toContainText('Saved node');
});

test('save → new → load round-trip preserves nodes, edges, and tags', async ({ page }) => {
  await createNode(page, 100, 200);
  await createNode(page, 300, 200);
  const ids = await getNodeIds(page);
  await updateNodeText(page, ids[0], 'Cause A');
  await updateNodeText(page, ids[1], 'Effect B');
  await addEdge(page, ids[0], ids[1]);

  await page.locator(`[data-node-id="${ids[1]}"]`).click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  const skyJson = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__diagramStore;
    const diagram = store.getState().diagram;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { diagramToSkyJson } = (window as any).__skyIoHelpers ?? {};
    if (diagramToSkyJson) return JSON.stringify(diagramToSkyJson(diagram), null, 2);
    return JSON.stringify(diagram);
  });

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(0);

  const fileInput = page.locator('input[type="file"][accept=".json"]');
  await fileInput.setInputFiles({
    name: 'round-trip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(skyJson, 'utf-8'),
  });

  await expect(page.locator('.entity-node')).toHaveCount(2);
  await expect(page.locator('.entity-node').filter({ hasText: 'Cause A' })).toBeVisible();
  await expect(page.locator('.entity-node').filter({ hasText: 'Effect B' })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();
});

test('Ctrl+Z undoes and Ctrl+Shift+Z redoes a node creation', async ({ page }) => {
  await createNode(page, 200, 200);
  await expect(page.locator('.entity-node')).toHaveCount(1);

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });

  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.entity-node')).toHaveCount(0);

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.locator('.entity-node')).toHaveCount(1);
});

test('Escape clears node selection', async ({ page }) => {
  await createNode(page, 200, 200);
  const node = page.locator('.entity-node').first();
  await node.click();

  await expect(page.getByLabel('Node text')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByLabel('Node text')).not.toBeVisible();
});

test('V key switches to select mode and H key switches to pan mode', async ({ page }) => {
  const selectBtn = page.getByLabel('Select tool');
  const panBtn = page.getByLabel('Pan tool');

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });

  await page.keyboard.press('h');
  await expect(panBtn).toHaveClass(/btn-toggle-active/);
  await expect(selectBtn).not.toHaveClass(/btn-toggle-active/);

  await page.keyboard.press('v');
  await expect(selectBtn).toHaveClass(/btn-toggle-active/);
  await expect(panBtn).not.toHaveClass(/btn-toggle-active/);
});

test('Save button serializes diagram and Load restores it via file input', async ({ page }) => {
  await createNode(page, 100, 200);
  await createNode(page, 300, 200);
  const ids = await getNodeIds(page);
  await updateNodeText(page, ids[0], 'Alpha');
  await updateNodeText(page, ids[1], 'Beta');
  await addEdge(page, ids[0], ids[1]);

  await page.locator(`[data-node-id="${ids[1]}"]`).click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  const savedJson = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__diagramStore;
    const diagram = store.getState().diagram;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { diagramToSkyJson } = (window as any).__skyIoHelpers ?? {};
    if (diagramToSkyJson) return JSON.stringify(diagramToSkyJson(diagram), null, 2);
    return JSON.stringify(diagram);
  });

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);

  const fileInput = page.locator('input[type="file"][accept=".json"]');
  await fileInput.setInputFiles({
    name: 'save-load-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(savedJson, 'utf-8'),
  });

  await expect(page.locator('.entity-node')).toHaveCount(2);
  await expect(page.locator('.entity-node').filter({ hasText: 'Alpha' })).toBeVisible();
  await expect(page.locator('.entity-node').filter({ hasText: 'Beta' })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  const fw = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().diagram.frameworkId,
  );
  expect(fw).toBe('crt');
});

test('undo/redo across node create, edge add, tag change, and delete', async ({ page }) => {
  await createNode(page, 200, 200);
  await expect(page.locator('.entity-node')).toHaveCount(1);
  const idsAfterFirst = await getNodeIds(page);
  await updateNodeText(page, idsAfterFirst[0], 'Node A');

  await createNode(page, 400, 200);
  await expect(page.locator('.entity-node')).toHaveCount(2);
  const idsAfterSecond = await getNodeIds(page);
  const nodeBId = idsAfterSecond.find((id) => id !== idsAfterFirst[0])!;
  await updateNodeText(page, nodeBId, 'Node B');

  await addEdge(page, idsAfterFirst[0], nodeBId);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await page.locator(`[data-node-id="${idsAfterFirst[0]}"]`).click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  await page.locator(`[data-node-id="${nodeBId}"]`).click();
  await page.keyboard.press('Backspace');
  await expect(page.locator('.entity-node')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });

  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.entity-node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toHaveCount(0);

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.locator('.entity-node')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});
