import { memo } from 'react';
import type { NodeTag } from '../../../core/framework-types';
import type { DiagramNode } from '../../../core/types';
import { useDiagramStore } from '../../../store/diagram-store';
import FormField from '../../form/FormField';

interface Props {
  selectedNodes: DiagramNode[];
  availableTags: NodeTag[];
}

function SelectionTagsEditor({ selectedNodes, availableTags }: Props) {
  const updateNodeTags = useDiagramStore((state) => state.updateNodeTags);
  const addNodesTag = useDiagramStore((state) => state.addNodesTag);
  const removeNodesTag = useDiagramStore((state) => state.removeNodesTag);

  if (selectedNodes.length === 0 || availableTags.length === 0) return null;

  if (selectedNodes.length === 1) {
    const node = selectedNodes[0];

    return (
      <FormField label="Tags">
        <div className="control-row">
          {availableTags.map((tag) => {
            const active = node.data.tags.includes(tag.id);
            return (
              <button
                key={tag.id}
                className="tag-chip"
                data-active={active}
                onClick={() => {
                  const next = node.data.tags.includes(tag.id)
                    ? node.data.tags.filter((value) => value !== tag.id)
                    : [...node.data.tags, tag.id];
                  updateNodeTags(node.id, next);
                }}
                style={active ? { color: tag.color, borderColor: tag.color } : undefined}
                title={tag.description}
              >
                <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            );
          })}
        </div>
      </FormField>
    );
  }

  const ids = selectedNodes.map((node) => node.id);
  const total = selectedNodes.length;

  return (
    <FormField label="Tags">
      <div className="section-stack gap-tight">
        {availableTags.map((tag) => {
          const count = selectedNodes.filter((node) => node.data.tags.includes(tag.id)).length;
          const allHave = count === total;
          const noneHave = count === 0;

          return (
            <div
              key={tag.id}
              className="control-row gap-tight"
              style={{ alignItems: 'center' }}
            >
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

export default memo(SelectionTagsEditor);
