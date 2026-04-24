import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';
import { useChatStore } from '../../store/chat-store';
import { useDiagramStore } from '../../store/diagram-store';
import { useSettingsStore } from '../../store/settings-store';
import { useUIStore } from '../../store/ui-store';
import { saveSkyFile, loadSkyFile } from '../../core/persistence/sky-io';
import { useNodeAlignmentActions } from '../../hooks/useNodeAlignmentActions';
import type { AnnotationKind } from '../../core/types';

function clearChatUiState() {
  useChatStore.getState().clearMessages();
  useChatStore.getState().clearAiModified();
}

export function useToolbarController() {
  const canUndo = useDiagramStore((state) => state.canUndo);
  const canRedo = useDiagramStore((state) => state.canRedo);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const newDiagram = useDiagramStore((state) => state.newDiagram);
  const distributeNodesHorizontally = useDiagramStore(
    (state) => state.distributeNodesHorizontally,
  );
  const distributeNodesVertically = useDiagramStore(
    (state) => state.distributeNodesVertically,
  );
  const loadDiagram = useDiagramStore((state) => state.loadDiagram);
  const optimizeEdges = useDiagramStore((state) => state.optimizeEdges);
  const runAutoLayout = useDiagramStore((state) => state.runAutoLayout);
  const addAnnotation = useDiagramStore((state) => state.addAnnotation);
  const nodes = useDiagramStore((state) => state.diagram.nodes);
  const edges = useDiagramStore((state) => state.diagram.edges);
  const edgeRoutingMode = useDiagramStore(
    (state) => state.diagram.settings.edgeRoutingMode,
  );

  const sidePanelOpen = useUIStore((state) => state.sidePanelOpen);
  const toggleSidePanel = useUIStore((state) => state.toggleSidePanel);
  const requestFitView = useUIStore((state) => state.requestFitView);
  const selectedNodeIds = useUIStore((state) => state.selectedNodeIds);
  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);

  const toggleSettings = useSettingsStore((state) => state.toggleSettings);
  const { alignSelectedNodesHorizontally, alignSelectedNodesVertically } =
    useNodeAlignmentActions();
  const { screenToFlowPosition } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id));
  const canAlign = selectedNodes.length >= 2;
  const canDistribute = selectedNodes.length >= 3;
  const canOptimizeEdges = edgeRoutingMode === 'fixed';
  const hasDiagramWork =
    nodes.length > 1 ||
    edges.length > 0 ||
    nodes.some((node) => node.data.label !== '');

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

  const handleAddAnnotation = useCallback(
    (kind: AnnotationKind) => {
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      addAnnotation(kind, position);
    },
    [addAnnotation, screenToFlowPosition],
  );

  const handleNew = useCallback(() => {
    if (
      hasDiagramWork &&
      !window.confirm('Create a new diagram? Unsaved changes will be lost.')
    ) {
      return;
    }

    newDiagram();
    clearChatUiState();
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
      await saveSkyFile(useDiagramStore.getState().diagram);
    } catch {
      toast.error('Failed to save the project. Try again.');
    }
  }, []);

  const handleLoad = useCallback(() => {
    if (
      hasDiagramWork &&
      !window.confirm(
        'Load a project? The current in-memory session will be replaced.',
      )
    ) {
      return;
    }

    fileInputRef.current?.click();
  }, [hasDiagramWork]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const result = await loadSkyFile(file);
        loadDiagram(result.diagram);
        clearChatUiState();

        if (result.needsLayout) {
          await useDiagramStore.getState().runAutoLayout({ fitView: false });
        }

        requestFitView();
        for (const warning of result.warnings) {
          toast.warning(warning);
        }

        if (result.warnings.length === 0) {
          toast('Project loaded');
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to load project. Try again.',
        );
      }

      event.target.value = '';
    },
    [loadDiagram, requestFitView],
  );

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    sidePanelOpen,
    interactionMode,
    setInteractionMode,
    toggleSettings,
    toggleSidePanel,
    fileInputRef,
    canAlign,
    canDistribute,
    canOptimizeEdges,
    handleAlignH,
    handleAlignV,
    handleDistributeH,
    handleDistributeV,
    handleAddAnnotation,
    handleAutoLayout,
    handleAutoEdges,
    handleNew,
    handleLoad,
    handleSave,
    handleFileChange,
  };
}
