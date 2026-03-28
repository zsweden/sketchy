import type { Diagram } from '../types';

// --- Types ---

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DiagramModification {
  addNodes: { id: string; label: string; tags?: string[] }[];
  updateNodes: { id: string; label?: string; tags?: string[]; notes?: string }[];
  removeNodeIds: string[];
  addEdges: { source: string; target: string }[];
  removeEdgeIds: string[];
}

interface OpenAIFunctionCall {
  name: string;
  arguments: string;
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  function_call?: OpenAIFunctionCall;
}

interface OpenAIResponse {
  choices: { message: OpenAIMessage }[];
  error?: { message: string };
}

// --- Function definition for OpenAI ---

const modifyDiagramFunction = {
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
              description: 'Tag IDs to apply (e.g. ["ude"])',
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
          },
          required: ['source', 'target'],
        },
      },
      removeEdgeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of edges to remove',
      },
    },
    required: ['explanation'],
  },
};

// --- System prompt builder ---

function buildSystemPrompt(diagram: Diagram, frameworkName: string): string {
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
    .map((e) => `  - id="${e.id}", "${e.source}" → "${e.target}"`)
    .join('\n');

  return `You are an AI assistant for Sketchy, a thinking-frameworks diagram editor.

The user is working on a "${frameworkName}" diagram called "${diagram.name}".

Current diagram state:
Nodes:
${nodesDesc || '  (none)'}

Edges (source causes target):
${edgesDesc || '  (none)'}

You can either:
1. Answer questions about the diagram — analyze the causal structure, identify issues, suggest improvements.
2. Make changes by calling the modify_diagram function — add/update/remove nodes and edges.

Rules for modifications:
- Edge direction means "source causes target" — this is a DAG (no cycles).
- Keep node labels concise (under 15 words).
- When adding nodes, use IDs like "new_1", "new_2", etc.
- When referencing existing nodes, use their exact IDs.
- Available tags: ude (Undesirable Effect).
- Always explain your reasoning.`;
}

// --- API call ---

export async function sendChatMessage(
  apiKey: string,
  diagram: Diagram,
  frameworkName: string,
  messages: ChatMessage[],
): Promise<{ text: string; modifications?: DiagramModification }> {
  const systemPrompt = buildSystemPrompt(diagram, frameworkName);

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: apiMessages,
      functions: [modifyDiagramFunction],
      function_call: 'auto',
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errorBody}`);
  }

  const data: OpenAIResponse = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const choice = data.choices[0]?.message;
  if (!choice) throw new Error('No response from OpenAI');

  // Handle function call response
  if (choice.function_call?.name === 'modify_diagram') {
    const args = JSON.parse(choice.function_call.arguments);
    const modifications: DiagramModification = {
      addNodes: args.addNodes ?? [],
      updateNodes: args.updateNodes ?? [],
      removeNodeIds: args.removeNodeIds ?? [],
      addEdges: args.addEdges ?? [],
      removeEdgeIds: args.removeEdgeIds ?? [],
    };
    return {
      text: args.explanation ?? 'Changes applied.',
      modifications,
    };
  }

  // Plain text response
  return { text: choice.content ?? '' };
}
