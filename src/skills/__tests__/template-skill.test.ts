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
      nodes: [
        { id: 'a', label: 'A', tags: ['objective'] },
        { id: 'b', label: 'B', tags: ['requirement'] },
        { id: 'c', label: 'C', tags: ['requirement'] },
        { id: 'd', label: 'D', tags: ['prerequisite'] },
        { id: 'dp', label: "D'", tags: ['prerequisite'] },
      ],
      edges: [
        { source: 'd', target: 'b' },
        { source: 'dp', target: 'c' },
        { source: 'b', target: 'a' },
        { source: 'c', target: 'a' },
        { source: 'd', target: 'dp', edgeTag: 'conflict' },
      ],
    },
  };
}

describe('deterministic template skill', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('evaporating-cloud');
    useDiagramStore.getState().newDiagram();
  });

  it('adds all template nodes with their tags', async () => {
    await applyTemplateSkill(ecTemplateSkill());
    const nodes = useDiagramStore.getState().diagram.nodes;
    expect(nodes).toHaveLength(5);
    const labelToTags = new Map(nodes.map((n) => [n.data.label, n.data.tags]));
    expect(labelToTags.get('A')).toEqual(['objective']);
    expect(labelToTags.get('B')).toEqual(['requirement']);
    expect(labelToTags.get('D')).toEqual(['prerequisite']);
  });

  it('wires all 5 edges with the conflict edge tagged', async () => {
    await applyTemplateSkill(ecTemplateSkill());
    const state = useDiagramStore.getState().diagram;
    expect(state.edges).toHaveLength(5);
    const taggedEdges = state.edges.filter((e) => e.edgeTag === 'conflict');
    expect(taggedEdges).toHaveLength(1);
    const labelOf = (id: string) => state.nodes.find((n) => n.id === id)!.data.label;
    expect(new Set([labelOf(taggedEdges[0].source), labelOf(taggedEdges[0].target)]))
      .toEqual(new Set(['D', "D'"]));
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
