import { expect, test } from '@playwright/test';
import { PANE, createNode } from './helpers';

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

test('side panel switches between Node and Diagram views', async ({ page }) => {
  await expect(page.locator('.side-panel-top .section-heading', { hasText: 'Diagram' })).toBeVisible();

  await createNode(page, 200, 250);

  await page.locator('.entity-node').nth(0).click();
  await expect(page.locator('.side-panel-top .section-heading', { hasText: 'Node' })).toBeVisible();

  await page.locator(PANE).click({ position: { x: 50, y: 50 } });
  await expect(page.locator('.side-panel-top .section-heading', { hasText: 'Diagram' })).toBeVisible();
});

test('switching provider updates settings correctly', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-popover')).toBeVisible();
  await expect(page.getByLabel('Provider')).toHaveValue('openai');

  await page.getByLabel('Provider').selectOption('ollama');
  await expect(page.getByLabel('API key')).toHaveCount(0);

  await page.getByLabel('Provider').selectOption('anthropic');
  await expect(page.getByLabel('API key')).toBeVisible();
});

test('mascot image renders in toolbar', async ({ page }) => {
  const mascot = page.locator('.app-mascot');
  await expect(mascot).toBeVisible();
  await expect(mascot).toHaveAttribute('src', '/mascot.svg');
});

test('theme switching updates CSS variables on the document', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-popover')).toBeVisible();

  await page.getByLabel('Theme').selectOption('nord');

  const accent = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--accent'),
  );
  expect(accent).toBe('#88C0D0');

  await page.getByLabel('Theme').selectOption('rose');
  const roseAccent = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--accent'),
  );
  expect(roseAccent).toBe('#E11D48');
});

test('chat panel shows setup prompt when AI is not configured', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem('sketchy-settings');
  });
  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');

  await expect(page.getByText('AI not configured')).toBeVisible();
  await expect(page.getByText('Open Settings')).toBeVisible();

  await page.getByText('Open Settings').click();
  await expect(page.locator('.settings-popover')).toBeVisible();
});

test('sets node background color via context menu color swatch', async ({ page }) => {
  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  const bgSwatches = page.locator('.context-menu-colors').first();
  await expect(bgSwatches.locator('.color-swatch-none')).toHaveAttribute('data-active', 'true');

  await bgSwatches.locator('.color-swatch[title="Blue"]').click();
  await page.mouse.click(20, 20);

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.color === '#3B82F6';
  });
});

test('sets node text color via context menu and persists to store', async ({ page }) => {
  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  const textSwatches = page.locator('.context-menu-colors').nth(1);
  await textSwatches.locator('.color-swatch[title="Red"]').click();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return false;
    return JSON.parse(raw).nodes?.[0]?.data?.textColor === '#EF4444';
  });
});

test('reopen context menu reflects current node color as active swatch', async ({ page }) => {
  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu-colors').first().locator('.color-swatch[title="Green"]').click();
  await page.mouse.click(20, 20);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  const bgSwatches = page.locator('.context-menu-colors').first();
  await expect(bgSwatches.locator('.color-swatch[title="Green"]')).toHaveAttribute('data-active', 'true');
  await expect(bgSwatches.locator('.color-swatch-none')).toHaveAttribute('data-active', 'false');
});

test('custom node background color persists via color picker', async ({ page }) => {
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
  const bgSwatches = page.locator('.context-menu-colors').first();
  await expect(bgSwatches.locator('.color-swatch-none')).toHaveAttribute('data-active', 'false');
});

test('pressing Escape in the node color menu discards pending colors', async ({ page }) => {
  await createNode(page, 200, 250);

  await page.locator('.entity-node').first().click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();

  await page.locator('.context-menu-colors').first().locator('.color-swatch[title="Green"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.context-menu')).toBeHidden();

  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    if (!raw) return true;
    return JSON.parse(raw).nodes?.[0]?.data?.color === undefined;
  });
  const storedColor = await page.evaluate(() => {
    const raw = sessionStorage.getItem('sketchy_diagram');
    return raw ? JSON.parse(raw).nodes?.[0]?.data?.color : undefined;
  });
  expect(storedColor).toBeUndefined();
});
