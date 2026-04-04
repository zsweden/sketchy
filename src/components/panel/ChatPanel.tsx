import { useCallback, useEffect, useRef } from 'react';
import { Check, PanelBottom, Rows2, Square, Trash2 } from 'lucide-react';
import { useChatStore } from '../../store/chat-store';
import { useSettingsStore, PROVIDERS } from '../../store/settings-store';
import { useUIStore } from '../../store/ui-store';
import type { ChatMentionTarget } from '../../core/chat/mentions';
import { ChatComposer } from './chat/ChatComposer';
import { ChatMessageList } from './chat/ChatMessageList';
import { useChatComposer } from './chat/useChatComposer';

export default function ChatPanel() {
  const messages = useChatStore((state) => state.messages);
  const loading = useChatStore((state) => state.loading);
  const streamingContent = useChatStore((state) => state.streamingContent);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const cancelStream = useChatStore((state) => state.cancelStream);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const selectGraphObject = useUIStore((state) => state.selectGraphObject);
  const focusGraphObject = useUIStore((state) => state.focusGraphObject);
  const chatPanelMode = useUIStore((state) => state.chatPanelMode);
  const setChatPanelMode = useUIStore((state) => state.setChatPanelMode);

  const provider = useSettingsStore((state) => state.provider);
  const apiKey = useSettingsStore((state) => state.openaiApiKey);
  const model = useSettingsStore((state) => state.model);
  const availableModels = useSettingsStore((state) => state.availableModels);
  const modelsLoading = useSettingsStore((state) => state.modelsLoading);
  const modelsError = useSettingsStore((state) => state.modelsError);
  const toggleSettings = useSettingsStore((state) => state.toggleSettings);

  const currentProvider = PROVIDERS.find((entry) => entry.id === provider) ?? PROVIDERS[0];
  const isConfigured = !currentProvider.requiresKey || apiKey.length > 0;
  const isConnected = isConfigured && !modelsLoading && !modelsError && availableModels.length > 0;
  const isMinimized = chatPanelMode === 'min';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    attachedFile,
    fileInputRef,
    handleAttach,
    handleFileChange,
    handleKeyDown,
    handleSend,
    input,
    removeAttachedFile,
    setInput,
  } = useChatComposer({
    isConfigured,
    loading,
    sendMessage,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleMentionClick = useCallback(
    (mention: ChatMentionTarget) => {
      selectGraphObject({ kind: mention.kind, id: mention.id });
      focusGraphObject({ kind: mention.kind, id: mention.id });
    },
    [focusGraphObject, selectGraphObject],
  );

  return (
    <div className={`chat-panel${isMinimized ? ' chat-panel--minimized' : ''}`}>
      <div className="chat-header">
        <p className="section-heading chat-header-title">
          <span>AI</span>
          {model && <span className="chat-model-name">{model}</span>}
          {isConnected && <Check size={14} style={{ color: '#22c55e' }} />}
        </p>
        <div className="chat-header-actions">
          <div className="chat-layout-controls" aria-label="Chat panel layout controls">
            <button
              className={`btn btn-ghost btn-icon-sm chat-layout-btn${chatPanelMode === 'max' ? ' is-active' : ''}`}
              onClick={() => setChatPanelMode('max')}
              title="Maximize chat"
              aria-label="Maximize chat"
            >
              <Square size={13} />
            </button>
            <button
              className={`btn btn-ghost btn-icon-sm chat-layout-btn${chatPanelMode === 'min' ? ' is-active' : ''}`}
              onClick={() => setChatPanelMode('min')}
              title="Minimize chat"
              aria-label="Minimize chat"
            >
              <PanelBottom size={13} />
            </button>
            <button
              className={`btn btn-ghost btn-icon-sm chat-layout-btn${chatPanelMode === 'shared' ? ' is-active' : ''}`}
              onClick={() => setChatPanelMode('shared')}
              title="Share chat and info panel"
              aria-label="Share chat and info panel"
            >
              <Rows2 size={13} />
            </button>
          </div>
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
      </div>

      {!isMinimized && loading && <div className="chat-progress-bar" />}

      {!isMinimized && (
        <>
          <ChatMessageList
            isConfigured={isConfigured}
            loading={loading}
            messages={messages}
            messagesEndRef={messagesEndRef}
            onMentionClick={handleMentionClick}
            onOpenSettings={toggleSettings}
            onRetry={sendMessage}
            streamingContent={streamingContent}
          />

          <ChatComposer
            attachedFile={attachedFile}
            disabled={!isConfigured}
            fileInputRef={fileInputRef}
            input={input}
            loading={loading}
            onAttach={handleAttach}
            onCancel={cancelStream}
            onChange={setInput}
            onFileChange={handleFileChange}
            onKeyDown={handleKeyDown}
            onRemoveAttachment={removeAttachedFile}
            onSend={handleSend}
          />
        </>
      )}
    </div>
  );
}
