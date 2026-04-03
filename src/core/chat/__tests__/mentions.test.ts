import { describe, expect, it } from 'vitest';
import type { NamedCausalLoop } from '../../graph/derived';
import type { DiagramEdge, DiagramNode } from '../../types';
import {
  buildChatMessageRenderData,
  getChatMessageDisplayText,
  getStreamingChatMessageDisplayText,
  remapCanonicalMentionIds,
} from '../mentions';

function makeNode(id: string, label: string): DiagramNode {
  return { id, type: 'entity', position: { x: 0, y: 0 }, data: { label, tags: [], junctionType: 'or' } };
}

function makeEdge(id: string, source: string, target: string): DiagramEdge {
  return { id, source, target };
}

function makeLoop(id: string, label: string, nodeIds: string[], edgeIds: string[]): NamedCausalLoop {
  return { id, label, nodeIds, edgeIds, kind: 'reinforcing', negativeEdgeCount: 0, delayedEdgeCount: 0 };
}

const nodes = [makeNode('n1', 'Demand'), makeNode('n2', 'Growth'), makeNode('n3', '')];
const edges = [makeEdge('e1', 'n1', 'n2'), makeEdge('e2', 'n1', 'n3'), makeEdge('e3', 'n3', 'n3')];
const loops = [makeLoop('loop1', 'R1', ['n1', 'n2'], ['e1'])];

describe('buildChatMessageRenderData', () => {
  it('returns segments, displayText, normalizedText, and malformedMentionCount', () => {
    const result = buildChatMessageRenderData(
      '[Demand][node:n1] drives [Growth][node:n2].',
      nodes, edges, loops,
    );

    expect(result.displayText).toBe('Demand drives Growth.');
    expect(result.normalizedText).toBe('[Demand][node:n1] drives [Growth][node:n2].');
    expect(result.malformedMentionCount).toBe(0);
    expect(result.segments).toHaveLength(4);
  });

  it('counts malformed mentions referencing nonexistent IDs', () => {
    const result = buildChatMessageRenderData(
      '[Demand][node:n1] and [Gone][node:deleted] and [Also Gone][edge:deleted2].',
      nodes, edges, loops,
    );

    expect(result.malformedMentionCount).toBe(2);
    expect(result.displayText).toBe('Demand and [Gone][node:deleted] and [Also Gone][edge:deleted2].');
  });

  it('handles plain text with no mentions', () => {
    const result = buildChatMessageRenderData('just plain text', nodes, edges, loops);

    expect(result.segments).toEqual([{ type: 'text', text: 'just plain text' }]);
    expect(result.displayText).toBe('just plain text');
    expect(result.normalizedText).toBe('just plain text');
    expect(result.malformedMentionCount).toBe(0);
  });

  it('handles empty string', () => {
    const result = buildChatMessageRenderData('', nodes, edges, loops);

    expect(result.segments).toEqual([{ type: 'text', text: '' }]);
    expect(result.malformedMentionCount).toBe(0);
  });
});

describe('remapCanonicalMentionIds', () => {
  it('remaps IDs in canonical mention syntax', () => {
    const idMap = new Map([['n1', 'new-n1'], ['e1', 'new-e1']]);
    const result = remapCanonicalMentionIds(
      '[Demand][node:n1] drives [Demand -> Growth][edge:e1].',
      idMap,
    );

    expect(result).toBe('[Demand][node:new-n1] drives [Demand -> Growth][edge:new-e1].');
  });

  it('leaves mentions unchanged when ID is not in the map', () => {
    const idMap = new Map([['n1', 'new-n1']]);
    const result = remapCanonicalMentionIds(
      '[Demand][node:n1] and [Growth][node:n2].',
      idMap,
    );

    expect(result).toBe('[Demand][node:new-n1] and [Growth][node:n2].');
  });

  it('handles text with no mentions', () => {
    const idMap = new Map([['n1', 'new-n1']]);
    expect(remapCanonicalMentionIds('no mentions here', idMap)).toBe('no mentions here');
  });

  it('remaps loop mention IDs', () => {
    const idMap = new Map([['loop1', 'new-loop1']]);
    const result = remapCanonicalMentionIds('[R1][loop:loop1] is key.', idMap);

    expect(result).toBe('[R1][loop:new-loop1] is key.');
  });
});

describe('edge display label fallbacks', () => {
  it('resolves edge display text from source and target node labels', () => {
    const displayText = getChatMessageDisplayText(
      '[][edge:e1]',
      nodes, edges, loops,
    );

    expect(displayText).toBe('Demand -> Growth');
  });

  it('uses "node" placeholder when source has no label', () => {
    // e3 is n3 -> n3, and n3 has an empty label
    const displayText = getChatMessageDisplayText(
      '[][edge:e3]',
      nodes, edges, loops,
    );

    expect(displayText).toBe('edge');
  });

  it('uses "node" placeholder when one side has no label', () => {
    // e2 is n1 -> n3, n3 has empty label
    const displayText = getChatMessageDisplayText(
      '[][edge:e2]',
      nodes, edges, loops,
    );

    expect(displayText).toBe('Demand -> node');
  });

  it('falls back to loop label from diagram data', () => {
    const displayText = getChatMessageDisplayText(
      '[][loop:loop1]',
      nodes, edges, loops,
    );

    expect(displayText).toBe('R1');
  });

  it('falls back to "loop" when loop has no label', () => {
    const emptyLoops = [makeLoop('loop2', '', ['n1'], ['e1'])];
    const displayText = getChatMessageDisplayText(
      '[][loop:loop2]',
      nodes, edges, emptyLoops,
    );

    expect(displayText).toBe('loop');
  });
});

describe('getStreamingChatMessageDisplayText', () => {
  it('passes through regular brackets that are not mentions', () => {
    expect(getStreamingChatMessageDisplayText('array[0] and obj[key]'))
      .toBe('array[0] and obj[key]');
  });

  it('hides incomplete mention with kind prefix only', () => {
    expect(getStreamingChatMessageDisplayText('See [Demand][nod'))
      .toBe('See ');
  });

  it('hides incomplete mention with kind and colon but no closing bracket', () => {
    expect(getStreamingChatMessageDisplayText('See [Demand][node:n'))
      .toBe('See ');
  });

  it('does not hide brackets that cannot be a mention prefix', () => {
    expect(getStreamingChatMessageDisplayText('See [Demand][xyz'))
      .toBe('See [Demand][xyz');
  });

  it('handles multiple complete mentions in streaming text', () => {
    expect(getStreamingChatMessageDisplayText(
      '[Demand][node:n1] and [Growth][node:n2] are key.',
    )).toBe('Demand and Growth are key.');
  });

  it('handles complete mention followed by incomplete one', () => {
    expect(getStreamingChatMessageDisplayText(
      '[Demand][node:n1] and [Growth][node:',
    )).toBe('Demand and ');
  });

  it('handles empty input', () => {
    expect(getStreamingChatMessageDisplayText('')).toBe('');
  });
});
