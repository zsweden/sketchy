import { RotateCcw, Settings } from 'lucide-react';
import type { RefObject } from 'react';
import { getStreamingChatMessageDisplayText, type ChatMentionTarget } from '../../../core/chat/mentions';
import type { DisplayMessage } from '../../../store/chat-store';
import { AssistantMessageText } from './AssistantMessageText';
import { ChatCopyButton } from './ChatCopyButton';

export function ChatMessageList({
  isConfigured,
  loading,
  messages,
  messagesEndRef,
  onMentionClick,
  onOpenSettings,
  onRetry,
  streamingContent,
}: {
  isConfigured: boolean;
  loading: boolean;
  messages: DisplayMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onMentionClick: (mention: ChatMentionTarget) => void;
  onOpenSettings: () => void;
  onRetry: (text: string) => void;
  streamingContent: string;
}) {
  const streamingDisplayText = getStreamingChatMessageDisplayText(streamingContent).trimStart();

  return (
    <div className="chat-messages">
      {messages.length === 0 && !loading && (
        isConfigured ? (
          <p className="chat-empty">
            Ask questions about your diagram or request changes.
          </p>
        ) : (
          <div className="chat-setup">
            <Settings size={24} style={{ color: 'var(--text-soft)', marginBottom: '0.5rem' }} />
            <p className="chat-setup-title">AI not configured</p>
            <p className="chat-setup-text">
              Set up an AI provider and API key in Settings to use chat.
            </p>
            <button
              className="btn btn-secondary btn-xs"
              onClick={onOpenSettings}
            >
              Open Settings
            </button>
          </div>
        )
      )}
      {messages.map((message) => (
        <div key={message.id} className={`chat-bubble chat-bubble--${message.role}`}>
          {message.role === 'assistant' ? (
            <AssistantMessageText
              segments={message.segments}
              text={message.content}
              onMentionClick={onMentionClick}
            />
          ) : (
            <div className="chat-bubble-text">{message.content}</div>
          )}
          {message.modifications && (
            <span className="chat-badge-modified">changes applied</span>
          )}
          {(() => {
            const retryText = message.role === 'assistant' ? message.retryText : undefined;
            if (typeof retryText !== 'string') return null;

            return (
              <button
                className="chat-retry-btn"
                onClick={() => onRetry(retryText)}
                title="Retry message"
                aria-label="Retry message"
              >
                <RotateCcw size={12} />
              </button>
            );
          })()}
          {message.role === 'assistant' && (
            <ChatCopyButton text={message.displayText ?? message.content} />
          )}
        </div>
      ))}
      {loading && streamingDisplayText && (
        <div className="chat-bubble chat-bubble--assistant">
          <div className="chat-bubble-text">{streamingDisplayText}</div>
        </div>
      )}
      {loading && !streamingDisplayText && (
        <div className="chat-bubble chat-bubble--assistant">
          <span className="chat-typing">
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
          </span>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
