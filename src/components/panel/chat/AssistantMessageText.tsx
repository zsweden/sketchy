import { useCallback, type KeyboardEvent } from 'react';
import type { ChatMentionTarget, ParsedChatSegment } from '../chat-mentions';

export function AssistantMessageText({
  segments,
  text,
  onMentionClick,
}: {
  segments?: ParsedChatSegment[];
  text: string;
  onMentionClick: (mention: ChatMentionTarget) => void;
}) {
  const handleMentionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>, mention: ChatMentionTarget) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onMentionClick(mention);
    },
    [onMentionClick],
  );
  const resolvedSegments = segments ?? [{ type: 'text', text }];

  return (
    <div className="chat-bubble-text">
      {resolvedSegments.map((segment, index) => {
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
