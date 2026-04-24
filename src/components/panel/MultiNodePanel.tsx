import { useMemo } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useGraphDerivations } from '../../hooks/useGraphDerivations';
import { useNodeAlignmentActions } from '../../hooks/useNodeAlignmentActions';
import {
  AlignHorizontalIcon,
  AlignVerticalIcon,
  DistributeHorizontalIcon,
  DistributeVerticalIcon,
} from '../icons/AlignDistributeIcons';
import MultiNodeTagsEditor from './multi/MultiNodeTagsEditor';
import MultiNodeJunctionEditor from './multi/MultiNodeJunctionEditor';
import MultiNodeColorEditor from './multi/MultiNodeColorEditor';
import type { DiagramNode } from '../../core/types';

interface Props {
  selectedNodes: DiagramNode[];
}

export default function MultiNodePanel({ selectedNodes }: Props) {
  const framework = useFramework();
  const edges = useDiagramStore((s) => s.diagram.edges);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);
  const toggleNodeLocked = useDiagramStore((s) => s.toggleNodeLocked);
  const distributeNodesHorizontally = useDiagramStore((s) => s.distributeNodesHorizontally);
  const distributeNodesVertically = useDiagramStore((s) => s.distributeNodesVertically);
  const { alignSelectedNodesHorizontally, alignSelectedNodesVertically } = useNodeAlignmentActions();
  const { degreesMap } = useGraphDerivations(edges, framework.allowsCycles);

  const ids = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);

  return (
    <div className="section-stack">
      <p className="section-heading">{selectedNodes.length} nodes selected</p>

      {framework.nodeTags.length > 0 && (
        <MultiNodeTagsEditor
          selectedNodes={selectedNodes}
          availableTags={framework.nodeTags}
        />
      )}

      <MultiNodeJunctionEditor
        selectedNodes={selectedNodes}
        framework={framework}
        degreesMap={degreesMap}
      />

      <MultiNodeColorEditor selectedNodes={selectedNodes} />

      <div className="section-stack gap-field">
        <p className="section-label">Align</p>
        <div className="control-row gap-tight">
          <button
            className="btn btn-secondary btn-xs"
            title="Align to same row"
            aria-label="Align horizontally"
            onClick={() => alignSelectedNodesHorizontally(ids)}
          >
            <AlignHorizontalIcon />
          </button>
          <button
            className="btn btn-secondary btn-xs"
            title="Align to same column"
            aria-label="Align vertically"
            onClick={() => alignSelectedNodesVertically(ids)}
          >
            <AlignVerticalIcon />
          </button>
        </div>
      </div>

      <div className="section-stack gap-field">
        <p className="section-label">Distribute</p>
        <div className="control-row gap-tight">
          <button
            className="btn btn-secondary btn-xs"
            title="Space out horizontally"
            aria-label="Distribute horizontally"
            disabled={selectedNodes.length < 3}
            onClick={() => distributeNodesHorizontally(ids)}
          >
            <DistributeHorizontalIcon />
          </button>
          <button
            className="btn btn-secondary btn-xs"
            title="Space out vertically"
            aria-label="Distribute vertically"
            disabled={selectedNodes.length < 3}
            onClick={() => distributeNodesVertically(ids)}
          >
            <DistributeVerticalIcon />
          </button>
        </div>
      </div>

      <div className="section-stack gap-field">
        <p className="section-label">Position</p>
        <div className="control-row gap-tight">
          <button
            className="btn btn-secondary btn-xs"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            onClick={() => toggleNodeLocked(ids, true)}
          >
            <Lock size={12} /> Lock All
          </button>
          <button
            className="btn btn-secondary btn-xs"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            onClick={() => toggleNodeLocked(ids, false)}
          >
            <Unlock size={12} /> Unlock All
          </button>
        </div>
      </div>

      <button
        className="btn btn-secondary btn-xs"
        onClick={() => deleteNodes(ids)}
      >
        Delete All
      </button>
    </div>
  );
}
