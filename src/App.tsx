import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Toaster, toast } from 'sonner';
import DiagramCanvas from './components/canvas/DiagramCanvas';
import Toolbar from './components/toolbar/Toolbar';
import SidePanel from './components/panel/SidePanel';
import ContextMenu from './components/context-menu/ContextMenu';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useThemeEffect } from './hooks/useThemeEffect';
import { useViewportInsets } from './hooks/useViewportInsets';
import { useUIEvent } from './store/ui-events';
import { loadDiagram } from './core/persistence/local-storage';
import { useDiagramStore } from './store/diagram-store';

export default function App() {
  useAutoSave();
  useKeyboardShortcuts();
  useThemeEffect();
  useViewportInsets();
  useUIEvent('toastError', (msg) => toast.error(msg));

  // Load from localStorage on mount
  useEffect(() => {
    const result = loadDiagram();
    if (result.diagram) {
      useDiagramStore.getState().loadDiagram(result.diagram);
    }
    if (result.error) {
      toast.error(result.error);
    }
    if (result.warnings) {
      for (const warning of result.warnings) {
        toast.warning(warning);
      }
    }
  }, []);

  return (
    <ReactFlowProvider>
      <div className="app-shell">
        <Toolbar />
        <main className="app-main">
          <div className="app-canvas-shell">
            <DiagramCanvas />
          </div>
          <SidePanel />
        </main>
      </div>
      <ContextMenu />
      <Toaster
        position="bottom-center"
        duration={4000}
        toastOptions={{ className: 'sketchy-toast' }}
      />
    </ReactFlowProvider>
  );
}
