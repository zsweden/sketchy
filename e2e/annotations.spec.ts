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
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.annotation-rect')).toHaveCount(1);

  // Poll the store — under load the final pointer event may not yet have
  // flushed by the time we read.
  await expect
    .poll(() =>
      page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (window as any).__diagramStore.getState().diagram.annotations[0]?.size?.width ?? 0,
      ),
    )
    .toBeGreaterThan(200);

  const ann = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__diagramStore.getState().diagram.annotations[0],
  );
  expect(ann.kind).toBe('rect');
  expect(ann.size.height).toBeGreaterThan(120);
});

test('selected shape resize handles are hollow squares', async ({ page }) => {
  const pane = page.locator('[data-testid="diagram-flow"] .react-flow__pane');

  await page.getByRole('button', { name: 'Add rectangle annotation' }).click();
  await pane.click({ position: { x: 300, y: 220 } });
  const rect = page.locator('.annotation-rect');
  await expect(rect).toHaveCount(1);
  await rect.click();

  const rectHandle = await rect.evaluate((annotation) => {
    const handle = annotation.closest('.react-flow__node')?.querySelector('.react-flow__resize-control.handle');
    if (!(handle instanceof HTMLElement)) throw new Error('rectangle resize handle not found');
    const probe = document.createElement('div');
    probe.style.background = 'var(--surface)';
    document.body.appendChild(probe);
    const surface = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const style = getComputedStyle(handle);
    return {
      width: style.width,
      height: style.height,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
      borderStyle: style.borderTopStyle,
      surface,
    };
  });
  expect(rectHandle).toEqual({
    width: '10px',
    height: '10px',
    borderRadius: '2px',
    backgroundColor: rectHandle.surface,
    borderStyle: 'solid',
    surface: rectHandle.surface,
  });

  await page.getByRole('button', { name: 'Add ellipse annotation' }).click();
  await pane.click({ position: { x: 520, y: 220 } });
  const ellipse = page.locator('.annotation-ellipse');
  await expect(ellipse).toHaveCount(1);
  await ellipse.click();

  const ellipseHandle = await ellipse.evaluate((annotation) => {
    const handle = annotation.closest('.react-flow__node')?.querySelector('.react-flow__resize-control.handle');
    if (!(handle instanceof HTMLElement)) throw new Error('ellipse resize handle not found');
    const style = getComputedStyle(handle);
    return {
      width: style.width,
      height: style.height,
      borderRadius: style.borderRadius,
      borderStyle: style.borderTopStyle,
    };
  });
  expect(ellipseHandle).toEqual({
    width: '10px',
    height: '10px',
    borderRadius: '2px',
    borderStyle: 'solid',
  });
});

test('click-and-drag draws a visible line annotation', async ({ page }) => {
  const pane = page.locator('[data-testid="diagram-flow"] .react-flow__pane');
  await page.getByRole('button', { name: 'Add line annotation' }).click();

  const box = await pane.boundingBox();
  if (!box) throw new Error('pane has no bounding box');
  const startX = box.x + 220;
  const startY = box.y + 190;
  const endX = startX + 260;
  const endY = startY + 140;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.annotation-line')).toHaveCount(1);

  // Verify the line geometry from the store (deterministic across load) and
  // verify it is rendered as a visible SVG line (style sanity).
  await expect
    .poll(async () =>
      page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ann = (window as any).__diagramStore.getState().diagram.annotations[0];
        if (!ann || ann.kind !== 'line') return null;
        return {
          dx: Math.abs(ann.end.x - ann.start.x),
          dy: Math.abs(ann.end.y - ann.start.y),
        };
      }),
    )
    .toEqual(expect.objectContaining({
      dx: expect.any(Number) as unknown as number,
      dy: expect.any(Number) as unknown as number,
    }));

  const geometry = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ann = (window as any).__diagramStore.getState().diagram.annotations[0];
    return { dx: Math.abs(ann.end.x - ann.start.x), dy: Math.abs(ann.end.y - ann.start.y) };
  });
  // Lenient lower bounds: drag was 260×140 in screen px; at the highest
  // post-fitView zoom (~1.5×) that's ~173×93 in flow space. Requiring much
  // smaller minimums keeps the test stable under variable viewport zoom.
  expect(geometry.dx).toBeGreaterThan(80);
  expect(geometry.dy).toBeGreaterThan(40);

  const style = await page.locator('.annotation-line line').evaluate((l) => ({
    stroke: getComputedStyle(l).stroke,
    strokeWidth: getComputedStyle(l).strokeWidth,
  }));
  expect(style.stroke).not.toBe('none');
  expect(style.strokeWidth).not.toBe('0px');
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
