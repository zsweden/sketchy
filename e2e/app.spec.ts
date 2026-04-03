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

async function updateNodeText(page: import('@playwright/test').Page, nodeId: string, label: string) {
  await page.evaluate(
    ([id, text]) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().updateNodeText(id, text),
    [nodeId, label],
  );
}

async function getNodeCenter(page: import('@playwright/test').Page, nodeId: string) {
  const box = await page.locator(`[data-node-id="${nodeId}"]`).boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
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

  await page.locator('.entity-node').nth(1).click();
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

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();
  await expect(node.locator('.badge', { hasText: 'UDE' })).toBeVisible();
});

// --- 6. Multi-select & delete ---

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

// --- 7. Side panel switching ---

test('side panel switches between Node and Diagram views', async ({ page }) => {
  // Default: Diagram panel (section heading inside SettingsPanel)
  await expect(page.locator('.side-panel-top .section-heading', { hasText: 'Diagram' })).toBeVisible();

  // Create a node
  await createNode(page, 200, 250);

  // Click node → NodePanel
  await page.locator('.entity-node').nth(0).click();
  await expect(page.locator('.side-panel-top .section-heading', { hasText: 'Node' })).toBeVisible();

  // Click pane → back to Diagram
  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await expect(page.locator('.side-panel-top .section-heading', { hasText: 'Diagram' })).toBeVisible();
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
  await page.locator('.entity-node').nth(0).click();
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
  await page.locator('.entity-node').first().click({ button: 'right' });
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

// --- 16. Node background color ---

test('sets node background color via context menu color swatch', async ({ page }) => {
  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  // Default swatch should be active initially
  const bgSwatches = page.locator('.context-menu-colors').first();
  await expect(bgSwatches.locator('.color-swatch[title="Default"]')).toHaveAttribute('data-active', 'true');

  // Click the Blue swatch
  await bgSwatches.locator('.color-swatch[title="Blue"]').click();
  await page.mouse.click(20, 20);

  // Verify persisted
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.color === '#BFDBFE';
  });
});

// --- 17. Node text color ---

test('sets node text color via context menu and persists to store', async ({ page }) => {
  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  // Click the Red text-color swatch (second .context-menu-colors block)
  const textSwatches = page.locator('.context-menu-colors').nth(1);
  await textSwatches.locator('.color-swatch[title="Red"]').click();
  await page.mouse.click(20, 20);

  // Verify persisted
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.textColor === '#DC2626';
  });
});

// --- 18. Active color swatch reflects current color ---

test('reopen context menu reflects current node color as active swatch', async ({ page }) => {
  await createNode(page, 200, 250);

  // Apply Green background
  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-colors').first().locator('.color-swatch[title="Green"]').click();
  await page.mouse.click(20, 20);

  // Re-open context menu
  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  const bgSwatches = page.locator('.context-menu-colors').first();
  await expect(bgSwatches.locator('.color-swatch[title="Green"]')).toHaveAttribute('data-active', 'true');
  await expect(bgSwatches.locator('.color-swatch[title="Default"]')).toHaveAttribute('data-active', 'false');
});

test('custom node background color appears in the right-click palette after selection', async ({ page }) => {
  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  await page.getByLabel('Custom background color').evaluate((element) => {
    const input = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setValue?.call(input, '#12abef');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.mouse.click(20, 20);

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.color === '#12ABEF';
  });

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await expect(
    page.locator('.context-menu-colors').first().locator('.color-swatch[title="#12ABEF"]'),
  ).toHaveAttribute('data-active', 'true');
});

test('pressing Escape in the node color menu discards pending colors', async ({ page }) => {
  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  await page.locator('.context-menu-colors').first().locator('.color-swatch[title="Green"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.context-menu')).toBeHidden();

  await page.waitForTimeout(100);
  const storedColor = await page.evaluate(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    return raw ? JSON.parse(raw).nodes?.[0]?.data?.color : undefined;
  });
  expect(storedColor).toBeUndefined();
});

// --- 19. Select / pan toggle ---

test('select and pan tool toggle active state in toolbar', async ({ page }) => {
  const selectBtn = page.getByLabel('Select tool');
  const panBtn = page.getByLabel('Pan tool');

  // Default: select is active
  await expect(selectBtn).toHaveClass(/btn-toggle-active/);
  await expect(panBtn).not.toHaveClass(/btn-toggle-active/);

  // Switch to pan
  await panBtn.click();
  await expect(panBtn).toHaveClass(/btn-toggle-active/);
  await expect(selectBtn).not.toHaveClass(/btn-toggle-active/);

  // Switch back to select
  await selectBtn.click();
  await expect(selectBtn).toHaveClass(/btn-toggle-active/);
  await expect(panBtn).not.toHaveClass(/btn-toggle-active/);
});

// --- 20. Align buttons disabled state ---

test('align buttons are disabled until two nodes are selected', async ({ page }) => {
  const toolbar = page.locator('header');
  const alignH = toolbar.getByLabel('Align horizontally');
  const alignV = toolbar.getByLabel('Align vertically');

  // Initially disabled
  await expect(alignH).toBeDisabled();
  await expect(alignV).toBeDisabled();

  // Create 2 nodes and select both
  await createNode(page, 150, 200);
  await createNode(page, 350, 200);

  const ids = await getNodeIds(page);
  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nodeIds) => (window as any).__uiStore.getState().setSelectedNodes(nodeIds),
    ids,
  );

  // Now enabled
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
  await page.waitForTimeout(100);

  const firstCenter = await getNodeCenter(page, ids[0]);
  const secondCenter = await getNodeCenter(page, ids[1]);
  expect(Math.abs(firstCenter.y - secondCenter.y)).toBeLessThan(1);
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
  await page.waitForTimeout(100);

  const firstCenter = await getNodeCenter(page, ids[0]);
  const secondCenter = await getNodeCenter(page, ids[1]);
  expect(Math.abs(firstCenter.x - secondCenter.x)).toBeLessThan(1);
});

// --- 21. Distribute buttons ---

test('distribute buttons require three selected nodes and reposition them', async ({ page }) => {
  await createNode(page, 100, 100);
  await createNode(page, 250, 300);
  await createNode(page, 400, 150);

  const toolbar = page.locator('header');
  const distH = toolbar.getByLabel('Distribute horizontally');
  const distV = toolbar.getByLabel('Distribute vertically');

  // Not enough selected
  await expect(distH).toBeDisabled();
  await expect(distV).toBeDisabled();

  // Select all 3
  await page.locator('.entity-node').nth(0).click();
  await page.locator('.entity-node').nth(1).click({ modifiers: ['Shift'] });
  await page.locator('.entity-node').nth(2).click({ modifiers: ['Shift'] });

  await expect(distH).toBeEnabled();
  await expect(distV).toBeEnabled();

  // Capture positions, distribute vertically, verify movement
  const getPositions = () =>
    page.locator('.react-flow__node').evaluateAll(
      (nodes) => nodes.map((n) => (n as HTMLElement).style.transform),
    );

  const before = await getPositions();
  await distV.click();
  await page.waitForTimeout(300);
  const after = await getPositions();
  const changed = before.some((pos, i) => pos !== after[i]);
  expect(changed).toBe(true);
});

// --- 22. Node notes ---

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

// --- 23. Junction type ---

test('junction type toggle appears when node has two incoming edges', async ({ page }) => {
  await createNode(page, 150, 100);
  await createNode(page, 350, 100);
  await createNode(page, 250, 300);
  await expect(page.locator('.entity-node')).toHaveCount(3);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[2]); // A -> C

  // Click C — junction not yet visible (indegree 1)
  await page.locator('.entity-node').nth(2).click();
  await expect(page.getByText('Junction Logic')).not.toBeVisible();

  // Add second edge B -> C
  await addEdge(page, ids[1], ids[2]);

  // Re-click C to refresh panel
  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await page.locator('.entity-node').nth(2).click();
  await expect(page.getByText('Junction Logic')).toBeVisible();

  // Toggle to AND
  await page.getByRole('button', { name: 'AND', exact: true }).click();
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[2]?.data?.junctionType === 'and';
  });
  await expect(page.getByText('All incoming causes required')).toBeVisible();

  // Toggle to OR
  await page.getByRole('button', { name: 'OR', exact: true }).click();
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[2]?.data?.junctionType === 'or';
  });
  await expect(page.getByText('Any single cause is sufficient')).toBeVisible();
});

// --- 24. Edge panel ---

test('edge panel shows confidence and notes when an edge is clicked', async ({ page }) => {
  await createNode(page, 200, 200);
  await createNode(page, 200, 400);
  await expect(page.locator('.entity-node')).toHaveCount(2);

  const ids = await getNodeIds(page);
  await addEdge(page, ids[0], ids[1]);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // Deselect so the edge click registers in the UI store
  await page.locator(PANE).click({ position: { x: 50, y: 50 } });

  // Left-click edge to select it
  const edgePath = page.locator('.react-flow__edge-interaction').first();
  await expect(edgePath).toHaveCount(1);
  const box = await edgePath.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  // Edge panel should appear
  await expect(page.locator('.side-panel-top .section-heading', { hasText: 'Edge' })).toBeVisible();
  await expect(page.getByLabel('Edge notes')).toBeVisible();

  // Edit notes
  await page.getByLabel('Edge notes').fill('Strong causal link');
  await page.getByLabel('Edge notes').blur();

  // Change confidence to Low
  await page.getByRole('button', { name: 'Low', exact: true }).click();

  // Verify persistence
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    const edge = JSON.parse(raw).edges?.[0];
    return edge?.notes === 'Strong causal link' && edge?.confidence === 'low';
  });
});

// --- 25. Tag chips toggle ---

test('tag chips in NodePanel toggle on and off', async ({ page }) => {
  await createNode(page, 200, 250);
  await page.locator('.entity-node').first().click();

  // CRT default — UDE tag chip should be present but inactive
  const udeChip = page.locator('.tag-chip', { hasText: 'Undesirable Effect' });
  await expect(udeChip).toBeVisible();
  await expect(udeChip).toHaveAttribute('data-active', 'false');

  // Click to activate
  await udeChip.click();
  await expect(udeChip).toHaveAttribute('data-active', 'true');
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  // Click again to deactivate
  await udeChip.click();
  await expect(udeChip).toHaveAttribute('data-active', 'false');
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toHaveCount(0);
});

// --- 26. FRT tags ---

test('FRT framework shows Injection and Desirable Effect tags in context menu', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('frt');

  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  await expect(page.locator('.context-menu-item', { hasText: 'Injection' })).toBeVisible();
  await expect(page.locator('.context-menu-item', { hasText: 'Desirable Effect' })).toBeVisible();

  // Apply Injection tag
  await page.locator('.context-menu-item', { hasText: 'Injection' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'INJ' })).toBeVisible();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.tags?.includes('injection');
  });
});

// --- 27. PRT tags ---

test('PRT framework exposes Obstacle, Intermediate Objective, and Goal tags', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('prt');

  await createNode(page, 200, 250);
  await page.locator('.entity-node').first().click();

  // All three tags should appear as chips
  await expect(page.locator('.tag-chip', { hasText: 'Obstacle' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Intermediate Objective' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Goal' })).toBeVisible();

  // Apply Goal
  await page.locator('.tag-chip', { hasText: 'Goal' }).click();
  await expect(page.locator('.tag-chip', { hasText: 'Goal' })).toHaveAttribute('data-active', 'true');
  await expect(page.locator('.entity-node .badge', { hasText: 'GOAL' })).toBeVisible();
});

// --- 28. STT tags in context menu and panel ---

test('STT tags appear in both context menu and side panel', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('stt');

  await createNode(page, 200, 250);

  // Context menu
  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await expect(page.locator('.context-menu-item', { hasText: 'Objective' })).toBeVisible();
  await expect(page.locator('.context-menu-item', { hasText: 'Strategy' })).toBeVisible();
  await expect(page.locator('.context-menu-item', { hasText: 'Tactic' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Side panel tag chips
  await page.locator('.entity-node').first().click();
  await expect(page.locator('.tag-chip', { hasText: 'Objective' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Strategy' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Tactic' })).toBeVisible();

  // Apply Strategy via panel
  await page.locator('.tag-chip', { hasText: 'Strategy' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'STR' })).toBeVisible();
});

// --- 29. Framework switch clears tags ---

test('switching framework clears diagram and shows new framework tags', async ({ page }) => {
  // CRT: apply UDE tag
  await createNode(page, 200, 250);
  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-item', { hasText: 'Undesirable Effect' }).click();
  await expect(page.locator('.entity-node .badge', { hasText: 'UDE' })).toBeVisible();

  // Switch to FRT — diagram clears
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('frt');
  await expect(page.locator('.entity-node')).toHaveCount(0);
  await expect(page.getByLabel('Framework')).toHaveValue('frt');

  // Create new node in FRT
  await createNode(page, 200, 250);
  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await page.locator('.entity-node').first().click();

  // CRT tag should not exist, FRT tags should
  await expect(page.locator('.tag-chip', { hasText: 'Undesirable Effect' })).toHaveCount(0);
  await expect(page.locator('.tag-chip', { hasText: 'Injection' })).toBeVisible();
  await expect(page.locator('.tag-chip', { hasText: 'Desirable Effect' })).toBeVisible();
});
