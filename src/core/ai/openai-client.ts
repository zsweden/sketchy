import type { Diagram } from '../types';
import type { Framework } from '../framework-types';

// --- Types ---

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DiagramModification {
  addNodes: { id: string; label: string; tags?: string[] }[];
  updateNodes: { id: string; label?: string; tags?: string[]; notes?: string }[];
  removeNodeIds: string[];
  addEdges: { source: string; target: string; confidence?: 'high' | 'medium' | 'low'; notes?: string }[];
  updateEdges: { id: string; confidence?: 'high' | 'medium' | 'low'; notes?: string }[];
  removeEdgeIds: string[];
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (result: { text: string; modifications?: DiagramModification }) => void;
  onError: (error: Error) => void;
}

// --- Tool definition (modern tools API) ---

const modifyDiagramTool = {
  type: 'function' as const,
  function: {
    name: 'modify_diagram',
    description:
      'Apply changes to the diagram: add, update, or remove nodes and edges. Use this when the user asks you to change the diagram.',
    parameters: {
      type: 'object',
      properties: {
        explanation: {
          type: 'string',
          description: 'Brief explanation of what changes are being made and why.',
        },
        addNodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique id for the new node (e.g. "new_1")' },
              label: { type: 'string', description: 'Node text (under 15 words)' },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tag IDs to apply',
              },
            },
            required: ['id', 'label'],
          },
        },
        updateNodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Existing node ID to update' },
              label: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              notes: { type: 'string' },
            },
            required: ['id'],
          },
        },
        removeNodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of nodes to remove',
        },
        addEdges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Source node ID (cause)' },
              target: { type: 'string', description: 'Target node ID (effect)' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence level (default: high)' },
              notes: { type: 'string', description: 'Optional annotation or reasoning for this edge' },
            },
            required: ['source', 'target'],
          },
        },
        updateEdges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Existing edge ID to update' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              notes: { type: 'string', description: 'Annotation or reasoning for this edge' },
            },
            required: ['id'],
          },
          description: 'Update properties of existing edges',
        },
        removeEdgeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of edges to remove',
        },
      },
      required: ['explanation'],
    },
  },
};

// --- System prompt builder ---

function buildSystemPrompt(diagram: Diagram, framework: Framework): string {
  const nodesDesc = diagram.nodes
    .map((n) => {
      const parts = [`id="${n.id}", label="${n.data.label}"`];
      if (n.data.tags.length) parts.push(`tags=[${n.data.tags.join(', ')}]`);
      if (n.data.notes) parts.push(`notes="${n.data.notes}"`);
      if (n.data.junctionType !== 'or') parts.push(`junction=${n.data.junctionType}`);
      return `  - ${parts.join(', ')}`;
    })
    .join('\n');

  const edgesDesc = diagram.edges
    .map((e) => {
      const parts = [`id="${e.id}", "${e.source}" → "${e.target}"`];
      if (e.confidence && e.confidence !== 'high') parts.push(`confidence=${e.confidence}`);
      if (e.notes) parts.push(`notes="${e.notes}"`);
      return `  - ${parts.join(', ')}`;
    })
    .join('\n');

  const edgeVerb = framework.edgeLabel ?? 'causes';

  const tagList = framework.nodeTags.length > 0
    ? framework.nodeTags.map((t) => `${t.id} (${t.name})`).join(', ')
    : 'none';

  return `You are an AI assistant for Sketchy, a thinking-frameworks diagram editor.

The user is working on a "${framework.name}" diagram called "${diagram.name}".
${framework.description}

Current diagram state:
Nodes:
${nodesDesc || '  (none)'}

Edges (source ${edgeVerb} target):
${edgesDesc || '  (none)'}

You can either:
1. Answer questions about the diagram — analyze the structure, identify issues, suggest improvements.
2. Make changes by calling the modify_diagram tool — add/update/remove nodes and edges.

Rules for modifications:
- Edge direction means "source ${edgeVerb} target" — this is a DAG (no cycles).
- Keep node labels concise (under 15 words).
- When adding nodes, use IDs like "new_1", "new_2", etc.
- When referencing existing nodes, use their exact IDs.
- Available tags: ${tagList}.
- Edges have a confidence level: high (default, solid), medium (dashed), or low (dotted).
- Edges can have notes — use them to explain the causal reasoning behind the connection.
- Always explain your reasoning.`;
}

// --- Conversation pruning ---

const MAX_HISTORY_MESSAGES = 16; // ~8 exchanges (user + assistant pairs)

function pruneHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  return messages.slice(-MAX_HISTORY_MESSAGES);
}

// --- Streaming API call ---

export function streamChatMessage(
  apiKey: string,
  baseUrl: string,
  model: string,
  diagram: Diagram,
  framework: Framework,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
): AbortController {
  const controller = new AbortController();
  const systemPrompt = buildSystemPrompt(diagram, framework);

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...pruneHistory(messages).map((m) => ({ role: m.role, content: m.content })),
  ];

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: apiMessages,
      tools: [modifyDiagramTool],
      tool_choice: 'auto',
      stream: true,
    }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`API error (${res.status}): ${errorBody}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let contentText = '';
      const toolCalls: { name: string; args: string }[] = [];

      function processLine(line: string) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) return;
        const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) return;

          // Content tokens (plain text response)
          if (delta.content) {
            contentText += delta.content;
            callbacks.onToken(delta.content);
          }

          // Tool call chunks — track each by index
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls[idx]) toolCalls[idx] = { name: '', args: '' };
              if (tc.function?.name) toolCalls[idx].name = tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
            }
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          processLine(line);
        }
      }

      // Process any remaining data left in the buffer
      if (buffer.trim()) {
        processLine(buffer);
      }

      // Finalize — merge all modify_diagram tool calls into one modification
      const modifyCalls = toolCalls.filter((tc) => tc.name === 'modify_diagram' && tc.args);
      if (modifyCalls.length > 0) {
        try {
          const merged: DiagramModification = {
            addNodes: [],
            updateNodes: [],
            removeNodeIds: [],
            addEdges: [],
            updateEdges: [],
            removeEdgeIds: [],
          };
          const explanations: string[] = [];

          for (const tc of modifyCalls) {
            const args = JSON.parse(tc.args);
            if (args.explanation) explanations.push(args.explanation);
            if (args.addNodes) merged.addNodes.push(...args.addNodes);
            if (args.updateNodes) merged.updateNodes.push(...args.updateNodes);
            if (args.removeNodeIds) merged.removeNodeIds.push(...args.removeNodeIds);
            if (args.addEdges) merged.addEdges.push(...args.addEdges);
            if (args.updateEdges) merged.updateEdges.push(...args.updateEdges);
            if (args.removeEdgeIds) merged.removeEdgeIds.push(...args.removeEdgeIds);
          }

          callbacks.onDone({
            text: explanations.join(' ') || 'Changes applied.',
            modifications: merged,
          });
        } catch {
          const rawArgs = modifyCalls.map((tc) => tc.args).join('\n\n');
          const rawPreview = `The AI suggested changes but they could not be parsed. Please try again.\n\nRaw response:\n${rawArgs}`;
          callbacks.onDone({ text: contentText || rawPreview });
        }
      } else {
        callbacks.onDone({ text: contentText });
      }
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}
