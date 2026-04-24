import { useEffect, useMemo } from 'react';
import type { DiagramNode } from '../../core/types';
import { useChatStore } from '../../store/chat-store';
import { getDerivedIndicators } from '../../core/graph/derived';
import NodeHeader from './node/NodeHeader';
import NodeTextFields from './node/NodeTextFields';
import NodeValueUnit from './node/NodeValueUnit';
import NodeDerivedIndicators from './node/NodeDerivedIndicators';
import NodeLoopMembership from './node/NodeLoopMembership';
import SelectionTagsEditor from './selection/SelectionTagsEditor';
import SelectionJunctionEditor from './selection/SelectionJunctionEditor';
import { useNodeSelectionDetails } from './selection/useNodeSelectionDetails';

interface Props {
  node: DiagramNode;
}

export default function NodePanel({ node }: Props) {
  const removeAiModified = useChatStore((s) => s.removeAiModified);

  // Clear the AI-modified green dot when the user views this node
  useEffect(() => {
    removeAiModified(node.id);
  }, [node.id, removeAiModified]);

  const { framework, degreesMap, labeledLoops, nodeLabels } = useNodeSelectionDetails([node]);
  const derived = getDerivedIndicators(node.id, degreesMap, framework.derivedIndicators);
  const nodeLoops = useMemo(
    () => labeledLoops.filter((loop) => loop.nodeIds.includes(node.id)),
    [labeledLoops, node.id],
  );

  return (
    <div className="section-stack">
      <NodeHeader nodeId={node.id} locked={node.data.locked ?? false} />
      <NodeTextFields
        nodeId={node.id}
        label={node.data.label}
        notes={node.data.notes ?? ''}
      />
      {framework.supportsNodeValues && (
        <NodeValueUnit
          nodeId={node.id}
          value={node.data.value}
          unit={node.data.unit ?? ''}
        />
      )}
      <SelectionTagsEditor
        selectedNodes={[node]}
        availableTags={framework.nodeTags}
      />
      <SelectionJunctionEditor
        selectedNodes={[node]}
        framework={framework}
        degreesMap={degreesMap}
      />
      <NodeDerivedIndicators indicators={derived} />
      {framework.allowsCycles && (
        <NodeLoopMembership loops={nodeLoops} nodeLabels={nodeLabels} />
      )}
    </div>
  );
}
