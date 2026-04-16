import { memo } from 'react';
import type { Framework } from '../../../core/framework-types';
import { getJunctionState } from '../../../core/framework-types';
import type { JunctionType } from '../../../core/types';
import { useDiagramStore } from '../../../store/diagram-store';
import FormField from '../../form/FormField';
import ButtonGroup from '../../form/ButtonGroup';

interface Props {
  nodeId: string;
  framework: Framework;
  indegree: number;
  junctionType: JunctionType;
}

function NodeJunctionEditor({ nodeId, framework, indegree, junctionType }: Props) {
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const js = getJunctionState(framework, indegree, junctionType);
  if (!js) return null;
  return (
    <FormField label={js.isMath ? 'Operator' : 'Junction Logic'}>
      <ButtonGroup
        items={js.options.map((o) => ({ value: o.id as JunctionType, label: o.label }))}
        selected={junctionType}
        onSelect={(v) => updateNodeJunction(nodeId, v)}
      />
      <p className="field-label" style={{ marginTop: '-0.25rem' }}>
        {js.current.description}
      </p>
    </FormField>
  );
}

export default memo(NodeJunctionEditor);
