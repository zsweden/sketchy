import { memo } from 'react';
import {
  getJunctionOptions,
  getJunctionState,
  type Framework,
} from '../../../core/framework-types';
import type { NodeDegrees } from '../../../core/graph/derived';
import type { DiagramNode, JunctionType } from '../../../core/types';
import { useDiagramStore } from '../../../store/diagram-store';
import FormField from '../../form/FormField';
import ButtonGroup from '../../form/ButtonGroup';

interface Props {
  selectedNodes: DiagramNode[];
  framework: Framework;
  degreesMap: Map<string, NodeDegrees>;
}

function SelectionJunctionEditor({
  selectedNodes,
  framework,
  degreesMap,
}: Props) {
  const updateNodeJunction = useDiagramStore((state) => state.updateNodeJunction);
  const updateNodesJunction = useDiagramStore((state) => state.updateNodesJunction);

  if (selectedNodes.length === 0) return null;

  if (selectedNodes.length === 1) {
    const node = selectedNodes[0];
    const degrees = degreesMap.get(node.id) ?? { indegree: 0, outdegree: 0 };
    const junctionState = getJunctionState(
      framework,
      degrees.indegree,
      node.data.junctionType,
    );

    if (!junctionState) return null;

    return (
      <FormField label={junctionState.isMath ? 'Operator' : 'Junction Logic'}>
        <ButtonGroup
          items={junctionState.options.map((option) => ({
            value: option.id as JunctionType,
            label: option.label,
          }))}
          selected={node.data.junctionType}
          onSelect={(value) => updateNodeJunction(node.id, value)}
        />
        <p className="field-label" style={{ marginTop: '-0.25rem' }}>
          {junctionState.current.description}
        </p>
      </FormField>
    );
  }

  const options = getJunctionOptions(framework);
  const isMath = options.some((option) => option.id === 'add' || option.id === 'multiply');
  const minIndegree = isMath ? 1 : 2;
  const eligibleIds = selectedNodes
    .filter((node) => (degreesMap.get(node.id)?.indegree ?? 0) >= minIndegree)
    .map((node) => node.id);

  if (options.length === 0 || eligibleIds.length === 0) return null;

  const eligibleNodes = selectedNodes.filter((node) => eligibleIds.includes(node.id));
  const sharedType = eligibleNodes.every(
    (node) => node.data.junctionType === eligibleNodes[0].data.junctionType,
  )
    ? eligibleNodes[0].data.junctionType
    : null;
  const partial = eligibleIds.length < selectedNodes.length;

  return (
    <FormField label={isMath ? 'Operator' : 'Junction Logic'}>
      <div className="control-row">
        {options.map((option) => (
          <button
            key={option.id}
            className="btn btn-xs"
            style={
              sharedType === option.id
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--secondary)' }
            }
            title={option.description}
            onClick={() => updateNodesJunction(eligibleIds, option.id as JunctionType)}
          >
            {option.label}
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

export default memo(SelectionJunctionEditor);
