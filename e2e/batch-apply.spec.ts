import { expect, test } from '@playwright/test';

// E2E coverage for the batchApply seam. This is the path AI streams flow into:
// chat handlers parse a tool call, then invoke `batchApply({ addNodes, addEdges, ... })`.
// Driving the store directly avoids needing a live AI backend while still exercising
// React Flow rendering, history, and edge routing.

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

test('batchApply renders new nodes and edges in a single pass', async ({ page }) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().batchApply({
      addNodes: [
        { id: 'tmp_1', label: 'Cause' },
        { id: 'tmp_2', label: 'Effect' },
      ],
      addEdges: [{ source: 'tmp_1', target: 'tmp_2' }],
    });
  });

  await expect(page.locator('.entity-node')).toHaveCount(2);
  await expect(page.locator('.entity-node', { hasText: 'Cause' })).toBeVisible();
  await expect(page.locator('.entity-node', { hasText: 'Effect' })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});

test('batchApply silently drops edges that reference unknown nodes', async ({ page }) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().batchApply({
      addNodes: [{ id: 'tmp_1', label: 'Lonely' }],
      addEdges: [
        { source: 'tmp_1', target: 'ghost' },
        { source: 'phantom', target: 'tmp_1' },
      ],
    });
  });

  await expect(page.locator('.entity-node')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});

test('batchApply adds to undo stack so the operation can be reverted in one step', async ({ page }) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__diagramStore.getState().batchApply({
      addNodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      addEdges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    });
  });

  await expect(page.locator('.entity-node')).toHaveCount(3);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  await page.locator('body').focus();
  await page.keyboard.press('ControlOrMeta+z');

  await expect(page.locator('.entity-node')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
});

test('batchApply backfills the junction default when a target gains a second incoming edge', async ({ page }) => {
  const junctionType = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storeApi = (window as any).__diagramStore;
    storeApi.getState().batchApply({
      addNodes: [
        { id: 'src1', label: 'S1' },
        { id: 'src2', label: 'S2' },
        { id: 'tgt', label: 'Target', junctionType: 'and' },
      ],
      addEdges: [
        { source: 'src1', target: 'tgt' },
        { source: 'src2', target: 'tgt' },
      ],
    });
    const target = storeApi.getState().diagram.nodes.find(
      (n: { data: { label: string } }) => n.data.label === 'Target',
    );
    return target?.data.junctionType;
  });

  // CRT defaults to 'or'; the second incoming edge resets the junction.
  expect(junctionType).toBe('or');
});
