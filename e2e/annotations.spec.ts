import { expect, test } from '@playwright/test';

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

test('toolbar icon arms placement and a pane click drops the annotation', async ({ page }) => {
  const pane = page.locator('[data-testid="diagram-flow"] .react-flow__pane');
  const rectBtn = page.getByRole('button', { name: 'Add rectangle annotation' });

  // Empty canvas, no prior annotations to interfere with the pane click target.
  await rectBtn.click();
  await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');
  await pane.click({ position: { x: 320, y: 220 } });

  await expect(page.locator('.annotation-rect')).toHaveCount(1);
  await expect(rectBtn).toHaveAttribute('aria-pressed', 'false');
});

test('click-and-drag draws an annotation sized to the drag rectangle', async ({ page }) => {
  const pane = page.locator('[data-testid="diagram-flow"] .react-flow__pane');
  await page.getByRole('button', { name: 'Add rectangle annotation' }).click();

  const box = await pane.boundingBox();
  if (!box) throw new Error('pane has no bounding box');
  // Use a large drag so even with viewport zoom (fitView clamps to 1.5×) the
  // resulting flow-space size is unambiguously bigger than the default click size (160×100).
  const startX = box.x + 200;
  const startY = box.y + 180;
  const endX = startX + 600;
  const endY = startY + 360;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 60, startY + 40, { steps: 4 });
  await page.waitForFunction(() => {
    const rect = document.querySelector('.annotation-rect');
    if (!rect) return false;
    const box = rect.getBoundingClientRect();
    return box.width > 40 && box.height > 25;
  });
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.annotation-rect')).toHaveCount(1);

  const ann = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__diagramStore.getState().diagram.annotations[0],
  );
  expect(ann.kind).toBe('rect');
  // Strictly larger than the default click size to prove the drag rectangle was used.
  expect(ann.size.width).toBeGreaterThan(200);
  expect(ann.size.height).toBeGreaterThan(120);
});

test('Escape cancels a pending annotation tool', async ({ page }) => {
  const rectBtn = page.getByRole('button', { name: 'Add rectangle annotation' });
  await rectBtn.click();
  await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(rectBtn).toHaveAttribute('aria-pressed', 'false');

  const count = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__diagramStore.getState().diagram.annotations.length,
  );
  expect(count).toBe(0);
});

test('edits a text annotation and persists across reload', async ({ page }) => {
  const pane = page.locator('[data-testid="diagram-flow"] .react-flow__pane');
  await page.getByRole('button', { name: 'Add text annotation' }).click();
  await pane.click({ position: { x: 300, y: 220 } });

  const textAnn = page.locator('.annotation-text').first();
  await expect(textAnn).toBeVisible();
  await textAnn.dblclick();

  const textarea = textAnn.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.fill('Explanatory note');
  await textarea.blur();

  await expect(textAnn).toContainText('Explanatory note');

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.annotations?.[0]?.data?.text === 'Explanatory note';
  });

  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');
  await expect(page.locator('.annotation-text').first()).toContainText('Explanatory note');
});

test('undo restores a deleted annotation', async ({ page }) => {
  const pane = page.locator('[data-testid="diagram-flow"] .react-flow__pane');
  await page.getByRole('button', { name: 'Add rectangle annotation' }).click();
  await pane.click({ position: { x: 300, y: 220 } });
  await expect(page.locator('.annotation-rect')).toHaveCount(1);

  const getCount = () =>
    page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__diagramStore.getState().diagram.annotations.length,
    );

  // Delete the annotation directly via the store action (covers the
  // store-level history integration without depending on RF key-routing).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__diagramStore.getState();
    const id = store.diagram.annotations[0].id;
    store.deleteAnnotations([id]);
  });
  expect(await getCount()).toBe(0);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await getCount()).toBe(1);

  await page.getByRole('button', { name: 'Redo' }).click();
  expect(await getCount()).toBe(0);
});

test('does not affect entity nodes when annotations are added', async ({ page }) => {
  // Double-click the pane to add a real entity node
  const pane = page.locator('[data-testid="diagram-flow"] .react-flow__pane');
  await pane.dblclick({ position: { x: 300, y: 300 } });
  await expect(page.locator('.entity-node')).toHaveCount(1);

  await page.getByRole('button', { name: 'Add rectangle annotation' }).click();
  await pane.click({ position: { x: 200, y: 180 } });
  await page.getByRole('button', { name: 'Add text annotation' }).click();
  await pane.click({ position: { x: 420, y: 180 } });

  await expect(page.locator('.entity-node')).toHaveCount(1);
  await expect(page.locator('.annotation-rect')).toHaveCount(1);
  await expect(page.locator('.annotation-text')).toHaveCount(1);
});
