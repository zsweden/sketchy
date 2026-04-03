import type { Diagram } from '../types';
import type { Framework } from '../framework-types';
import { findCausalLoops } from '../graph/derived';

export const modifyDiagramTool = {
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
              notes: {
                type: 'string',
                description: 'Optional node notes or reasoning',
              },
              color: {
                type: ['string', 'null'],
                description: 'Optional node background color as a hex code like "#FDE68A"',
              },
              textColor: {
                type: ['string', 'null'],
                description: 'Optional node text color as a hex code like "#1A1A1A"',
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
              color: {
                type: ['string', 'null'],
                description: 'Set the node background color with a hex code, or null to clear it',
              },
              textColor: {
                type: ['string', 'null'],
                description: 'Set the node text color with a hex code, or null to clear it',
              },
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

export const anthropicModifyDiagramTool = {
  name: modifyDiagramTool.function.name,
  description: modifyDiagramTool.function.description,
  input_schema: modifyDiagramTool.function.parameters,
};

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
    return `  - [${loopName}][loop:${loop.id}]: ${cycle} → ${nodeLabels.get(loop.nodeIds[0]) ?? loop.nodeIds[0]} (${descriptors.join(', ')})`;
  });

  return `Detected feedback loops:\n${lines.join('\n')}`;
}

export function buildSystemPrompt(diagram: Diagram, framework: Framework): string {
  const nodesDesc = diagram.nodes
    .map((n) => {
      const parts = [`id="${n.id}", label="${n.data.label}"`];
      if (n.data.tags.length) parts.push(`tags=[${n.data.tags.join(', ')}]`);
      if (n.data.notes) parts.push(`notes="${n.data.notes}"`);
      if (n.data.color) parts.push(`color="${n.data.color}"`);
      if (n.data.textColor) parts.push(`textColor="${n.data.textColor}"`);
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
    ? framework.nodeTags.map((t) => `${t.id} (${t.name} — ${t.description})`).join(', ')
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

  const confidenceRule = framework.supportsEdgePolarity
    ? '\n- Edges can also use confidence to express uncertainty: high (default, solid), medium (dashed), or low (dotted).'
    : '';
  const junctionRule = framework.supportsJunctions
    ? "\n- When multiple edges point to the same target, the junction type determines how causes combine: 'and' means all sources are needed together, 'or' (default) means each source independently causes the target."
    : '';
  const loopSection = loopAnalysis ? `\n${loopAnalysis}\n` : '';

  return `You are an AI assistant for Sketchy, a thinking-frameworks diagram editor.

The user is working on a "${framework.name}" diagram called "${diagram.name}".
${framework.description}

Current diagram state:
Nodes:
${nodesDesc || '  (none)'}

Edges (source ${edgeVerb} target):
${edgesDesc || '  (none)'}
${loopSection}
You can either:
1. Answer questions about the diagram — analyze the structure, identify issues, suggest improvements.
2. Make changes by calling the modify_diagram tool — add/update/remove nodes and edges.

Only modify what the user asks for. Do not add, remove, or restructure parts of the diagram the user didn't mention.

Rules for modifications:
- ${graphRule}
- Keep node labels concise (under 15 words).
- When adding nodes, use IDs like "new_1", "new_2", etc.
- When referencing existing nodes, use their exact IDs.
- Available tags: ${tagList}.
- Do NOT set color or textColor on nodes unless the user explicitly asks for colors or styling. Leave them unset by default.${junctionRule}
- ${polarityRule}${confidenceRule}
- ${delayRule}
- ${loopReasoningRule}
- Edges can have notes — use them to explain the causal reasoning behind the connection.
- When mentioning diagram elements in prose, use this format: [Label][kind:id]. Examples: [Demand][node:n1], [Demand -> Growth][edge:e1], [R1][loop:n1>n2>n3]. Never put punctuation inside the kind:id bracket. If you cannot form a valid mention, fall back to plain text rather than inventing IDs.
- Reply in plain text only. Do not use Markdown formatting such as headings (#), bold (**), italic (*), tables, or code fences. Use "* " to start bullet points and UPPERCASE for section headings (e.g. "ANALYSIS").
- Always explain your reasoning.`;
}
