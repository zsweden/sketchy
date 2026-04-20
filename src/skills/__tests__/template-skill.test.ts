import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTemplateSkill } from '../apply-template-skill';
import { useDiagramStore } from '../../store/diagram-store';
import { getSkillsForFramework } from '../registry';
import type { TemplateSkill } from '../../core/skill-types';

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({ getInternalNode: vi.fn(() => undefined) }),
  };
});

function ecTemplateSkill(): TemplateSkill {
  return {
    id: 'test-ec-template',
    kind: 'template',
    name: 'Insert EC Template',
    startingFramework: 'evaporating-cloud',
    template: {
      layoutDirection: 'RL',
      nodes: [
        { id: 'a',  label: 'A', tags: ['objective'],    x: 10,  y: 72 },
        { id: 'c',  label: 'C', tags: ['requirement'],  x: 252, y: 12 },
        { id: 'b',  label: 'B', tags: ['requirement'],  x: 252, y: 132 },
        { id: 'dp', label: "D'", tags: ['prerequisite'], x: 492, y: 12 },
        { id: 'd',  label: 'D', tags: ['prerequisite'], x: 492, y: 132 },
      ],
      edges: [
        { source: 'd',  target: 'b', sourceSide: 'left', targetSide: 'right' },
        { source: 'dp', target: 'c', sourceSide: 'left', targetSide: 'right' },
        { source: 'b',  target: 'a', sourceSide: 'left', targetSide: 'bottomright-right' },
        { source: 'c',  target: 'a', sourceSide: 'left', targetSide: 'topright-right' },
        { source: 'd',  target: 'dp', sourceSide: 'top', targetSide: 'bottom', edgeTag: 'conflict' },
      ],
    },
  };
}

describe('deterministic template skill', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('evaporating-cloud');
    useDiagramStore.getState().newDiagram();
  });

  it('places nodes at exact template positions', () => {
    applyTemplateSkill(ecTemplateSkill());
    const nodes = useDiagramStore.getState().diagram.nodes;
    expect(nodes).toHaveLength(5);
    const byLabel = new Map(nodes.map((n) => [n.data.label, n]));
    expect(byLabel.get('A')!.position).toEqual({ x: 10, y: 72 });
    expect(byLabel.get('B')!.position).toEqual({ x: 252, y: 132 });
    expect(byLabel.get('C')!.position).toEqual({ x: 252, y: 12 });
    expect(byLabel.get('D')!.position).toEqual({ x: 492, y: 132 });
    expect(byLabel.get("D'")!.position).toEqual({ x: 492, y: 12 });
  });

  it('preserves edge handle sides', () => {
    applyTemplateSkill(ecTemplateSkill());
    const state = useDiagramStore.getState().diagram;
    const nodeId = (label: string) => state.nodes.find((n) => n.data.label === label)!.id;
    const conflict = state.edges.find((e) => e.edgeTag === 'conflict')!;
    expect(conflict.source).toBe(nodeId('D'));
    expect(conflict.target).toBe(nodeId("D'"));
    expect(conflict.sourceSide).toBe('top');
    expect(conflict.targetSide).toBe('bottom');

    const bToA = state.edges.find((e) => e.source === nodeId('B') && e.target === nodeId('A'))!;
    expect(bToA.targetSide).toBe('bottomright-right');
  });

  it('applies the template layout direction', () => {
    applyTemplateSkill(ecTemplateSkill());
    expect(useDiagramStore.getState().diagram.settings.layoutDirection).toBe('RL');
  });

  it('replaces existing diagram content rather than appending', () => {
    useDiagramStore.getState().addNode({ x: 0, y: 0 });
    expect(useDiagramStore.getState().diagram.nodes.length).toBe(1);

    applyTemplateSkill(ecTemplateSkill());

    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(5);
    expect(useDiagramStore.getState().diagram.nodes.every((n) => n.data.label !== '')).toBe(true);
  });

  it('ships an EC template skill in the registry', () => {
    const skills = getSkillsForFramework('evaporating-cloud');
    const template = skills.find((s) => s.kind === 'template');
    expect(template).toBeDefined();
    expect(template!.id).toBe('evaporating-cloud-template');
  });

  it('registry still loads all AI best-practices skills unchanged', () => {
    const crtSkills = getSkillsForFramework('crt');
    const bp = crtSkills.find((s) => s.id === 'crt-best-practices');
    expect(bp).toBeDefined();
    expect(bp!.kind).toBe('ai');
  });
});
