import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewportInsets } from '../useViewportInsets';

function Harness() {
  useViewportInsets();
  return null;
}

class MockVisualViewport extends EventTarget {
  constructor(
    public height: number,
    public offsetTop: number,
  ) {
    super();
  }

  emit(type: 'resize' | 'scroll') {
    this.dispatchEvent(new Event(type));
  }
}

let rafCallbacks: Array<[number, FrameRequestCallback]> = [];
let nextRafId = 1;

function flushAnimationFrames() {
  act(() => {
    const pending = rafCallbacks;
    rafCallbacks = [];

    for (const [id, callback] of pending) {
      callback(id);
    }
  });
}

describe('useViewportInsets', () => {
  beforeEach(() => {
    rafCallbacks = [];
    nextRafId = 1;

    document.documentElement.style.removeProperty('--app-viewport-height');
    document.documentElement.style.removeProperty('--app-viewport-top-inset');
    document.documentElement.style.removeProperty('--app-viewport-bottom-inset');

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 900,
    });

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      const id = nextRafId++;
      rafCallbacks.push([id, callback]);
      return id;
    });

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      rafCallbacks = rafCallbacks.filter(([pendingId]) => pendingId !== id);
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    vi.restoreAllMocks();
  });

  it('writes CSS viewport variables from the visual viewport and responds to updates', () => {
    const viewport = new MockVisualViewport(700, 50);
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: viewport as unknown as VisualViewport,
    });

    render(<Harness />);
    flushAnimationFrames();

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('900px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top-inset')).toBe('50px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-bottom-inset')).toBe('150px');

    viewport.height = 640;
    viewport.offsetTop = 20;

    act(() => {
      viewport.emit('resize');
    });
    flushAnimationFrames();

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('900px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top-inset')).toBe('20px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-bottom-inset')).toBe('240px');
  });

  it('falls back to the layout viewport when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    render(<Harness />);
    flushAnimationFrames();

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('900px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-top-inset')).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-bottom-inset')).toBe('0px');
  });

  it('cancels pending animation frames and removes listeners on unmount', () => {
    const viewport = new MockVisualViewport(700, 50);
    const removeViewportListener = vi.spyOn(viewport, 'removeEventListener');
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: viewport as unknown as VisualViewport,
    });

    const { unmount } = render(<Harness />);

    expect(rafCallbacks).toHaveLength(1);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(removeViewportListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeViewportListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith('orientationchange', expect.any(Function));
  });
});
