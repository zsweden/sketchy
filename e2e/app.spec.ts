import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload();
});

test('creates a node, edits it from the inspector, and restores it after reload', async ({ page }) => {
  await page.locator('[data-testid="diagram-flow"] .react-flow__pane').dblclick({
    position: { x: 240, y: 180 },
  });

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

  await page.locator('[data-testid="diagram-flow"] .react-flow__pane').dblclick({
    position: { x: 180, y: 160 },
  });

  await page.getByLabel('Chat input').fill('What should I fix first?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(
    page.getByText('Please configure your API endpoint and model in settings (cog icon in the toolbar).'),
  ).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Framework').selectOption('frt');

  await expect(page.locator('.entity-node')).toHaveCount(0);
  await expect(page.getByLabel('Framework')).toHaveValue('frt');
  await expect(
    page.getByText('Validate a proposed solution by tracing injections to desirable effects'),
  ).toBeVisible();
});
