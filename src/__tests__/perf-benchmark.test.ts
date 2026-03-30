/**
 * Performance benchmarks for critical Sketchy workflows.
 *
 * Each test generates diagrams of increasing size (small / medium / large)
 * and records execution time + memory.  Assertions enforce hard ceilings
 * so regressions are caught in CI.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { DiagramNode, DiagramEdge, Diagram } from '../core/types';
import { createEmptyDiagram } from '../core/types';
import { computeNodeDegrees, getDerivedIndicators, findCausalLoops } from '../core/graph/derived';
import { autoLayout, elkEngine } from '../core/layout';
import { UndoRedoManager } from '../core/history/undo-redo';
import { useDiagramStore } from '../store/diagram-store';
import { crtFramework } from '../frameworks/crt';
import { migrate, validateDiagramShape } from '../core/persistence/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, x = 0, y = 0, tags: string[] = []): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x, y },
    data: { label: `Node ${id}`, tags, junctionType: 'or' },
  };
}

function makeEdge(source: string, target: string, id?: string): DiagramEdge {
  return { id: id ?? `${source}->${target}`, source, target };
}

/** Build a chain: 0→1→2→…→(n-1) */
function buildChain(n: number): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes = Array.from({ length: n }, (_, i) => makeNode(String(i), i * 50, 0));
  const edges = Array.from({ length: n - 1 }, (_, i) =>
    makeEdge(String(i), String(i + 1)),
  );
  return { nodes, edges };
}

/** Build a tree of given depth and branching factor */
function buildTree(depth: number, branching: number): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  let nextId = 0;

  function addLevel(parentId: string, level: number) {
    if (level >= depth) return;
    for (let i = 0; i < branching; i++) {
      const childId = String(nextId++);
      nodes.push(makeNode(childId, nextId * 30, level * 100));
      edges.push(makeEdge(parentId, childId));
      addLevel(childId, level + 1);
    }
  }

  const rootId = String(nextId++);
  nodes.push(makeNode(rootId, 0, 0));
  addLevel(rootId, 1);
  return { nodes, edges };
}

/** Build a graph with cycles for CLD testing */
function buildCyclicGraph(nodeCount: number, cycleSize: number): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes = Array.from({ length: nodeCount }, (_, i) => makeNode(String(i)));
  const edges: DiagramEdge[] = [];

  // Create cycles of the given size
  const numCycles = Math.floor(nodeCount / cycleSize);
  for (let c = 0; c < numCycles; c++) {
    const start = c * cycleSize;
    for (let i = 0; i < cycleSize; i++) {
      const from = String(start + i);
      const to = String(start + ((i + 1) % cycleSize));
      edges.push(makeEdge(from, to));
    }
  }

  return { nodes, edges };
}

/** Build a dense graph with many cross-edges */
function buildDenseGraph(nodeCount: number, edgesPerNode: number): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes = Array.from({ length: nodeCount }, (_, i) =>
    makeNode(String(i), (i % 10) * 60, Math.floor(i / 10) * 80),
  );
  const edges: DiagramEdge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < edgesPerNode; j++) {
      const target = (i + j + 1) % nodeCount;
      if (target === i) continue;
      const key = `${i}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(makeEdge(String(i), String(target)));
    }
  }

  return { nodes, edges };
}

function makeDiagram(nodes: DiagramNode[], edges: DiagramEdge[], frameworkId = 'crt'): Diagram {
  const d = createEmptyDiagram(frameworkId);
  d.nodes = nodes;
  d.edges = edges;
  return d;
}

interface BenchResult {
  label: string;
  timeMs: number;
  memoryKb?: number;
}

const results: BenchResult[] = [];

function bench(label: string, fn: () => void): number {
  // Warm up
  fn();

  const before = performance.now();
  fn();
  const elapsed = performance.now() - before;

  results.push({ label, timeMs: Math.round(elapsed * 100) / 100 });
  return elapsed;
}

async function benchAsync(label: string, fn: () => Promise<void>): Promise<number> {
  // Warm up
  await fn();

  const before = performance.now();
  await fn();
  const elapsed = performance.now() - before;

  results.push({ label, timeMs: Math.round(elapsed * 100) / 100 });
  return elapsed;
}

// ---------------------------------------------------------------------------
// 1. Auto-layout (ELK engine)
// ---------------------------------------------------------------------------

describe('perf: auto-layout (ELK)', () => {
  it('lays out 50-node chain under 200ms', async () => {
    const { nodes, edges } = buildChain(50);
    const t = await benchAsync('layout-50-chain', async () => {
      await autoLayout(nodes, edges, { direction: 'BT' }, elkEngine);
    });
    expect(t).toBeLessThan(200);
  });

  it('lays out 100-node chain under 500ms', async () => {
    const { nodes, edges } = buildChain(100);
    const t = await benchAsync('layout-100-chain', async () => {
      await autoLayout(nodes, edges, { direction: 'BT' }, elkEngine);
    });
    expect(t).toBeLessThan(500);
  });

  it('lays out 500-node chain under 2000ms', async () => {
    const { nodes, edges } = buildChain(500);
    const t = await benchAsync('layout-500-chain', async () => {
      await autoLayout(nodes, edges, { direction: 'BT' }, elkEngine);
    });
    expect(t).toBeLessThan(2000);
  });

  it('lays out binary tree (depth 7, 127 nodes) under 500ms', async () => {
    const { nodes, edges } = buildTree(7, 2); // 2^7 - 1 = 127 nodes
    const t = await benchAsync('layout-127-tree', async () => {
      await autoLayout(nodes, edges, { direction: 'TB' }, elkEngine);
    });
    expect(t).toBeLessThan(500);
  });

  it('lays out dense graph (100 nodes, 3 edges/node) under 500ms', async () => {
    const { nodes, edges } = buildDenseGraph(100, 3);
    const t = await benchAsync('layout-100-dense', async () => {
      await autoLayout(nodes, edges, { direction: 'TB' }, elkEngine);
    });
    expect(t).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// 2. Derived indicator computation
// ---------------------------------------------------------------------------

describe('perf: derived indicators', () => {
  it('computes degrees for 500 nodes / 499 edges under 5ms', () => {
    const { edges } = buildChain(500);
    const t = bench('degrees-500', () => {
      computeNodeDegrees(edges);
    });
    expect(t).toBeLessThan(5);
  });

  it('computes degrees for 1000 nodes / 2000 edges under 10ms', () => {
    const { edges } = buildDenseGraph(1000, 2);
    const t = bench('degrees-1000', () => {
      computeNodeDegrees(edges);
    });
    expect(t).toBeLessThan(10);
  });

  it('computes all derived indicators for 500 nodes under 10ms', () => {
    const { nodes, edges } = buildChain(500);
    const indicators = crtFramework.derivedIndicators;
    const t = bench('derived-500', () => {
      const degreesMap = computeNodeDegrees(edges);
      for (const node of nodes) {
        getDerivedIndicators(node.id, degreesMap, indicators);
      }
    });
    expect(t).toBeLessThan(10);
  });

  it('computes all derived indicators for 1000 nodes under 20ms', () => {
    const { nodes, edges } = buildDenseGraph(1000, 2);
    const indicators = crtFramework.derivedIndicators;
    const t = bench('derived-1000', () => {
      const degreesMap = computeNodeDegrees(edges);
      for (const node of nodes) {
        getDerivedIndicators(node.id, degreesMap, indicators);
      }
    });
    expect(t).toBeLessThan(20);
  });
});

// ---------------------------------------------------------------------------
// 3. Cycle detection (CLD)
// ---------------------------------------------------------------------------

describe('perf: cycle detection', () => {
  it('finds cycles in 20-node graph with 4 cycles of 5 under 50ms', () => {
    const { edges } = buildCyclicGraph(20, 5);
    const t = bench('cycles-20', () => {
      findCausalLoops(edges);
    });
    expect(t).toBeLessThan(50);
  });

  it('finds cycles in 50-node graph with 10 cycles of 5 under 100ms', () => {
    const { edges } = buildCyclicGraph(50, 5);
    const t = bench('cycles-50', () => {
      findCausalLoops(edges);
    });
    expect(t).toBeLessThan(100);
  });

  it('finds cycles in 100-node graph with 25 cycles of 4 under 200ms', () => {
    const { edges } = buildCyclicGraph(100, 4);
    const t = bench('cycles-100', () => {
      findCausalLoops(edges);
    });
    expect(t).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// 4. Autosave (sessionStorage serialization)
// ---------------------------------------------------------------------------

describe('perf: autosave serialization', () => {
  it('serializes 50-node diagram under 5ms', () => {
    const { nodes, edges } = buildChain(50);
    const diagram = makeDiagram(nodes, edges);
    const t = bench('serialize-50', () => {
      JSON.stringify(diagram);
    });
    expect(t).toBeLessThan(5);
  });

  it('serializes 200-node diagram under 10ms', () => {
    const { nodes, edges } = buildChain(200);
    const diagram = makeDiagram(nodes, edges);
    const t = bench('serialize-200', () => {
      JSON.stringify(diagram);
    });
    expect(t).toBeLessThan(10);
  });

  it('serializes 500-node diagram under 20ms', () => {
    const { nodes, edges } = buildChain(500);
    const diagram = makeDiagram(nodes, edges);
    const t = bench('serialize-500', () => {
      JSON.stringify(diagram);
    });
    expect(t).toBeLessThan(20);
  });

  it('round-trips 500-node diagram (serialize + parse) under 30ms', () => {
    const { nodes, edges } = buildChain(500);
    const diagram = makeDiagram(nodes, edges);
    const t = bench('roundtrip-500', () => {
      JSON.parse(JSON.stringify(diagram));
    });
    expect(t).toBeLessThan(30);
  });
});

// ---------------------------------------------------------------------------
// 5. .sky file load + validation + migration
// ---------------------------------------------------------------------------

describe('perf: sky file load pipeline', () => {
  it('validates 200-node diagram shape under 5ms', () => {
    const { nodes, edges } = buildChain(200);
    const diagram = makeDiagram(nodes, edges);
    const raw = JSON.parse(JSON.stringify(diagram));
    const t = bench('validate-200', () => {
      validateDiagramShape(raw);
    });
    expect(t).toBeLessThan(5);
  });

  it('migrates 500-node diagram under 10ms', () => {
    const { nodes, edges } = buildChain(500);
    const diagram = makeDiagram(nodes, edges);
    const raw = JSON.parse(JSON.stringify(diagram)) as Record<string, unknown>;
    const t = bench('migrate-500', () => {
      migrate(raw);
    });
    expect(t).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// 6. Batch AI mutations (store)
// ---------------------------------------------------------------------------

describe('perf: batch mutations (store)', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('crt');
    useDiagramStore.getState().newDiagram();
  });

  it('batchApply adds 50 nodes + 49 edges under 50ms', () => {
    const addNodes = Array.from({ length: 50 }, (_, i) => ({
      id: `ai-${i}`,
      label: `AI Node ${i}`,
    }));
    const addEdges = Array.from({ length: 49 }, (_, i) => ({
      source: `ai-${i}`,
      target: `ai-${i + 1}`,
    }));

    const t = bench('batch-50', () => {
      useDiagramStore.getState().newDiagram();
      useDiagramStore.getState().batchApply({ addNodes, addEdges });
    });
    expect(t).toBeLessThan(50);
  });

  it('batchApply adds 200 nodes + 199 edges under 100ms', () => {
    const addNodes = Array.from({ length: 200 }, (_, i) => ({
      id: `ai-${i}`,
      label: `AI Node ${i}`,
    }));
    const addEdges = Array.from({ length: 199 }, (_, i) => ({
      source: `ai-${i}`,
      target: `ai-${i + 1}`,
    }));

    const t = bench('batch-200', () => {
      useDiagramStore.getState().newDiagram();
      useDiagramStore.getState().batchApply({ addNodes, addEdges });
    });
    expect(t).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// 7. Multi-select bulk delete
// ---------------------------------------------------------------------------

describe('perf: bulk delete', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('crt');
  });

  it('deletes 100 nodes with cascading edge cleanup under 50ms', () => {
    useDiagramStore.getState().newDiagram();
    // Add 100 nodes
    const nodeIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      nodeIds.push(useDiagramStore.getState().addNode({ x: i * 10, y: 0 }));
    }
    // Add edges between consecutive nodes
    for (let i = 0; i < 99; i++) {
      useDiagramStore.getState().addEdge(nodeIds[i], nodeIds[i + 1]);
    }

    const t = bench('delete-100', () => {
      useDiagramStore.getState().deleteNodes(nodeIds);
    });
    expect(t).toBeLessThan(50);
  });

  it('deletes 50 nodes from a 200-node diagram under 50ms', () => {
    useDiagramStore.getState().newDiagram();
    const nodeIds: string[] = [];
    for (let i = 0; i < 200; i++) {
      nodeIds.push(useDiagramStore.getState().addNode({ x: i * 10, y: 0 }));
    }
    for (let i = 0; i < 199; i++) {
      useDiagramStore.getState().addEdge(nodeIds[i], nodeIds[i + 1]);
    }

    const toDelete = nodeIds.slice(0, 50);
    const t = bench('delete-50-of-200', () => {
      useDiagramStore.getState().deleteNodes(toDelete);
    });
    expect(t).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// 8. Undo/redo with large snapshots
// ---------------------------------------------------------------------------

describe('perf: undo/redo snapshots', () => {
  it('pushes 50-snapshot history for a 200-node diagram under 100ms', () => {
    const manager = new UndoRedoManager<{ nodes: DiagramNode[]; edges: DiagramEdge[] }>();
    const { nodes, edges } = buildChain(200);
    const snapshot = { nodes, edges };

    const t = bench('undo-push-50x200', () => {
      for (let i = 0; i < 50; i++) {
        manager.push(snapshot);
      }
    });
    expect(t).toBeLessThan(100);
  });

  it('undo restores a 500-node snapshot under 20ms', () => {
    const manager = new UndoRedoManager<{ nodes: DiagramNode[]; edges: DiagramEdge[] }>();
    const { nodes: n1, edges: e1 } = buildChain(500);
    const { nodes: n2, edges: e2 } = buildChain(500);
    manager.push({ nodes: n1, edges: e1 });

    const t = bench('undo-restore-500', () => {
      manager.undo({ nodes: n2, edges: e2 });
    });
    expect(t).toBeLessThan(20);
  });
});

// ---------------------------------------------------------------------------
// 9. Node dragging simulation (move + edge re-routing)
// ---------------------------------------------------------------------------

describe('perf: node move in store', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('crt');
    useDiagramStore.getState().newDiagram();
  });

  it('moves a single node in a 200-node diagram under 5ms', () => {
    const nodeIds: string[] = [];
    for (let i = 0; i < 200; i++) {
      nodeIds.push(useDiagramStore.getState().addNode({ x: i * 10, y: 0 }));
    }
    for (let i = 0; i < 199; i++) {
      useDiagramStore.getState().addEdge(nodeIds[i], nodeIds[i + 1]);
    }

    const t = bench('move-1-in-200', () => {
      useDiagramStore.getState().moveNodes([
        { id: nodeIds[0], position: { x: 999, y: 999 } },
      ]);
    });
    expect(t).toBeLessThan(5);
  });

  it('moves 50 nodes simultaneously in a 200-node diagram under 10ms', () => {
    const nodeIds: string[] = [];
    for (let i = 0; i < 200; i++) {
      nodeIds.push(useDiagramStore.getState().addNode({ x: i * 10, y: 0 }));
    }
    for (let i = 0; i < 199; i++) {
      useDiagramStore.getState().addEdge(nodeIds[i], nodeIds[i + 1]);
    }

    const moves = nodeIds.slice(0, 50).map((id, i) => ({
      id,
      position: { x: i * 20, y: i * 20 },
    }));

    const t = bench('move-50-in-200', () => {
      useDiagramStore.getState().moveNodes(moves);
    });
    expect(t).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// 10. End-to-end workflow: create → layout → save → load → undo
// ---------------------------------------------------------------------------

describe('perf: full workflow', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('crt');
    useDiagramStore.getState().newDiagram();
  });

  it('full 100-node workflow under 1000ms total', async () => {
    const store = useDiagramStore.getState;

    // 1. Create 100 nodes via batchApply
    const t1Start = performance.now();
    const addNodes = Array.from({ length: 100 }, (_, i) => ({
      id: `n-${i}`,
      label: `Workflow Node ${i}`,
      tags: i % 5 === 0 ? ['ude'] : [],
    }));
    const addEdges = Array.from({ length: 99 }, (_, i) => ({
      source: `n-${i}`,
      target: `n-${i + 1}`,
    }));
    store().batchApply({ addNodes, addEdges });
    const t1 = performance.now() - t1Start;
    results.push({ label: 'workflow-create-100', timeMs: Math.round(t1 * 100) / 100 });

    // 2. Auto-layout
    const { nodes, edges } = store().diagram;
    const t2Start = performance.now();
    const updates = await autoLayout(nodes, edges, { direction: 'BT' }, elkEngine);
    store().moveNodes(updates);
    const t2 = performance.now() - t2Start;
    results.push({ label: 'workflow-layout-100', timeMs: Math.round(t2 * 100) / 100 });

    // 3. Serialize (autosave)
    const t3Start = performance.now();
    const json = JSON.stringify(store().diagram);
    const t3 = performance.now() - t3Start;
    results.push({ label: 'workflow-save-100', timeMs: Math.round(t3 * 100) / 100 });

    // 4. Deserialize + validate (load)
    const t4Start = performance.now();
    const parsed = JSON.parse(json);
    validateDiagramShape(parsed);
    migrate(parsed);
    const t4 = performance.now() - t4Start;
    results.push({ label: 'workflow-load-100', timeMs: Math.round(t4 * 100) / 100 });

    // 5. Derived indicators on all nodes
    const t5Start = performance.now();
    const degreesMap = computeNodeDegrees(store().diagram.edges);
    for (const node of store().diagram.nodes) {
      getDerivedIndicators(node.id, degreesMap, crtFramework.derivedIndicators);
    }
    const t5 = performance.now() - t5Start;
    results.push({ label: 'workflow-derived-100', timeMs: Math.round(t5 * 100) / 100 });

    const total = t1 + t2 + t3 + t4 + t5;
    results.push({ label: 'workflow-total-100', timeMs: Math.round(total * 100) / 100 });

    expect(total).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Print summary table after all tests
// ---------------------------------------------------------------------------

describe('perf: summary', () => {
  it('prints benchmark results', () => {
    if (results.length === 0) return;

    console.log('\n┌──────────────────────────────────────┬───────────┐');
    console.log('│ Benchmark                            │  Time(ms) │');
    console.log('├──────────────────────────────────────┼───────────┤');

    for (const r of results) {
      const name = r.label.padEnd(36);
      const time = String(r.timeMs).padStart(9);
      console.log(`│ ${name} │ ${time} │`);
    }

    console.log('└──────────────────────────────────────┴───────────┘\n');
    expect(results.length).toBeGreaterThan(0);
  });
});
