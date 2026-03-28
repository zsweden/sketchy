import { useEffect, useRef } from 'react';
import { useDiagramStore } from '../store/diagram-store';
import { saveDiagram } from '../core/persistence/local-storage';

const DEBOUNCE_MS = 500;

export function useAutoSave() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const unsubscribe = useDiagramStore.subscribe((state) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        saveDiagram(state.diagram);
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}
