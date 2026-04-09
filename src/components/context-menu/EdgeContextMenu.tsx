import { Check, Trash2 } from 'lucide-react';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import type { DiagramEdge } from '../../core/types';

interface Props {
  edge: DiagramEdge;
  closeContextMenu: () => void;
}

export default function EdgeContextMenu({ edge, closeContextMenu }: Props) {
  const framework = useFramework();
  const setEdgeConfidence = useDiagramStore((s) => s.setEdgeConfidence);
  const setEdgePolarity = useDiagramStore((s) => s.setEdgePolarity);
  const setEdgeDelay = useDiagramStore((s) => s.setEdgeDelay);
  const setEdgeTag = useDiagramStore((s) => s.setEdgeTag);
  const deleteEdges = useDiagramStore((s) => s.deleteEdges);

  return (
    <>
      {/* Edge Tags */}
      {framework.edgeTags && framework.edgeTags.length > 0 && (
        <>
          <div className="context-menu-label">Interaction Mode</div>
          {framework.edgeTags.map((tag) => {
            const active = edge.edgeTag === tag.id;
            return (
              <button
                key={tag.id}
                className="context-menu-item"
                onClick={() => {
                  setEdgeTag(edge.id, active ? undefined : tag.id);
                  closeContextMenu();
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

      {/* Polarity */}
      {framework.supportsEdgePolarity && (
        <>
          <div className="context-menu-label">Polarity</div>
          {([
            { value: 'positive' as const, label: 'Positive (+)' },
            { value: 'negative' as const, label: 'Negative (-)' },
          ]).map((p) => {
            const current = edge.polarity ?? 'positive';
            return (
              <button
                key={p.value}
                className="context-menu-item"
                onClick={() => {
                  setEdgePolarity(edge.id, p.value);
                  closeContextMenu();
                }}
              >
                {p.label}
                {current === p.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
          <div className="context-menu-separator" />
        </>
      )}

      {/* Delay */}
      {framework.supportsEdgeDelay && (
        <>
          <button
            className="context-menu-item"
            onClick={() => {
              setEdgeDelay(edge.id, !edge.delay);
              closeContextMenu();
            }}
          >
            {edge.delay ? 'Remove Delay' : 'Add Delay'}
            {edge.delay && <Check size={14} style={{ marginLeft: 'auto' }} />}
          </button>
          <div className="context-menu-separator" />
        </>
      )}

      {/* Confidence */}
      <div className="context-menu-label">Confidence</div>
      {(['high', 'medium', 'low'] as const).map((level) => {
        const current = edge.confidence ?? 'high';
        return (
          <button
            key={level}
            className="context-menu-item"
            onClick={() => {
              setEdgeConfidence(edge.id, level);
              closeContextMenu();
            }}
          >
            <span
              className="confidence-line-preview"
              data-level={level}
            />
            {level.charAt(0).toUpperCase() + level.slice(1)}
            {current === level && <Check size={14} style={{ marginLeft: 'auto' }} />}
          </button>
        );
      })}
      <div className="context-menu-separator" />
      <button
        className="context-menu-item context-menu-item--danger"
        onClick={() => {
          deleteEdges([edge.id]);
          closeContextMenu();
        }}
      >
        <Trash2 size={14} />
        Delete connection
      </button>
    </>
  );
}
