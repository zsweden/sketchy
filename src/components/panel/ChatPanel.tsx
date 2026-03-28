import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Square, Trash2, Copy, Check } from 'lucide-react';
import { useChatStore } from '../../store/chat-store';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      className="chat-copy-btn"
      onClick={handleCopy}
      title="Copy response"
      aria-label="Copy response"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const cancelStream = useChatStore((s) => s.cancelStream);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, loading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      // Prevent React Flow from intercepting keys
      e.stopPropagation();
    },
    [handleSend],
  );

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <p className="section-label">AI Chat</p>
        {messages.length > 0 && (
          <button
            className="btn btn-ghost btn-icon-sm"
            onClick={clearMessages}
            title="Clear chat"
            aria-label="Clear chat"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <p className="chat-empty">
            Ask questions about your diagram or request changes.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble chat-bubble--${msg.role}`}>
            <p className="chat-bubble-text">{msg.content}</p>
            {msg.modifications && (
              <span className="chat-badge-modified">changes applied</span>
            )}
            {msg.role === 'assistant' && <CopyButton text={msg.content} />}
          </div>
        ))}
        {loading && streamingContent && (
          <div className="chat-bubble chat-bubble--assistant">
            <p className="chat-bubble-text">{streamingContent}</p>
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

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your diagram..."
          rows={1}
          disabled={loading}
        />
        {loading ? (
          <button
            className="btn btn-secondary btn-icon-sm"
            onClick={cancelStream}
            title="Stop"
            aria-label="Stop generating"
          >
            <Square size={11} />
          </button>
        ) : (
          <button
            className="btn btn-secondary btn-icon-sm"
            onClick={handleSend}
            disabled={!input.trim()}
            title="Send"
            aria-label="Send message"
          >
            <Send size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
