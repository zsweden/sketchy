import { useEffect, useRef } from 'react';
import { useDiagramStore } from '../store/diagram-store';
import { saveDiagram } from '../core/persistence/local-storage';

const DEBOUNCE_MS = 500;

export function useAutoSave() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingDiagramRef = useRef<Parameters<typeof saveDiagram>[0] | null>(null);

  useEffect(() => {
    const flush = () => {
      if (pendingDiagramRef.current) {
        saveDiagram(pendingDiagramRef.current);
        pendingDiagramRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };

    const unsubscribe = useDiagramStore.subscribe((state) => {
      pendingDiagramRef.current = state.diagram;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        flush();
      }, DEBOUNCE_MS);
    });

    window.addEventListener('beforeunload', flush);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);
}
