# TODO

## Features

### [x] Enable annotation layer on diagram
Shipped. Decorative shapes (text, rectangle, ellipse, line) added via toolbar, stored as a separate `Diagram.annotations` array so graph reasoning (validation, layout, edge routing, AI context) is untouched. Render below entity nodes, share drag/undo with the node layer.

### [ ] Enable multiple node edit

## Bugs

### [x] Edge misalignment after layout/load
Resolved. Edges now stay aligned with node handle anchor points after auto-layout, file load, framework switch, and new diagram creation.

**Resolution:**
- Preserve React Flow runtime node measurement state during store -> canvas sync instead of rebuilding nodes without `measured`/`width`/`height`
- Refresh node internals using the latest node ids after bulk updates so RF remeasures the correct handles
- Remove active attachment rendering/timing logic and center the visible handle marker on React Flow's true anchor point

**Reproduction:**
1. Load `4BoxLayout.json` (or any saved diagram)
2. Edges may appear offset from their anchor points
3. Click the background — edges snap to correct positions
4. Same issue occurs after hitting the auto-layout button

**What we know:**
- React Flow caches handle positions internally in `NodeHandleBounds`
- After bulk node repositioning, RF may render edges before remeasuring handle DOM positions
- `clearCanvasSelection` fixes it by creating new node/edge object references, forcing RF to re-render
- The `useUpdateNodeInternals` API (RF's built-in handle remeasurement) with double rAF does not reliably fix it
- Single rAF edge reference cloning also does not reliably fix it
- The issue is timing-dependent — sometimes the deferred refresh fires before RF has completed its internal measurement cycle

**Attempted fixes (did not work consistently):**
1. Single `requestAnimationFrame` to clone edge references after `rfNodes` change
2. Targeted `edgeRefreshTrigger` (counter in ui-store) with single rAF edge clone — only fires from layout/load/switch, not every node change
3. `useUpdateNodeInternals(nodeIds)` with double rAF — RF's built-in API to force handle remeasurement

**Files involved:**
- `src/components/canvas/DiagramCanvas.tsx` — dual-state sync (store → localNodes/localEdges → RF)
- `src/hooks/useRFNodeEdgeBuilder.ts` — computes rfNodes/rfEdges with handle IDs
- `src/store/diagram-store-diagram-actions.ts` — runAutoLayout, loadDiagram, setFramework, newDiagram
- `src/store/ui-store.ts` — edgeRefreshTrigger
- `src/hooks/useCanvasHandlers.ts` — clearCanvasSelection (the manual workaround)
- `src/store/diagram-edge-routing.ts` — getNodeBoxes uses DEFAULT_NODE_WIDTH/HEIGHT (160x60) for edge routing

**Key observation:**
The edge routing geometry (`getNodeBoxes`) uses constant `DEFAULT_NODE_WIDTH=160` / `DEFAULT_NODE_HEIGHT=60`, while React Flow measures actual DOM dimensions. If actual rendered node sizes differ from these constants, edge handle placements will be computed incorrectly. This discrepancy would explain why clicking the background (which forces RF to use its own measured positions) fixes the alignment.
