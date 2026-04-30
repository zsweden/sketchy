import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Annotation } from '../src/core/types';

export const PANE = '[data-testid="diagram-flow"] .react-flow__pane';

type SketchyWindow = Window & {
  __diagramStore: {
    getState: () => {
      setFramework: (frameworkId: string) => void;
      addNode: (position: { x: number; y: number }) => string;
      updateNodeText: (id: string, text: string) => void;
      deleteAnnotations: (ids: string[]) => void;
      diagram: { annotations: Annotation[] };
    };
  };
  __uiStore?: {
    getState: () => { selectedNodeIds: string[] };
  };
  __sketchy_addEdge: (sourceId: string, targetId: string) => unknown;
};

export async function resetApp(page: Page, frameworkId = 'crt') {
  await page.goto('/');
  await page.waitForSelector('[data-testid="diagram-flow"]');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('[data-testid="diagram-flow"]');
  await page.evaluate(
    (id) => (window as unknown as SketchyWindow).__diagramStore.getState().setFramework(id),
    frameworkId,
  );
}

export async function getAnnotations(page: Page): Promise<Annotation[]> {
  return page.evaluate(() => (window as unknown as SketchyWindow).__diagramStore.getState().diagram.annotations);
}

export async function getAnnotationCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as SketchyWindow).__diagramStore.getState().diagram.annotations.length);
}

export async function getFirstAnnotationWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const first = (window as unknown as SketchyWindow).__diagramStore.getState().diagram.annotations[0];
    return first && first.kind !== 'line' ? first.size.width : 0;
  });
}

export async function getFirstLineDelta(page: Page): Promise<{ dx: number; dy: number } | null> {
  return page.evaluate(() => {
    const first = (window as unknown as SketchyWindow).__diagramStore.getState().diagram.annotations[0];
    if (!first || first.kind !== 'line') return null;
    return {
      dx: Math.abs(first.end.x - first.start.x),
      dy: Math.abs(first.end.y - first.start.y),
    };
  });
}

/**
 * Read the current React Flow viewport zoom from the DOM transform matrix.
 * Annotation deltas live in flow space, so callers that drag in screen pixels
 * must divide by zoom to know what to expect. Avoids hardcoded "lenient"
 * thresholds that drift when fitView lands on a different zoom.
 */
async function getViewportZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewport) throw new Error('react-flow viewport not found');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
    return matrix.a;
  });
}

/**
 * Wait for the React Flow viewport to stop animating (fitView uses a 300 ms
 * tween) before reading zoom. Without this, drag-based geometry tests race the
 * tween and see a moving target.
 */
export async function waitForViewportStable(page: Page): Promise<number> {
  let prev = await getViewportZoom(page);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    const next = await getViewportZoom(page);
    if (Math.abs(next - prev) < 1e-4) return next;
    prev = next;
  }
  return prev;
}

export async function deleteFirstAnnotation(page: Page) {
  await page.evaluate(() => {
    const store = (window as unknown as SketchyWindow).__diagramStore.getState();
    const id = store.diagram.annotations[0]?.id;
    if (id) store.deleteAnnotations([id]);
  });
}

export async function createNode(page: Page, x: number, y: number) {
  const countBefore = await page.locator('.entity-node').count();
  await page.evaluate(
    ([nodeX, nodeY]) => {
      // Use store-level creation for deterministic flow-space coordinates.
      // Pane double-click coordinates become viewport-dependent once fitView zooms.
      return (window as unknown as SketchyWindow).__diagramStore.getState().addNode({ x: nodeX, y: nodeY });
    },
    [x, y],
  );
  await expect(page.locator('.entity-node')).toHaveCount(countBefore + 1);
}

export async function getNodeIds(page: Page): Promise<string[]> {
  return page.locator('[data-node-id]').evaluateAll(
    (els) => els.map((el) => el.getAttribute('data-node-id')!),
  );
}

export async function selectNode(
  page: Page,
  node: Locator,
) {
  await node.click();
  await page.waitForFunction(() => {
    const ids = (window as unknown as SketchyWindow).__uiStore?.getState().selectedNodeIds;
    return Array.isArray(ids) && ids.length === 1;
  });
}

export async function addEdge(page: Page, sourceId: string, targetId: string) {
  await page.evaluate(
    ([src, tgt]) => (window as unknown as SketchyWindow).__sketchy_addEdge(src, tgt),
    [sourceId, targetId],
  );
}

export async function updateNodeText(page: Page, nodeId: string, label: string) {
  await page.evaluate(
    ([id, text]) => (window as unknown as SketchyWindow).__diagramStore.getState().updateNodeText(id, text),
    [nodeId, label],
  );
}

export async function getNodeCenter(page: Page, nodeId: string) {
  const box = await page.locator(`[data-node-id="${nodeId}"]`).boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
}

/**
 * Right-click an edge and wait for a specific context menu item to appear.
 * Retries up to 5 times because React Flow edge SVGs may not have settled
 * when the bounding box is first captured — the click can land on the pane.
 */
export async function rightClickEdge(
  page: Page,
  menuItemText: string,
) {
  const edgePath = page.locator('.react-flow__edge-interaction').first();
  const menuItem = page.locator('.context-menu-item', { hasText: menuItemText });
  const contextMenu = page.locator('.context-menu');

  // Wait for the edge interaction element to have a stable bounding box
  await edgePath.waitFor({ state: 'attached' });

  for (let attempt = 0; attempt < 5; attempt++) {
    const box = await edgePath.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, { button: 'right' });

    // Soft check: the click may miss the edge entirely (no context menu).
    const menuVisible = await contextMenu.isVisible().catch(() => false);
    if (!menuVisible) {
      // Wait briefly for React Flow to settle before retrying
      await page.waitForTimeout(200);
      continue;
    }

    if (await menuItem.isVisible()) return;
    await page.keyboard.press('Escape');
    await expect(contextMenu).not.toBeVisible();
  }
  // Final attempt — let Playwright's expect fail with a clear message
  await expect(menuItem).toBeVisible();
}
