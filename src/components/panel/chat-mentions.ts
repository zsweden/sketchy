import type { NamedCausalLoop } from '../../core/graph/derived';
import type { DiagramEdge, DiagramNode } from '../../core/types';

export type ChatMentionKind = 'node' | 'edge' | 'loop';

export interface ChatMentionTarget {
  kind: ChatMentionKind;
  id: string;
  displayText: string;
  rawText: string;
}

export interface ChatMentionSegment {
  type: 'mention';
  displayText: string;
  rawText: string;
  mention: ChatMentionTarget;
}

export interface ChatTextSegment {
  type: 'text';
  text: string;
}

export type ParsedChatSegment = ChatMentionSegment | ChatTextSegment;

const CANONICAL_MENTION_PATTERN = /\[([^\]]+)\]\[(node|edge|loop):([^\]]+)\]/g;
const STREAMING_CANONICAL_MENTION_PREFIX_PATTERN = /^\[([^\]]+)\]\[/;

interface ParsedChatSegmentsResult {
  segments: ParsedChatSegment[];
  malformedMentions: string[];
}

export interface ChatMessageRenderData {
  segments: ParsedChatSegment[];
  normalizedText: string;
  displayText: string;
  malformedMentionCount: number;
}

function getMentionIds(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): Record<ChatMentionKind, Set<string>> {
  return {
    node: new Set(nodes.map((node) => node.id)),
    edge: new Set(edges.map((edge) => edge.id)),
    loop: new Set(loops.map((loop) => loop.id)),
  };
}

function parseChatMessageMentionsDetailed(
  text: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): ParsedChatSegmentsResult {
  const mentionIds = getMentionIds(nodes, edges, loops);
  const segments: ParsedChatSegment[] = [];
  const malformedMentions: string[] = [];
  let cursor = 0;

  for (const match of text.matchAll(CANONICAL_MENTION_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const rawText = match[0];
    const displayText = match[1];
    const kind = match[2] as ChatMentionKind;
    const id = match[3];

    if (!mentionIds[kind].has(id)) {
      malformedMentions.push(rawText);
      continue;
    }

    if (matchIndex > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, matchIndex) });
    }

    segments.push({
      type: 'mention',
      displayText,
      rawText,
      mention: { kind, id, displayText, rawText },
    });
    cursor = matchIndex + rawText.length;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }

  return {
    segments: segments.length > 0 ? segments : [{ type: 'text', text }],
    malformedMentions,
  };
}

export function parseChatMessageMentions(
  text: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): ParsedChatSegment[] {
  return parseChatMessageMentionsDetailed(text, nodes, edges, loops).segments;
}

export function normalizeChatMessageMentions(
  text: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): string {
  return getNormalizedChatMessageTextFromSegments(
    parseChatMessageMentionsDetailed(text, nodes, edges, loops).segments,
  );
}

export function getChatMessageDisplayText(
  text: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): string {
  return getChatMessageDisplayTextFromSegments(
    parseChatMessageMentionsDetailed(text, nodes, edges, loops).segments,
  );
}

export function countMalformedCanonicalMentions(
  text: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): number {
  return parseChatMessageMentionsDetailed(text, nodes, edges, loops).malformedMentions.length;
}

export function getNormalizedChatMessageTextFromSegments(segments: ParsedChatSegment[]): string {
  return segments
    .map((segment) => segment.type === 'mention' ? segment.rawText : segment.text)
    .join('');
}

export function getChatMessageDisplayTextFromSegments(segments: ParsedChatSegment[]): string {
  return segments
    .map((segment) => segment.type === 'mention' ? segment.displayText : segment.text)
    .join('');
}

export function buildChatMessageRenderData(
  text: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): ChatMessageRenderData {
  const { segments, malformedMentions } = parseChatMessageMentionsDetailed(text, nodes, edges, loops);

  return {
    segments,
    normalizedText: getNormalizedChatMessageTextFromSegments(segments),
    displayText: getChatMessageDisplayTextFromSegments(segments),
    malformedMentionCount: malformedMentions.length,
  };
}

export function remapCanonicalMentionIds(text: string, idMap: Map<string, string>): string {
  return text.replace(CANONICAL_MENTION_PATTERN, (rawText, displayText, kind, id) => {
    const mappedId = idMap.get(id);
    if (!mappedId) return rawText;
    return `[${displayText}][${kind}:${mappedId}]`;
  });
}

function isPossibleCanonicalMentionKindPrefix(value: string): boolean {
  return ['node', 'edge', 'loop'].some((kind) => kind.startsWith(value));
}

function isIncompleteCanonicalMention(text: string): boolean {
  const match = text.match(STREAMING_CANONICAL_MENTION_PREFIX_PATTERN);
  if (!match) return false;

  const tagStart = match[0].length;
  const tagContent = text.slice(tagStart);
  if (tagContent.includes(']')) return false;

  const colonIndex = tagContent.indexOf(':');
  if (colonIndex === -1) {
    return isPossibleCanonicalMentionKindPrefix(tagContent);
  }

  const kind = tagContent.slice(0, colonIndex);
  const id = tagContent.slice(colonIndex + 1);
  return isPossibleCanonicalMentionKindPrefix(kind) && !id.includes(']');
}

export function getStreamingChatMessageDisplayText(text: string): string {
  let displayText = '';
  let cursor = 0;

  while (cursor < text.length) {
    const nextMentionStart = text.indexOf('[', cursor);
    if (nextMentionStart === -1) {
      displayText += text.slice(cursor);
      break;
    }

    displayText += text.slice(cursor, nextMentionStart);
    const remainder = text.slice(nextMentionStart);
    const mentionMatch = remainder.match(/^\[([^\]]+)\]\[(node|edge|loop):([^\]]+)\]/);
    if (mentionMatch) {
      displayText += mentionMatch[1];
      cursor = nextMentionStart + mentionMatch[0].length;
      continue;
    }

    if (isIncompleteCanonicalMention(remainder)) {
      break;
    }

    displayText += '[';
    cursor = nextMentionStart + 1;
  }

  return displayText;
}
