import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { COPY_FEEDBACK_MS } from '../../../constants/timing';

export function ChatCopyButton({ text }: { text: string }) {
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
