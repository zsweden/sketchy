import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRFNodeEdgeBuilder } from '../useRFNodeEdgeBuilder';
import { useDiagramStore } from '../../store/diagram-store';
import { useSettingsStore } from '../../store/settings-store';
import { useUIStore } from '../../store/ui-store';
import { getWebStorage } from '../../utils/web-storage';
import type { ConnectedSubgraph, NamedCausalLoop } from '../../core/graph/derived';

describe('useRFNodeEdgeBuilder', () => {
  beforeEach(() => {
    getWebStorage('localStorage')?.removeItem('sketchy-settings');

    useSettingsStore.setState({
      edgeRenderMode: 'legacy',
      theme: 'figma-dark',
      provider: 'openai',
      openaiApiKey: '',
      baseUrl: '',
      model: '',
      settingsOpen: false,
      availableModels: [],
      modelsLoading: false,
      modelsError: null,
    });

    useUIStore.setState({
      selectedEdgeIds: [],
      selectedNodeIds: [],
    });

    useDiagramStore.getState().setFramework('cld');
    useDiagramStore.setState((state) => ({
      ...state,
      diagram: {
        ...state.diagram,
        settings: {
          ...state.diagram.settings,
          edgeRoutingMode: 'fixed',
        },
        nodes: [
          {
            id: 'a',
            type: 'entity',
            position: { x: 0, y: 0 },
            data: { label: 'A', tags: [], junctionType: 'or' },
          },
          {
            id: 'b',
            type: 'entity',
            position: { x: 0, y: 140 },
            data: { label: 'B', tags: [], junctionType: 'or' },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'a',
            target: 'b',
            sourceSide: 'bottom',
            targetSide: 'top',
            polarity: 'positive',
          },
        ],
      },
    }));
  });

  it('keeps smoothstep rendering in legacy mode', () => {
    const { result } = renderHook(() => useRFNodeEdgeBuilder(null, null, new Map(), false));

    expect(result.current.rfEdges[0].type).toBeUndefined();
  });

  it('switches edges to the orthogonal renderer in new mode', () => {
    useSettingsStore.getState().setEdgeRenderMode('new');

    const { result } = renderHook(() => useRFNodeEdgeBuilder(null, null, new Map(), false));

    expect(result.current.rfEdges[0].type).toBe('orthogonal');
  });

  it('highlights only the selected node, keeps neighbors normal, and dims the rest', () => {
    useDiagramStore.setState((state) => ({
      ...state,
      diagram: {
        ...state.diagram,
        nodes: [
          {
            id: 'a',
            type: 'entity',
            position: { x: 0, y: 0 },
            data: { label: 'A', tags: [], junctionType: 'or' },
          },
          {
            id: 'b',
            type: 'entity',
            position: { x: 0, y: 140 },
            data: { label: 'B', tags: [], junctionType: 'or' },
          },
          {
            id: 'c',
            type: 'entity',
            position: { x: 0, y: 280 },
            data: { label: 'C', tags: [], junctionType: 'or' },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'a',
            target: 'b',
            sourceSide: 'bottom',
            targetSide: 'top',
            polarity: 'positive',
          },
        ],
      },
    }));
    useUIStore.setState({ selectedNodeIds: ['a'], selectedEdgeIds: [] });

    const highlightSets: ConnectedSubgraph = {
      nodeIds: new Set(['a', 'b']),
      edgeIds: new Set(['e1']),
    };

    const { result } = renderHook(() => useRFNodeEdgeBuilder(highlightSets, null, new Map(), false));

    expect(result.current.rfNodes.find((node) => node.id === 'a')?.data.highlightState).toBe('highlighted');
    expect(result.current.rfNodes.find((node) => node.id === 'b')?.data.highlightState).toBe('none');
    expect(result.current.rfNodes.find((node) => node.id === 'c')?.data.highlightState).toBe('dimmed');
  });

  it('highlights both endpoint nodes for an edge selection and dims the rest', () => {
    useDiagramStore.setState((state) => ({
      ...state,
      diagram: {
        ...state.diagram,
        nodes: [
          {
            id: 'a',
            type: 'entity',
            position: { x: 0, y: 0 },
            data: { label: 'A', tags: [], junctionType: 'or' },
          },
          {
            id: 'b',
            type: 'entity',
            position: { x: 0, y: 140 },
            data: { label: 'B', tags: [], junctionType: 'or' },
          },
          {
            id: 'c',
            type: 'entity',
            position: { x: 0, y: 280 },
            data: { label: 'C', tags: [], junctionType: 'or' },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'a',
            target: 'b',
            sourceSide: 'bottom',
            targetSide: 'top',
            polarity: 'positive',
          },
        ],
      },
    }));
    useUIStore.setState({ selectedNodeIds: [], selectedEdgeIds: ['e1'] });

    const highlightSets: ConnectedSubgraph = {
      nodeIds: new Set(['a', 'b']),
      edgeIds: new Set(['e1']),
    };

    const { result } = renderHook(() => useRFNodeEdgeBuilder(highlightSets, null, new Map(), false));

    expect(result.current.rfNodes.find((node) => node.id === 'a')?.data.highlightState).toBe('highlighted');
    expect(result.current.rfNodes.find((node) => node.id === 'b')?.data.highlightState).toBe('highlighted');
    expect(result.current.rfNodes.find((node) => node.id === 'c')?.data.highlightState).toBe('dimmed');
  });

  it('highlights loop nodes, dims other nodes, and preserves loop kind metadata', () => {
    useDiagramStore.setState((state) => ({
      ...state,
      diagram: {
        ...state.diagram,
        nodes: [
          {
            id: 'a',
            type: 'entity',
            position: { x: 0, y: 0 },
            data: { label: 'A', tags: [], junctionType: 'or' },
          },
          {
            id: 'b',
            type: 'entity',
            position: { x: 0, y: 140 },
            data: { label: 'B', tags: [], junctionType: 'or' },
          },
          {
            id: 'c',
            type: 'entity',
            position: { x: 0, y: 280 },
            data: { label: 'C', tags: [], junctionType: 'or' },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'a',
            target: 'b',
            sourceSide: 'bottom',
            targetSide: 'top',
            polarity: 'positive',
          },
          {
            id: 'e2',
            source: 'b',
            target: 'a',
            sourceSide: 'top',
            targetSide: 'bottom',
            polarity: 'positive',
          },
        ],
      },
    }));

    const highlightSets: ConnectedSubgraph = {
      nodeIds: new Set(['a', 'b']),
      edgeIds: new Set(['e1', 'e2']),
    };
    const selectedLoop: NamedCausalLoop = {
      id: 'a>b',
      nodeIds: ['a', 'b'],
      edgeIds: ['e1', 'e2'],
      kind: 'reinforcing',
      negativeEdgeCount: 0,
      delayedEdgeCount: 0,
      label: 'R1',
    };

    const { result } = renderHook(() => useRFNodeEdgeBuilder(highlightSets, selectedLoop, new Map(), false));

    expect(result.current.rfNodes.find((node) => node.id === 'a')?.data.highlightState).toBe('highlighted');
    expect(result.current.rfNodes.find((node) => node.id === 'a')?.data.loopKind).toBe('reinforcing');
    expect(result.current.rfNodes.find((node) => node.id === 'b')?.data.highlightState).toBe('highlighted');
    expect(result.current.rfNodes.find((node) => node.id === 'c')?.data.highlightState).toBe('dimmed');
  });
});
