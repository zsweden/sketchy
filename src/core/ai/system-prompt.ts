import type { Diagram } from '../types';
import type { Framework } from '../framework-types';
import { getJunctionOptions } from '../framework-types';
import { findCausalLoops } from '../graph/derived';
import { listFrameworks } from '../../frameworks/registry';

// Re-export tools so existing consumers don't need to change imports
export {
  modifyDiagramTool,
  anthropicModifyDiagramTool,
  suggestFrameworksTool,
  anthropicSuggestFrameworksTool,
} from './tools';

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
  const isMathJunctionsLocal = getJunctionOptions(framework).some((o) => o.id === 'add' || o.id === 'multiply');
  const defaultJunction = isMathJunctionsLocal ? 'add' : 'or';
  const nodesDesc = diagram.nodes
    .map((n) => {
      const parts = [`id="${n.id}", label="${n.data.label}"`];
      if (n.data.tags.length) parts.push(`tags=[${n.data.tags.join(', ')}]`);
      if (n.data.notes) parts.push(`notes="${n.data.notes}"`);
      if (n.data.value != null) parts.push(`value=${n.data.value}`);
      if (n.data.unit) parts.push(`unit="${n.data.unit}"`);
      if (n.data.color) parts.push(`color="${n.data.color}"`);
      if (n.data.textColor) parts.push(`textColor="${n.data.textColor}"`);
      if (n.data.junctionType !== defaultJunction) parts.push(`junction=${n.data.junctionType}`);
      if (isMathJunctionsLocal) parts.push(`operator=${n.data.junctionType}`);
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
  const isMathJunctions = getJunctionOptions(framework).some((o) => o.id === 'add' || o.id === 'multiply');
  const polarityRule = framework.supportsEdgePolarity
    ? isMathJunctions
      ? 'Use polarity=positive (default) for additive/multiplicative contribution and polarity=negative for subtraction/division.'
      : 'Use polarity=positive for same-direction influence and polarity=negative for opposite-direction influence.'
    : 'Confidence is the primary edge attribute: high (default, solid), medium (dashed), or low (dotted).';
  const delayRule = framework.supportsEdgeDelay
    ? 'Set delay=true when the source affects the target only after a noticeable lag.'
    : 'Use notes when you need to explain timing or caveats.';
  const loopAnalysis = framework.allowsCycles
    ? buildLoopAnalysis(diagram)
    : '';
  const loopReasoningRule = framework.allowsCycles
    ? 'When loops are present, refer to them using mention syntax (e.g. [R1][loop:n1>n2>n3]), explain whether each loop is reinforcing or balancing from its signed edges, and suggest flywheel rewrites or simplifications when the structure is overly redundant.'
    : 'Focus on causes, dependencies, and missing links rather than feedback loops.';

  const confidenceRule = framework.supportsEdgePolarity
    ? '\n- Edges can also use confidence to express uncertainty: high (default, solid), medium (dashed), or low (dotted).'
    : '';
  const nodeValueRule = framework.supportsNodeValues
    ? "\n- Nodes support numeric values: set 'value' (number) and 'unit' (string like '$', '%', 'users') to display metrics on nodes. Set value=null to clear. When the user provides quantitative data, populate these fields."
    : '';
  const junctionRule = framework.supportsJunctions
    ? isMathJunctions
      ? "\n- When multiple edges point to the same target, the node's operator determines how children combine: 'add' (default) sums children, 'multiply' multiplies them. Use edge polarity=negative to subtract or divide."
      : "\n- When multiple edges point to the same target, the junction type determines how causes combine: 'and' means all sources are needed together, 'or' (default) means each source independently causes the target."
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
- Do NOT set color or textColor on nodes unless the user explicitly asks for colors or styling. Leave them unset by default.${nodeValueRule}${junctionRule}
- ${polarityRule}${confidenceRule}
- ${delayRule}
- ${loopReasoningRule}
- Edges can have notes — use them to explain the causal reasoning behind the connection.
- When mentioning diagram elements in prose, use this exact format: [Label][kind:id]. The two bracket groups must be adjacent with NO space between them. Examples: [Demand][node:n1], [Demand -> Growth][edge:e1], [R1][loop:n1>n2>n3]. WRONG: R1 [loop:n1>n2>n3]. CORRECT: [R1][loop:n1>n2>n3]. Never put punctuation inside the kind:id bracket. If you cannot form a valid mention, fall back to plain text rather than inventing IDs.
- Reply in plain text only. No Markdown, no section headings, no bullet lists unless the user explicitly asks for a list. Keep replies to 1–3 sentences unless the user asks for more detail. No preamble, no restating the question, no trailing summary.${framework.systemPromptHint ? `\n\nFramework-specific guidance:\n${framework.systemPromptHint}` : ''}`;
}

export function buildGuideSystemPrompt(diagram: Diagram, framework: Framework): string {
  // Start with the full normal system prompt (diagram state, current framework rules, modify_diagram)
  const basePrompt = buildSystemPrompt(diagram, framework);

  // Build the alternatives list (all frameworks except the current one)
  const alternatives = listFrameworks()
    .filter((fw) => fw.id !== framework.id)
    .map((fw) => {
      const tags = fw.nodeTags.length > 0
        ? ` Node types: ${fw.nodeTags.map((t) => t.name).join(', ')}.`
        : '';
      return `  - ${fw.id}: ${fw.name} — ${fw.description}.${tags}`;
    })
    .join('\n');

  return `${basePrompt}

GUIDE MODE IS ON.
Before making any diagram changes, evaluate whether "${framework.name}" is the best framework for what the user is describing.

- If "${framework.name}" is a good fit: proceed normally — answer questions or use modify_diagram to build the diagram. No need to mention other frameworks.
- If a different framework would be a better fit: call the suggest_frameworks tool with 1-3 ranked recommendations (best fit first, 1-2 sentence reason each). Include "${framework.name}" in the list only if it's still a reasonable option. The system will handle switching — never tell the user to switch manually.
- If the user rejects your suggestions, suggest alternatives or ask clarifying questions.

Alternative frameworks available:
${alternatives}`;
}
