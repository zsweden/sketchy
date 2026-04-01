import { describe, expect, it } from 'vitest';
import type { Diagram } from '../../core/types';
import { createEmptyDiagram } from '../../core/types';
import {
  deriveDiagramFromTransition,
  deriveDiagramName,
  getNextDiagramTransition,
  listDiagramTransitions,
} from '../registry';

function makeDiagram(frameworkId: string, name = 'ConvoyChurn'): Diagram {
  return {
    ...createEmptyDiagram(frameworkId),
    name,
    nodes: [],
    edges: [],
  };
}

describe('diagram transitions registry', () => {
  it('exposes only the canonical adjacent transitions', () => {
    const transitions = listDiagramTransitions();
    expect(transitions.map((transition) => transition.id)).toEqual([
      'crt_to_frt',
      'frt_to_prt',
      'prt_to_stt',
    ]);
  });

  it('returns a next transition only for supported workflow types', () => {
    expect(getNextDiagramTransition('crt')?.id).toBe('crt_to_frt');
    expect(getNextDiagramTransition('frt')?.id).toBe('frt_to_prt');
    expect(getNextDiagramTransition('prt')?.id).toBe('prt_to_stt');
    expect(getNextDiagramTransition('stt')).toBeUndefined();
    expect(getNextDiagramTransition('goal-tree')).toBeUndefined();
    expect(getNextDiagramTransition('success-tree')).toBeUndefined();
    expect(getNextDiagramTransition('cld')).toBeUndefined();
  });
});

describe('deriveDiagramName', () => {
  it('appends the target suffix when the name has no framework suffix', () => {
    expect(deriveDiagramName('ConvoyChurn', 'frt')).toBe('ConvoyChurn_FRT');
  });

  it('replaces an existing workflow suffix', () => {
    expect(deriveDiagramName('ConvoyChurn_CRT', 'prt')).toBe('ConvoyChurn_PRT');
  });

  it('strips a .sky extension before appending the target suffix', () => {
    expect(deriveDiagramName('ConvoyChurn.sky', 'frt')).toBe('ConvoyChurn_FRT');
  });
});

describe('deterministic derivation rules', () => {
  it('maps CRT nodes into an FRT scaffold', () => {
    const source = makeDiagram('crt', 'ConvoyChurn_CRT');
    source.nodes = [
      {
        id: 'n1',
        type: 'entity',
        position: { x: 0, y: 0 },
        data: { label: 'Poor onboarding', tags: ['ude'], junctionType: 'or', notes: 'fix this' },
      },
      {
        id: 'n2',
        type: 'entity',
        position: { x: 0, y: 120 },
        data: { label: 'Churn rises', tags: ['ude'], junctionType: 'or' },
      },
      {
        id: 'n3',
        type: 'entity',
        position: { x: 0, y: 240 },
        data: { label: 'Managers overloaded', tags: [], junctionType: 'and', color: '#111111' },
      },
    ];
    source.edges = [
      { id: 'e1', source: 'n1', target: 'n2', notes: 'causal note' },
      { id: 'e2', source: 'n3', target: 'n2', confidence: 'low' },
    ];

    const result = deriveDiagramFromTransition(source, 'crt_to_frt');
    expect(result).not.toBeNull();
    expect(result!.diagram.frameworkId).toBe('frt');
    expect(result!.diagram.name).toBe('ConvoyChurn_FRT');
    expect(result!.diagram.settings.layoutDirection).toBe('BT');

    expect(result!.diagram.nodes).toEqual([
      expect.objectContaining({
        id: 'n1',
        data: expect.objectContaining({
          label: 'Injection: address Poor onboarding',
          tags: ['injection'],
          notes: 'fix this',
        }),
      }),
      expect.objectContaining({
        id: 'n2',
        data: expect.objectContaining({
          label: 'Desired outcome: Churn rises',
          tags: ['de'],
        }),
      }),
      expect.objectContaining({
        id: 'n3',
        data: expect.objectContaining({
          label: 'Injection: address Managers overloaded',
          tags: ['injection'],
          junctionType: 'and',
          color: '#111111',
        }),
      }),
    ]);
    expect(result!.diagram.edges).toEqual([
      expect.objectContaining({ id: 'e1', source: 'n1', target: 'n2', notes: 'causal note' }),
      expect.objectContaining({ id: 'e2', source: 'n3', target: 'n2', confidence: 'low' }),
    ]);
  });

  it('maps FRT nodes into a PRT scaffold', () => {
    const source = makeDiagram('frt', 'ConvoyChurn_FRT');
    source.nodes = [
      {
        id: 'n1',
        type: 'entity',
        position: { x: 0, y: 0 },
        data: { label: 'Weekly planning lock', tags: ['injection'], junctionType: 'or' },
      },
      {
        id: 'n2',
        type: 'entity',
        position: { x: 0, y: 120 },
        data: { label: 'Predictable delivery', tags: ['de'], junctionType: 'or' },
      },
    ];
    source.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

    const result = deriveDiagramFromTransition(source, 'frt_to_prt');
    expect(result).not.toBeNull();
    expect(result!.diagram.frameworkId).toBe('prt');
    expect(result!.diagram.name).toBe('ConvoyChurn_PRT');
    expect(result!.diagram.nodes.find((node) => node.id === 'n1')?.data.tags).toEqual(['io']);
    expect(result!.diagram.nodes.find((node) => node.id === 'n2')?.data.tags).toEqual(['goal']);
    expect(result!.diagram.edges).toEqual([
      expect.objectContaining({ id: 'e1', source: 'n1', target: 'n2' }),
    ]);
  });

  it('maps PRT nodes into an STT scaffold and reverses edges', () => {
    const source = makeDiagram('prt', 'ConvoyChurn_PRT');
    source.nodes = [
      {
        id: 'n1',
        type: 'entity',
        position: { x: 0, y: 0 },
        data: { label: 'Create onboarding checklist', tags: ['obstacle'], junctionType: 'or' },
      },
      {
        id: 'n2',
        type: 'entity',
        position: { x: 0, y: 120 },
        data: { label: 'Managers use checklist', tags: ['io'], junctionType: 'or', notes: 'kept' },
      },
      {
        id: 'n3',
        type: 'entity',
        position: { x: 0, y: 240 },
        data: { label: 'Reduce churn', tags: ['goal'], junctionType: 'or' },
      },
    ];
    source.edges = [
      { id: 'e1', source: 'n1', target: 'n2', notes: 'obstacle to io' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ];

    const result = deriveDiagramFromTransition(source, 'prt_to_stt');
    expect(result).not.toBeNull();
    expect(result!.diagram.frameworkId).toBe('stt');
    expect(result!.diagram.name).toBe('ConvoyChurn_STT');
    expect(result!.diagram.settings.layoutDirection).toBe('TB');
    expect(result!.diagram.nodes.find((node) => node.id === 'n1')?.data.tags).toEqual(['tactic']);
    expect(result!.diagram.nodes.find((node) => node.id === 'n2')?.data.tags).toEqual(['strategy']);
    expect(result!.diagram.nodes.find((node) => node.id === 'n3')?.data.tags).toEqual(['objective']);
    expect(result!.diagram.nodes.find((node) => node.id === 'n2')?.data.notes).toBe('kept');
    expect(result!.diagram.edges).toEqual([
      expect.objectContaining({ id: 'e1', source: 'n2', target: 'n1', notes: 'obstacle to io' }),
      expect.objectContaining({ id: 'e2', source: 'n3', target: 'n2' }),
    ]);
  });
});
