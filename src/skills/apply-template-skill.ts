import type { TemplateSkill } from '../core/skill-types';
import { SCHEMA_VERSION, type Diagram, type DiagramEdge, type DiagramNode } from '../core/types';
import { useDiagramStore } from '../store/diagram-store';
import { getDefaultJunctionType, getJunctionOptions } from '../core/framework-types';
import { getFramework } from '../frameworks/registry';

/**
 * Apply a deterministic template skill by constructing a full Diagram from the
 * template's explicit positions and edge handle sides, then calling loadDiagram.
 * Unlike AI skills (which mutate additively), templates replace the current
 * diagram wholesale to guarantee pixel-perfect fidelity.
 */
export function applyTemplateSkill(skill: TemplateSkill): void {
  const state = useDiagramStore.getState();
  const diagram = state.diagram;
  const framework = getFramework(skill.startingFramework);
  if (!framework) {
    throw new Error(`Template skill references unknown framework: ${skill.startingFramework}`);
  }

  const junctionOptions = getJunctionOptions(framework);
  const defaultJunction = junctionOptions.length > 0 ? getDefaultJunctionType(framework) : 'or';

  const idMap = new Map<string, string>();
  for (const n of skill.template.nodes) {
    idMap.set(n.id, crypto.randomUUID());
  }

  const nodes: DiagramNode[] = skill.template.nodes.map((n) => ({
    id: idMap.get(n.id)!,
    type: 'entity',
    position: { x: n.x, y: n.y },
    data: {
      label: n.label,
      tags: n.tags ?? [],
      junctionType: (n.junctionType ?? defaultJunction) as DiagramNode['data']['junctionType'],
      ...(n.notes ? { notes: n.notes } : {}),
    },
  }));

  const edges: DiagramEdge[] = skill.template.edges.map((e) => {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    if (!source || !target) {
      throw new Error(`Template edge references unknown node id: ${e.source} → ${e.target}`);
    }
    return {
      id: crypto.randomUUID(),
      source,
      target,
      ...(e.sourceSide ? { sourceSide: e.sourceSide } : {}),
      ...(e.targetSide ? { targetSide: e.targetSide } : {}),
      ...(e.edgeTag ? { edgeTag: e.edgeTag } : {}),
      ...(e.notes ? { notes: e.notes } : {}),
      ...(framework.supportsEdgePolarity ? { polarity: e.polarity ?? 'positive' } : {}),
      ...(e.confidence && e.confidence !== 'high' ? { confidence: e.confidence } : {}),
    };
  });

  const nextDiagram: Diagram = {
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: diagram.name,
    frameworkId: skill.startingFramework,
    settings: {
      ...diagram.settings,
      layoutDirection: skill.template.layoutDirection ?? framework.defaultLayoutDirection,
    },
    nodes,
    edges,
  };

  useDiagramStore.getState().loadDiagram(nextDiagram);
}
