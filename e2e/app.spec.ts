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

// --- Helpers ---

async function createNode(page: import('@playwright/test').Page, x: number, y: number) {
  await page.locator(PANE).dblclick({ position: { x, y } });
}

async function getNodeIds(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator('[data-node-id]').evaluateAll(
    (els) => els.map((el) => el.getAttribute('data-node-id')!),
  );
}

async function addEdge(page: import('@playwright/test').Page, sourceId: string, targetId: string) {
  await page.evaluate(
    ([src, tgt]) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__sketchy_addEdge(src, tgt),
    [sourceId, targetId],
  );
}

// --- Existing tests ---

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

test('shows fallback message for custom provider with no endpoint and supports framework switching', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      'sketchy-settings',
      JSON.stringify({ apiKey: 'sk-test', baseUrl: '', model: '', provider: 'custom' }),
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

// --- 1. Edge creation & confidence ---

test('connects two nodes and changes edge confidence via context menu', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 350);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // Right-click edge midpoint
  const edgePath = page.locator('.react-flow__edge-interaction').first();
  const box = await edgePath.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, { button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Medium' }).click();
  await expect(page.locator('.edge-confidence-medium')).toHaveCount(1);
});

// --- 2. Undo / redo ---

test('undo restores a deleted node and redo removes it again', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const firstNode = page.locator('.entity-node').first();
  await firstNode.click();
  await page.getByLabel('Node text').fill('Keep me');
  await page.getByLabel('Node text').blur();

  await page.locator('.react-flow__node').nth(1).click();
  await page.keyboard.press('Backspace');
  await expect(page.locator('.entity-node')).toHaveCount(1);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(2);

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(1);
  await expect(page.locator('.entity-node').first()).toContainText('Keep me');
});

// --- 3. Save / load .sky file ---

test('saves diagram to sessionStorage, clears, and restores via file load', async ({ page }) => {
  await createNode(page, 200, 250);
  const node = page.locator('.entity-node').first();
  await node.click();
  await page.getByLabel('Node text').fill('Saved node');
  await page.getByLabel('Node text').blur();
  await expect(node).toContainText('Saved node');

  // Wait for autosave
  const diagramJson = await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.nodes?.[0]?.data?.label === 'Saved node') return raw;
    return null;
  });
  const json = await diagramJson.jsonValue();
  expect(json).toBeTruthy();

  // Clear
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(0);

  // Load via the .sky file input
  const fileInput = page.locator('input[type="file"][accept=".sky,.json"]');
  const buffer = Buffer.from(json as string, 'utf-8');
  await fileInput.setInputFiles({
    name: 'test-diagram.sky',
    mimeType: 'application/json',
    buffer,
  });

  await expect(page.locator('.entity-node').first()).toContainText('Saved node');
});

// --- 4. Auto-layout ---

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
  await page.waitForTimeout(500);

  const newPositions = await getPositions();
  const changed = initialPositions.some((pos, i) => pos !== newPositions[i]);
  expect(changed).toBe(true);
});

// --- 5. Context menu — apply tag ---

test('applies a tag via right-click context menu and shows badge', async ({ page }) => {
  await createNode(page, 200, 250);
  const node = page.locator('.entity-node').first();

  await page.locator('.react-flow__node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();
  await expect(node.locator('.badge', { hasText: 'UDE' })).toBeVisible();
});

// --- 6. Multi-select & delete ---

test('multi-select nodes and delete all', async ({ page }) => {
  await createNode(page, 150, 200);
  await createNode(page, 300, 200);
  await createNode(page, 225, 350);
  await expect(page.locator('.entity-node')).toHaveCount(3);

  await page.locator('.react-flow__node').nth(0).click();
  await page.locator('.react-flow__node').nth(1).click({ modifiers: ['Shift'] });
  await page.locator('.react-flow__node').nth(2).click({ modifiers: ['Shift'] });

  await expect(page.getByText('3 nodes selected')).toBeVisible();
  await page.getByRole('button', { name: 'Delete All' }).click();
  await expect(page.locator('.entity-node')).toHaveCount(0);
});

// --- 7. Side panel switching ---

test('side panel switches between Node and Diagram views', async ({ page }) => {
  // Default: Diagram panel
  await expect(page.locator('.side-panel-top').getByText('Diagram', { exact: true })).toBeVisible();

  // Create a node
  await createNode(page, 200, 250);

  // Click node → NodePanel
  await page.locator('.react-flow__node').nth(0).click();
  await expect(page.locator('.side-panel-top').getByText('Node', { exact: true })).toBeVisible();

  // Click pane → back to Diagram
  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await expect(page.locator('.side-panel-top').getByText('Diagram', { exact: true })).toBeVisible();
});

// --- 8. Provider / model settings ---

test('switching provider updates settings correctly', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-popover')).toBeVisible();
  await expect(page.getByLabel('Provider')).toHaveValue('openai');

  await page.getByLabel('Provider').selectOption('ollama');
  await expect(page.getByLabel('API key')).toHaveCount(0);

  await page.getByLabel('Provider').selectOption('anthropic');
  await expect(page.getByLabel('API key')).toBeVisible();
});

// --- 9. Node highlight on click ---

test('clicking a node highlights connected edges and dims unconnected nodes', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await createNode(page, 450, 300);
  await expect(page.locator('.entity-node')).toHaveCount(3);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // Click the first node
  await page.locator('.react-flow__node').nth(0).click();
  await expect(page.locator('.edge-highlighted')).toHaveCount(1);
  await expect(page.locator('.entity-node.dimmed')).toHaveCount(1);

  // Click pane to deselect
  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await expect(page.locator('.edge-highlighted')).toHaveCount(0);
  await expect(page.locator('.entity-node.dimmed')).toHaveCount(0);
});

// --- 10. Mascot renders ---

test('mascot image renders in toolbar', async ({ page }) => {
  const mascot = page.locator('.app-mascot');
  await expect(mascot).toBeVisible();
  await expect(mascot).toHaveAttribute('src', '/mascot.svg');
});

// --- 11. Theme switching ---

test('theme switching updates CSS variables on the document', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-popover')).toBeVisible();

  // Switch to Nord
  await page.getByLabel('Theme').selectOption('nord');

  const accent = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--accent'),
  );
  expect(accent).toBe('#88C0D0');

  // Switch to Rose (light theme)
  await page.getByLabel('Theme').selectOption('rose');
  const roseAccent = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--accent'),
  );
  expect(roseAccent).toBe('#E11D48');
});

// --- 12. Snap-to-grid toggle ---

test('snap-to-grid setting persists to diagram settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-popover')).toBeVisible();

  // Default is off
  const initialSnap = await page.evaluate(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return null;
    return JSON.parse(raw).settings?.snapToGrid;
  });
  expect(initialSnap).toBeFalsy();

  // Toggle snap on
  await page.getByLabel('Toggle snap to grid').click();

  // Verify it persisted
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).settings?.snapToGrid === true;
  });
});

// --- 13. Node locking ---

test('locked node shows lock indicator and survives auto-layout', async ({ page }) => {
  await createNode(page, 200, 250);
  const node = page.locator('.entity-node').first();
  await expect(node).toHaveCount(1);

  // Right-click to lock
  await page.locator('.react-flow__node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Unlocked' }).click();

  // Verify lock indicator appears
  await expect(page.locator('.node-lock-indicator')).toHaveCount(1);

  // Get locked position
  const lockedPos = await page.locator('.react-flow__node').first().evaluate(
    (el) => (el as HTMLElement).style.transform,
  );

  // Create another node and auto-layout
  await createNode(page, 400, 400);
  await page.getByRole('button', { name: 'Auto-layout' }).click();
  await page.waitForTimeout(500);

  // Locked node should not have moved
  const afterPos = await page.locator('.react-flow__node').first().evaluate(
    (el) => (el as HTMLElement).style.transform,
  );
  expect(afterPos).toBe(lockedPos);
});

// --- 14. Edge polarity and delay in CLD ---

test('CLD framework supports edge polarity and delay via context menu', async ({ page }) => {
  // Switch to CLD
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('cld');

  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // Right-click edge for polarity
  const edgePath = page.locator('.react-flow__edge-interaction').first();
  const box1 = await edgePath.boundingBox();
  await page.mouse.click(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2, { button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  // Change polarity to negative
  await page.locator('.context-menu-item', { hasText: 'Negative' }).click();

  // Verify polarity changed in store (wait for autosave)
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).edges?.[0]?.polarity === 'negative';
  });

  // Right-click edge again for delay (re-query bounding box)
  const box2 = await page.locator('.react-flow__edge-interaction').first().boundingBox();
  await page.mouse.click(box2!.x + box2!.width / 2, box2!.y + box2!.height / 2, { button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Add Delay' }).click();

  // Verify delay set in store
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).edges?.[0]?.delay === true;
  });
});

// --- 15. AI not-configured state ---

test('chat panel shows setup prompt when AI is not configured', async ({ page }) => {
  // Clear any stored API key
  await page.evaluate(() => {
    localStorage.removeItem('sketchy-settings');
  });
  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  await expect(page.getByText('AI not configured')).toBeVisible();
  await expect(page.getByText('Open Settings')).toBeVisible();

  // Click "Open Settings" should open settings popover
  await page.getByText('Open Settings').click();
  await expect(page.locator('.settings-popover')).toBeVisible();
});
