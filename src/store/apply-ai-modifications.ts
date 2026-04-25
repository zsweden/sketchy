import type { DiagramModification } from '../core/ai/openai-client';
import type { EdgePolarity, JunctionType } from '../core/types';
import { getJunctionOptions } from '../core/framework-types';
import type { BatchMutations } from './diagram-store-types';
import { useDiagramStore } from './diagram-store';
import { useChatStore } from './chat-store';
import { resolveFramework } from './diagram-framework';

function shouldAutoLayout(mods: DiagramModification): boolean {
  return mods.addNodes.length > 0
    || mods.removeNodeIds.length > 0
    || mods.addEdges.length > 0
    || mods.removeEdgeIds.length > 0;
}

const JUNCTION_TYPES = ['and', 'or', 'add', 'multiply'] as const;
const EDGE_CONFIDENCE = ['high', 'medium', 'low'] as const;
const EDGE_POLARITY = ['positive', 'negative'] as const;
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalColorOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : undefined;
}

function optionalEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value
    : undefined;
}

function sanitizeTags(value: unknown, allowedTagIds: ReadonlySet<string>): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return Array.from(new Set(value.filter((tag): tag is string =>
    typeof tag === 'string' && allowedTagIds.has(tag),
  )));
}

function normalizeAiModifications(raw: DiagramModification): DiagramModification {
  const diagram = useDiagramStore.getState().diagram;
  const framework = resolveFramework(diagram.frameworkId);
  const allowedTagIds = new Set(framework.nodeTags.map((tag) => tag.id));
  const allowedJunctionIds = new Set(getJunctionOptions(framework).map((option) => option.id));

  const addNodes = asArray((raw as unknown as Record<string, unknown>)?.addNodes)
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const id = nonEmptyString(entry.id);
      const label = optionalString(entry.label);
      if (!id || label === undefined) return [];

      const value = framework.supportsNodeValues ? optionalNumberOrNull(entry.value) : undefined;
      const unit = framework.supportsNodeValues ? optionalString(entry.unit) : undefined;
      const color = optionalColorOrNull(entry.color);
      const textColor = optionalColorOrNull(entry.textColor);
      const junctionType = optionalEnum(entry.junctionType, JUNCTION_TYPES);
      return [{
        id,
        label,
        ...(sanitizeTags(entry.tags, allowedTagIds) ? { tags: sanitizeTags(entry.tags, allowedTagIds) } : {}),
        ...(optionalString(entry.notes) ? { notes: optionalString(entry.notes) } : {}),
        ...(value !== undefined ? { value } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(textColor !== undefined ? { textColor } : {}),
        ...(junctionType && allowedJunctionIds.has(junctionType) ? { junctionType: junctionType as JunctionType } : {}),
      }];
    });

  const updateNodes = asArray((raw as unknown as Record<string, unknown>)?.updateNodes)
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const id = nonEmptyString(entry.id);
      if (!id) return [];
      const value = framework.supportsNodeValues ? optionalNumberOrNull(entry.value) : undefined;
      const unit = framework.supportsNodeValues ? optionalString(entry.unit) : undefined;
      const color = optionalColorOrNull(entry.color);
      const textColor = optionalColorOrNull(entry.textColor);
      const junctionType = optionalEnum(entry.junctionType, JUNCTION_TYPES);
      const tags = sanitizeTags(entry.tags, allowedTagIds);

      return [{
        id,
        ...(optionalString(entry.label) !== undefined ? { label: optionalString(entry.label) } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(optionalString(entry.notes) !== undefined ? { notes: optionalString(entry.notes) } : {}),
        ...(value !== undefined ? { value } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(textColor !== undefined ? { textColor } : {}),
        ...(junctionType && allowedJunctionIds.has(junctionType) ? { junctionType: junctionType as JunctionType } : {}),
      }];
    });

  const addEdges = asArray((raw as unknown as Record<string, unknown>)?.addEdges)
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const source = nonEmptyString(entry.source);
      const target = nonEmptyString(entry.target);
      if (!source || !target) return [];
      const confidence = optionalEnum(entry.confidence, EDGE_CONFIDENCE);
      const polarity = framework.supportsEdgePolarity
        ? optionalEnum(entry.polarity, EDGE_POLARITY)
        : undefined;
      return [{
        source,
        target,
        ...(confidence ? { confidence } : {}),
        ...(polarity ? { polarity: polarity as EdgePolarity } : {}),
        ...(framework.supportsEdgeDelay && typeof entry.delay === 'boolean' ? { delay: entry.delay } : {}),
        ...(optionalString(entry.notes) ? { notes: optionalString(entry.notes) } : {}),
      }];
    });

  const updateEdges = asArray((raw as unknown as Record<string, unknown>)?.updateEdges)
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const id = nonEmptyString(entry.id);
      if (!id) return [];
      const confidence = optionalEnum(entry.confidence, EDGE_CONFIDENCE);
      const polarity = framework.supportsEdgePolarity
        ? optionalEnum(entry.polarity, EDGE_POLARITY)
        : undefined;
      return [{
        id,
        ...(confidence ? { confidence } : {}),
        ...(polarity ? { polarity: polarity as EdgePolarity } : {}),
        ...(framework.supportsEdgeDelay && typeof entry.delay === 'boolean' ? { delay: entry.delay } : {}),
        ...(optionalString(entry.notes) !== undefined ? { notes: optionalString(entry.notes) } : {}),
      }];
    });

  return {
    addNodes,
    updateNodes,
    removeNodeIds: asArray((raw as unknown as Record<string, unknown>)?.removeNodeIds)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
    addEdges,
    updateEdges,
    removeEdgeIds: asArray((raw as unknown as Record<string, unknown>)?.removeEdgeIds)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  };
}

/**
 * Applies AI diagram modifications through the diagram store's batchApply,
 * tracks modified node IDs in the chat store, and triggers auto-layout
 * when structural changes are present.
 *
 * Returns the placeholder→real ID map from batchApply.
 */
export function applyAiModifications(mods: DiagramModification): Map<string, string> {
  const safeMods = normalizeAiModifications(mods);
  const mutations: BatchMutations = {
    addNodes: safeMods.addNodes,
    updateNodes: safeMods.updateNodes,
    removeNodeIds: safeMods.removeNodeIds,
    addEdges: safeMods.addEdges,
    updateEdges: safeMods.updateEdges,
    removeEdgeIds: safeMods.removeEdgeIds,
  };

  const idMap = useDiagramStore.getState().batchApply(mutations);

  // Track AI-modified node IDs (resolved to real UUIDs)
  const prev = useChatStore.getState().aiModifiedNodeIds;
  const modifiedIds = new Set(prev);
  for (const node of safeMods.addNodes) {
    const realId = idMap.get(node.id);
    if (realId) modifiedIds.add(realId);
  }
  for (const upd of safeMods.updateNodes) {
    modifiedIds.add(idMap.get(upd.id) ?? upd.id);
  }
  useChatStore.setState({ aiModifiedNodeIds: modifiedIds });

  if (shouldAutoLayout(safeMods)) {
    void useDiagramStore.getState().runAutoLayout({ fitView: true });
  }

  return idMap;
}
