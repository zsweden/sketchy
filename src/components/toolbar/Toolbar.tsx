import {
  LayoutDashboard,
  Route,
  Undo2,
  Redo2,
  PanelRightClose,
  PanelRightOpen,
  MousePointer2,
  Hand,
  Settings,
  Settings2,
} from 'lucide-react';
import { useCallback, useRef } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { useSettingsStore } from '../../store/settings-store';
import { useChatStore } from '../../store/chat-store';
import { appVersion } from '../../core/app-version';
import { saveSkyFile, loadSkyFile } from '../../core/persistence/sky-io';
import { getFrameworkSuffix, getNextDiagramTransition } from '../../transitions/registry';
import { useNodeAlignmentActions } from '../../hooks/useNodeAlignmentActions';
import FrameworkSelector from './FrameworkSelector';
import LayoutLabPopover from './LayoutLabPopover';
import SettingsPopover from './SettingsPopover';
import { AlignHorizontalIcon, AlignVerticalIcon, DistributeHorizontalIcon, DistributeVerticalIcon } from '../icons/AlignDistributeIcons';

export default function Toolbar() {
  const diagram = useDiagramStore((s) => s.diagram);
  const framework = useDiagramStore((s) => s.framework);
  const canUndo = useDiagramStore((s) => s.canUndo);
  const canRedo = useDiagramStore((s) => s.canRedo);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const newDiagram = useDiagramStore((s) => s.newDiagram);
  const distributeNodesHorizontally = useDiagramStore((s) => s.distributeNodesHorizontally);
  const distributeNodesVertically = useDiagramStore((s) => s.distributeNodesVertically);
  const loadDiagram = useDiagramStore((s) => s.loadDiagram);
  const optimizeEdges = useDiagramStore((s) => s.optimizeEdges);
  const runAutoLayout = useDiagramStore((s) => s.runAutoLayout);
  const deriveNextDiagram = useDiagramStore((s) => s.deriveNextDiagram);
  const addToast = useUIStore((s) => s.addToast);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const toggleSidePanel = useUIStore((s) => s.toggleSidePanel);
  const requestFitView = useUIStore((s) => s.requestFitView);
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const interactionMode = useUIStore((s) => s.interactionMode);
  const setInteractionMode = useUIStore((s) => s.setInteractionMode);
  const toggleLayoutLab = useSettingsStore((s) => s.toggleLayoutLab);
  const { alignSelectedNodesHorizontally, alignSelectedNodesVertically } = useNodeAlignmentActions();

  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const canAlign = selectedNodes.length >= 2;
  const canDistribute = selectedNodes.length >= 3;
  const canOptimizeEdges = diagram.settings.edgeRoutingMode === 'fixed';
  const currentFrameworkId = framework.id;
  const nextTransition = getNextDiagramTransition(currentFrameworkId);
  const nextDocumentLabel = nextTransition
    ? getFrameworkSuffix(nextTransition.targetFrameworkId)
    : null;

  const handleAlignH = useCallback(() => {
    alignSelectedNodesHorizontally(selectedNodeIds);
  }, [alignSelectedNodesHorizontally, selectedNodeIds]);

  const handleAlignV = useCallback(() => {
    alignSelectedNodesVertically(selectedNodeIds);
  }, [alignSelectedNodesVertically, selectedNodeIds]);

  const handleDistributeH = useCallback(() => {
    distributeNodesHorizontally(selectedNodeIds);
  }, [distributeNodesHorizontally, selectedNodeIds]);

  const handleDistributeV = useCallback(() => {
    distributeNodesVertically(selectedNodeIds);
  }, [distributeNodesVertically, selectedNodeIds]);

  const toggleSettings = useSettingsStore((s) => s.toggleSettings);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDiagramWork =
    diagram.nodes.length > 1 ||
    diagram.edges.length > 0 ||
    diagram.nodes.some((n) => n.data.label !== '');

  const handleNew = useCallback(() => {
    if (
      hasDiagramWork &&
      !window.confirm('Create a new diagram? Unsaved changes will be lost.')
    ) {
      return;
    }
    newDiagram();
    useChatStore.getState().clearMessages();
    useChatStore.getState().clearAiModified();
    requestFitView();
  }, [hasDiagramWork, newDiagram, requestFitView]);

  const handleAutoLayout = useCallback(async () => {
    await runAutoLayout({ commitHistory: true, fitView: true });
  }, [runAutoLayout]);

  const handleAutoEdges = useCallback(() => {
    optimizeEdges();
  }, [optimizeEdges]);

  const handleSave = useCallback(async () => {
    try {
      await saveSkyFile(diagram);
    } catch {
      addToast('Failed to save the project. Try again.', 'error');
    }
  }, [diagram, addToast]);

  const handleLoad = useCallback(() => {
    if (
      hasDiagramWork &&
      !window.confirm('Load a project? The current in-memory session will be replaced.')
    ) {
      return;
    }
    fileInputRef.current?.click();
  }, [hasDiagramWork]);

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
          await useDiagramStore.getState().runAutoLayout({ fitView: false });
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
    [loadDiagram, addToast, requestFitView],
  );

  const handlePrint = useCallback(() => {
    addToast('Print is coming soon', 'info');
  }, [addToast]);

  const handleNextDocument = useCallback(async () => {
    if (!nextTransition) return;

    if (
      hasDiagramWork &&
      !window.confirm(
        `Create a ${getFrameworkSuffix(nextTransition.targetFrameworkId)} draft from this ${getFrameworkSuffix(currentFrameworkId)}? The current in-memory session will be replaced.`,
      )
    ) {
      return;
    }

    const derived = await deriveNextDiagram();
    if (!derived) return;

    useChatStore.getState().clearMessages();
    useChatStore.getState().clearAiModified();
  }, [currentFrameworkId, deriveNextDiagram, hasDiagramWork, nextTransition]);

  return (
    <header className="app-header">
      <div className="toolbar-group">
        <img src="/mascot.svg" alt="" className="app-mascot" />
        <h1 className="app-title">Sketchy <span className="app-version">v{appVersion}</span></h1>
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
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAutoEdges}
          disabled={!canOptimizeEdges}
          title="Auto edges"
          aria-label="Auto edges"
        >
          <Route size={16} />
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
        {nextTransition && nextDocumentLabel ? (
          <button
            className="btn btn-secondary"
            onClick={handleNextDocument}
            title={`Create ${nextDocumentLabel} draft from current ${getFrameworkSuffix(currentFrameworkId)}`}
          >
            {`to ${nextDocumentLabel}`}
          </button>
        ) : null}
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
            onClick={toggleLayoutLab}
            title="Layout lab"
            aria-label="Layout lab"
          >
            <Settings2 size={16} />
          </button>
          <LayoutLabPopover />
        </div>

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
