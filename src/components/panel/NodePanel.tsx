import { useEffect, useMemo } from 'react';
import type { DiagramNode } from '../../core/types';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useChatStore } from '../../store/chat-store';
import { getDerivedIndicators } from '../../core/graph/derived';
import { useGraphDerivations } from '../../hooks/useGraphDerivations';
import NodeHeader from './node/NodeHeader';
import NodeTextFields from './node/NodeTextFields';
import NodeValueUnit from './node/NodeValueUnit';
import NodeTagsEditor from './node/NodeTagsEditor';
import NodeJunctionEditor from './node/NodeJunctionEditor';
import NodeDerivedIndicators from './node/NodeDerivedIndicators';
import NodeLoopMembership from './node/NodeLoopMembership';

interface Props {
  node: DiagramNode;
}

export default function NodePanel({ node }: Props) {
  const framework = useFramework();
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const removeAiModified = useChatStore((s) => s.removeAiModified);

  // Clear the AI-modified green dot when the user views this node
  useEffect(() => {
    removeAiModified(node.id);
  }, [node.id, removeAiModified]);

  const { degreesMap, labeledLoops } = useGraphDerivations(edges, framework.allowsCycles);
  const degrees = degreesMap.get(node.id) ?? { indegree: 0, outdegree: 0 };
  const derived = getDerivedIndicators(node.id, degreesMap, framework.derivedIndicators);
  const nodeLoops = useMemo(
    () => labeledLoops.filter((loop) => loop.nodeIds.includes(node.id)),
    [labeledLoops, node.id],
  );
  const nodeLabels = useMemo(
    () => new Map(nodes.map((entry) => [entry.id, entry.data.label || entry.id])),
    [nodes],
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
      {framework.nodeTags.length > 0 && (
        <NodeTagsEditor
          nodeId={node.id}
          tags={node.data.tags}
          availableTags={framework.nodeTags}
        />
      )}
      <NodeJunctionEditor
        nodeId={node.id}
        framework={framework}
        indegree={degrees.indegree}
        junctionType={node.data.junctionType}
      />
      <NodeDerivedIndicators indicators={derived} />
      {framework.allowsCycles && (
        <NodeLoopMembership loops={nodeLoops} nodeLabels={nodeLabels} />
      )}
    </div>
  );
}
