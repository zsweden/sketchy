import { Settings } from 'lucide-react';
import type { RefObject } from 'react';
import type { DisplayMessage } from '../../../store/chat-store';
import type { ChatMentionTarget } from '../chat-mentions';
import { AssistantMessageText } from './AssistantMessageText';
import { ChatCopyButton } from './ChatCopyButton';

export function ChatMessageList({
  isConfigured,
  loading,
  messages,
  messagesEndRef,
  onMentionClick,
  onOpenSettings,
  streamingContent,
}: {
  isConfigured: boolean;
  loading: boolean;
  messages: DisplayMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onMentionClick: (mention: ChatMentionTarget) => void;
  onOpenSettings: () => void;
  streamingContent: string;
}) {
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
            <AssistantMessageText text={message.content} onMentionClick={onMentionClick} />
          ) : (
            <div className="chat-bubble-text">{message.content}</div>
          )}
          {message.modifications && (
            <span className="chat-badge-modified">changes applied</span>
          )}
          {message.role === 'assistant' && <ChatCopyButton text={message.content} />}
        </div>
      ))}
      {loading && streamingContent && (
        <div className="chat-bubble chat-bubble--assistant">
          <div className="chat-bubble-text">{streamingContent.trimStart()}</div>
        </div>
      )}
      {loading && !streamingContent && (
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
