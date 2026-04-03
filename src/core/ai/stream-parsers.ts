import type { DiagramModification, StreamCallbacks } from './ai-types';

export interface ParseState {
  contentText: string;
  toolCalls: { name: string; args: string }[];
}

export function processOpenAILine(
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

export function processAnthropicLine(
  line: string,
  state: ParseState,
  callbacks: StreamCallbacks,
): void {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) return;
  const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);

  try {
    const parsed = JSON.parse(data);

    if (parsed.type === 'error') {
      const msg = parsed.error?.message ?? 'Unknown stream error';
      const type = parsed.error?.type ?? 'unknown';
      throw new Error(`Anthropic stream error (${type}): ${msg}`);
    }

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
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Anthropic stream error')) throw e;
    // Skip malformed SSE chunks
  }
}

export function finalizeToolCalls(
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
