import { useCallback, useMemo, type KeyboardEvent } from 'react';
import { findCausalLoops, labelCausalLoops } from '../../../core/graph/derived';
import { useDiagramStore } from '../../../store/diagram-store';
import { parseChatMessageMentions, type ChatMentionTarget } from '../chat-mentions';

export function AssistantMessageText({
  text,
  onMentionClick,
}: {
  text: string;
  onMentionClick: (mention: ChatMentionTarget) => void;
}) {
  const nodes = useDiagramStore((state) => state.diagram.nodes);
  const edges = useDiagramStore((state) => state.diagram.edges);
  const framework = useDiagramStore((state) => state.framework);
  const loops = useMemo(
    () => (framework.allowsCycles ? labelCausalLoops(findCausalLoops(edges)) : []),
    [edges, framework.allowsCycles],
  );
  const segments = useMemo(
    () => parseChatMessageMentions(text, nodes, edges, loops),
    [text, nodes, edges, loops],
  );
  const handleMentionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>, mention: ChatMentionTarget) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onMentionClick(mention);
    },
    [onMentionClick],
  );

  return (
    <div className="chat-bubble-text">
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{segment.text}</span>;
        }

        return (
          <span
            key={`mention-${segment.mention.kind}-${segment.mention.id}-${index}`}
            className="chat-mention"
            role="button"
            tabIndex={0}
            onClick={() => onMentionClick(segment.mention)}
            onKeyDown={(event) => handleMentionKeyDown(event, segment.mention)}
            data-kind={segment.mention.kind}
            data-id={segment.mention.id}
          >
            {segment.mention.displayText}
          </span>
        );
      })}
    </div>
  );
}
