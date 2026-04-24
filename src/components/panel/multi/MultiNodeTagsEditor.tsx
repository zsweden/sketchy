import { memo } from 'react';
import type { NodeTag } from '../../../core/framework-types';
import type { DiagramNode } from '../../../core/types';
import { useDiagramStore } from '../../../store/diagram-store';
import FormField from '../../form/FormField';

interface Props {
  selectedNodes: DiagramNode[];
  availableTags: NodeTag[];
}

function MultiNodeTagsEditor({ selectedNodes, availableTags }: Props) {
  const addNodesTag = useDiagramStore((s) => s.addNodesTag);
  const removeNodesTag = useDiagramStore((s) => s.removeNodesTag);
  const ids = selectedNodes.map((n) => n.id);
  const total = selectedNodes.length;

  return (
    <FormField label="Tags">
      <div className="section-stack gap-tight">
        {availableTags.map((tag) => {
          const count = selectedNodes.filter((n) => n.data.tags.includes(tag.id)).length;
          const allHave = count === total;
          const noneHave = count === 0;
          return (
            <div key={tag.id} className="control-row gap-tight" style={{ alignItems: 'center' }}>
              <span
                className="tag-chip"
                style={{
                  color: tag.color,
                  borderColor: tag.color,
                  flex: '0 0 auto',
                }}
                title={tag.description}
              >
                <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </span>
              <span
                className="field-label"
                style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                aria-label={`${count} of ${total} have ${tag.name}`}
              >
                {count}/{total}
              </span>
              <button
                className="btn btn-secondary btn-xs"
                disabled={allHave}
                onClick={() => addNodesTag(ids, tag.id)}
                aria-label={`Add ${tag.name} to all selected`}
              >
                Add
              </button>
              <button
                className="btn btn-secondary btn-xs"
                disabled={noneHave}
                onClick={() => removeNodesTag(ids, tag.id)}
                aria-label={`Remove ${tag.name} from all selected`}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </FormField>
  );
}

export default memo(MultiNodeTagsEditor);
