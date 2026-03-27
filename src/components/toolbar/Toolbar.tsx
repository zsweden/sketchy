import {
  FilePlus,
  LayoutDashboard,
  Download,
  Upload,
  Undo2,
  Redo2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useCallback, useRef } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { autoLayout } from '../../core/layout/dagre-layout';
import { exportDiagram } from '../../core/persistence/json-io';
import { importDiagram } from '../../core/persistence/json-io';
import FrameworkSelector from './FrameworkSelector';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNew = useCallback(() => {
    if (
      diagram.nodes.length > 0 &&
      !window.confirm('Create a new diagram? Unsaved changes will be lost.')
    ) {
      return;
    }
    newDiagram();
  }, [diagram.nodes.length, newDiagram]);

  const handleAutoLayout = useCallback(() => {
    const updates = autoLayout(diagram.nodes, diagram.edges, {
      direction: diagram.settings.layoutDirection,
      respectPinned: true,
    });
    if (updates.length > 0) {
      commitToHistory();
      moveNodesStore(updates);
    }
  }, [diagram, commitToHistory, moveNodesStore]);

  const handleExport = useCallback(() => {
    exportDiagram(diagram);
  }, [diagram]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const result = await importDiagram(file);
        loadDiagram(result.diagram);
        for (const warning of result.warnings) {
          addToast(warning, 'warning');
        }
        if (result.warnings.length === 0) {
          addToast('Diagram imported successfully', 'info');
        }
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : 'Failed to import diagram',
          'error',
        );
      }
      // Reset file input
      e.target.value = '';
    },
    [loadDiagram, addToast],
  );

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
          <FilePlus size={16} />
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
          className="btn btn-secondary btn-icon"
          onClick={handleExport}
          title="Export JSON"
          aria-label="Export JSON"
        >
          <Download size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleImport}
          title="Import JSON"
          aria-label="Import JSON"
        >
          <Upload size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div className="toolbar-divider" />

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
