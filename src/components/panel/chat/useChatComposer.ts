import { useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { ChatDocument, ChatImage, ChatImageMediaType } from '../../../core/ai/ai-types';

const IMAGE_MEDIA_TYPES = new Set<string>(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export interface AttachedFile {
  name: string;
  content: string;
  isImage: boolean;
  isPdf: boolean;
  image?: ChatImage;
  document?: ChatDocument;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:<mediaType>;base64," prefix
      resolve(result.split(',', 2)[1]);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useChatComposer({
  isConfigured,
  loading,
  sendMessage,
}: {
  isConfigured: boolean;
  loading: boolean;
  sendMessage: (message: string, image?: ChatImage, displayText?: string, document?: ChatDocument) => void;
}) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const queryHistory = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading || !isConfigured) return;
    queryHistory.current.push(trimmed);
    setHistoryIndex(-1);
    setInput('');

    let message = trimmed;
    let image: ChatImage | undefined;
    let document: ChatDocument | undefined;

    if (attachedFile) {
      if (attachedFile.isImage && attachedFile.image) {
        image = attachedFile.image;
        message = `[Attached image: ${attachedFile.name}]\n\n${trimmed}`;
      } else if (attachedFile.isPdf && attachedFile.document) {
        document = attachedFile.document;
        message = `[Attached PDF: ${attachedFile.name}]\n\n${trimmed}`;
      } else {
        message = `[Attached file: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\n${trimmed}`;
      }
      setAttachedFile(null);
    }

    sendMessage(message, image, undefined, document);
  }, [attachedFile, input, isConfigured, loading, sendMessage]);

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (IMAGE_MEDIA_TYPES.has(file.type)) {
      const base64 = await readFileAsBase64(file);
      setAttachedFile({
        name: file.name,
        content: '',
        isImage: true,
        isPdf: false,
        image: { mediaType: file.type as ChatImageMediaType, base64 },
      });
    } else if (file.type === 'application/pdf') {
      const base64 = await readFileAsBase64(file);
      setAttachedFile({
        name: file.name,
        content: '',
        isImage: false,
        isPdf: true,
        document: { filename: file.name, mediaType: 'application/pdf', base64 },
      });
    } else {
      const content = await file.text();
      setAttachedFile({ name: file.name, content, isImage: false, isPdf: false });
    }

    event.target.value = '';
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      } else if (event.key === 'ArrowUp') {
        const history = queryHistory.current;
        if (history.length === 0) return;
        event.preventDefault();
        const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      } else if (event.key === 'ArrowDown') {
        const history = queryHistory.current;
        if (historyIndex === -1) return;
        event.preventDefault();
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(nextIndex);
          setInput(history[nextIndex]);
        }
      }
      event.stopPropagation();
    },
    [handleSend, historyIndex],
  );

  return {
    attachedFile,
    fileInputRef,
    handleAttach,
    handleFileChange,
    handleKeyDown,
    handleSend,
    input,
    removeAttachedFile: () => setAttachedFile(null),
    setInput,
  };
}
