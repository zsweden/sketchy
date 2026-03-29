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

function fireKey(key: string, opts: Partial<KeyboardEvent> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
  (opts.target ?? document).dispatchEvent(event);
}

function fireKeyUp(key: string, target: EventTarget = document) {
  const event = new KeyboardEvent('keyup', { key, bubbles: true });
  target.dispatchEvent(event);
}

describe('keyboard shortcuts', () => {
  let cleanup: () => void;

  beforeEach(() => {
    useDiagramStore.getState().newDiagram();
    useUIStore.setState({ interactionMode: 'select' });
    cleanup = render(createElement(Harness)).unmount;
  });

  afterEach(() => {
    cleanup();
  });

  describe('undo/redo', () => {
    it('Cmd+Z triggers undo', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);

      fireKey('z', { metaKey: true });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });

    it('Ctrl+Z triggers undo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      fireKey('z', { ctrlKey: true });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });

    it('Cmd+Shift+Z triggers redo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      fireKey('z', { metaKey: true }); // undo
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);

      fireKey('z', { metaKey: true, shiftKey: true }); // redo
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
    });

    it('Cmd+Y triggers redo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      fireKey('z', { metaKey: true }); // undo
      fireKey('y', { metaKey: true }); // redo
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
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
