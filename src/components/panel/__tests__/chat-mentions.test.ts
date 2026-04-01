import { describe, expect, it } from 'vitest';
import type { NamedCausalLoop } from '../../../core/graph/derived';
import type { DiagramEdge, DiagramNode } from '../../../core/types';
import {
  getChatMessageDisplayText,
  normalizeChatMessageMentions,
  parseChatMessageMentions,
} from '../chat-mentions';

const nodes: DiagramNode[] = [
  { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Demand', tags: [], junctionType: 'or' } },
  { id: 'n2', type: 'entity', position: { x: 0, y: 80 }, data: { label: 'Growth', tags: [], junctionType: 'or' } },
];

const edges: DiagramEdge[] = [
  { id: 'e1', source: 'n1', target: 'n2' },
];

const loops: NamedCausalLoop[] = [
  {
    id: 'n1>n2',
    label: 'R1',
    nodeIds: ['n1', 'n2'],
    edgeIds: ['e1'],
    kind: 'reinforcing',
    negativeEdgeCount: 0,
    delayedEdgeCount: 0,
  },
];

describe('parseChatMessageMentions', () => {
  it('extracts node, edge, and loop mentions from mixed prose', () => {
    const segments = parseChatMessageMentions(
      '[Demand][node:n1] strengthens [Demand -> Growth][edge:e1] through [R1][loop:n1>n2].',
      nodes,
      edges,
      loops,
    );

    expect(segments).toEqual([
      {
        type: 'mention',
        displayText: 'Demand',
        rawText: '[Demand][node:n1]',
        mention: { kind: 'node', id: 'n1', displayText: 'Demand', rawText: '[Demand][node:n1]' },
      },
      { type: 'text', text: ' strengthens ' },
      {
        type: 'mention',
        displayText: 'Demand -> Growth',
        rawText: '[Demand -> Growth][edge:e1]',
        mention: { kind: 'edge', id: 'e1', displayText: 'Demand -> Growth', rawText: '[Demand -> Growth][edge:e1]' },
      },
      { type: 'text', text: ' through ' },
      {
        type: 'mention',
        displayText: 'R1',
        rawText: '[R1][loop:n1>n2]',
        mention: { kind: 'loop', id: 'n1>n2', displayText: 'R1', rawText: '[R1][loop:n1>n2]' },
      },
      { type: 'text', text: '.' },
    ]);
  });

  it('leaves malformed or stale mentions as plain text', () => {
    const segments = parseChatMessageMentions(
      '[Demand][node:missing] and [Growth][edge:missing] stay plain.',
      nodes,
      edges,
      loops,
    );

    expect(segments).toEqual([
      { type: 'text', text: '[Demand][node:missing] and [Growth][edge:missing] stay plain.' },
    ]);
  });

  it('treats legacy inline syntax as plain text', () => {
    const segments = parseChatMessageMentions(
      'Label[node:n1] drives Source -> Target[edge:e1].',
      nodes,
      edges,
      loops,
    );

    expect(segments).toEqual([
      { type: 'text', text: 'Label[node:n1] drives Source -> Target[edge:e1].' },
    ]);
  });

  it('preserves canonical mention text during normalization', () => {
    const normalized = normalizeChatMessageMentions(
      '[Demand][node:n1] drives [Demand -> Growth][edge:e1].',
      nodes,
      edges,
      loops,
    );

    expect(normalized).toBe('[Demand][node:n1] drives [Demand -> Growth][edge:e1].');
  });

  it('returns rendered display text for canonical mentions', () => {
    const displayText = getChatMessageDisplayText(
      '[Demand][node:n1] drives [Demand -> Growth][edge:e1] in [R1][loop:n1>n2].',
      nodes,
      edges,
      loops,
    );

    expect(displayText).toBe('Demand drives Demand -> Growth in R1.');
  });
});
