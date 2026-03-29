import {
  SquarePlus,
  LayoutDashboard,
  Undo2,
  Redo2,
  PanelRightClose,
  PanelRightOpen,
  MousePointer2,
  Hand,
  Settings,
} from 'lucide-react';
import { useCallback, useRef } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { useSettingsStore } from '../../store/settings-store';
import { useChatStore } from '../../store/chat-store';
import { autoLayout, elkEngine } from '../../core/layout';
import { saveSkyFile, loadSkyFile } from '../../core/persistence/sky-io';
import FrameworkSelector from './FrameworkSelector';
import SettingsPopover from './SettingsPopover';

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
  const addToast = useUIStore((s) => s.addToast);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const toggleSidePanel = useUIStore((s) => s.toggleSidePanel);
  const requestFitView = useUIStore((s) => s.requestFitView);
  const interactionMode = useUIStore((s) => s.interactionMode);
  const setInteractionMode = useUIStore((s) => s.setInteractionMode);
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
    }, elkEngine);
    if (updates.length > 0) {
      commitToHistory();
      moveNodesStore(updates);
      requestFitView();
    }
  }, [diagram, commitToHistory, moveNodesStore, requestFitView]);

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
        <h1 className="app-title">Sketchy</h1>
        <div className="toolbar-divider" />
        <FrameworkSelector />
      </div>

      <div className="toolbar-group">
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleNew}
          title="New diagram"
          aria-label="New diagram"
        >
          <SquarePlus size={16} />
        </button>

        <div className="toolbar-divider" />

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
