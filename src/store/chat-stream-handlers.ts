import type { Framework } from '../core/framework-types';
import type { Diagram } from '../core/types';
import type { DiagramModification } from '../core/ai/openai-client';
import type { FrameworkSuggestions } from '../core/ai/ai-types';
import type { ParsedChatSegment } from '../core/chat/mentions';
import type { DisplayMessage } from './chat-store-types';
import { buildChatMessageRenderData, remapCanonicalMentionIds } from '../core/chat/mentions';
import { findCausalLoops, labelCausalLoops } from '../core/graph/derived';
import { applyAiModifications } from './apply-ai-modifications';
import { useDiagramStore } from './diagram-store';
import { reportError } from '../core/monitoring/error-logging';

const EMPTY_RESPONSE_FALLBACK = 'The AI returned an empty response. Please try again.';

function getLoopsForDiagram(diagram: Diagram, framework: Framework) {
  return framework.allowsCycles ? labelCausalLoops(findCausalLoops(diagram.edges)) : [];
}

function createTextSegments(text: string): ParsedChatSegment[] {
  return [{ type: 'text', text }];
}

export function createAssistantMessage(
  content: string,
  options?: {
    diagram?: Diagram;
    framework?: Framework;
    modifications?: DiagramModification;
    retryText?: string;
  },
): DisplayMessage {
  if (options?.diagram && options.framework) {
    const renderData = buildChatMessageRenderData(
      content,
      options.diagram.nodes,
      options.diagram.edges,
      getLoopsForDiagram(options.diagram, options.framework),
    );

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: renderData.normalizedText,
      displayText: renderData.displayText,
      segments: renderData.segments,
      modifications: options.modifications,
      retryText: options.retryText,
    };
  }

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    displayText: content,
    segments: createTextSegments(content),
    modifications: options?.modifications,
    retryText: options?.retryText,
  };
}

export interface ErrorMetadataContext {
  provider: string;
  model: string;
  baseUrl: string;
  frameworkId: string;
  historyCount: number;
  userMessageLength: number;
}

function getEndpointHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || 'unknown';
  } catch {
    return 'invalid_url';
  }
}

function buildBaseMetadata(ctx: ErrorMetadataContext) {
  return {
    provider: ctx.provider,
    model: ctx.model,
    endpointHost: getEndpointHost(ctx.baseUrl),
    frameworkId: ctx.frameworkId,
    historyCount: ctx.historyCount,
  };
}

interface StreamDoneResult {
  text: string;
  modifications?: DiagramModification;
  suggestions?: FrameworkSuggestions;
}

interface DoneOutcome {
  assistantMsg: DisplayMessage;
  pendingSuggestions?: FrameworkSuggestions;
}

export function processStreamDone(
  result: StreamDoneResult,
  diagram: Diagram,
  framework: Framework,
  ctx: ErrorMetadataContext,
  streamingLength: number,
): DoneOutcome {
  // Guide mode: framework suggestions
  if (result.suggestions && result.suggestions.length > 0) {
    const content = result.text.trim() || result.suggestions.map((s) => `${s.frameworkName}: ${s.reason}`).join('\n');
    return {
      assistantMsg: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        displayText: content,
        segments: createTextSegments(content),
        suggestions: result.suggestions,
      },
      pendingSuggestions: result.suggestions,
    };
  }

  let messageDiagram = diagram;
  let normalizedInput = result.text;

  if (result.modifications) {
    const idMap = applyAiModifications(result.modifications);
    normalizedInput = remapCanonicalMentionIds(result.text, idMap);
    messageDiagram = useDiagramStore.getState().diagram;
  }

  const renderData = buildChatMessageRenderData(
    normalizedInput,
    messageDiagram.nodes,
    messageDiagram.edges,
    getLoopsForDiagram(messageDiagram, framework),
  );
  const trimmedText = renderData.normalizedText.trim();
  const content = trimmedText || EMPTY_RESPONSE_FALLBACK;

  if (renderData.malformedMentionCount > 0) {
    void reportError(new Error('AI chat returned malformed canonical mentions'), {
      source: 'chat.malformed_mention',
      fatal: false,
      metadata: {
        ...buildBaseMetadata(ctx),
        malformedMentionCount: renderData.malformedMentionCount,
        resultTextLength: result.text.length,
        normalizedTextLength: renderData.normalizedText.length,
      },
    });
  }

  if (!trimmedText) {
    void reportError(new Error('AI chat returned empty assistant response'), {
      source: 'chat.empty_response',
      fatal: false,
      metadata: {
        ...buildBaseMetadata(ctx),
        userMessageLength: ctx.userMessageLength,
        streamingLength,
        resultTextLength: result.text.length,
        normalizedTextLength: renderData.normalizedText.length,
        hasModifications: Boolean(result.modifications),
        addedNodes: result.modifications?.addNodes.length ?? 0,
        updatedNodes: result.modifications?.updateNodes.length ?? 0,
        removedNodes: result.modifications?.removeNodeIds.length ?? 0,
        addedEdges: result.modifications?.addEdges.length ?? 0,
        updatedEdges: result.modifications?.updateEdges.length ?? 0,
        removedEdges: result.modifications?.removeEdgeIds.length ?? 0,
      },
    });
  }

  return {
    assistantMsg: createAssistantMessage(content, {
      diagram: trimmedText ? messageDiagram : undefined,
      framework: trimmedText ? framework : undefined,
      modifications: result.modifications,
    }),
  };
}

export function reportStreamError(error: Error, ctx: ErrorMetadataContext): void {
  void reportError(error, {
    source: 'chat.stream_error',
    fatal: false,
    metadata: {
      ...buildBaseMetadata(ctx),
      userMessageLength: ctx.userMessageLength,
    },
  });
}
