import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiagramStore } from '../../../store/diagram-store';
import { useChatStore } from '../../../store/chat-store';
import type { Framework } from '../../../core/framework-types';

let mockConnectionState = {
  inProgress: false,
  fromHandle: null,
};

// Mock @xyflow/react — EntityNode uses Handle and Position
vi.mock('@xyflow/react', () => ({
  Handle: ({ children, id, className, onClick, title }: {
    children?: React.ReactNode;
    id?: string;
    className?: string;
    onClick?: () => void;
    title?: string;
  }) => (
    <div data-testid={id} className={className} onClick={onClick} title={title ?? ''}>
      {children}
    </div>
  ),
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
  useConnection: () => mockConnectionState,
}));

// Import after mocking
import EntityNodeRaw from '../EntityNode';
// memo wraps the component — unwrap for testing
const EntityNode = EntityNodeRaw;

const crtFramework: Framework = {
  id: 'crt',
  name: 'Current Reality Tree',
  description: 'CRT',
  defaultLayoutDirection: 'BT',
  supportsJunctions: true,
  nodeTags: [
    { id: 'ude', name: 'Undesirable Effect', shortName: 'UDE', color: '#E57373', description: '', exclusive: false },
  ],
  derivedIndicators: [
    { id: 'root-cause', name: 'Root Cause', shortName: 'Root', color: '#5C8DB5', condition: 'indegree-zero', description: '' },
    { id: 'intermediate', name: 'Intermediate', shortName: 'Inter', color: '#9E9E9E', condition: 'indegree-and-outdegree', description: '' },
  ],
};

const noJunctionFramework: Framework = {
  id: 'test',
  name: 'Test',
  description: '',
  defaultLayoutDirection: 'TB',
  supportsJunctions: false,
  nodeTags: [],
  derivedIndicators: [],
};

function resetStores() {
  mockConnectionState = {
    inProgress: false,
    fromHandle: null,
  };
  useDiagramStore.setState({
    framework: crtFramework,
  });
  useChatStore.setState({
    aiModifiedNodeIds: new Set(),
  });
}

function renderNode(overrides: {
  id?: string;
  label?: string;
  tags?: string[];
  junctionType?: 'and' | 'or';
  color?: string;
  textColor?: string;
  locked?: boolean;
  highlightState?: 'highlighted' | 'dimmed' | 'none';
  loopKind?: 'reinforcing' | 'balancing';
  selected?: boolean;
  degreesMap?: Map<string, { indegree: number; outdegree: number }>;
} = {}) {
  const id = overrides.id ?? 'n1';
  const data = {
    label: overrides.label ?? 'Test Node',
    tags: overrides.tags ?? [],
    junctionType: overrides.junctionType ?? 'or',
    color: overrides.color,
    textColor: overrides.textColor,
    locked: overrides.locked,
    highlightState: overrides.highlightState,
    loopKind: overrides.loopKind,
    degreesMap: overrides.degreesMap,
  };

  return render(
    <EntityNode
      id={id}
      data={data as never}
      type="entity"
      selected={overrides.selected ?? false}
      isConnectable={true}
      zIndex={0}
      positionAbsoluteX={0}
      positionAbsoluteY={0}
      dragging={false}
      dragHandle=""
      parentId=""
      sourcePosition={undefined}
      targetPosition={undefined}
      width={160}
      height={60}
      deletable
      selectable
    />,
  );
}

beforeEach(resetStores);

describe('EntityNode', () => {
  describe('label rendering', () => {
    it('displays the node label', () => {
      renderNode({ label: 'My Effect' });
      expect(screen.getByText('My Effect')).toBeInTheDocument();
    });

    it('shows placeholder when label is empty', () => {
      renderNode({ label: '' });
      expect(screen.getByText('Double-tap or double-click to edit')).toBeInTheDocument();
    });
  });

  describe('accent color', () => {
    it('renders accent bar with tag color when node has a tag', () => {
      renderNode({ tags: ['ude'] });
      const accent = document.querySelector('.entity-node-accent') as HTMLElement;
      expect(accent).not.toBeNull();
      expect(accent.style.backgroundColor).toBe('rgb(229, 115, 115)'); // #E57373
    });

    it('renders accent bar with derived indicator color when no tags', () => {
      // indegree=0 + outdegree>0 → root-cause derived indicator
      const degreesMap = new Map([['n1', { indegree: 0, outdegree: 1 }]]);
      renderNode({ degreesMap });
      const accent = document.querySelector('.entity-node-accent') as HTMLElement;
      expect(accent).not.toBeNull();
      expect(accent.style.backgroundColor).toBe('rgb(92, 141, 181)'); // #5C8DB5
    });

    it('does not render accent bar when no tags and no derived indicators', () => {
      // isolated node (indegree=0, outdegree=0) — no derived indicators match
      renderNode();
      const accent = document.querySelector('.entity-node-accent');
      expect(accent).toBeNull();
    });

    it('prefers tag color over derived indicator color', () => {
      const degreesMap = new Map([['n1', { indegree: 0, outdegree: 1 }]]);
      renderNode({ tags: ['ude'], degreesMap });
      const accent = document.querySelector('.entity-node-accent') as HTMLElement;
      expect(accent.style.backgroundColor).toBe('rgb(229, 115, 115)'); // UDE tag color, not root-cause
    });
  });

  describe('badges', () => {
    it('renders tag badges with correct text', () => {
      renderNode({ tags: ['ude'] });
      expect(screen.getByText('UDE')).toBeInTheDocument();
    });

    it('renders derived indicator badges', () => {
      const degreesMap = new Map([['n1', { indegree: 0, outdegree: 1 }]]);
      renderNode({ degreesMap });
      expect(screen.getByText('Root')).toBeInTheDocument();
    });

    it('renders both tag and derived badges together', () => {
      // indegree>0 and outdegree>0 → intermediate
      const degreesMap = new Map([['n1', { indegree: 1, outdegree: 1 }]]);
      renderNode({ tags: ['ude'], degreesMap });
      expect(screen.getByText('UDE')).toBeInTheDocument();
      expect(screen.getByText('Inter')).toBeInTheDocument();
    });

    it('does not render badge container when no tags and no derived', () => {
      renderNode();
      expect(document.querySelector('.entity-node-badges')).toBeNull();
    });
  });

  describe('highlight styling', () => {
    it('adds a highlight class when connected through a highlighted edge', () => {
      renderNode({ highlightState: 'highlighted' });
      expect(document.querySelector('.entity-node')).toHaveClass('highlighted');
    });

    it('adds loop focus classes for highlighted loop nodes', () => {
      renderNode({ highlightState: 'highlighted', loopKind: 'reinforcing' });
      expect(document.querySelector('.entity-node')).toHaveClass('highlighted', 'loop-focused', 'loop-reinforcing');
    });
  });

  describe('inline editing', () => {
    it('enters edit mode on double-click', async () => {
      renderNode({ label: 'Edit me' });
      const nodeEl = document.querySelector('.entity-node')!;
      fireEvent.doubleClick(nodeEl);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('enters edit mode on touch double-tap', () => {
      vi.useFakeTimers();
      renderNode({ label: 'Edit me' });
      const nodeEl = document.querySelector('.entity-node')!;

      fireEvent.pointerDown(nodeEl, { pointerType: 'touch', pointerId: 1, clientX: 120, clientY: 80 });
      fireEvent.pointerUp(nodeEl, { pointerType: 'touch', pointerId: 1, clientX: 120, clientY: 80 });
      vi.advanceTimersByTime(120);
      fireEvent.pointerDown(nodeEl, { pointerType: 'touch', pointerId: 1, clientX: 122, clientY: 82 });
      fireEvent.pointerUp(nodeEl, { pointerType: 'touch', pointerId: 1, clientX: 122, clientY: 82 });

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      vi.useRealTimers();
    });

    it('textarea has current label text', () => {
      renderNode({ label: 'Hello' });
      fireEvent.doubleClick(document.querySelector('.entity-node')!);
      expect(screen.getByRole('textbox')).toHaveValue('Hello');
    });

    it('commits text on blur', async () => {
      const commitNodeText = vi.fn();
      useDiagramStore.setState({ commitNodeText });

      renderNode({ label: 'Old' });
      fireEvent.doubleClick(document.querySelector('.entity-node')!);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'New' } });
      fireEvent.blur(textarea);

      expect(commitNodeText).toHaveBeenCalledWith('n1', 'New');
    });

    it('does not commit if text unchanged', () => {
      const commitNodeText = vi.fn();
      useDiagramStore.setState({ commitNodeText });

      renderNode({ label: 'Same' });
      fireEvent.doubleClick(document.querySelector('.entity-node')!);
      fireEvent.blur(screen.getByRole('textbox'));

      expect(commitNodeText).not.toHaveBeenCalled();
    });

    it('commits on Enter key', () => {
      const commitNodeText = vi.fn();
      useDiagramStore.setState({ commitNodeText });

      renderNode({ label: 'Before' });
      fireEvent.doubleClick(document.querySelector('.entity-node')!);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'After' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      // Enter triggers blur, which commits
      expect(commitNodeText).toHaveBeenCalledWith('n1', 'After');
    });
  });

  describe('junction indicators', () => {
    it('shows junction handle class when indegree >= 2 and framework supports junctions', () => {
      const degreesMap = new Map([['n1', { indegree: 2, outdegree: 0 }]]);
      renderNode({ degreesMap });
      const handle = screen.getByTestId('target-top');
      expect(handle.className).toContain('junction-handle');
    });

    it('does not show junction handle when indegree < 2', () => {
      const degreesMap = new Map([['n1', { indegree: 1, outdegree: 0 }]]);
      renderNode({ degreesMap });
      const handle = screen.getByTestId('target-top');
      expect(handle.className).not.toContain('junction-handle');
    });

    it('does not show junction handle when framework does not support junctions', () => {
      useDiagramStore.setState({ framework: noJunctionFramework });
      const degreesMap = new Map([['n1', { indegree: 2, outdegree: 0 }]]);
      renderNode({ degreesMap });
      const handle = screen.getByTestId('target-top');
      expect(handle.className).not.toContain('junction-handle');
    });

    it('shows & symbol on top handle for AND junction', () => {
      const degreesMap = new Map([['n1', { indegree: 2, outdegree: 0 }]]);
      renderNode({ junctionType: 'and', degreesMap });
      expect(screen.getByText('&')).toBeInTheDocument();
    });

    it('does not show & symbol for OR junction', () => {
      const degreesMap = new Map([['n1', { indegree: 2, outdegree: 0 }]]);
      renderNode({ junctionType: 'or', degreesMap });
      expect(screen.queryByText('&')).toBeNull();
    });

    it('toggles junction type on handle click', () => {
      const updateNodeJunction = vi.fn();
      useDiagramStore.setState({ updateNodeJunction });

      const degreesMap = new Map([['n1', { indegree: 2, outdegree: 0 }]]);
      renderNode({ junctionType: 'or', degreesMap });

      fireEvent.click(screen.getByTestId('target-top'));
      expect(updateNodeJunction).toHaveBeenCalledWith('n1', 'and');
    });
  });

  describe('visual states', () => {
    it('adds selected class when selected', () => {
      renderNode({ selected: true });
      expect(document.querySelector('.entity-node.selected')).not.toBeNull();
    });

    it('adds dimmed class when highlightState is dimmed', () => {
      renderNode({ highlightState: 'dimmed' });
      expect(document.querySelector('.entity-node.dimmed')).not.toBeNull();
    });

    it('adds loop-focused class when highlighted with loopKind', () => {
      renderNode({ highlightState: 'highlighted', loopKind: 'reinforcing' });
      const el = document.querySelector('.entity-node')!;
      expect(el.className).toContain('loop-focused');
      expect(el.className).toContain('loop-reinforcing');
    });

    it('does not add loop class when highlighted without loopKind', () => {
      renderNode({ highlightState: 'highlighted' });
      expect(document.querySelector('.loop-focused')).toBeNull();
    });

    it('applies custom background color', () => {
      renderNode({ color: '#ff0000' });
      const el = document.querySelector('.entity-node') as HTMLElement;
      expect(el.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('applies custom text color to label', () => {
      renderNode({ textColor: '#00ff00', label: 'Colored' });
      const label = document.querySelector('.entity-node-label') as HTMLElement;
      expect(label.style.color).toBe('rgb(0, 255, 0)');
    });
  });

  describe('indicators', () => {
    it('shows lock icon when node is locked', () => {
      renderNode({ locked: true });
      expect(document.querySelector('.node-lock-indicator')).not.toBeNull();
    });

    it('does not show lock icon when node is unlocked', () => {
      renderNode({ locked: false });
      expect(document.querySelector('.node-lock-indicator')).toBeNull();
    });

    it('shows AI modified dot when node is in aiModifiedNodeIds', () => {
      useChatStore.setState({ aiModifiedNodeIds: new Set(['n1']) });
      renderNode();
      expect(document.querySelector('.ai-modified-dot')).not.toBeNull();
    });

    it('does not show AI modified dot for unmodified node', () => {
      renderNode();
      expect(document.querySelector('.ai-modified-dot')).toBeNull();
    });
  });

  describe('handles', () => {
    it('renders 12 target handles and 12 source handles', () => {
      renderNode();
      for (const side of [
        'top',
        'right',
        'bottom',
        'left',
        'topleft-top',
        'topleft-left',
        'topright-top',
        'topright-right',
        'bottomright-right',
        'bottomright-bottom',
        'bottomleft-bottom',
        'bottomleft-left',
      ]) {
        expect(screen.getByTestId(`target-${side}`)).toBeInTheDocument();
        expect(screen.getByTestId(`source-${side}`)).toBeInTheDocument();
      }
    });

    it('reveals handles when the pointer moves near the node', () => {
      renderNode();
      const nodeEl = document.querySelector('.entity-node') as HTMLDivElement;
      const rect = {
        x: 100,
        y: 100,
        left: 100,
        top: 100,
        right: 260,
        bottom: 160,
        width: 160,
        height: 60,
        toJSON: () => ({}),
      };
      vi.spyOn(nodeEl, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

      expect(nodeEl.className).not.toContain('handles-visible');

      fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: 80, clientY: 80 });
      expect(nodeEl.className).toContain('handles-visible');

      fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: 20, clientY: 20 });
      expect(nodeEl.className).not.toContain('handles-visible');
    });

    it('hides overlapping source handles on non-source nodes while connecting', () => {
      mockConnectionState = {
        inProgress: true,
        fromHandle: { nodeId: 'other-node' },
      };

      renderNode();

      expect(screen.getByTestId('source-top').className).toContain('handle-source');
      expect(screen.getByTestId('target-top').className).toContain('handle-target');
      expect(document.querySelector('.entity-node')?.className).toContain('connection-in-progress');
      expect(document.querySelector('.entity-node')?.className).not.toContain('connection-source-node');
    });
  });
});
