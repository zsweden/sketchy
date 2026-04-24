import { memo, useMemo } from 'react';
import {
  type Framework,
  getJunctionOptions,
} from '../../../core/framework-types';
import type { DiagramNode, JunctionType } from '../../../core/types';
import type { NodeDegrees } from '../../../core/graph/derived';
import { useDiagramStore } from '../../../store/diagram-store';
import FormField from '../../form/FormField';

interface Props {
  selectedNodes: DiagramNode[];
  framework: Framework;
  degreesMap: Map<string, NodeDegrees>;
}

function MultiNodeJunctionEditor({ selectedNodes, framework, degreesMap }: Props) {
  const updateNodesJunction = useDiagramStore((s) => s.updateNodesJunction);
  const options = getJunctionOptions(framework);
  const isMath = options.some((o) => o.id === 'add' || o.id === 'multiply');
  const minIndegree = isMath ? 1 : 2;

  const eligibleIds = useMemo(
    () => selectedNodes
      .filter((n) => (degreesMap.get(n.id)?.indegree ?? 0) >= minIndegree)
      .map((n) => n.id),
    [selectedNodes, degreesMap, minIndegree],
  );

  if (options.length === 0 || eligibleIds.length === 0) return null;

  const eligibleNodes = selectedNodes.filter((n) => eligibleIds.includes(n.id));
  const sharedType = eligibleNodes.every((n) => n.data.junctionType === eligibleNodes[0].data.junctionType)
    ? eligibleNodes[0].data.junctionType
    : null;

  const partial = eligibleIds.length < selectedNodes.length;

  return (
    <FormField label={isMath ? 'Operator' : 'Junction Logic'}>
      <div className="control-row">
        {options.map((o) => (
          <button
            key={o.id}
            className="btn btn-xs"
            style={
              sharedType === o.id
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--secondary)' }
            }
            title={o.description}
            onClick={() => updateNodesJunction(eligibleIds, o.id as JunctionType)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {partial && (
        <p className="field-label" style={{ marginTop: '-0.25rem' }}>
          Applies to {eligibleIds.length} of {selectedNodes.length} selected
        </p>
      )}
    </FormField>
  );
}

export default memo(MultiNodeJunctionEditor);
