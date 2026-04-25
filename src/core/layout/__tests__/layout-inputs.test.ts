import { describe, expect, it } from 'vitest';
import { prepareLayoutEdges, prepareLayoutNodes } from '../layout-inputs';
import { NODE_WIDTH, estimateHeight } from '../layout-engine';
import type { DiagramEdge, DiagramNode } from '../../types';

function makeNode(id: string, overrides?: Partial<DiagramNode>): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label: id, tags: [], junctionType: 'or' },
    ...overrides,
  };
}

function makeEdge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target };
}

describe('prepareLayoutNodes', () => {
  it('sets width to NODE_WIDTH for all nodes', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const result = prepareLayoutNodes(nodes, []);
    for (const input of result) {
      expect(input.width).toBe(NODE_WIDTH);
    }
  });

  it('uses measured node size when available', () => {
    const nodes = [makeNode('a', { size: { width: 210, height: 96 } })];
    const result = prepareLayoutNodes(nodes, []);
    expect(result[0].width).toBe(210);
    expect(result[0].height).toBe(96);
  });

  it('estimates height from label length', () => {
    const longLabel = 'A'.repeat(90); // 3 lines worth
    const nodes = [makeNode('a', { data: { label: longLabel, tags: [], junctionType: 'or' } })];
    const result = prepareLayoutNodes(nodes, []);
    // Root node (indegree=0, outdegree=0) has no badges — isolated
    expect(result[0].height).toBe(estimateHeight(longLabel, false));
  });

  it('adds badge height for nodes with tags', () => {
    const nodes = [makeNode('a', { data: { label: 'test', tags: ['ude'], junctionType: 'or' } })];
    const result = prepareLayoutNodes(nodes, []);
    expect(result[0].height).toBe(estimateHeight('test', true));
  });

  it('adds badge height for intermediate nodes (indegree>0 and outdegree>0)', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    const result = prepareLayoutNodes(nodes, edges);
    const bNode = result.find((n) => n.id === 'b')!;
    expect(bNode.height).toBe(estimateHeight('b', true));
  });

  it('adds badge height for root-cause nodes (indegree=0, outdegree>0)', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const result = prepareLayoutNodes(nodes, edges);
    const aNode = result.find((n) => n.id === 'a')!;
    expect(aNode.height).toBe(estimateHeight('a', true));
  });

  it('preserves position from the original node', () => {
    const nodes = [makeNode('a', { position: { x: 100, y: 200 } })];
    const result = prepareLayoutNodes(nodes, []);
    expect(result[0].position).toEqual({ x: 100, y: 200 });
  });

  it('passes locked flag through', () => {
    const nodes = [makeNode('a', { data: { label: 'a', tags: [], junctionType: 'or', locked: true } })];
    const result = prepareLayoutNodes(nodes, []);
    expect(result[0].locked).toBe(true);
  });
});

describe('prepareLayoutEdges', () => {
  it('maps DiagramEdge to LayoutEdgeInput', () => {
    const edges: DiagramEdge[] = [
      { id: 'e1', source: 'a', target: 'b', confidence: 'high', notes: 'test' },
    ];
    const result = prepareLayoutEdges(edges);
    expect(result).toEqual([{ source: 'a', target: 'b' }]);
  });

  it('returns empty array for no edges', () => {
    expect(prepareLayoutEdges([])).toEqual([]);
  });

  it('preserves edge order', () => {
    const edges = [makeEdge('c', 'd'), makeEdge('a', 'b')];
    const result = prepareLayoutEdges(edges);
    expect(result[0].source).toBe('c');
    expect(result[1].source).toBe('a');
  });
});
