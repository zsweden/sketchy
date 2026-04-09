import { useEffect, useRef } from 'react';
import mitt from 'mitt';
import type { GraphObjectTarget } from './ui-store';

type UIEvents = {
  fitView: undefined;
  edgeRefresh: undefined;
  selectionSync: undefined;
  viewportFocus: GraphObjectTarget;
  toastError: string;
};

export const uiEvents = mitt<UIEvents>();

/**
 * Subscribe to a UI event inside a React component.
 * Uses a ref so the handler can close over fresh state without re-subscribing.
 */
export function useUIEvent<K extends keyof UIEvents>(
  event: K,
  handler: (payload: UIEvents[K]) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const cb = (payload: UIEvents[K]) => handlerRef.current(payload);
    uiEvents.on(event, cb);
    return () => { uiEvents.off(event, cb); };
  }, [event]);
}
