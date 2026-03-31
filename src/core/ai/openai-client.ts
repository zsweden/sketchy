import type { Diagram, EdgePolarity } from '../types';
import type { Framework } from '../framework-types';
import { findCausalLoops } from '../graph/derived';
import { buildHeaders } from './model-fetcher';

// --- Types ---

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DiagramModification {
  addNodes: { id: string; label: string; tags?: string[] }[];
  updateNodes: { id: string; label?: string; tags?: string[]; notes?: string }[];
  removeNodeIds: string[];
  addEdges: {
    source: string;
    target: string;
    confidence?: 'high' | 'medium' | 'low';
    polarity?: EdgePolarity;
    delay?: boolean;
    notes?: string;
  }[];
  updateEdges: {
    id: string;
    confidence?: 'high' | 'medium' | 'low';
    polarity?: EdgePolarity;
    delay?: boolean;
    notes?: string;
  }[];
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
              polarity: { type: 'string', enum: ['positive', 'negative'], description: 'For signed diagrams: positive = same-direction influence, negative = opposite-direction influence' },
              delay: { type: 'boolean', description: 'Whether the source affects the target with a delay' },
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
              polarity: { type: 'string', enum: ['positive', 'negative'] },
              delay: { type: 'boolean' },
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

function buildLoopAnalysis(diagram: Diagram): string {
  const loops = findCausalLoops(diagram.edges);
  if (loops.length === 0) return 'Detected feedback loops:\n  (none)';

  let reinforcingIndex = 0;
  let balancingIndex = 0;
  const nodeLabels = new Map(
    diagram.nodes.map((node) => [node.id, node.data.label || node.id]),
  );

  const lines = loops.map((loop) => {
    const loopName = loop.kind === 'reinforcing'
      ? `R${++reinforcingIndex}`
      : `B${++balancingIndex}`;
    const descriptors = [
      loop.kind,
      `${loop.negativeEdgeCount} negative edge${loop.negativeEdgeCount === 1 ? '' : 's'}`,
      ...(loop.delayedEdgeCount > 0 ? [`${loop.delayedEdgeCount} delayed edge${loop.delayedEdgeCount === 1 ? '' : 's'}`] : []),
    ];
    const cycle = loop.nodeIds
      .map((nodeId) => nodeLabels.get(nodeId) ?? nodeId)
      .join(' → ');
    return `  - ${loopName}[loop:${loop.id}]: ${cycle} → ${nodeLabels.get(loop.nodeIds[0]) ?? loop.nodeIds[0]} (${descriptors.join(', ')})`;
  });

  return `Detected feedback loops:\n${lines.join('\n')}`;
}

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
      if (framework.supportsEdgePolarity && e.polarity) parts.push(`polarity=${e.polarity}`);
      if (framework.supportsEdgeDelay && e.delay) parts.push('delay=true');
      if (e.notes) parts.push(`notes="${e.notes}"`);
      return `  - ${parts.join(', ')}`;
    })
    .join('\n');

  const edgeVerb = framework.edgeLabel ?? 'causes';

  const tagList = framework.nodeTags.length > 0
    ? framework.nodeTags.map((t) => `${t.id} (${t.name})`).join(', ')
    : 'none';
  const graphRule = framework.allowsCycles
    ? 'Cycles and feedback loops are allowed when they reflect real system behavior.'
    : `Edge direction means "source ${edgeVerb} target" — this is a DAG (no cycles).`;
  const polarityRule = framework.supportsEdgePolarity
    ? 'Use polarity=positive for same-direction influence and polarity=negative for opposite-direction influence.'
    : 'Confidence is the primary edge attribute: high (default, solid), medium (dashed), or low (dotted).';
  const delayRule = framework.supportsEdgeDelay
    ? 'Set delay=true when the source affects the target only after a noticeable lag.'
    : 'Use notes when you need to explain timing or caveats.';
  const loopAnalysis = framework.allowsCycles
    ? buildLoopAnalysis(diagram)
    : '';
  const loopReasoningRule = framework.allowsCycles
    ? 'When loops are present, refer to them by the provided R#/B# names, explain whether each loop is reinforcing or balancing from its signed edges, and suggest flywheel rewrites or simplifications when the structure is overly redundant.'
    : 'Focus on causes, dependencies, and missing links rather than feedback loops.';

  return `You are an AI assistant for Sketchy, a thinking-frameworks diagram editor.

The user is working on a "${framework.name}" diagram called "${diagram.name}".
${framework.description}

Current diagram state:
Nodes:
${nodesDesc || '  (none)'}

Edges (source ${edgeVerb} target):
${edgesDesc || '  (none)'}

${loopAnalysis}

You can either:
1. Answer questions about the diagram — analyze the structure, identify issues, suggest improvements.
2. Make changes by calling the modify_diagram tool — add/update/remove nodes and edges.

Rules for modifications:
- ${graphRule}
- Keep node labels concise (under 15 words).
- When adding nodes, use IDs like "new_1", "new_2", etc.
- When referencing existing nodes, use their exact IDs.
- Available tags: ${tagList}.
- ${polarityRule}
- Edges can also use confidence to express uncertainty: high (default, solid), medium (dashed), or low (dotted).
- ${delayRule}
- ${loopReasoningRule}
- Edges can have notes — use them to explain the causal reasoning behind the connection.
- When mentioning an existing node in prose, use Label[node:<node-id>] with the node's current label, or its ID if it has no label.
- When mentioning an existing edge in prose, use Source -> Target[edge:<edge-id>] with the current source and target labels.
- When mentioning an existing loop in prose, use R1[loop:<loop-id>] or B1[loop:<loop-id>] using the loop labels provided above.
- Examples: Demand[node:n1], Demand -> Growth[edge:e1], R1[loop:n1>n2>n3].
- If you cannot form a valid typed mention, fall back to plain text rather than inventing IDs.
- Always explain your reasoning.`;
}

// --- Conversation pruning ---

const MAX_HISTORY_MESSAGES = 16; // ~8 exchanges (user + assistant pairs)

function pruneHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  return messages.slice(-MAX_HISTORY_MESSAGES);
}

// --- Anthropic tool format ---

const anthropicModifyDiagramTool = {
  name: modifyDiagramTool.function.name,
  description: modifyDiagramTool.function.description,
  input_schema: modifyDiagramTool.function.parameters,
};

// --- Request builders ---

function buildOpenAIRequest(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
): { url: string; headers: Record<string, string>; body: string } {
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...pruneHistory(messages).map((m) => ({ role: m.role, content: m.content })),
  ];
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    headers: buildHeaders(apiKey, 'openai'),
    body: JSON.stringify({
      model,
      messages: apiMessages,
      tools: [modifyDiagramTool],
      tool_choice: 'auto',
      stream: true,
    }),
  };
}

function buildAnthropicRequest(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
): { url: string; headers: Record<string, string>; body: string } {
  const userMessages = pruneHistory(messages)
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/messages`,
    headers: buildHeaders(apiKey, 'anthropic'),
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: userMessages,
      tools: [anthropicModifyDiagramTool],
      stream: true,
    }),
  };
}

// --- SSE line parsers ---

interface ParseState {
  contentText: string;
  toolCalls: { name: string; args: string }[];
}

function processOpenAILine(
  line: string,
  state: ParseState,
  callbacks: StreamCallbacks,
): void {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) return;
  const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
  if (data === '[DONE]') return;

  try {
    const parsed = JSON.parse(data);
    const delta = parsed.choices?.[0]?.delta;
    if (!delta) return;

    if (delta.content) {
      state.contentText += delta.content;
      callbacks.onToken(delta.content);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!state.toolCalls[idx]) state.toolCalls[idx] = { name: '', args: '' };
        if (tc.function?.name) state.toolCalls[idx].name = tc.function.name;
        if (tc.function?.arguments) state.toolCalls[idx].args += tc.function.arguments;
      }
    }
  } catch {
    // Skip malformed SSE chunks
  }
}

function processAnthropicLine(
  line: string,
  state: ParseState,
  callbacks: StreamCallbacks,
): void {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) return;
  const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);

  try {
    const parsed = JSON.parse(data);

    if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
      state.toolCalls.push({ name: parsed.content_block.name ?? '', args: '' });
    }

    if (parsed.type === 'content_block_delta') {
      if (parsed.delta?.type === 'text_delta' && parsed.delta.text) {
        state.contentText += parsed.delta.text;
        callbacks.onToken(parsed.delta.text);
      }
      if (parsed.delta?.type === 'input_json_delta' && parsed.delta.partial_json) {
        const lastTool = state.toolCalls[state.toolCalls.length - 1];
        if (lastTool) lastTool.args += parsed.delta.partial_json;
      }
    }
  } catch {
    // Skip malformed SSE chunks
  }
}

// --- Finalize tool calls into modifications ---

function finalizeToolCalls(
  toolCalls: { name: string; args: string }[],
  contentText: string,
  callbacks: StreamCallbacks,
): void {
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
        text: explanations.join(' ') || contentText || 'Changes applied.',
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
  provider: string = 'openai',
): AbortController {
  const controller = new AbortController();
  const systemPrompt = buildSystemPrompt(diagram, framework);

  const isAnthropic = provider === 'anthropic';
  const req = isAnthropic
    ? buildAnthropicRequest(baseUrl, apiKey, model, systemPrompt, messages)
    : buildOpenAIRequest(baseUrl, apiKey, model, systemPrompt, messages);

  const processLine = isAnthropic ? processAnthropicLine : processOpenAILine;

  fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: req.body,
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
      const state: ParseState = { contentText: '', toolCalls: [] };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          processLine(line, state, callbacks);
        }
      }

      if (buffer.trim()) {
        processLine(buffer, state, callbacks);
      }

      finalizeToolCalls(state.toolCalls, state.contentText, callbacks);
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}
