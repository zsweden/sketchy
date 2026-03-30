import { useCallback, useRef, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import NodePanel from './NodePanel';
import EdgePanel from './EdgePanel';
import SettingsPanel from './SettingsPanel';
import ChatPanel from './ChatPanel';
import { AlignHorizontalIcon, AlignVerticalIcon, DistributeHorizontalIcon, DistributeVerticalIcon } from '../icons/AlignDistributeIcons';
import { alignHorizontal, alignVertical, distributeHorizontal, distributeVertical } from '../../utils/align-distribute';

export default function SidePanel() {
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);
  const toggleNodeLocked = useDiagramStore((s) => s.toggleNodeLocked);
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

            <div className="section-stack gap-field">
              <p className="section-label">Align</p>
              <div className="control-row gap-tight">
                <button
                  className="btn btn-secondary btn-xs"
                  title="Align to same row"
                  aria-label="Align horizontally"
                  onClick={() => { commitToHistory(); moveNodes(alignHorizontal(selectedNodes)); }}
                >
                  <AlignHorizontalIcon />
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  title="Align to same column"
                  aria-label="Align vertically"
                  onClick={() => { commitToHistory(); moveNodes(alignVertical(selectedNodes)); }}
                >
                  <AlignVerticalIcon />
                </button>
              </div>
            </div>

            <div className="section-stack gap-field">
              <p className="section-label">Distribute</p>
              <div className="control-row gap-tight">
                <button
                  className="btn btn-secondary btn-xs"
                  title="Space out horizontally"
                  aria-label="Distribute horizontally"
                  disabled={selectedNodes.length < 3}
                  onClick={() => { commitToHistory(); moveNodes(distributeHorizontal(selectedNodes)); }}
                >
                  <DistributeHorizontalIcon />
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  title="Space out vertically"
                  aria-label="Distribute vertically"
                  disabled={selectedNodes.length < 3}
                  onClick={() => { commitToHistory(); moveNodes(distributeVertical(selectedNodes)); }}
                >
                  <DistributeVerticalIcon />
                </button>
              </div>
            </div>

            <div className="section-stack gap-field">
              <p className="section-label">Position</p>
              <div className="control-row gap-tight">
                <button
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  onClick={() => toggleNodeLocked(selectedNodes.map((n) => n.id), true)}
                >
                  <Lock size={12} /> Lock All
                </button>
                <button
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  onClick={() => toggleNodeLocked(selectedNodes.map((n) => n.id), false)}
                >
                  <Unlock size={12} /> Unlock All
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
