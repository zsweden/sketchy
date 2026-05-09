import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

function Harness() {
  useKeyboardShortcuts();
  return null;
}

const KEY_TO_CODE: Record<string, string> = {
  z: 'KeyZ',
  y: 'KeyY',
  v: 'KeyV',
  h: 'KeyH',
  ' ': 'Space',
  Escape: 'Escape',
};

function fireKey(key: string, opts: Partial<KeyboardEvent> = {}) {
  const code = KEY_TO_CODE[key] ?? key;
  const event = new KeyboardEvent('keydown', { key, code, bubbles: true, ...opts });
  (opts.target ?? document).dispatchEvent(event);
}

function fireKeyUp(key: string, target: EventTarget = document) {
  const code = KEY_TO_CODE[key] ?? key;
  const event = new KeyboardEvent('keyup', { key, code, bubbles: true });
  target.dispatchEvent(event);
}

// react-hotkeys-hook 5.3+ resolves `mod` per-platform (metaKey on Mac, ctrlKey elsewhere).
// jsdom's default userAgent isn't Mac, so meta-key tests must stub it.
function stubMacUserAgent() {
  const original = navigator.userAgent;
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  return () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: original });
  };
}

describe('keyboard shortcuts', () => {
  let cleanup: () => void;

  beforeEach(() => {
    useDiagramStore.getState().newDiagram();
    useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
    useUIStore.setState({ interactionMode: 'select' });
    cleanup = render(createElement(Harness)).unmount;
  });

  afterEach(() => {
    cleanup();
  });

  describe('undo/redo', () => {
    it('Cmd+Z triggers undo', () => {
      const restore = stubMacUserAgent();
      try {
        useDiagramStore.getState().addNode({ x: 0, y: 0 });
        expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);

        fireKey('z', { metaKey: true });
        expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
      } finally {
        restore();
      }
    });

    it('Ctrl+Z triggers undo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      fireKey('z', { ctrlKey: true });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });

    it('Cmd+Shift+Z triggers redo', () => {
      const restore = stubMacUserAgent();
      try {
        useDiagramStore.getState().addNode({ x: 0, y: 0 });
        fireKey('z', { metaKey: true }); // undo
        expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);

        fireKey('z', { metaKey: true, shiftKey: true }); // redo
        expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      } finally {
        restore();
      }
    });

    it('Cmd+Y triggers redo', () => {
      const restore = stubMacUserAgent();
      try {
        useDiagramStore.getState().addNode({ x: 0, y: 0 });
        fireKey('z', { metaKey: true }); // undo
        expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
        fireKey('y', { metaKey: true }); // redo
        expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      } finally {
        restore();
      }
    });
  });

  describe('editing guard', () => {
    it('does not switch tools while typing in an input', () => {
      useUIStore.setState({ interactionMode: 'select' });
      const input = document.createElement('input');
      document.body.appendChild(input);

      fireKey('h', { target: input });

      expect(useUIStore.getState().interactionMode).toBe('select');
      input.remove();
    });
  });

  describe('tool shortcuts', () => {
    it('V switches to select mode', () => {
      useUIStore.setState({ interactionMode: 'pan' });
      fireKey('v');
      expect(useUIStore.getState().interactionMode).toBe('select');
    });

    it('H switches to pan mode', () => {
      fireKey('h');
      expect(useUIStore.getState().interactionMode).toBe('pan');
    });

    it('Space hold toggles to pan, release restores', () => {
      expect(useUIStore.getState().interactionMode).toBe('select');

      fireKey(' ');
      expect(useUIStore.getState().interactionMode).toBe('pan');

      fireKeyUp(' ');
      expect(useUIStore.getState().interactionMode).toBe('select');
    });

    it('Space restores pan mode if already panning', () => {
      useUIStore.setState({ interactionMode: 'pan' });

      fireKey(' ');
      expect(useUIStore.getState().interactionMode).toBe('pan');

      fireKeyUp(' ');
      expect(useUIStore.getState().interactionMode).toBe('pan');
    });
  });
});
