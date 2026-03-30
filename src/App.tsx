import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import DiagramCanvas from './components/canvas/DiagramCanvas';
import Toolbar from './components/toolbar/Toolbar';
import SidePanel from './components/panel/SidePanel';
import ContextMenu from './components/context-menu/ContextMenu';
import ToastContainer from './components/toast/ToastContainer';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useThemeEffect } from './hooks/useThemeEffect';
import { loadDiagram } from './core/persistence/local-storage';
import { useDiagramStore } from './store/diagram-store';
import { useUIStore } from './store/ui-store';

export default function App() {
  useAutoSave();
  useKeyboardShortcuts();
  useThemeEffect();

  // Load from localStorage on mount
  useEffect(() => {
    const result = loadDiagram();
    if (result.diagram) {
      useDiagramStore.getState().loadDiagram(result.diagram);
    }
    if (result.error) {
      useUIStore.getState().addToast(result.error, 'error');
    }
    if (result.warnings) {
      for (const warning of result.warnings) {
        useUIStore.getState().addToast(warning, 'warning');
      }
    }
  }, []);

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Toolbar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1 }}>
            <DiagramCanvas />
          </div>
          <SidePanel />
        </div>
      </div>
      <ContextMenu />
      <ToastContainer />
    </ReactFlowProvider>
  );
}
