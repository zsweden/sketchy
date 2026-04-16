import { memo } from 'react';
import type { NamedCausalLoop } from '../../../core/graph/derived';
import { useUIStore } from '../../../store/ui-store';
import FormField from '../../form/FormField';
import LoopCard from '../../form/LoopCard';

interface Props {
  loops: NamedCausalLoop[];
  nodeLabels: Map<string, string>;
}

function NodeLoopMembership({ loops, nodeLabels }: Props) {
  const selectedLoopId = useUIStore((s) => s.selectedLoopId);
  const setSelectedLoop = useUIStore((s) => s.setSelectedLoop);
  return (
    <FormField label="Loop Membership">
      {loops.length === 0 ? (
        <p className="field-label">This variable is not part of a detected feedback loop.</p>
      ) : (
        loops.map((loop) => (
          <LoopCard
            key={loop.id}
            loop={loop}
            selected={selectedLoopId === loop.id}
            onSelect={() => setSelectedLoop(selectedLoopId === loop.id ? null : loop.id)}
            nodeLabels={nodeLabels}
          />
        ))
      )}
    </FormField>
  );
}

export default memo(NodeLoopMembership);
