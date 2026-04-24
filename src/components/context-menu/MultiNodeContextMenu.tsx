import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Lock, Unlock, Trash2 } from 'lucide-react';
import {
  getJunctionOptions,
  type Framework,
} from '../../core/framework-types';
import type { DiagramNode, JunctionType } from '../../core/types';
import type { NodeDegrees } from '../../core/graph/derived';
import { useDiagramStore } from '../../store/diagram-store';
import type { DiagramSnapshot } from '../../store/diagram-store-types';
import { rememberRecentColor } from '../../store/color-history-store';
import ColorPickerSection from '../shared/ColorPickerSection';
import { colorsMatch } from '../shared/color-utils';

interface Props {
  selectedNodes: DiagramNode[];
  framework: Framework;
  degreesMap: Map<string, NodeDegrees>;
  closeContextMenu: () => void;
  beginColorPickerInteraction: () => void;
  endColorPickerInteraction: () => void;
  registerCloseActions: (actions: { apply: () => void; cancel: () => void } | null) => void;
}

function sharedColor(
  nodes: DiagramNode[],
  key: 'color' | 'textColor',
): string | undefined {
  if (nodes.length === 0) return undefined;
  const first = nodes[0].data[key];
  return nodes.every((n) => colorsMatch(n.data[key], first)) ? first : undefined;
}

export default function MultiNodeContextMenu({
  selectedNodes,
  framework,
  degreesMap,
  closeContextMenu,
  beginColorPickerInteraction,
  endColorPickerInteraction,
  registerCloseActions,
}: Props) {
  const addNodesTag = useDiagramStore((s) => s.addNodesTag);
  const removeNodesTag = useDiagramStore((s) => s.removeNodesTag);
  const updateNodesJunction = useDiagramStore((s) => s.updateNodesJunction);
  const previewNodeColor = useDiagramStore((s) => s.previewNodeColor);
  const previewNodeTextColor = useDiagramStore((s) => s.previewNodeTextColor);
  const previewNodesColor = useDiagramStore((s) => s.previewNodesColor);
  const previewNodesTextColor = useDiagramStore((s) => s.previewNodesTextColor);
  const pushHistoryEntry = useDiagramStore((s) => s.pushHistoryEntry);
  const toggleNodeLocked = useDiagramStore((s) => s.toggleNodeLocked);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);

  const ids = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);

  const originalsRef = useRef(
    new Map(selectedNodes.map((n) => [n.id, {
      color: n.data.color,
      textColor: n.data.textColor,
    }])),
  );
  // Snapshot the pre-preview diagram so a single undo can restore it after the
  // user commits a color change made via interactive preview swatches.
  const preStateRef = useRef<DiagramSnapshot | null>(null);
  const bgDirtyRef = useRef(false);
  const textDirtyRef = useRef(false);

  const currentBg = sharedColor(selectedNodes, 'color');
  const currentText = sharedColor(selectedNodes, 'textColor');

  const captureSnapshotOnce = useCallback(() => {
    if (preStateRef.current) return;
    const diagram = useDiagramStore.getState().diagram;
    preStateRef.current = {
      nodes: diagram.nodes,
      edges: diagram.edges,
      annotations: diagram.annotations,
    };
  }, []);

  const setBackgroundColor = useCallback((color: string | undefined) => {
    captureSnapshotOnce();
    bgDirtyRef.current = true;
    previewNodesColor(ids, color);
  }, [captureSnapshotOnce, ids, previewNodesColor]);

  const setTextColor = useCallback((color: string | undefined) => {
    captureSnapshotOnce();
    textDirtyRef.current = true;
    previewNodesTextColor(ids, color);
  }, [captureSnapshotOnce, ids, previewNodesTextColor]);

  const commitColors = useCallback(() => {
    const dirty = bgDirtyRef.current || textDirtyRef.current;
    if (!dirty || !preStateRef.current) return;
    pushHistoryEntry(preStateRef.current);
    if (bgDirtyRef.current) rememberRecentColor('background', currentBg);
    if (textDirtyRef.current) rememberRecentColor('text', currentText);
    preStateRef.current = null;
    bgDirtyRef.current = false;
    textDirtyRef.current = false;
  }, [currentBg, currentText, pushHistoryEntry]);

  const revertColors = useCallback(() => {
    originalsRef.current.forEach(({ color, textColor }, id) => {
      if (bgDirtyRef.current) previewNodeColor(id, color);
      if (textDirtyRef.current) previewNodeTextColor(id, textColor);
    });
    preStateRef.current = null;
    bgDirtyRef.current = false;
    textDirtyRef.current = false;
  }, [previewNodeColor, previewNodeTextColor]);

  useEffect(() => {
    registerCloseActions({
      apply: () => { commitColors(); closeContextMenu(); },
      cancel: () => { revertColors(); closeContextMenu(); },
    });
    return () => { registerCloseActions(null); };
  }, [closeContextMenu, registerCloseActions, commitColors, revertColors]);

  const applyAndClose = useCallback(() => {
    commitColors();
    closeContextMenu();
  }, [commitColors, closeContextMenu]);

  // Junction eligibility
  const junctionOptions = getJunctionOptions(framework);
  const isMath = junctionOptions.some((o) => o.id === 'add' || o.id === 'multiply');
  const minIndegree = isMath ? 1 : 2;
  const eligibleIds = selectedNodes
    .filter((n) => (degreesMap.get(n.id)?.indegree ?? 0) >= minIndegree)
    .map((n) => n.id);
  const showJunction = junctionOptions.length > 0 && eligibleIds.length > 0;

  const total = selectedNodes.length;
  const allLocked = selectedNodes.every((n) => n.data.locked);

  return (
    <>
      <div className="context-menu-label">{total} nodes selected</div>

      {framework.nodeTags.length > 0 && (
        <>
          {framework.nodeTags.map((tag) => {
            const count = selectedNodes.filter((n) => n.data.tags.includes(tag.id)).length;
            const allHave = count === total;
            const noneHave = count === 0;
            return (
              <div key={tag.id} className="context-menu-multi-row">
                <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                <span style={{ flex: 1 }}>{tag.name}</span>
                <span className="field-label" style={{ marginRight: '0.5rem' }}>
                  {count}/{total}
                </span>
                <button
                  className="btn btn-secondary btn-xs"
                  disabled={allHave}
                  onClick={() => { addNodesTag(ids, tag.id); applyAndClose(); }}
                  aria-label={`Add ${tag.name} to all selected`}
                >
                  Add
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  disabled={noneHave}
                  onClick={() => { removeNodesTag(ids, tag.id); applyAndClose(); }}
                  aria-label={`Remove ${tag.name} from all selected`}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <div className="context-menu-separator" />
        </>
      )}

      <ColorPickerSection
        label="Background"
        pickerAriaLabel="Custom background color for all selected nodes"
        currentColor={currentBg}
        fallbackInputColor="#F5F5EC"
        onColorChange={setBackgroundColor}
        onPickerFocus={beginColorPickerInteraction}
        onPickerBlur={endColorPickerInteraction}
      />

      <ColorPickerSection
        label="Text Color"
        pickerAriaLabel="Custom text color for all selected nodes"
        currentColor={currentText}
        fallbackInputColor="#1A1A1A"
        onColorChange={setTextColor}
        onPickerFocus={beginColorPickerInteraction}
        onPickerBlur={endColorPickerInteraction}
      />

      {showJunction && (
        <>
          <div className="context-menu-separator" />
          <div className="context-menu-label">
            {isMath ? 'Operator' : 'Junction Logic'}
          </div>
          <div className="context-menu-multi-row">
            {junctionOptions.map((o) => (
              <button
                key={o.id}
                className="btn btn-secondary btn-xs"
                style={{ flex: 1 }}
                title={o.description}
                onClick={() => {
                  updateNodesJunction(eligibleIds, o.id as JunctionType);
                  applyAndClose();
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {eligibleIds.length < total && (
            <p className="field-label" style={{ padding: '0 0.75rem 0.25rem' }}>
              Applies to {eligibleIds.length} of {total} selected
            </p>
          )}
        </>
      )}

      <div className="context-menu-separator" />
      <button
        className="context-menu-item"
        onClick={() => {
          toggleNodeLocked(ids, !allLocked);
          applyAndClose();
        }}
      >
        {allLocked ? <Lock size={14} /> : <Unlock size={14} />}
        {allLocked ? 'Unlock All' : 'Lock All'}
      </button>
      <button
        className="context-menu-item context-menu-item--danger"
        onClick={() => {
          deleteNodes(ids);
          closeContextMenu();
        }}
      >
        <Trash2 size={14} />
        Delete All
      </button>
    </>
  );
}
