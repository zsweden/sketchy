import { memo, useCallback } from 'react';
import type { NodeTag } from '../../../core/framework-types';
import { useDiagramStore } from '../../../store/diagram-store';
import FormField from '../../form/FormField';

interface Props {
  nodeId: string;
  tags: string[];
  availableTags: NodeTag[];
}

function NodeTagsEditor({ nodeId, tags, availableTags }: Props) {
  const updateNodeTags = useDiagramStore((s) => s.updateNodeTags);

  const toggleTag = useCallback(
    (tagId: string) => {
      const next = tags.includes(tagId)
        ? tags.filter((t) => t !== tagId)
        : [...tags, tagId];
      updateNodeTags(nodeId, next);
    },
    [nodeId, tags, updateNodeTags],
  );

  return (
    <FormField label="Tags">
      <div className="control-row">
        {availableTags.map((tag) => {
          const active = tags.includes(tag.id);
          return (
            <button
              key={tag.id}
              className="tag-chip"
              data-active={active}
              onClick={() => toggleTag(tag.id)}
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

export default memo(NodeTagsEditor);
