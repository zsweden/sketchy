import { describe, it, expect } from 'vitest';
import {
  isSelfLoop,
  isDuplicateEdge,
  wouldCreateCycle,
  validateEdge,
  validateGraph,
} from '../validation';
import type { DiagramEdge, DiagramNode } from '../../types';

function edge(id: string, source: string, target: string): DiagramEdge {
  return { id, source, target };
}

function node(id: string): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label: id, tags: [], junctionType: 'and' },
  };
}

describe('isSelfLoop', () => {
  it('detects A→A', () => {
    expect(isSelfLoop('a', 'a')).toBe(true);
  });

  it('allows A→B', () => {
    expect(isSelfLoop('a', 'b')).toBe(false);
  });
});

describe('isDuplicateEdge', () => {
  it('detects existing A→B', () => {
    const edges = [edge('1', 'a', 'b')];
    expect(isDuplicateEdge(edges, 'a', 'b')).toBe(true);
  });

  it('allows reverse B→A', () => {
    const edges = [edge('1', 'a', 'b')];
    expect(isDuplicateEdge(edges, 'b', 'a')).toBe(false);
  });

  it('allows different target', () => {
    const edges = [edge('1', 'a', 'b')];
    expect(isDuplicateEdge(edges, 'a', 'c')).toBe(false);
  });
});

describe('wouldCreateCycle', () => {
  it('detects direct cycle A→B, adding B→A', () => {
    const edges = [edge('1', 'a', 'b')];
    expect(wouldCreateCycle(edges, 'b', 'a')).toBe(true);
  });

  it('detects transitive cycle A→B→C, adding C→A', () => {
    const edges = [edge('1', 'a', 'b'), edge('2', 'b', 'c')];
    expect(wouldCreateCycle(edges, 'c', 'a')).toBe(true);
  });

  it('allows C→D in chain A→B→C', () => {
    const edges = [edge('1', 'a', 'b'), edge('2', 'b', 'c')];
    expect(wouldCreateCycle(edges, 'c', 'd')).toBe(false);
  });

  it('allows diamond shape without cycle', () => {
    const edges = [
      edge('1', 'a', 'b'),
      edge('2', 'a', 'c'),
      edge('3', 'b', 'd'),
    ];
    expect(wouldCreateCycle(edges, 'c', 'd')).toBe(false);
  });
});

describe('validateEdge', () => {
  it('rejects self-loop', () => {
    const result = validateEdge([], 'a', 'a');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('itself');
  });

  it('rejects duplicate', () => {
    const result = validateEdge([edge('1', 'a', 'b')], 'a', 'b');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('already exists');
  });

  it('rejects cycle', () => {
    const edges = [edge('1', 'a', 'b'), edge('2', 'b', 'c')];
    const result = validateEdge(edges, 'c', 'a');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('cycle');
  });

  it('accepts valid edge', () => {
    const result = validateEdge([edge('1', 'a', 'b')], 'b', 'c');
    expect(result.valid).toBe(true);
  });

  it('allows cycle when explicitly enabled', () => {
    const edges = [edge('1', 'a', 'b'), edge('2', 'b', 'c')];
    const result = validateEdge(edges, 'c', 'a', { allowCycles: true });
    expect(result.valid).toBe(true);
  });
});

describe('validateGraph', () => {
  it('passes valid graph', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('1', 'a', 'b'), edge('2', 'b', 'c')];
    const result = validateGraph(nodes, edges);
    expect(result.valid).toBe(true);
    expect(result.droppedEdges).toHaveLength(0);
  });

  it('drops edge referencing non-existent node', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('1', 'a', 'b'), edge('2', 'a', 'z')];
    const result = validateGraph(nodes, edges);
    expect(result.valid).toBe(false);
    expect(result.droppedEdges).toHaveLength(1);
    expect(result.droppedEdges[0].id).toBe('2');
  });

  it('drops duplicate edges', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('1', 'a', 'b'), edge('2', 'a', 'b')];
    const result = validateGraph(nodes, edges);
    expect(result.droppedEdges).toHaveLength(1);
    expect(result.droppedEdges[0].id).toBe('2');
  });

  it('drops cyclic edges', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [
      edge('1', 'a', 'b'),
      edge('2', 'b', 'c'),
      edge('3', 'c', 'a'),
    ];
    const result = validateGraph(nodes, edges);
    expect(result.droppedEdges).toHaveLength(1);
    expect(result.droppedEdges[0].id).toBe('3');
  });

  it('preserves cyclic edges when cycles are allowed', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [
      edge('1', 'a', 'b'),
      edge('2', 'b', 'c'),
      edge('3', 'c', 'a'),
    ];
    const result = validateGraph(nodes, edges, { allowCycles: true });
    expect(result.valid).toBe(true);
    expect(result.droppedEdges).toHaveLength(0);
  });
});
