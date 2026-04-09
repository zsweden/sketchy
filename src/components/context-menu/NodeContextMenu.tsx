import { useCallback, useEffect, useRef } from 'react';
import { Check, Lock, Unlock, Trash2 } from 'lucide-react';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { rememberRecentColor } from '../../store/color-history-store';
import { getJunctionState } from '../../core/framework-types';
import type { DiagramNode, JunctionType } from '../../core/types';
import ColorPickerSection from '../shared/ColorPickerSection';
import { colorsMatch } from '../shared/color-utils';

interface Props {
  node: DiagramNode;
  degrees: { indegree: number; outdegree: number } | null;
  closeContextMenu: () => void;
  beginColorPickerInteraction: () => void;
  endColorPickerInteraction: () => void;
  registerCloseActions: (actions: { apply: () => void; cancel: () => void } | null) => void;
}

export default function NodeContextMenu({
  node,
  degrees,
  closeContextMenu,
  beginColorPickerInteraction,
  endColorPickerInteraction,
  registerCloseActions,
}: Props) {
  const framework = useFramework();
  const updateNodeTags = useDiagramStore((s) => s.updateNodeTags);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const previewNodeColor = useDiagramStore((s) => s.previewNodeColor);
  const previewNodeTextColor = useDiagramStore((s) => s.previewNodeTextColor);
  const updateNodeColor = useDiagramStore((s) => s.updateNodeColor);
  const updateNodeTextColor = useDiagramStore((s) => s.updateNodeTextColor);
  const toggleNodeLocked = useDiagramStore((s) => s.toggleNodeLocked);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);

  const originalColorRef = useRef(node.data.color);
  const originalTextColorRef = useRef(node.data.textColor);

  const setBackgroundColor = useCallback((color: string | undefined) => {
    previewNodeColor(node.id, color);
  }, [node.id, previewNodeColor]);

  const setTextColor = useCallback((color: string | undefined) => {
    previewNodeTextColor(node.id, color);
  }, [node.id, previewNodeTextColor]);

  const commitColors = useCallback(() => {
    if (!colorsMatch(originalColorRef.current, node.data.color)) {
      updateNodeColor(node.id, node.data.color);
      rememberRecentColor('background', node.data.color);
    }
    if (!colorsMatch(originalTextColorRef.current, node.data.textColor)) {
      updateNodeTextColor(node.id, node.data.textColor);
      rememberRecentColor('text', node.data.textColor);
    }
  }, [node.id, node.data.color, node.data.textColor, updateNodeColor, updateNodeTextColor]);

  const revertColors = useCallback(() => {
    previewNodeColor(node.id, originalColorRef.current);
    previewNodeTextColor(node.id, originalTextColorRef.current);
  }, [node.id, previewNodeColor, previewNodeTextColor]);

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
  }, [closeContextMenu, commitColors]);

  return (
    <>
      {framework.nodeTags.length > 0 && (
        <>
          {framework.nodeTags.map((tag) => {
            const active = node.data.tags.includes(tag.id);
            return (
              <button
                key={tag.id}
                className="context-menu-item"
                onClick={() => {
                  const next = active
                    ? node.data.tags.filter((t) => t !== tag.id)
                    : [...node.data.tags, tag.id];
                  updateNodeTags(node.id, next);
                  applyAndClose();
                }}
              >
                <span
                  className="tag-chip-dot"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
                {active && <Check size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
          <div className="context-menu-separator" />
        </>
      )}

      <ColorPickerSection
        label="Background"
        pickerAriaLabel="Custom background color"
        currentColor={node.data.color}
        fallbackInputColor="#F5F5EC"
        onColorChange={setBackgroundColor}
        onPickerFocus={beginColorPickerInteraction}
        onPickerBlur={endColorPickerInteraction}
      />

      <ColorPickerSection
        label="Text Color"
        pickerAriaLabel="Custom text color"
        currentColor={node.data.textColor}
        fallbackInputColor="#1A1A1A"
        onColorChange={setTextColor}
        onPickerFocus={beginColorPickerInteraction}
        onPickerBlur={endColorPickerInteraction}
      />
      {degrees && (() => {
        const js = getJunctionState(framework, degrees.indegree, node.data.junctionType);
        if (!js) return null;
        return (
          <>
            <div className="context-menu-separator" />
            <button
              className="context-menu-item"
              onClick={() => {
                updateNodeJunction(node.id, js.next.id as JunctionType);
                applyAndClose();
              }}
            >
              {js.current.label} → {js.next.label}
            </button>
          </>
        );
      })()}

      <div className="context-menu-separator" />
      <button
        className="context-menu-item"
        onClick={() => {
          toggleNodeLocked([node.id], !node.data.locked);
          applyAndClose();
        }}
      >
        {node.data.locked ? <Lock size={14} /> : <Unlock size={14} />}
        {node.data.locked ? 'Locked' : 'Unlocked'}
      </button>
      <button
        className="context-menu-item context-menu-item--danger"
        onClick={() => {
          deleteNodes([node.id]);
          closeContextMenu();
        }}
      >
        <Trash2 size={14} />
        Delete
      </button>
    </>
  );
}
