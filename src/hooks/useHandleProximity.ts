import { useEffect, useRef, useState } from 'react';

const HANDLE_REVEAL_DISTANCE_PX = 40;

/**
 * Reveals connection handles when the mouse pointer is near the node element.
 * Touch pointers are ignored (handles are shown on touch via pointer-down instead).
 *
 * Returns [nodeRef, handlesVisible, setHandlesVisible].
 */
export function useHandleProximity(): [React.RefObject<HTMLDivElement | null>, boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [handlesVisible, setHandlesVisible] = useState(false);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const nodeElement = nodeRef.current;
      if (!nodeElement) return;

      const rect = nodeElement.getBoundingClientRect();
      const isNear = event.clientX >= rect.left - HANDLE_REVEAL_DISTANCE_PX
        && event.clientX <= rect.right + HANDLE_REVEAL_DISTANCE_PX
        && event.clientY >= rect.top - HANDLE_REVEAL_DISTANCE_PX
        && event.clientY <= rect.bottom + HANDLE_REVEAL_DISTANCE_PX;

      setHandlesVisible((current) => (current === isNear ? current : isNear));
    };

    const handlePointerLeave = () => {
      setHandlesVisible(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return [nodeRef, handlesVisible, setHandlesVisible];
}
