import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import { useChatStore } from '../../store/chat-store';
import { useSettingsStore } from '../../store/settings-store';

export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const apiKey = useSettingsStore((s) => s.openaiApiKey);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
        {messages.length === 0 && (
          <p className="chat-empty">
            {apiKey
              ? 'Ask questions about your diagram or request changes.'
              : 'Set your OpenAI API key in settings to start.'}
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble chat-bubble--${msg.role}`}>
            <p className="chat-bubble-text">{msg.content}</p>
            {msg.modifications && (
              <span className="chat-badge-modified">changes applied</span>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble chat-bubble--assistant">
            <Loader2 size={14} className="chat-spinner" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your diagram..."
          rows={1}
          disabled={loading}
        />
        <button
          className="btn btn-secondary btn-icon-sm"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          title="Send"
          aria-label="Send message"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
