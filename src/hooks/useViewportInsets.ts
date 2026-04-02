import { useEffect } from 'react';

function setViewportVar(root: HTMLElement, name: string, value: number) {
  root.style.setProperty(name, `${Math.max(0, Math.round(value))}px`);
}

export function useViewportInsets() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const root = document.documentElement;
    let frameId = 0;

    const updateViewportVars = () => {
      frameId = 0;

      const visualViewport = window.visualViewport;
      const layoutViewportHeight = window.innerHeight;
      const topInset = visualViewport?.offsetTop ?? 0;
      const bottomInset = visualViewport
        ? layoutViewportHeight - visualViewport.height - visualViewport.offsetTop
        : 0;

      setViewportVar(root, '--app-viewport-height', layoutViewportHeight);
      setViewportVar(root, '--app-viewport-top-inset', topInset);
      setViewportVar(root, '--app-viewport-bottom-inset', bottomInset);
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(updateViewportVars);
    };

    scheduleUpdate();

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('orientationchange', scheduleUpdate, { passive: true });
    visualViewport?.addEventListener('resize', scheduleUpdate);
    visualViewport?.addEventListener('scroll', scheduleUpdate);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      visualViewport?.removeEventListener('resize', scheduleUpdate);
      visualViewport?.removeEventListener('scroll', scheduleUpdate);
    };
  }, []);
}
