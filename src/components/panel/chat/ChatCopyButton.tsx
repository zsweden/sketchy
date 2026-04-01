import { useCallback, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { COPY_FEEDBACK_MS } from '../../../constants/timing';
import { findCausalLoops, labelCausalLoops } from '../../../core/graph/derived';
import { useDiagramStore } from '../../../store/diagram-store';
import { getChatMessageDisplayText } from '../chat-mentions';

export function ChatCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const nodes = useDiagramStore((state) => state.diagram.nodes);
  const edges = useDiagramStore((state) => state.diagram.edges);
  const framework = useDiagramStore((state) => state.framework);
  const loops = useMemo(
    () => (framework.allowsCycles ? labelCausalLoops(findCausalLoops(edges)) : []),
    [edges, framework.allowsCycles],
  );
  const copyText = useMemo(
    () => getChatMessageDisplayText(text, nodes, edges, loops),
    [text, nodes, edges, loops],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    });
  }, [copyText]);

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
