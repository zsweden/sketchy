import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Square, Trash2, Copy, Check, Paperclip, X, Settings } from 'lucide-react';
import { useChatStore } from '../../store/chat-store';
import { findCausalLoops, labelCausalLoops } from '../../core/graph/derived';
import { useDiagramStore } from '../../store/diagram-store';
import { useSettingsStore, PROVIDERS } from '../../store/settings-store';
import { useUIStore } from '../../store/ui-store';
import { COPY_FEEDBACK_MS } from '../../constants/timing';
import { parseChatMessageMentions, type ChatMentionTarget } from './chat-mentions';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
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

function AssistantMessageText({
  text,
  onMentionClick,
}: {
  text: string;
  onMentionClick: (mention: ChatMentionTarget) => void;
}) {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const framework = useDiagramStore((s) => s.framework);
  const loops = useMemo(
    () => (framework.allowsCycles ? labelCausalLoops(findCausalLoops(edges)) : []),
    [edges, framework.allowsCycles],
  );
  const segments = useMemo(
    () => parseChatMessageMentions(text, nodes, edges, loops),
    [text, nodes, edges, loops],
  );
  const handleMentionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>, mention: ChatMentionTarget) => {
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

export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const cancelStream = useChatStore((s) => s.cancelStream);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const selectGraphObject = useUIStore((s) => s.selectGraphObject);

  const provider = useSettingsStore((s) => s.provider);
  const apiKey = useSettingsStore((s) => s.openaiApiKey);
  const model = useSettingsStore((s) => s.model);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const modelsLoading = useSettingsStore((s) => s.modelsLoading);
  const modelsError = useSettingsStore((s) => s.modelsError);
  const toggleSettings = useSettingsStore((s) => s.toggleSettings);
  const currentProvider = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const isConfigured = !currentProvider.requiresKey || apiKey.length > 0;
  const isConnected = isConfigured && !modelsLoading && !modelsError && availableModels.length > 0;

  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const queryHistory = useRef<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading || !isConfigured) return;
    queryHistory.current.push(trimmed);
    setHistoryIndex(-1);
    setInput('');

    let message = trimmed;
    if (attachedFile) {
      message = `[Attached file: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\n${trimmed}`;
      setAttachedFile(null);
    }

    sendMessage(message);
  }, [input, loading, sendMessage, attachedFile, isConfigured]);

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((content) => {
      setAttachedFile({ name: file.name, content });
    });
    // Reset so the same file can be re-selected
    e.target.value = '';
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (e.key === 'ArrowUp') {
        const history = queryHistory.current;
        if (history.length === 0) return;
        e.preventDefault();
        const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      } else if (e.key === 'ArrowDown') {
        const history = queryHistory.current;
        if (historyIndex === -1) return;
        e.preventDefault();
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(nextIndex);
          setInput(history[nextIndex]);
        }
      }
      // Prevent React Flow from intercepting keys
      e.stopPropagation();
    },
    [handleSend, historyIndex],
  );

  const handleMentionClick = useCallback(
    (mention: ChatMentionTarget) => {
      selectGraphObject({ kind: mention.kind, id: mention.id });
    },
    [selectGraphObject],
  );

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <p className="section-heading chat-header-title">
          <span>AI Chat</span>
          {model && <span className="chat-model-name">{model}</span>}
          {isConnected && <Check size={14} style={{ color: '#22c55e' }} />}
        </p>
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

      {loading && <div className="chat-progress-bar" />}
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
                onClick={toggleSettings}
              >
                Open Settings
              </button>
            </div>
          )
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble chat-bubble--${msg.role}`}>
            {msg.role === 'assistant' ? (
              <AssistantMessageText text={msg.content} onMentionClick={handleMentionClick} />
            ) : (
              <div className="chat-bubble-text">{msg.content}</div>
            )}
            {msg.modifications && (
              <span className="chat-badge-modified">changes applied</span>
            )}
            {msg.role === 'assistant' && <CopyButton text={msg.content} />}
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

      <div className="chat-input-area">
        {attachedFile && (
          <div className="chat-file-chip">
            <Paperclip size={11} />
            <span className="chat-file-chip-name">{attachedFile.name}</span>
            <button
              className="chat-file-chip-remove"
              onClick={() => setAttachedFile(null)}
              aria-label="Remove attachment"
            >
              <X size={11} />
            </button>
          </div>
        )}
        <div className="chat-input-row">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept=".txt,.json,.sky,.csv,.md,.ts,.tsx,.js,.jsx,.html,.css,.yml,.yaml,.xml,.log"
            style={{ display: 'none' }}
          />
          {!loading && (
            <button
              className="btn btn-ghost btn-icon-sm"
              onClick={handleAttach}
              title="Attach file"
              aria-label="Attach file"
            >
              <Paperclip size={13} />
            </button>
          )}
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConfigured ? 'Ask about your diagram...' : 'Configure AI provider in Settings'}
            rows={1}
            disabled={loading || !isConfigured}
            aria-label="Chat input"
          />
          {loading ? (
            <button
              className="btn btn-secondary btn-icon-sm"
              onClick={cancelStream}
              title="Stop generating"
              aria-label="Stop generating"
            >
              <Square size={11} />
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-icon-sm"
              onClick={handleSend}
              disabled={!input.trim() || !isConfigured}
              title="Send message"
              aria-label="Send message"
            >
              <Send size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
