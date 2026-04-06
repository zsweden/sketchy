import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { FileText, Paperclip, Send, Square, X } from 'lucide-react';
import type { AttachedFile } from './useChatComposer';

const ACCEPT = '.txt,.json,.csv,.md,.ts,.tsx,.js,.jsx,.html,.css,.yml,.yaml,.xml,.log,.png,.jpg,.jpeg,.gif,.webp,.pdf';

export function ChatComposer({
  attachedFile,
  disabled,
  fileInputRef,
  input,
  loading,
  onAttach,
  onCancel,
  onChange,
  onFileChange,
  onKeyDown,
  onRemoveAttachment,
  onSend,
}: {
  attachedFile: AttachedFile | null;
  disabled: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  input: string;
  loading: boolean;
  onAttach: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onRemoveAttachment: () => void;
  onSend: () => void;
}) {
  return (
    <div className="chat-input-area">
      {attachedFile && (
        <div className="chat-file-chip">
          {attachedFile.isImage && attachedFile.image ? (
            <img
              src={`data:${attachedFile.image.mediaType};base64,${attachedFile.image.base64}`}
              alt={attachedFile.name}
              className="chat-image-thumbnail"
            />
          ) : attachedFile.isPdf ? (
            <FileText size={11} />
          ) : (
            <Paperclip size={11} />
          )}
          <span className="chat-file-chip-name">{attachedFile.name}</span>
          <button
            className="chat-file-chip-remove"
            onClick={onRemoveAttachment}
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
          onChange={onFileChange}
          accept={ACCEPT}
          style={{ display: 'none' }}
        />
        {!loading && (
          <button
            className="btn btn-ghost btn-icon-sm"
            onClick={onAttach}
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip size={13} />
          </button>
        )}
        <textarea
          className="chat-input"
          value={input}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'Configure AI provider in Settings' : 'Ask about your diagram...'}
          rows={1}
          disabled={loading || disabled}
          aria-label="Chat input"
        />
        {loading ? (
          <button
            className="btn btn-secondary btn-icon-sm"
            onClick={onCancel}
            title="Stop generating"
            aria-label="Stop generating"
          >
            <Square size={11} />
          </button>
        ) : (
          <button
            className="btn btn-secondary btn-icon-sm"
            onClick={onSend}
            disabled={!input.trim() || disabled}
            title="Send message"
            aria-label="Send message"
          >
            <Send size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
