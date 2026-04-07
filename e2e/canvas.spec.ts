import { expect, test } from '@playwright/test';
import { PANE, createNode, getNodeIds, addEdge, getNodeCenter } from './helpers';

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

test('creates a node, edits it from the inspector, and restores it after reload', async ({ page }) => {
  await createNode(page, 240, 250);

  const node = page.locator('.entity-node').first();
  await expect(node).toHaveCount(1);

  await node.click();
  await page.getByLabel('Node text').fill('Root cause');
  await page.getByLabel('Node text').blur();

  await expect(node).toContainText('Root cause');
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.nodes?.[0]?.data?.label === 'Root cause';
  });

  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');
  await expect(page.locator('.entity-node').first()).toContainText('Root cause');
});

test('supports local chat fallback and framework switching in the browser', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      'sketchy-settings',
      JSON.stringify({ apiKey: '', baseUrl: '', model: '', provider: 'custom' }),
    );
  });
  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  await createNode(page, 180, 200);

  await page.getByLabel('Chat input').fill('What should I fix first?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(
    page.getByText('Please configure your API endpoint and model in settings (cog icon in the toolbar).'),
  ).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('frt');

  await expect(page.locator('.entity-node')).toHaveCount(0);
  await expect(page.getByLabel('Framework')).toHaveValue('frt');
});

test('retains chat messages after browser refresh', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      'sketchy-settings',
      JSON.stringify({ apiKey: '', baseUrl: '', model: '', provider: 'custom' }),
    );
  });
  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  await page.getByLabel('Chat input').fill('Persist this chat');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Persist this chat')).toBeVisible();
  await expect(
    page.getByText('Please configure your API endpoint and model in settings (cog icon in the toolbar).'),
  ).toBeVisible();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_chat');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.messages?.length === 2;
  });

  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  await expect(page.getByText('Persist this chat')).toBeVisible();
  await expect(
    page.getByText('Please configure your API endpoint and model in settings (cog icon in the toolbar).'),
  ).toBeVisible();
});

test('shows a recovery toast and backs up corrupted session data after reload', async ({ page }) => {
  const corrupted = '{not valid json!!!';

  await page.evaluate((raw) => {
    sessionStorage.setItem('sketchy_diagram', raw);
  }, corrupted);

  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  await expect(page.locator('.entity-node')).toHaveCount(0);
  await expect(page.getByLabel('Diagram name')).toBeVisible();

  const backup = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((entry) => entry.startsWith('sketchy_backup_'));
    return key ? { key, value: localStorage.getItem(key) } : null;
  });

  expect(backup).toBeTruthy();
  expect(backup?.value).toBe(corrupted);
});

test('clicking a node highlights connected edges and dims unconnected nodes', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await createNode(page, 450, 300);
  await expect(page.locator('.entity-node')).toHaveCount(3);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await page.locator('.entity-node').nth(0).click();
  await expect(page.locator('.edge-highlighted')).toHaveCount(1);
  await expect(page.locator('.entity-node.dimmed')).toHaveCount(1);

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await expect(page.locator('.edge-highlighted')).toHaveCount(0);
  await expect(page.locator('.entity-node.dimmed')).toHaveCount(0);
});

test('snap-to-grid setting persists to diagram settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-popover')).toBeVisible();

  const initialSnap = await page.evaluate(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return null;
    return JSON.parse(raw).settings?.snapToGrid;
  });
  expect(initialSnap).toBeFalsy();

  await page.getByLabel('Toggle snap to grid').click();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).settings?.snapToGrid === true;
  });
});

test('locked node shows lock indicator and survives auto-layout', async ({ page }) => {
  await createNode(page, 200, 250);
  const node = page.locator('.entity-node').first();
  await expect(node).toHaveCount(1);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Unlocked' }).click();

  await expect(page.locator('.node-lock-indicator')).toHaveCount(1);

  const lockedPos = await page.locator('.react-flow__node').first().evaluate(
    (el) => (el as HTMLElement).style.transform,
  );

  await createNode(page, 400, 400);
  await page.getByRole('button', { name: 'Auto-layout' }).click();
  await page.waitForTimeout(500);

  const afterPos = await page.locator('.react-flow__node').first().evaluate(
    (el) => (el as HTMLElement).style.transform,
  );
  expect(afterPos).toBe(lockedPos);
});

test('select and pan tool toggle active state in toolbar', async ({ page }) => {
  const selectBtn = page.getByLabel('Select tool');
  const panBtn = page.getByLabel('Pan tool');

  await expect(selectBtn).toHaveClass(/btn-toggle-active/);
  await expect(panBtn).not.toHaveClass(/btn-toggle-active/);

  await panBtn.click();
  await expect(panBtn).toHaveClass(/btn-toggle-active/);
  await expect(selectBtn).not.toHaveClass(/btn-toggle-active/);

  await selectBtn.click();
  await expect(selectBtn).toHaveClass(/btn-toggle-active/);
  await expect(panBtn).not.toHaveClass(/btn-toggle-active/);
});

test('edits node notes in the side panel and persists to store', async ({ page }) => {
  await createNode(page, 200, 250);
  await page.locator('.entity-node').first().click();

  await page.getByLabel('Node notes').fill('This is the root cause');
  await page.getByLabel('Node notes').blur();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.notes === 'This is the root cause';
  });
});

test('junction type toggle appears when node has two incoming edges', async ({ page }) => {
  await createNode(page, 150, 100);
  await createNode(page, 350, 100);
  await createNode(page, 250, 300);
  await expect(page.locator('.entity-node')).toHaveCount(3);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[2]);

  await page.locator('.entity-node').nth(2).click();
  await expect(page.getByText('Junction Logic')).not.toBeVisible();

  await addEdge(page, ids[1], ids[2]);

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await page.locator('.entity-node').nth(2).click();
  await expect(page.getByText('Junction Logic')).toBeVisible();

  await page.getByRole('button', { name: 'AND', exact: true }).click();
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[2]?.data?.junctionType === 'and';
  });
  await expect(page.getByText('All incoming causes required')).toBeVisible();

  await page.getByRole('button', { name: 'OR', exact: true }).click();
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[2]?.data?.junctionType === 'or';
  });
  await expect(page.getByText('Any single cause is sufficient')).toBeVisible();
});

test('root cause and intermediate badges appear based on graph topology', async ({ page }) => {
  await createNode(page, 200, 100);
  await createNode(page, 200, 300);
  await createNode(page, 200, 500);
  await expect(page.locator('.entity-node')).toHaveCount(3);

  const ids = await getNodeIds(page);

  await expect(page.locator('.badge', { hasText: 'Roo' })).toHaveCount(3);
  await expect(page.locator('.badge', { hasText: 'Int' })).toHaveCount(0);

  await addEdge(page, ids[0], ids[1]);
  await addEdge(page, ids[1], ids[2]);

  await expect(page.locator('.badge', { hasText: 'Roo' })).toHaveCount(1);
  await expect(page.locator('.badge', { hasText: 'Int' })).toHaveCount(1);

  const firstNode = page.locator(`[data-node-id="${ids[0]}"]`);
  await expect(firstNode.locator('.badge', { hasText: 'Roo' })).toBeVisible();

  const middleNode = page.locator(`[data-node-id="${ids[1]}"]`);
  await expect(middleNode.locator('.badge', { hasText: 'Int' })).toBeVisible();
});

test('double-click a node to edit label inline', async ({ page }) => {
  await createNode(page, 200, 250);
  const ids = await getNodeIds(page);
  const node = page.locator(`[data-testid="entity-node-${ids[0]}"]`);

  const center = await getNodeCenter(page, ids[0]);
  await page.mouse.click(center.x, center.y);
  await page.mouse.click(center.x, center.y, { clickCount: 2 });

  const textarea = page.locator('.entity-node-textarea');
  await expect(textarea).toBeVisible();

  await textarea.fill('Inline edited');
  await textarea.press('Enter');

  await expect(node).toContainText('Inline edited');

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.label === 'Inline edited';
  });
});

test('dragging multiple selected nodes moves them together', async ({ page }) => {
  await createNode(page, 100, 200);
  await createNode(page, 300, 200);
  const ids = await getNodeIds(page);

  const initialPositions = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = (window as any).__diagramStore.getState().diagram.nodes;
    return nodes.map((n: { id: string; position: { x: number; y: number } }) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));
  });

  await page.evaluate(
    ([id0, id1]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__diagramStore;
      store.getState().dragNodes([
        { id: id0, position: { x: store.getState().diagram.nodes[0].position.x + 50, y: store.getState().diagram.nodes[0].position.y + 50 } },
        { id: id1, position: { x: store.getState().diagram.nodes[1].position.x + 50, y: store.getState().diagram.nodes[1].position.y + 50 } },
      ]);
      store.getState().commitDraggedNodes();
    },
    [ids[0], ids[1]],
  );

  const finalPositions = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = (window as any).__diagramStore.getState().diagram.nodes;
    return nodes.map((n: { id: string; position: { x: number; y: number } }) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));
  });

  for (let i = 0; i < 2; i++) {
    expect(finalPositions[i].x).toBeCloseTo(initialPositions[i].x + 50, 0);
    expect(finalPositions[i].y).toBeCloseTo(initialPositions[i].y + 50, 0);
  }

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('ControlOrMeta+z');

  const restored = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = (window as any).__diagramStore.getState().diagram.nodes;
    return nodes.map((n: { id: string; position: { x: number; y: number } }) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));
  });

  for (let i = 0; i < 2; i++) {
    expect(restored[i].x).toBeCloseTo(initialPositions[i].x, 0);
    expect(restored[i].y).toBeCloseTo(initialPositions[i].y, 0);
  }
});
