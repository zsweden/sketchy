import { memo } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useDiagramStore } from '../../../store/diagram-store';

interface Props {
  nodeId: string;
  locked: boolean;
}

function NodeHeader({ nodeId, locked }: Props) {
  const toggleNodeLocked = useDiagramStore((s) => s.toggleNodeLocked);
  return (
    <div className="control-row split-row">
      <p className="section-heading">Node</p>
      <button
        className="btn btn-secondary btn-xs"
        title={locked ? 'Unlock position' : 'Lock position'}
        onClick={() => toggleNodeLocked([nodeId], !locked)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
      >
        {locked ? <Lock size={12} /> : <Unlock size={12} />}
        {locked ? 'Locked' : 'Unlocked'}
      </button>
    </div>
  );
}

export default memo(NodeHeader);
