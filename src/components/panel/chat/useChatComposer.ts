import { useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

interface AttachedFile {
  name: string;
  content: string;
}

export function useChatComposer({
  isConfigured,
  loading,
  sendMessage,
}: {
  isConfigured: boolean;
  loading: boolean;
  sendMessage: (message: string) => void;
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
    if (attachedFile) {
      message = `[Attached file: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\n${trimmed}`;
      setAttachedFile(null);
    }

    sendMessage(message);
  }, [attachedFile, input, isConfigured, loading, sendMessage]);

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((content) => {
      setAttachedFile({ name: file.name, content });
    });
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
