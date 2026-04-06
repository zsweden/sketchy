import { expect, test } from '@playwright/test';
import { PANE, createNode, getNodeIds, addEdge } from './helpers';

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

test('applies a tag via right-click context menu and shows badge', async ({ page }) => {
  await createNode(page, 200, 250);
  const node = page.locator('.entity-node').first();

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();
  await expect(node.locator('.badge', { hasText: 'UDE' })).toBeVisible();
});

test('tag chips in NodePanel toggle on and off', async ({ page }) => {
  await createNode(page, 200, 250);
  await page.locator('.entity-node').first().click();

  const udeChip = page.locator('.tag-chip', { hasText: 'Undesirable Effect' });
  await expect(udeChip).toBeVisible();
  await expect(udeChip).toHaveAttribute('data-active', 'false');

  await udeChip.click();
  await expect(udeChip).toHaveAttribute('data-active', 'true');
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  await udeChip.click();
  await expect(udeChip).toHaveAttribute('data-active', 'false');
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toHaveCount(0);
});

test('FRT framework shows Injection and Desirable Effect tags in context menu', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('frt');

  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  await expect(page.locator('.context-menu-item', { hasText: 'Injection' })).toBeVisible();
  await expect(page.locator('.context-menu-item', { hasText: 'Desirable Effect' })).toBeVisible();

  await page.locator('.context-menu-item', { hasText: 'Injection' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'INJ' })).toBeVisible();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.tags?.includes('injection');
  });
});

test('PRT framework exposes Obstacle, Intermediate Objective, and Goal tags', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('prt');

  await createNode(page, 200, 250);
  await page.locator('.entity-node').first().click();

  await expect(page.locator('.tag-chip', { hasText: 'Obstacle' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Intermediate Objective' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Goal' })).toBeVisible();

  await page.locator('.tag-chip', { hasText: 'Goal' }).click();
  await expect(page.locator('.tag-chip', { hasText: 'Goal' })).toHaveAttribute('data-active', 'true');
  await expect(page.locator('.entity-node .badge', { hasText: 'GOAL' })).toBeVisible();
});

test('STT tags appear in both context menu and side panel', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('stt');

  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await expect(page.locator('.context-menu-item', { hasText: 'Objective' })).toBeVisible();
  await expect(page.locator('.context-menu-item', { hasText: 'Strategy' })).toBeVisible();
  await expect(page.locator('.context-menu-item', { hasText: 'Tactic' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.locator('.entity-node').first().click();
  await expect(page.locator('.tag-chip', { hasText: 'Objective' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Strategy' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Tactic' })).toBeVisible();

  await page.locator('.tag-chip', { hasText: 'Strategy' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'STR' })).toBeVisible();
});

test('switching framework clears diagram and shows new framework tags', async ({ page }) => {
  await createNode(page, 200, 250);
  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('frt');
  await expect(page.locator('.entity-node')).toHaveCount(0);
  await expect(page.getByLabel('Framework')).toHaveValue('frt');

  await createNode(page, 200, 250);
  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await page.locator('.entity-node').first().click();

  await expect(page.locator('.tag-chip', { hasText: 'Undesirable Effect' })).toHaveCount(0);
  await expect(page.locator('.tag-chip', { hasText: 'Injection' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Desirable Effect' })).toBeVisible();
});

test('rejects self-loop and shows warning toast', async ({ page }) => {
  await createNode(page, 200, 250);
  const ids = await getNodeIds(page);

  const result = await page.evaluate(
    ([id]) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__sketchy_addEdge(id, id),
    [ids[0]],
  );

  expect(result.success).toBe(false);
  expect(result.reason).toBe('Cannot connect a node to itself');
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});

test('rejects duplicate edge and shows warning toast', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  const ids = await getNodeIds(page);

  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  const result = await page.evaluate(
    ([src, tgt]) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__sketchy_addEdge(src, tgt),
    [ids[0], ids[1]],
  );

  expect(result.success).toBe(false);
  expect(result.reason).toBe('Edge already exists');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});

test('rejects cycle-creating edge in DAG framework', async ({ page }) => {
  await createNode(page, 200, 100);
  await createNode(page, 200, 300);
  await createNode(page, 200, 500);
  const ids = await getNodeIds(page);

  await addEdge(page, ids[0], ids[1]);
  await addEdge(page, ids[1], ids[2]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  const result = await page.evaluate(
    ([src, tgt]) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__sketchy_addEdge(src, tgt),
    [ids[2], ids[0]],
  );

  expect(result.success).toBe(false);
  expect(result.reason).toBe('Cannot connect: would create a cycle');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
});

test('batchApply creates nodes and edges as AI would', async ({ page }) => {
  const result = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__diagramStore;
    const idMap = store.getState().batchApply({
      addNodes: [
        { id: 'ai-1', label: 'AI Cause' },
        { id: 'ai-2', label: 'AI Effect' },
        { id: 'ai-3', label: 'AI Outcome' },
      ],
      addEdges: [
        { source: 'ai-1', target: 'ai-2' },
        { source: 'ai-2', target: 'ai-3' },
      ],
    });
    return {
      mappedIds: Object.fromEntries(idMap),
      nodeCount: store.getState().diagram.nodes.length,
      edgeCount: store.getState().diagram.edges.length,
    };
  });

  expect(result.nodeCount).toBe(3);
  expect(result.edgeCount).toBe(2);
  expect(result.mappedIds['ai-1']).toBeTruthy();
  expect(result.mappedIds['ai-2']).toBeTruthy();
  expect(result.mappedIds['ai-3']).toBeTruthy();

  await expect(page.locator('.entity-node')).toHaveCount(3);
  await expect(page.locator('.entity-node').filter({ hasText: 'AI Cause' })).toBeVisible();
  await expect(page.locator('.entity-node').filter({ hasText: 'AI Effect' })).toBeVisible();
  await expect(page.locator('.entity-node').filter({ hasText: 'AI Outcome' })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.entity-node')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});
