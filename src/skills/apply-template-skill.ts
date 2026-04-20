import type { TemplateSkill } from '../core/skill-types';
import type { BatchMutations } from '../store/diagram-store-types';
import { useDiagramStore } from '../store/diagram-store';

/**
 * Apply a deterministic template skill to the current diagram.
 * Nodes/edges are batch-added with placeholder IDs that the store maps to UUIDs,
 * then auto-layout positions them.
 */
export async function applyTemplateSkill(skill: TemplateSkill): Promise<void> {
  const { template } = skill;

  const mutations: BatchMutations = {
    addNodes: template.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      tags: n.tags,
      notes: n.notes,
      junctionType: n.junctionType,
    })),
    addEdges: template.edges.map((e) => ({
      source: e.source,
      target: e.target,
      edgeTag: e.edgeTag,
      notes: e.notes,
      polarity: e.polarity,
      confidence: e.confidence,
    })),
  };

  useDiagramStore.getState().batchApply(mutations);
  await useDiagramStore.getState().runAutoLayout({ fitView: true });
}
