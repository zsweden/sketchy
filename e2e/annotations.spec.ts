import { expect, test } from '@playwright/test';
import {
  deleteFirstAnnotation,
  getAnnotationCount,
  getAnnotations,
  getFirstAnnotationWidth,
  getFirstLineDelta,
  PANE,
  resetApp,
  waitForViewportStable,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('toolbar icon arms placement and a pane click drops the annotation', async ({ page }) => {
  const pane = page.locator(PANE);
  const rectBtn = page.getByRole('button', { name: 'Add rectangle annotation' });

  // Empty canvas, no prior annotations to interfere with the pane click target.
  await rectBtn.click();
  await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');
  await pane.click({ position: { x: 320, y: 220 } });

  await expect(page.locator('.annotation-rect')).toHaveCount(1);
  await expect(rectBtn).toHaveAttribute('aria-pressed', 'false');
});

test('click-and-drag draws an annotation sized to the drag rectangle', async ({ page }) => {
  const pane = page.locator(PANE);
  await page.getByRole('button', { name: 'Add rectangle annotation' }).click();

  const box = await pane.boundingBox();
  if (!box) throw new Error('pane has no bounding box');
  const screenDx = 600;
  const screenDy = 360;
  const startX = box.x + 200;
  const startY = box.y + 180;
  const endX = startX + screenDx;
  const endY = startY + screenDy;

  const zoom = await waitForViewportStable(page);
  const expectedWidth = screenDx / zoom;
  const expectedHeight = screenDy / zoom;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Single-step move: stepped moves coalesce in Chromium and drop the final
  // position. One direct move fires a single deterministic pointermove event.
  await page.mouse.move(endX, endY);
  await page.mouse.up();

  await expect(page.locator('.annotation-rect')).toHaveCount(1);

  await expect
    .poll(() => getFirstAnnotationWidth(page))
    .toBeGreaterThan(expectedWidth * 0.95);

  const ann = (await getAnnotations(page))[0];
  expect(ann.kind).toBe('rect');
  if (ann.kind !== 'line') {
    expect(ann.size.width).toBeGreaterThan(expectedWidth * 0.95);
    expect(ann.size.width).toBeLessThan(expectedWidth * 1.05);
    expect(ann.size.height).toBeGreaterThan(expectedHeight * 0.95);
    expect(ann.size.height).toBeLessThan(expectedHeight * 1.05);
  }
});

test('selected shape resize handles are hollow squares', async ({ page }) => {
  const pane = page.locator(PANE);

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
  const pane = page.locator(PANE);
  await page.getByRole('button', { name: 'Add line annotation' }).click();

  const box = await pane.boundingBox();
  if (!box) throw new Error('pane has no bounding box');
  const screenDx = 260;
  const screenDy = 140;
  const startX = box.x + 220;
  const startY = box.y + 190;
  const endX = startX + screenDx;
  const endY = startY + screenDy;

  const zoom = await waitForViewportStable(page);
  const expectedDx = screenDx / zoom;
  const expectedDy = screenDy / zoom;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Single-step move: stepped moves coalesce in Chromium and drop the final
  // position. One direct move fires a single deterministic pointermove event.
  await page.mouse.move(endX, endY);
  await page.mouse.up();

  await expect(page.locator('.annotation-line')).toHaveCount(1);

  await expect
    .poll(() => getFirstLineDelta(page))
    .toEqual(expect.objectContaining({
      dx: expect.any(Number) as unknown as number,
      dy: expect.any(Number) as unknown as number,
    }));

  const geometry = await getFirstLineDelta(page);
  expect(geometry).not.toBeNull();
  // Geometry lives in flow space; assert within 5% of the zoom-derived
  // expected delta to absorb any tail-end animation drift.
  expect(geometry!.dx).toBeGreaterThan(expectedDx * 0.95);
  expect(geometry!.dx).toBeLessThan(expectedDx * 1.05);
  expect(geometry!.dy).toBeGreaterThan(expectedDy * 0.95);
  expect(geometry!.dy).toBeLessThan(expectedDy * 1.05);

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

  expect(await getAnnotationCount(page)).toBe(0);
});

test('edits a text annotation and persists across reload', async ({ page }) => {
  const pane = page.locator(PANE);
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
  const pane = page.locator(PANE);
  await page.getByRole('button', { name: 'Add rectangle annotation' }).click();
  await pane.click({ position: { x: 300, y: 220 } });
  await expect(page.locator('.annotation-rect')).toHaveCount(1);

  // Delete the annotation directly via the store action (covers the
  // store-level history integration without depending on RF key-routing).
  await deleteFirstAnnotation(page);
  expect(await getAnnotationCount(page)).toBe(0);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await getAnnotationCount(page)).toBe(1);

  await page.getByRole('button', { name: 'Redo' }).click();
  expect(await getAnnotationCount(page)).toBe(0);
});

test('does not affect entity nodes when annotations are added', async ({ page }) => {
  // Double-click the pane to add a real entity node
  const pane = page.locator(PANE);
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
