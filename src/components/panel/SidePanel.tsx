import { useCallback, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import NodePanel from './NodePanel';
import EdgePanel from './EdgePanel';
import SettingsPanel from './SettingsPanel';
import ChatPanel from './ChatPanel';

const s = 14;
const c = 'currentColor';

function AlignVerticalIcon() {
  // Vertical center line with horizontal bars of varying widths centered on it
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill={c} stroke="none">
      <rect x="7.25" y="0" width="1.5" height="16" />
      <rect x="2" y="1.5" width="12" height="2" rx="0.5" />
      <rect x="4" y="7" width="8" height="2" rx="0.5" />
      <rect x="3" y="12.5" width="10" height="2" rx="0.5" />
    </svg>
  );
}

function AlignHorizontalIcon() {
  // Horizontal center line with vertical bars of varying heights centered on it
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill={c} stroke="none">
      <rect x="0" y="7.25" width="16" height="1.5" />
      <rect x="1.5" y="2" width="2" height="12" rx="0.5" />
      <rect x="7" y="4" width="2" height="8" rx="0.5" />
      <rect x="12.5" y="3" width="2" height="10" rx="0.5" />
    </svg>
  );
}

function DistributeHorizontalIcon() {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="1" y="4" width="3" height="8" rx="0.5" />
      <rect x="6.5" y="4" width="3" height="8" rx="0.5" />
      <rect x="12" y="4" width="3" height="8" rx="0.5" />
    </svg>
  );
}

function DistributeVerticalIcon() {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="4" y="1" width="8" height="3" rx="0.5" />
      <rect x="4" y="6.5" width="8" height="3" rx="0.5" />
      <rect x="4" y="12" width="8" height="3" rx="0.5" />
    </svg>
  );
}

export default function SidePanel() {
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);
  const moveNodes = useDiagramStore((s) => s.moveNodes);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);

  const [width, setWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Vertical split: percentage of panel height for the top section
  const [topPercent, setTopPercent] = useState(40);
  const [vDragging, setVDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = width;
    setDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX.current - ev.clientX;
      const newWidth = Math.min(600, Math.max(240, startWidth.current + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  const onVMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setVDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setTopPercent(Math.min(80, Math.max(15, pct)));
    };

    const onMouseUp = () => {
      setVDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  if (!sidePanelOpen) return null;

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const selectedEdges = edges.filter((e) => selectedEdgeIds.includes(e.id));

  return (
    <div className="side-panel" style={{ width, minWidth: width }} ref={panelRef}>
      <div
        className={`side-panel-resize ${dragging ? 'dragging' : ''}`}
        onMouseDown={onMouseDown}
      />
      <div className="side-panel-top" style={{ height: `${topPercent}%` }}>
        {selectedNodes.length === 1 ? (
          <NodePanel node={selectedNodes[0]} />
        ) : selectedNodes.length > 1 ? (
          <div className="section-stack">
            <p className="section-heading">
              {selectedNodes.length} nodes selected
            </p>

            <div className="section-stack" style={{ gap: '0.375rem' }}>
              <p className="section-label">Align</p>
              <div className="control-row" style={{ gap: '0.25rem' }}>
                <button
                  className="btn btn-secondary btn-xs"
                  title="Align to same row"
                  onClick={() => {
                    const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;
                    commitToHistory();
                    moveNodes(selectedNodes.map((n) => ({ id: n.id, position: { x: n.position.x, y: avgY } })));
                  }}
                >
                  <AlignHorizontalIcon />
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  title="Align to same column"
                  onClick={() => {
                    const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
                    commitToHistory();
                    moveNodes(selectedNodes.map((n) => ({ id: n.id, position: { x: avgX, y: n.position.y } })));
                  }}
                >
                  <AlignVerticalIcon />
                </button>
              </div>
            </div>

            <div className="section-stack" style={{ gap: '0.375rem' }}>
              <p className="section-label">Distribute</p>
              <div className="control-row" style={{ gap: '0.25rem' }}>
                <button
                  className="btn btn-secondary btn-xs"
                  title="Space out horizontally"
                  onClick={() => {
                    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
                    const minX = sorted[0].position.x;
                    const maxX = sorted[sorted.length - 1].position.x;
                    const step = (maxX - minX) / (sorted.length - 1);
                    commitToHistory();
                    moveNodes(sorted.map((n, i) => ({ id: n.id, position: { x: minX + step * i, y: n.position.y } })));
                  }}
                >
                  <DistributeHorizontalIcon />
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  title="Space out vertically"
                  onClick={() => {
                    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
                    const minY = sorted[0].position.y;
                    const maxY = sorted[sorted.length - 1].position.y;
                    const step = (maxY - minY) / (sorted.length - 1);
                    commitToHistory();
                    moveNodes(sorted.map((n, i) => ({ id: n.id, position: { x: n.position.x, y: minY + step * i } })));
                  }}
                >
                  <DistributeVerticalIcon />
                </button>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-xs"
              onClick={() => deleteNodes(selectedNodes.map((n) => n.id))}
            >
              Delete All
            </button>
          </div>
        ) : selectedEdges.length === 1 ? (
          <EdgePanel edge={selectedEdges[0]} />
        ) : (
          <SettingsPanel />
        )}
      </div>
      <div
        className={`side-panel-v-resize ${vDragging ? 'dragging' : ''}`}
        onMouseDown={onVMouseDown}
      />
      <ChatPanel />
    </div>
  );
}
