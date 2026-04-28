import type { Node } from '@xyflow/react';

export function mergeRFNodesWithLocalState(
  prevLocalNodes: Node[],
  rfNodes: Node[],
): Node[] {
  const prevById = new Map(prevLocalNodes.map((node) => [node.id, node]));

  return rfNodes.map((node) => {
    const prevNode = prevById.get(node.id);
    const shouldPreserveMeasuredSize = !node.type?.toString().startsWith('annotation-');

    return {
      ...node,
      selected: prevNode?.selected ?? false,
      ...(shouldPreserveMeasuredSize && prevNode?.measured ? { measured: prevNode.measured } : {}),
      ...(shouldPreserveMeasuredSize && prevNode?.width != null ? { width: prevNode.width } : {}),
      ...(shouldPreserveMeasuredSize && prevNode?.height != null ? { height: prevNode.height } : {}),
    };
  });
}
