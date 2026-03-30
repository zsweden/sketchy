import {
  LayoutDashboard,
  Undo2,
  Redo2,
  PanelRightClose,
  PanelRightOpen,
  MousePointer2,
  Hand,
  Settings,
  CircleOff,
} from 'lucide-react';
import { useCallback, useRef } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { useSettingsStore } from '../../store/settings-store';
import { useChatStore } from '../../store/chat-store';
import { version } from '../../../package.json';
import { autoLayout, elkEngine } from '../../core/layout';
import { saveSkyFile, loadSkyFile } from '../../core/persistence/sky-io';
import FrameworkSelector from './FrameworkSelector';
import SettingsPopover from './SettingsPopover';

const iconSize = 16;

function AlignHorizontalIcon() {
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <rect x="0" y="7.25" width="16" height="1.5" />
      <rect x="1.5" y="2" width="2" height="12" rx="0.5" />
      <rect x="7" y="4" width="2" height="8" rx="0.5" />
      <rect x="12.5" y="3" width="2" height="10" rx="0.5" />
    </svg>
  );
}

function AlignVerticalIcon() {
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <rect x="7.25" y="0" width="1.5" height="16" />
      <rect x="2" y="1.5" width="12" height="2" rx="0.5" />
      <rect x="4" y="7" width="8" height="2" rx="0.5" />
      <rect x="3" y="12.5" width="10" height="2" rx="0.5" />
    </svg>
  );
}

function DistributeHorizontalIcon() {
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4" width="3" height="8" rx="0.5" />
      <rect x="6.5" y="4" width="3" height="8" rx="0.5" />
      <rect x="12" y="4" width="3" height="8" rx="0.5" />
    </svg>
  );
}

function DistributeVerticalIcon() {
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="1" width="8" height="3" rx="0.5" />
      <rect x="4" y="6.5" width="8" height="3" rx="0.5" />
      <rect x="4" y="12" width="8" height="3" rx="0.5" />
    </svg>
  );
}

export default function Toolbar() {
  const diagram = useDiagramStore((s) => s.diagram);
  const canUndo = useDiagramStore((s) => s.canUndo);
  const canRedo = useDiagramStore((s) => s.canRedo);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const newDiagram = useDiagramStore((s) => s.newDiagram);
  const moveNodesStore = useDiagramStore((s) => s.moveNodes);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);
  const loadDiagram = useDiagramStore((s) => s.loadDiagram);
  const framework = useDiagramStore((s) => s.framework);
  const addToast = useUIStore((s) => s.addToast);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const toggleSidePanel = useUIStore((s) => s.toggleSidePanel);
  const requestFitView = useUIStore((s) => s.requestFitView);
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const selectedLoopId = useUIStore((s) => s.selectedLoopId);
  const setSelectedNodes = useUIStore((s) => s.setSelectedNodes);
  const setSelectedEdges = useUIStore((s) => s.setSelectedEdges);
  const setSelectedLoop = useUIStore((s) => s.setSelectedLoop);
  const interactionMode = useUIStore((s) => s.interactionMode);
  const setInteractionMode = useUIStore((s) => s.setInteractionMode);

  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0 || selectedLoopId !== null;
  const canAlign = selectedNodes.length >= 2;
  const canDistribute = selectedNodes.length >= 3;

  const handleAlignH = useCallback(() => {
    const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;
    commitToHistory();
    moveNodesStore(selectedNodes.map((n) => ({ id: n.id, position: { x: n.position.x, y: avgY } })));
  }, [selectedNodes, commitToHistory, moveNodesStore]);

  const handleAlignV = useCallback(() => {
    const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
    commitToHistory();
    moveNodesStore(selectedNodes.map((n) => ({ id: n.id, position: { x: avgX, y: n.position.y } })));
  }, [selectedNodes, commitToHistory, moveNodesStore]);

  const handleDistributeH = useCallback(() => {
    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const minX = sorted[0].position.x;
    const maxX = sorted[sorted.length - 1].position.x;
    const step = (maxX - minX) / (sorted.length - 1);
    commitToHistory();
    moveNodesStore(sorted.map((n, i) => ({ id: n.id, position: { x: minX + step * i, y: n.position.y } })));
  }, [selectedNodes, commitToHistory, moveNodesStore]);

  const handleDistributeV = useCallback(() => {
    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const minY = sorted[0].position.y;
    const maxY = sorted[sorted.length - 1].position.y;
    const step = (maxY - minY) / (sorted.length - 1);
    commitToHistory();
    moveNodesStore(sorted.map((n, i) => ({ id: n.id, position: { x: n.position.x, y: minY + step * i } })));
  }, [selectedNodes, commitToHistory, moveNodesStore]);

  const handleClearSelection = useCallback(() => {
    setSelectedNodes([]);
    setSelectedEdges([]);
    setSelectedLoop(null);
  }, [setSelectedNodes, setSelectedEdges, setSelectedLoop]);
  const toggleSettings = useSettingsStore((s) => s.toggleSettings);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNew = useCallback(() => {
    if (
      diagram.nodes.length > 0 &&
      !window.confirm('Create a new diagram? Unsaved changes will be lost.')
    ) {
      return;
    }
    newDiagram();
    useChatStore.getState().clearMessages();
    useChatStore.getState().clearAiModified();
    requestFitView();
  }, [diagram.nodes.length, newDiagram, requestFitView]);

  const handleAutoLayout = useCallback(async () => {
    const updates = await autoLayout(diagram.nodes, diagram.edges, {
      direction: diagram.settings.layoutDirection,
      cyclic: framework.allowsCycles,
    }, elkEngine);
    if (updates.length > 0) {
      commitToHistory();
      moveNodesStore(updates);
      requestFitView();
    }
  }, [diagram, framework.allowsCycles, commitToHistory, moveNodesStore, requestFitView]);

  const handleSave = useCallback(async () => {
    try {
      await saveSkyFile(diagram);
    } catch {
      addToast('Failed to save the project. Try again.', 'error');
    }
  }, [diagram, addToast]);

  const handleLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const result = await loadSkyFile(file);
        loadDiagram(result.diagram);
        useChatStore.getState().clearMessages();
        useChatStore.getState().clearAiModified();

        if (result.needsLayout) {
          const loaded = useDiagramStore.getState().diagram;
          const updates = await autoLayout(loaded.nodes, loaded.edges, {
            direction: loaded.settings.layoutDirection,
            cyclic: useDiagramStore.getState().framework.allowsCycles,
          }, elkEngine);
          if (updates.length > 0) {
            moveNodesStore(updates);
          }
        }

        requestFitView();
        for (const warning of result.warnings) {
          addToast(warning, 'warning');
        }
        if (result.warnings.length === 0) {
          addToast('Project loaded', 'info');
        }
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : 'Failed to load project. Try again.',
          'error',
        );
      }
      e.target.value = '';
    },
    [loadDiagram, addToast, requestFitView, moveNodesStore],
  );

  const handlePrint = useCallback(() => {
    addToast('Print is coming soon', 'info');
  }, [addToast]);

  return (
    <header className="app-header">
      <div className="toolbar-group">
        <img src="/mascot.svg" alt="" className="app-mascot" />
        <h1 className="app-title">Sketchy <span className="app-version">v{version}</span></h1>
        <div className="toolbar-divider" />
        <FrameworkSelector />
      </div>

      <div className="toolbar-group">
        <button
          className={`btn btn-secondary btn-icon ${interactionMode === 'select' ? 'btn-toggle-active' : ''}`}
          onClick={() => setInteractionMode('select')}
          title="Select tool (V)"
          aria-label="Select tool"
        >
          <MousePointer2 size={16} />
        </button>
        <button
          className={`btn btn-secondary btn-icon ${interactionMode === 'pan' ? 'btn-toggle-active' : ''}`}
          onClick={() => setInteractionMode('pan')}
          title="Pan tool (H)"
          aria-label="Pan tool"
        >
          <Hand size={16} />
        </button>

        <button
          className="btn btn-secondary btn-icon"
          onClick={handleClearSelection}
          disabled={!hasSelection}
          title="Clear selection (Esc)"
          aria-label="Clear selection"
        >
          <CircleOff size={16} />
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAlignH}
          disabled={!canAlign}
          title="Align horizontally"
          aria-label="Align horizontally"
        >
          <AlignHorizontalIcon />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAlignV}
          disabled={!canAlign}
          title="Align vertically"
          aria-label="Align vertically"
        >
          <AlignVerticalIcon />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleDistributeH}
          disabled={!canDistribute}
          title="Distribute horizontally"
          aria-label="Distribute horizontally"
        >
          <DistributeHorizontalIcon />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleDistributeV}
          disabled={!canDistribute}
          title="Distribute vertically"
          aria-label="Distribute vertically"
        >
          <DistributeVerticalIcon />
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAutoLayout}
          title="Auto-layout"
          aria-label="Auto-layout"
        >
          <LayoutDashboard size={16} />
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-secondary btn-icon"
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 size={16} />
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-secondary"
          onClick={handleNew}
          title="New diagram"
        >
          New
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleLoad}
          title="Load project"
        >
          Load
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleSave}
          title="Save project"
        >
          Save
        </button>
        <button
          className="btn btn-secondary"
          onClick={handlePrint}
          title="Print project"
        >
          Print
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".sky,.json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

      </div>

      <div className="toolbar-group toolbar-group-right">
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={toggleSettings}
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>
          <SettingsPopover />
        </div>

        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleSidePanel}
          title="Toggle side panel"
          aria-label="Toggle side panel"
        >
          {sidePanelOpen ? (
            <PanelRightClose size={16} />
          ) : (
            <PanelRightOpen size={16} />
          )}
        </button>
      </div>
    </header>
  );
}
