import { expect, test } from '@playwright/test';
import { PANE, createNode, getNodeIds, addEdge, updateNodeText, rightClickEdge } from './helpers';

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

test('connects two nodes and changes edge confidence via context menu', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 350);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await rightClickEdge(page, 'Medium');
  await page.locator('.context-menu-item', { hasText: 'Medium' }).click();
  await expect(page.locator('.edge-confidence-medium')).toHaveCount(1);
});

test('CLD framework supports edge polarity and delay via context menu', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('cld');

  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await rightClickEdge(page, 'Negative');
  await page.locator('.context-menu-item', { hasText: 'Negative' }).click();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).edges?.[0]?.polarity === 'negative';
  });

  await rightClickEdge(page, 'Add Delay');
  await page.locator('.context-menu-item', { hasText: 'Add Delay' }).click();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).edges?.[0]?.delay === true;
  });
});

test('CLD feedback loops appear in the diagram panel and can be toggled', async ({ page }) => {
  await page.getByLabel('Framework').selectOption('cld');

  await createNode(page, 140, 180);
  await createNode(page, 320, 180);
  await createNode(page, 230, 340);

  const ids = await getNodeIds(page);
  await updateNodeText(page, ids[0], 'Demand');
  await updateNodeText(page, ids[1], 'Capacity');
  await updateNodeText(page, ids[2], 'Growth');

  await addEdge(page, ids[0], ids[1]);
  await addEdge(page, ids[1], ids[2]);
  await addEdge(page, ids[2], ids[0]);

  await expect(page.getByText('Feedback Loops')).toBeVisible();
  await expect(page.getByText('1 Total')).toBeVisible();
  await expect(page.getByText('1 Reinforcing')).toBeVisible();

  const loopButton = page.getByRole('button', { name: /R1/ });
  await expect(loopButton).toHaveAttribute('aria-pressed', 'false');
  await expect(loopButton).toContainText('Demand');
  await expect(loopButton).toContainText('Capacity');
  await expect(loopButton).toContainText('Growth');

  await loopButton.click();

  await expect(loopButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.entity-node.loop-focused')).toHaveCount(3);

  await loopButton.click();

  await expect(loopButton).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.entity-node.loop-focused')).toHaveCount(0);
});

test('edge panel shows confidence and notes when an edge is clicked', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });

  // Click the edge — retry because edge SVG may not have settled
  const edgePath = page.locator('.react-flow__edge-interaction').first();
  for (let attempt = 0; attempt < 3; attempt++) {
    const box = await edgePath.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    if (await page.locator('.side-panel-top .section-heading', { hasText: 'Edge' }).isVisible()) break;
  }

  await expect(page.locator('.side-panel-top .section-heading', { hasText: 'Edge' })).toBeVisible();
  await expect(page.getByLabel('Edge notes')).toBeVisible();

  await page.getByLabel('Edge notes').fill('Strong causal link');
  await page.getByLabel('Edge notes').blur();

  await page.getByRole('button', { name: 'Low', exact: true }).click();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    const edge = JSON.parse(raw).edges?.[0];
    return edge?.notes === 'Strong causal link' && edge?.confidence === 'low';
  });
});

test('deletes an edge via right-click context menu', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await rightClickEdge(page, 'Delete connection');
  await page.locator('.context-menu-item', { hasText: 'Delete connection' }).click();

  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(page.locator('.entity-node')).toHaveCount(2);
});

test('reconnecting an edge updates its target in the store', async ({ page }) => {
  await createNode(page, 200, 100);
  await createNode(page, 200, 300);
  await createNode(page, 400, 300);
  const ids = await getNodeIds(page);

  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  const initialTarget = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__diagramStore.getState().diagram.edges[0].target;
  });
  expect(initialTarget).toBe(ids[1]);

  await page.evaluate(
    ([sourceId, , newTargetId]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__diagramStore;
      const edgeId = store.getState().diagram.edges[0].id;
      store.getState().deleteEdges([edgeId]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__sketchy_addEdge(sourceId, newTargetId);
    },
    [ids[0], ids[1], ids[2]],
  );

  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  const newTarget = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__diagramStore.getState().diagram.edges[0].target;
  });
  expect(newTarget).toBe(ids[2]);
});

test('CLD framework allows cycle-creating edge that DAG frameworks reject', async ({ page }) => {
  page.once('dialog', (d) => d.accept());
  await page.getByLabel('Framework').selectOption('cld');

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

  expect(result.success).toBe(true);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);

  const edges = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__diagramStore.getState().diagram.edges.map(
      (e: { source: string; target: string }) => ({ source: e.source, target: e.target }),
    );
  });
  const cycleEdge = edges.find(
    (e: { source: string; target: string }) => e.source === ids[2] && e.target === ids[0],
  );
  expect(cycleEdge).toBeDefined();
});
