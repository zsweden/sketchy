import type { DiagramModification } from '../core/ai/openai-client';
import type { BatchMutations } from './diagram-store-types';
import { useDiagramStore } from './diagram-store';
import { useChatStore } from './chat-store';

function shouldAutoLayout(mods: DiagramModification): boolean {
  return mods.addNodes.length > 0
    || mods.removeNodeIds.length > 0
    || mods.addEdges.length > 0
    || mods.removeEdgeIds.length > 0;
}

/**
 * Applies AI diagram modifications through the diagram store's batchApply,
 * tracks modified node IDs in the chat store, and triggers auto-layout
 * when structural changes are present.
 *
 * Returns the placeholder→real ID map from batchApply.
 */
export function applyAiModifications(mods: DiagramModification): Map<string, string> {
  const mutations: BatchMutations = {
    addNodes: mods.addNodes,
    updateNodes: mods.updateNodes,
    removeNodeIds: mods.removeNodeIds,
    addEdges: mods.addEdges,
    updateEdges: mods.updateEdges,
    removeEdgeIds: mods.removeEdgeIds,
  };

  const idMap = useDiagramStore.getState().batchApply(mutations);

  // Track AI-modified node IDs (resolved to real UUIDs)
  const prev = useChatStore.getState().aiModifiedNodeIds;
  const modifiedIds = new Set(prev);
  for (const node of mods.addNodes) {
    const realId = idMap.get(node.id);
    if (realId) modifiedIds.add(realId);
  }
  for (const upd of mods.updateNodes) {
    modifiedIds.add(idMap.get(upd.id) ?? upd.id);
  }
  useChatStore.setState({ aiModifiedNodeIds: modifiedIds });

  if (shouldAutoLayout(mods)) {
    void useDiagramStore.getState().runAutoLayout({ fitView: true });
  }

  return idMap;
}
