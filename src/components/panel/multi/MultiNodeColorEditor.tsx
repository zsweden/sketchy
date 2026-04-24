import { memo, useCallback, useRef, useState } from 'react';
import type { DiagramNode } from '../../../core/types';
import { useDiagramStore } from '../../../store/diagram-store';
import { rememberRecentColor } from '../../../store/color-history-store';
import ColorPickerSection from '../../shared/ColorPickerSection';
import { colorsMatch } from '../../shared/color-utils';

interface Props {
  selectedNodes: DiagramNode[];
}

type ColorKind = 'background' | 'text';

function sharedColor(nodes: DiagramNode[], key: 'color' | 'textColor'): string | undefined {
  if (nodes.length === 0) return undefined;
  const first = nodes[0].data[key];
  return nodes.every((n) => colorsMatch(n.data[key], first)) ? first : undefined;
}

function useBulkColorHandler(
  kind: ColorKind,
  ids: string[],
  currentSharedValue: string | undefined,
) {
  const previewNodesColor = useDiagramStore((s) => s.previewNodesColor);
  const previewNodesTextColor = useDiagramStore((s) => s.previewNodesTextColor);
  const updateNodesColor = useDiagramStore((s) => s.updateNodesColor);
  const updateNodesTextColor = useDiagramStore((s) => s.updateNodesTextColor);
  const preview = kind === 'background' ? previewNodesColor : previewNodesTextColor;
  const commit = kind === 'background' ? updateNodesColor : updateNodesTextColor;

  const [isPickerFocused, setPickerFocused] = useState(false);
  const baselineRef = useRef<string | undefined>(currentSharedValue);
  const lastPreviewedRef = useRef<string | undefined>(currentSharedValue);

  const onPickerFocus = useCallback(() => {
    setPickerFocused(true);
    baselineRef.current = currentSharedValue;
    lastPreviewedRef.current = currentSharedValue;
  }, [currentSharedValue]);

  const onPickerBlur = useCallback(() => {
    setPickerFocused(false);
    if (!colorsMatch(lastPreviewedRef.current, baselineRef.current)) {
      commit(ids, lastPreviewedRef.current);
      rememberRecentColor(kind, lastPreviewedRef.current);
      baselineRef.current = lastPreviewedRef.current;
    }
  }, [commit, ids, kind]);

  const onColorChange = useCallback(
    (color: string | undefined) => {
      if (isPickerFocused) {
        lastPreviewedRef.current = color;
        preview(ids, color);
      } else {
        commit(ids, color);
        rememberRecentColor(kind, color);
        baselineRef.current = color;
        lastPreviewedRef.current = color;
      }
    },
    [commit, ids, isPickerFocused, kind, preview],
  );

  return { onColorChange, onPickerFocus, onPickerBlur };
}

function MultiNodeColorEditor({ selectedNodes }: Props) {
  const ids = selectedNodes.map((n) => n.id);
  const currentBg = sharedColor(selectedNodes, 'color');
  const currentText = sharedColor(selectedNodes, 'textColor');
  const bg = useBulkColorHandler('background', ids, currentBg);
  const text = useBulkColorHandler('text', ids, currentText);

  return (
    <>
      <ColorPickerSection
        label="Background"
        pickerAriaLabel="Custom background color for all selected nodes"
        currentColor={currentBg}
        fallbackInputColor="#F5F5EC"
        onColorChange={bg.onColorChange}
        onPickerFocus={bg.onPickerFocus}
        onPickerBlur={bg.onPickerBlur}
      />
      <ColorPickerSection
        label="Text Color"
        pickerAriaLabel="Custom text color for all selected nodes"
        currentColor={currentText}
        fallbackInputColor="#1A1A1A"
        onColorChange={text.onColorChange}
        onPickerFocus={text.onPickerFocus}
        onPickerBlur={text.onPickerBlur}
      />
    </>
  );
}

export default memo(MultiNodeColorEditor);
