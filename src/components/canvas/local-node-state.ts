import type { Node } from '@xyflow/react';

export function mergeRFNodesWithLocalState(
  prevLocalNodes: Node[],
  rfNodes: Node[],
): Node[] {
  const prevById = new Map(prevLocalNodes.map((node) => [node.id, node]));

  return rfNodes.map((node) => {
    const prevNode = prevById.get(node.id);

    return {
      ...node,
      selected: prevNode?.selected ?? false,
      ...(prevNode?.measured ? { measured: prevNode.measured } : {}),
      ...(prevNode?.width != null ? { width: prevNode.width } : {}),
      ...(prevNode?.height != null ? { height: prevNode.height } : {}),
    };
  });
}
