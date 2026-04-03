import { create } from 'zustand';
import { DEFAULT_EDGE_ROUTING_CONFIG, type EdgeRoutingConfig, type EdgeRoutingPolicy } from '../core/edge-routing';

interface EdgeRoutingState extends EdgeRoutingConfig {
  setEdgeCrossingPenalty: (value: number) => void;
  setEdgeNodeOverlapPenalty: (value: number) => void;
  setEdgeLengthSquared: (value: boolean) => void;
  setFlowAlignedBonus: (value: number) => void;
  setCrossingPolicy: (value: EdgeRoutingPolicy) => void;
  setMixedDirectionPenalty: (value: number) => void;
  resetDefaults: () => void;
  getConfig: () => EdgeRoutingConfig;
}

export const useEdgeRoutingStore = create<EdgeRoutingState>((set, get) => ({
  ...DEFAULT_EDGE_ROUTING_CONFIG,

  setEdgeCrossingPenalty: (edgeCrossingPenalty) => set({ edgeCrossingPenalty }),
  setEdgeNodeOverlapPenalty: (edgeNodeOverlapPenalty) => set({ edgeNodeOverlapPenalty }),
  setEdgeLengthSquared: (edgeLengthSquared) => set({ edgeLengthSquared }),
  setFlowAlignedBonus: (flowAlignedBonus) => set({ flowAlignedBonus }),
  setCrossingPolicy: (crossingPolicy) => set({ crossingPolicy }),
  setMixedDirectionPenalty: (mixedDirectionPenalty) => set({ mixedDirectionPenalty }),
  resetDefaults: () => set(DEFAULT_EDGE_ROUTING_CONFIG),
  getConfig: () => {
    const { edgeCrossingPenalty, edgeNodeOverlapPenalty, edgeLengthSquared, flowAlignedBonus, crossingPolicy, mixedDirectionPenalty } = get();
    return { edgeCrossingPenalty, edgeNodeOverlapPenalty, edgeLengthSquared, flowAlignedBonus, crossingPolicy, mixedDirectionPenalty };
  },
}));
