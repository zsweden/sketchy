import type { NamedCausalLoop } from '../../core/graph/derived';
import type { DiagramEdge, DiagramNode } from '../../core/types';

export type ChatMentionKind = 'node' | 'edge' | 'loop';

export interface ChatMentionTarget {
  kind: ChatMentionKind;
  id: string;
  label: string;
}

export interface ChatMentionSegment {
  type: 'mention';
  text: string;
  mention: ChatMentionTarget;
}

export interface ChatTextSegment {
  type: 'text';
  text: string;
}

export type ParsedChatSegment = ChatMentionSegment | ChatTextSegment;

const MENTION_PATTERN = /\[(node|edge|loop):([^\]]+)\]/g;

function getNodeLabel(node: DiagramNode): string {
  return node.data.label || node.id;
}

function getMentionLabelCandidates(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): Map<string, string[]> {
  const candidates = new Map<string, string[]>();
  const nodeLabels = new Map(nodes.map((node) => [node.id, getNodeLabel(node)]));

  for (const node of nodes) {
    candidates.set(`node:${node.id}`, [getNodeLabel(node)]);
  }

  for (const edge of edges) {
    const sourceLabel = nodeLabels.get(edge.source) ?? edge.source;
    const targetLabel = nodeLabels.get(edge.target) ?? edge.target;
    candidates.set(`edge:${edge.id}`, [
      `${sourceLabel} -> ${targetLabel}`,
      `${sourceLabel} → ${targetLabel}`,
    ]);
  }

  for (const loop of loops) {
    candidates.set(`loop:${loop.id}`, [loop.label]);
  }

  return candidates;
}

export function parseChatMessageMentions(
  text: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  loops: NamedCausalLoop[],
): ParsedChatSegment[] {
  const labelCandidates = getMentionLabelCandidates(nodes, edges, loops);
  const segments: ParsedChatSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const kind = match[1] as ChatMentionKind;
    const id = match[2];
    const matchIndex = match.index ?? 0;
    const bracketText = match[0];
    const candidates = labelCandidates.get(`${kind}:${id}`) ?? [];

    let matchedLabel: string | null = null;
    for (const candidate of [...candidates].sort((a, b) => b.length - a.length)) {
      const labelStart = matchIndex - candidate.length;
      if (labelStart < cursor) continue;
      if (text.slice(labelStart, matchIndex) === candidate) {
        matchedLabel = candidate;
        break;
      }
    }

    if (!matchedLabel) continue;

    const labelStart = matchIndex - matchedLabel.length;
    if (labelStart > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, labelStart) });
    }

    segments.push({
      type: 'mention',
      text: `${matchedLabel}${bracketText}`,
      mention: { kind, id, label: matchedLabel },
    });
    cursor = matchIndex + bracketText.length;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text }];
}
